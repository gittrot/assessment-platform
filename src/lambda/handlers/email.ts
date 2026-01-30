/**
 * Lambda handler for sending assessment invitation emails
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import {
  ValidationError,
  AuthenticationError,
  formatErrorResponse
} from '../../shared/errors';
import { getUserFromToken, hasRole, getTenantId } from '../../shared/auth';
import { UserRole } from '../../shared/types';
import { getItem } from '../../shared/dynamodb';
import { TABLES } from '../../shared/constants';
import { Assessment } from '../../shared/types';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Helper function to find assessment by ID
// For authenticated users, try their tenantId first, then fallback to scanning for admins
async function findAssessmentById(assessmentId: string, userTenantId?: string | null): Promise<Assessment | null> {
  // If we have a tenantId, try to get the assessment directly
  if (userTenantId) {
    const assessment = await getItem<Assessment>(TABLES.ASSESSMENTS, userTenantId, assessmentId);
    if (assessment) {
      return assessment;
    }
  }
  
  // For admins or cross-tenant access, we need to scan
  // Note: This is inefficient but necessary for admin users accessing any tenant's assessments
  // In production, consider adding a GSI on assessmentId or including tenantId in the URL
  const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
  const docClient = DynamoDBDocumentClient.from(client);
  
  const command = new ScanCommand({
    TableName: TABLES.ASSESSMENTS,
    FilterExpression: 'assessmentId = :assessmentId',
    ExpressionAttributeValues: {
      ':assessmentId': assessmentId
    }
  });
  
  const response = await docClient.send(command);
  return (response.Items?.[0] as Assessment) || null;
}

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@example.com';

/**
 * Send assessment invitation email
 * POST /assessments/{assessmentId}/send-email
 */
export async function sendAssessmentEmail(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Authentication
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError();
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(accessToken);

    if (!hasRole(user, UserRole.TENANT) && !hasRole(user, UserRole.ADMIN)) {
      throw new AuthenticationError('Only tenants and admins can send assessment emails');
    }

    // Get assessment ID from path
    const assessmentId = event.pathParameters?.assessmentId;
    if (!assessmentId) {
      throw new ValidationError('Assessment ID required');
    }

    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { candidateEmail, candidateName, customMessage } = body;

    if (!candidateEmail) {
      throw new ValidationError('Candidate email required');
    }

    // Get tenantId from user (for tenant users) or null for admins
    const userTenantId = getTenantId(user);
    
    // Get assessment details
    const assessment = await findAssessmentById(assessmentId, userTenantId);
    if (!assessment) {
      throw new ValidationError('Assessment not found');
    }

    if (!assessment.isActive) {
      throw new ValidationError('Cannot send email for inactive assessment');
    }

    // Create user-friendly assessment start page link
    // Use frontend URL (hiring.trotlabs.com) - frontend will redirect to API Gateway
    const frontendUrl = process.env.FRONTEND_URL || 'https://hiring.trotlabs.com';
    const tenantIdParam = assessment.tenantId ? `&tenantId=${encodeURIComponent(assessment.tenantId)}` : '';
    const startAssessmentLink = `${frontendUrl}/assessments/${assessmentId}/start?email=${encodeURIComponent(candidateEmail)}&name=${encodeURIComponent(candidateName || candidateEmail.split('@')[0])}${tenantIdParam}`;
    
    // Email content
    const candidateDisplayName = candidateName || candidateEmail.split('@')[0];
    const emailSubject = `Assessment Invitation: ${assessment.title}`;
    
    const emailBody = `
Hello ${candidateDisplayName},

${customMessage || `You have been invited to take an assessment: ${assessment.title}`}

Assessment Details:
- Title: ${assessment.title}
${assessment.description ? `- Description: ${assessment.description}` : ''}
- Role: ${assessment.targetRole.name} (${assessment.targetRole.seniorityLevel})
${assessment.durationMinutes ? `- Duration: ${assessment.durationMinutes} minutes` : ''}

Click the link below to start your assessment:

${startAssessmentLink}

This link will take you to a page where you can begin the assessment. Your email and name are pre-filled for convenience.

Good luck!

Best regards,
Adaptive Assessment Platform
    `.trim();

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #667eea; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .assessment-details { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .code-block { background: #f5f5f5; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 12px; margin: 15px 0; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Assessment Invitation</h1>
    </div>
    <div class="content">
      <p>Hello ${candidateDisplayName},</p>
      
      <p>${customMessage || `You have been invited to take an assessment: <strong>${assessment.title}</strong>`}</p>
      
      <div class="assessment-details">
        <h3>Assessment Details</h3>
        <p><strong>Title:</strong> ${assessment.title}</p>
        ${assessment.description ? `<p><strong>Description:</strong> ${assessment.description}</p>` : ''}
        <p><strong>Role:</strong> ${assessment.targetRole.name} (${assessment.targetRole.seniorityLevel})</p>
        ${assessment.durationMinutes ? `<p><strong>Duration:</strong> ${assessment.durationMinutes} minutes</p>` : ''}
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${startAssessmentLink}" class="button" style="font-size: 18px; padding: 16px 32px;">
          🚀 Start Assessment
        </a>
      </div>
      
      <p style="text-align: center; margin: 20px 0;">
        <a href="${startAssessmentLink}" style="color: #667eea; word-break: break-all; text-decoration: none;">
          ${startAssessmentLink}
        </a>
      </p>
      
      <p style="text-align: center; font-size: 14px; color: #666; margin-top: 20px;">
        Click the button above or copy the link to start your assessment. Your information is pre-filled for convenience.
      </p>
      
      <p style="margin-top: 30px;">Good luck!</p>
      
      <p>Best regards,<br>Adaptive Assessment Platform</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    // Send email via SES
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [candidateEmail]
      },
      Message: {
        Subject: {
          Data: emailSubject,
          Charset: 'UTF-8'
        },
        Body: {
          Text: {
            Data: emailBody,
            Charset: 'UTF-8'
          },
          Html: {
            Data: emailHtml,
            Charset: 'UTF-8'
          }
        }
      }
    });

    try {
      const response = await sesClient.send(command);
      
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
          message: 'Email sent successfully',
          messageId: response.MessageId
        })
      };
    } catch (sesError: any) {
      console.error('SES error:', sesError);
      throw new ValidationError(`Failed to send email: ${sesError.message || 'Unknown error'}`);
    }
  } catch (error) {
    const errorResponse = formatErrorResponse(error);
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
