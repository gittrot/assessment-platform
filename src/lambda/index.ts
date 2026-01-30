/**
 * Lambda function entry points
 * Routes requests to appropriate handlers
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as assessments from './handlers/assessments';
import * as sessions from './handlers/sessions';
import * as dashboard from './handlers/dashboard';
import * as admin from './handlers/admin';

/**
 * Main router function
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { httpMethod, resource, pathParameters } = event;
  const path = resource || event.path;

  try {
    // Route to appropriate handler
    if (path.includes('/assessments')) {
      if (httpMethod === 'POST') {
        return await assessments.createAssessment(event);
      } else if (httpMethod === 'GET' && pathParameters?.assessmentId) {
        return await assessments.getAssessment(event);
      } else if (httpMethod === 'GET') {
        return await assessments.listAssessments(event);
      }
    } else if (path.includes('/sessions/start')) {
      return await sessions.startSession(event);
    } else if (path.includes('/sessions') && pathParameters?.sessionId) {
      if (path.includes('/next-question')) {
        return await sessions.getNextQuestion(event);
      } else if (path.includes('/answer')) {
        return await sessions.submitAnswer(event);
      } else if (path.includes('/submit')) {
        return await sessions.submitSession(event);
      } else if (httpMethod === 'GET') {
        return await sessions.getSession(event);
      }
    } else if (path.includes('/dashboard')) {
      if (path.includes('/candidates/')) {
        return await dashboard.getCandidateDrillDown(event);
      } else if (httpMethod === 'GET') {
        return await dashboard.getDashboard(event);
      }
    } else if (path.includes('/admin')) {
      if (path.includes('/tenants')) {
        return await admin.createTenant(event);
      } else if (path.includes('/admins')) {
        return await admin.createAdmin(event);
      }
    }

    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Not found' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred'
        }
      })
    };
  }
}

// Export individual handlers for direct invocation
export { createAssessment, getAssessment, listAssessments } from './handlers/assessments';
export { startSession, getNextQuestion, submitAnswer, submitSession, getSession } from './handlers/sessions';
export { getDashboard, getCandidateDrillDown } from './handlers/dashboard';
export { createTenant, createAdmin } from './handlers/admin';
