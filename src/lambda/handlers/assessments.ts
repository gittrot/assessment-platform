/**
 * Lambda handler for assessment management endpoints
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
  Assessment,
  KnowledgeAreaConfig,
  TargetRole,
  DifficultyLevel,
  UserRole
} from '../../shared/types';
import { getUserFromToken, hasRole, getTenantId, belongsToTenant } from '../../shared/auth';
import { putItem, getItem, queryByPartitionKey, scanTable } from '../../shared/dynamodb';
import {
  AuthenticationError,
  AuthorizationError,
  TenantIsolationError,
  ValidationError,
  formatErrorResponse
} from '../../shared/errors';
import { TABLES, DEFAULT_QUESTIONS_PER_ASSESSMENT } from '../../shared/constants';
import { generateQuestionsForAssessment } from '../../ai/question-generator';

/**
 * Create a new assessment
 * POST /assessments
 */
export async function createAssessment(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    console.log('createAssessment called', {
      httpMethod: event.httpMethod,
      path: event.path,
      hasBody: !!event.body,
      bodyLength: event.body?.length,
      headers: Object.keys(event.headers || {})
    });
    
    // Authentication
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      console.warn('No authorization header found');
      throw new AuthenticationError();
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(accessToken);

    if (!hasRole(user, UserRole.TENANT) && !hasRole(user, UserRole.ADMIN)) {
      throw new AuthorizationError('Only tenants and admins can create assessments');
    }

    const tenantId = getTenantId(user);
    if (!tenantId && !hasRole(user, UserRole.ADMIN)) {
      throw new ValidationError('Tenant ID required');
    }

    // Parse request body
    let body: any;
    try {
      body = JSON.parse(event.body || '{}');
    } catch (parseError) {
      throw new ValidationError('Invalid JSON in request body');
    }
    const {
      title,
      description,
      targetRole,
      knowledgeAreaMix,
      initialDifficulty = 3,
      durationMinutes,
      maxQuestions = 10
    } = body;

    // Validation
    if (!title || !targetRole || !knowledgeAreaMix) {
      throw new ValidationError('Missing required fields: title, targetRole, knowledgeAreaMix');
    }

    if (!Array.isArray(knowledgeAreaMix) || knowledgeAreaMix.length === 0) {
      throw new ValidationError('knowledgeAreaMix must be a non-empty array');
    }

    // Validate maxQuestions
    if (maxQuestions !== undefined && (typeof maxQuestions !== 'number' || maxQuestions < 1 || maxQuestions > 50)) {
      throw new ValidationError('maxQuestions must be a number between 1 and 50');
    }

    // Validate knowledge area mix percentages sum to 100
    const totalPercentage = knowledgeAreaMix.reduce(
      (sum: number, config: KnowledgeAreaConfig) => sum + config.percentage,
      0
    );
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new ValidationError('Knowledge area percentages must sum to 100');
    }

    // Create assessment
    const assessmentId = uuidv4();
    const now = new Date().toISOString();

    // Ensure tenantId is never empty (DynamoDB doesn't allow empty strings for key attributes)
    // For admins without tenantId, use a default tenant or require it in the request
    const finalTenantId = tenantId || body.tenantId || (hasRole(user, UserRole.ADMIN) ? 'admin-default' : null);
    if (!finalTenantId || finalTenantId.trim() === '') {
      throw new ValidationError('Tenant ID is required and cannot be empty');
    }

    const assessment: Assessment = {
      assessmentId,
      tenantId: finalTenantId,
      title,
      description,
      targetRole: targetRole as TargetRole,
      knowledgeAreaMix: knowledgeAreaMix as KnowledgeAreaConfig[],
      initialDifficulty: initialDifficulty as DifficultyLevel,
      durationMinutes,
      maxQuestions: Math.max(1, Math.min(50, maxQuestions)), // Clamp between 1-50
      createdAt: now,
      updatedAt: now,
      createdBy: user.sub,
      isActive: true
    };

    // Save assessment - explicitly construct to ensure tenantId is first
    const assessmentItem = {
      tenantId: finalTenantId.trim(), // Set tenantId FIRST (partition key)
      assessmentId: assessment.assessmentId, // Set assessmentId SECOND (sort key)
      title: assessment.title,
      description: assessment.description,
      targetRole: assessment.targetRole,
      knowledgeAreaMix: assessment.knowledgeAreaMix,
      initialDifficulty: assessment.initialDifficulty,
      durationMinutes: assessment.durationMinutes,
      maxQuestions: assessment.maxQuestions,
      createdAt: assessment.createdAt,
      updatedAt: assessment.updatedAt,
      createdBy: assessment.createdBy,
      isActive: assessment.isActive
    };
    
    await putItem(TABLES.ASSESSMENTS, assessmentItem);

    // Generate initial question set asynchronously (don't wait - API Gateway has 30s timeout)
    // Questions will be generated in the background to avoid timeout
    const questionsPerArea = calculateQuestionsPerArea(
      knowledgeAreaMix,
      DEFAULT_QUESTIONS_PER_ASSESSMENT
    );

    // Fire and forget - generate questions asynchronously
    // This prevents API Gateway timeout (30s limit) while still generating questions
    generateQuestionsForAssessment(assessment, questionsPerArea)
      .then(async (questions) => {
        if (!questions || !Array.isArray(questions)) {
          console.error(`Invalid questions array for assessment ${assessment.assessmentId}:`, questions);
          return;
        }
        
        console.log(`Generated ${questions.length} questions for assessment ${assessment.assessmentId}`);
        
        if (questions.length === 0) {
          console.warn(`No questions generated for assessment ${assessment.assessmentId}`);
          return;
        }
        
        // Save questions
        for (const question of questions) {
          // Validate question object exists
          if (!question || typeof question !== 'object') {
            console.error('Skipping invalid question object:', question);
            continue;
          }

          // Validate required fields
          if (!question.questionId || !question.questionText) {
            console.error('Skipping question with missing required fields:', {
              hasQuestionId: !!question.questionId,
              hasQuestionText: !!question.questionText,
              question: question
            });
            continue;
          }

          // Validate tenantId before saving
          const questionTenantId = question.tenantId || assessment.tenantId;
          if (!questionTenantId || questionTenantId.trim() === '') {
            console.error('Cannot save question: tenantId is empty', {
              questionId: question.questionId,
              assessmentId: assessment.assessmentId,
              assessmentTenantId: assessment.tenantId,
              questionTenantId: question.tenantId
            });
            continue; // Skip this question
          }
          
          // Explicitly construct the question item to ensure tenantId is first
          const questionItem: any = {
            tenantId: questionTenantId.trim(), // Set tenantId FIRST
            questionId: `${assessment.assessmentId}#${question.questionId}`,
            assessmentId: question.assessmentId,
            questionText: question.questionText,
            questionType: question.questionType,
            knowledgeArea: question.knowledgeArea,
            difficulty: question.difficulty,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation,
            createdAt: question.createdAt
          };
          
          // Add optional fields
          if (question.options) {
            questionItem.options = question.options;
          }
          if (question.metadata) {
            questionItem.metadata = question.metadata;
          }
          
          try {
            await putItem(TABLES.QUESTIONS, questionItem);
          } catch (err) {
            console.error(`Failed to save question ${question.questionId}:`, err);
          }
        }
        console.log(`Successfully saved all questions for assessment ${assessment.assessmentId}`);
      })
      .catch((error) => {
        console.error('Error generating questions (async):', error);
        // Questions can be generated later or on-demand
      });

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: JSON.stringify({ assessment })
    };
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

