/**
 * Lambda handler for authentication
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand
} from '@aws-sdk/client-cognito-identity-provider';
import {
  ValidationError,
  AuthenticationError,
  formatErrorResponse
} from '../../shared/errors';
import { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID } from '../../shared/constants';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Login endpoint
 * POST /auth/login
 */
export async function login(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { email, password } = body;

    if (!email || !password) {
      throw new ValidationError('Email and password required');
    }

    // Try USER_PASSWORD_AUTH first (works for most users)
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: COGNITO_CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      });

      const response = await cognitoClient.send(command);
      
      // Handle NEW_PASSWORD_REQUIRED challenge (for users with FORCE_CHANGE_PASSWORD status)
      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        // For now, use the same password as the new password (user should change it later)
        // In production, you might want to require a new password in the request
        const challengeResponse = new RespondToAuthChallengeCommand({
          ClientId: COGNITO_CLIENT_ID,
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          Session: response.Session,
          ChallengeResponses: {
            USERNAME: email,
            NEW_PASSWORD: password
          }
        });
        
        const challengeResult = await cognitoClient.send(challengeResponse);
        
        if (challengeResult.AuthenticationResult?.AccessToken) {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
              'Access-Control-Max-Age': '3600'
            },
            body: JSON.stringify({
              accessToken: challengeResult.AuthenticationResult.AccessToken,
              idToken: challengeResult.AuthenticationResult.IdToken,
              refreshToken: challengeResult.AuthenticationResult.RefreshToken
            })
          };
        }
      }
      
      // Normal successful authentication
      if (response.AuthenticationResult?.AccessToken) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
            'Access-Control-Max-Age': '3600'
          },
          body: JSON.stringify({
            accessToken: response.AuthenticationResult.AccessToken,
            idToken: response.AuthenticationResult.IdToken,
            refreshToken: response.AuthenticationResult.RefreshToken
          })
        };
      }
    } catch (error: any) {
      console.log('USER_PASSWORD_AUTH failed, trying admin auth:', error?.name || error?.message || 'Unknown error');
      // Fall through to admin auth
    }

    // Fallback: Use ADMIN_NO_SRP_AUTH (works for all users, including FORCE_CHANGE_PASSWORD)
    // This requires the Lambda to have admin permissions (which it does)
    try {
      const adminCommand = new AdminInitiateAuthCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        ClientId: COGNITO_CLIENT_ID,
        AuthFlow: 'ADMIN_NO_SRP_AUTH',
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password
        }
      });

      const adminResponse = await cognitoClient.send(adminCommand);
      
      if (adminResponse.AuthenticationResult?.AccessToken) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
            'Access-Control-Max-Age': '3600'
          },
          body: JSON.stringify({
            accessToken: adminResponse.AuthenticationResult.AccessToken,
            idToken: adminResponse.AuthenticationResult.IdToken,
            refreshToken: adminResponse.AuthenticationResult.RefreshToken
          })
        };
      }
    } catch (adminError: any) {
      console.error('Admin auth also failed:', adminError?.name || adminError?.message || 'Unknown error');
      // Provide more specific error messages
      const errorCode = adminError?.name || '';
      let errorMessage = 'Invalid credentials';
      
      if (errorCode === 'NotAuthorizedException') {
        errorMessage = 'Invalid email or password';
      } else if (errorCode === 'UserNotFoundException') {
        errorMessage = 'User not found';
      } else if (errorCode === 'UserNotConfirmedException') {
        errorMessage = 'User account is not confirmed';
      } else if (errorCode === 'InvalidParameterException' && adminError?.message?.includes('Auth flow not enabled')) {
        errorMessage = 'Authentication configuration error. Please contact support.';
      } else if (adminError?.message) {
        errorMessage = adminError.message;
      }
      
      throw new AuthenticationError(errorMessage);
    }

    throw new AuthenticationError('Invalid credentials');
  } catch (error) {
    const errorResponse = formatErrorResponse(error);
    // Add CORS headers to error response
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: errorResponse.body
    };
  }
}
