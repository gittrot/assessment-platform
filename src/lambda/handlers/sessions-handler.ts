/**
 * Lambda handler entry point for sessions
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { startSession, getNextQuestion, submitAnswer, submitSession, getSession } from './sessions';

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const { httpMethod, pathParameters, resource } = event;
  const path = resource || event.path;

  try {
    if (path.includes('/start') && httpMethod === 'POST') {
      return await startSession(event);
    } else if (path.includes('/next-question') && httpMethod === 'GET') {
      return await getNextQuestion(event);
    } else if (path.includes('/answer') && httpMethod === 'POST') {
      return await submitAnswer(event);
    } else if (path.includes('/submit') && httpMethod === 'POST') {
      return await submitSession(event);
    } else if (httpMethod === 'GET' && pathParameters?.sessionId) {
      return await getSession(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Not found' })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'An unexpected error occurred'
        }
      })
    };
  }
}
