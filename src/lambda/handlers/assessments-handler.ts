/**
 * Lambda handler entry point for assessments
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { createAssessment, getAssessment, listAssessments } from './assessments';
import { getAssessmentStartPage } from './assessment-start-page';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
  'Access-Control-Max-Age': '3600'
};

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { httpMethod, pathParameters, resource } = event;
  const path = resource || event.path;

  // Handle OPTIONS request for CORS preflight
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    if (httpMethod === 'POST') {
      return await createAssessment(event);
    } else if (httpMethod === 'GET' && pathParameters?.assessmentId) {
      // Check if this is the start page route
      if (path.includes('/start')) {
        return await getAssessmentStartPage(event);
      }
      return await getAssessment(event);
    } else if (httpMethod === 'GET') {
      return await listAssessments(event);
    }

    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({ error: 'Not found' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
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