/**
 * Get assessment by ID
 * GET /assessments/{assessmentId}
 */
export async function getAssessment(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError();
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(accessToken);

    if (!hasRole(user, UserRole.TENANT) && !hasRole(user, UserRole.ADMIN)) {
      throw new AuthorizationError();
    }

    const assessmentId = event.pathParameters?.assessmentId;
    if (!assessmentId) {
      throw new ValidationError('Assessment ID required');
    }

    const tenantId = getTenantId(user);
    if (!tenantId && !hasRole(user, UserRole.ADMIN)) {
      throw new ValidationError('Tenant ID required');
    }

    let requestedTenantId = event.queryStringParameters?.tenantId || tenantId;
    if (!requestedTenantId && !hasRole(user, UserRole.ADMIN)) {
      throw new ValidationError('Tenant ID required');
    }

    if (requestedTenantId && !hasRole(user, UserRole.ADMIN) && !belongsToTenant(user, requestedTenantId)) {
      throw new TenantIsolationError();
    }

    let assessment: Assessment | null;
    if (requestedTenantId) {
      assessment = await getItem<Assessment>(TABLES.ASSESSMENTS, requestedTenantId, assessmentId);
    } else {
      const items = await scanTable<Assessment>(TABLES.ASSESSMENTS, {
        expression: 'assessmentId = :aid',
        values: { ':aid': assessmentId }
      });
      assessment = items[0] || null;
    }

    if (!assessment) {
      throw new ValidationError('Assessment not found');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: JSON.stringify({ assessment })
    };
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

/**
 * List assessments for a tenant
 * GET /assessments
 */
export async function listAssessments(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError();
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(accessToken);

    if (!hasRole(user, UserRole.TENANT) && !hasRole(user, UserRole.ADMIN)) {
      throw new AuthorizationError();
    }

    const tenantId = getTenantId(user);
    let requestedTenantId = event.queryStringParameters?.tenantId || tenantId;

    if (!requestedTenantId && !hasRole(user, UserRole.ADMIN)) {
      throw new ValidationError('Tenant ID required');
    }

    if (requestedTenantId && !hasRole(user, UserRole.ADMIN) && !belongsToTenant(user, requestedTenantId)) {
      throw new TenantIsolationError();
    }

    let assessments: Assessment[];
    if (requestedTenantId) {
      assessments = await queryByPartitionKey<Assessment>(TABLES.ASSESSMENTS, requestedTenantId);
    } else {
      assessments = await scanTable<Assessment>(TABLES.ASSESSMENTS);
    }

    const activeOnly = event.queryStringParameters?.activeOnly === 'true';
    const filtered = activeOnly
      ? assessments.filter(a => a.isActive)
      : assessments;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: JSON.stringify({ assessments: filtered })
    };
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

/**
 * Calculate questions per knowledge area based on mix
 */
function calculateQuestionsPerArea(
  knowledgeAreaMix: KnowledgeAreaConfig[],
  totalQuestions: number
): Record<string, number> {
  const questionsPerArea: Record<string, number> = {};

  knowledgeAreaMix.forEach(config => {
    const count = Math.round((config.percentage / 100) * totalQuestions);
    questionsPerArea[config.area] = Math.max(1, count); // At least 1 question per area
  });

  return questionsPerArea;
}
