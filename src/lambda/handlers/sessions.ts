/**
 * Lambda handler for candidate session management
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import {
  CandidateSession,
  QuestionResponse,
  KnowledgeArea,
  UserRole,
  DifficultyLevel,
  Assessment
} from '../../shared/types';
import { getUserFromToken, hasRole, getTenantId, belongsToTenant } from '../../shared/auth';
import {
  getItem,
  putItem,
  updateItem,
  queryByPartitionKey,
  docClient,
  ScanCommand
} from '../../shared/dynamodb';
import {
  AuthenticationError,
  AuthorizationError,
  TenantIsolationError,
  ValidationError,
  NotFoundError,
  formatErrorResponse
} from '../../shared/errors';
import { TABLES } from '../../shared/constants';
import { getItem as getAssessment } from '../../shared/dynamodb';
import { generateAdaptiveQuestion } from '../../ai/question-generator';
import { updateSessionDifficulties, selectNextKnowledgeArea } from '../../analytics/adaptive-engine';
import { calculatePerformanceMetrics } from '../../analytics/scoring-engine';
import { generateInsights } from '../../ai/insights-generator';

/**
 * Start a new candidate session (public endpoint)
 * POST /sessions/start
 */
export async function startSession(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { assessmentId, candidateEmail, candidateName, tenantId: bodyTenantId } = body;

    if (!assessmentId) {
      throw new ValidationError('Assessment ID required');
    }

    // Extract tenantId from assessment
    // Use tenantId from request body if provided (from email link), otherwise scan
    console.log('Finding assessment:', {
      assessmentId,
      bodyTenantId,
      bodyTenantIdType: typeof bodyTenantId,
      bodyTenantIdLength: bodyTenantId?.length
    });
    
    const assessment = await findAssessmentById(assessmentId, bodyTenantId);
    if (!assessment) {
      throw new NotFoundError('Assessment');
    }

    if (!assessment.isActive) {
      throw new ValidationError('Assessment is not active');
    }

    // Log assessment details for debugging
    console.log('Assessment found:', {
      assessmentId: assessment.assessmentId,
      assessmentTenantId: assessment.tenantId,
      assessmentTenantIdType: typeof assessment.tenantId,
      assessmentTenantIdValue: JSON.stringify(assessment.tenantId),
      assessmentTenantIdLength: assessment.tenantId?.length,
      assessmentTenantIdTrimmed: typeof assessment.tenantId === 'string' ? assessment.tenantId.trim() : 'N/A',
      bodyTenantId: bodyTenantId,
      bodyTenantIdType: typeof bodyTenantId,
      bodyTenantIdValue: JSON.stringify(bodyTenantId),
      bodyTenantIdLength: bodyTenantId?.length,
      fullAssessmentKeys: Object.keys(assessment)
    });

    // Determine the tenantId to use for the session
    // Priority: 1) tenantId from request body (from URL), 2) assessment.tenantId, 3) error
    let sessionTenantId: string;
    
    if (bodyTenantId && typeof bodyTenantId === 'string' && bodyTenantId.trim() !== '') {
      // Use tenantId from request (from email link URL)
      sessionTenantId = bodyTenantId.trim();
      console.log('✅ Using tenantId from request body:', {
        sessionTenantId,
        sessionTenantIdType: typeof sessionTenantId,
        sessionTenantIdLength: sessionTenantId.length,
        sessionTenantIdValue: JSON.stringify(sessionTenantId)
      });
    } else if (assessment.tenantId && typeof assessment.tenantId === 'string' && assessment.tenantId.trim() !== '') {
      // Fallback to assessment's tenantId
      sessionTenantId = assessment.tenantId.trim();
      console.log('✅ Using tenantId from assessment:', {
        sessionTenantId,
        sessionTenantIdType: typeof sessionTenantId,
        sessionTenantIdLength: sessionTenantId.length,
        sessionTenantIdValue: JSON.stringify(sessionTenantId)
      });
    } else {
      // Both are empty - this is an error
      console.error('❌ Invalid tenantId - both request and assessment have empty tenantId:', {
        assessmentId: assessment.assessmentId,
        bodyTenantId,
        bodyTenantIdType: typeof bodyTenantId,
        bodyTenantIdValue: JSON.stringify(bodyTenantId),
        assessmentTenantId: assessment.tenantId,
        assessmentTenantIdType: typeof assessment.tenantId,
        assessmentTenantIdValue: JSON.stringify(assessment.tenantId),
        fullAssessment: JSON.stringify(assessment, null, 2)
      });
      throw new ValidationError('Assessment configuration error: tenantId is missing. Please contact the assessment administrator or use a link with tenantId included.');
    }

    // Final validation - ensure tenantId is not empty
    if (!sessionTenantId || typeof sessionTenantId !== 'string' || sessionTenantId.trim() === '') {
      console.error('❌ CRITICAL: sessionTenantId is empty after validation:', {
        sessionTenantId,
        sessionTenantIdType: typeof sessionTenantId,
        sessionTenantIdValue: JSON.stringify(sessionTenantId),
        assessmentId: assessment.assessmentId
      });
      throw new ValidationError(`Cannot create session: tenantId is empty after validation. Assessment ID: ${assessment.assessmentId}`);
    }
    
    // Log final tenantId before creating session
    console.log('🎯 Final sessionTenantId before creating session:', {
      sessionTenantId,
      sessionTenantIdType: typeof sessionTenantId,
      sessionTenantIdLength: sessionTenantId.length,
      sessionTenantIdValue: JSON.stringify(sessionTenantId),
      sessionTenantIdCharCodes: sessionTenantId.split('').map(c => c.charCodeAt(0))
    });

    // Create session
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    // Initialize difficulties per knowledge area
    const initialDifficulties: Partial<Record<KnowledgeArea, DifficultyLevel>> = {};
    assessment.knowledgeAreaMix.forEach(config => {
      initialDifficulties[config.area] = assessment.initialDifficulty;
    });

    const session: CandidateSession = {
      sessionId,
      assessmentId,
      tenantId: sessionTenantId,
      candidateEmail,
      candidateName,
      startedAt: now,
      currentDifficulty: initialDifficulties as Record<KnowledgeArea, DifficultyLevel>,
      questionsAnswered: [],
      status: 'IN_PROGRESS'
    };

    // Log session before saving
    console.log('Creating session:', {
      sessionId,
      assessmentId,
      tenantId: sessionTenantId,
      tenantIdType: typeof sessionTenantId,
      tenantIdLength: sessionTenantId.length
    });

    // Explicitly construct the item with tenantId and sessionId as first properties
    // This ensures they're properly set for DynamoDB key attributes
    const sessionItem: CandidateSession = {
      tenantId: sessionTenantId, // Set tenantId FIRST (partition key)
      sessionId: sessionId, // Set sessionId SECOND (sort key)
      assessmentId: assessmentId,
      candidateEmail: candidateEmail || undefined,
      candidateName: candidateName || undefined,
      startedAt: now,
      currentDifficulty: initialDifficulties as Record<KnowledgeArea, DifficultyLevel>,
      questionsAnswered: [],
      status: 'IN_PROGRESS'
    };

    // Final validation before saving
    if (!sessionItem.tenantId || sessionItem.tenantId.trim() === '') {
      throw new ValidationError(`Cannot create session: tenantId is empty. Assessment ID: ${assessmentId}, Request tenantId: ${bodyTenantId}, Assessment tenantId: ${assessment.tenantId}`);
    }
    if (!sessionItem.sessionId || sessionItem.sessionId.trim() === '') {
      throw new ValidationError(`Cannot create session: sessionId is empty`);
    }

    // Log exactly what we're about to save
    console.log('About to call putItem with:', {
      tenantId: sessionItem.tenantId,
      tenantIdType: typeof sessionItem.tenantId,
      tenantIdValue: JSON.stringify(sessionItem.tenantId),
      tenantIdLength: sessionItem.tenantId?.length,
      sessionId: sessionItem.sessionId,
      sessionIdType: typeof sessionItem.sessionId,
      fullItemKeys: Object.keys(sessionItem),
      itemStringified: JSON.stringify(sessionItem, null, 2)
    });

    try {
      await putItem(TABLES.SESSIONS, sessionItem);
      console.log('putItem succeeded');
    } catch (putError: any) {
      console.error('putItem failed:', {
        error: putError.message,
        errorName: putError.name,
        errorStack: putError.stack,
        tenantId: sessionItem.tenantId,
        sessionId: sessionItem.sessionId,
        item: JSON.stringify(sessionItem, null, 2)
      });
      throw putError;
    }

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        sessionId,
        assessmentId,
        startedAt: now
      })
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get next question for a session
 * GET /sessions/{sessionId}/next-question
 */
export async function getNextQuestion(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      throw new ValidationError('Session ID required');
    }

    // Try to get tenantId from query parameters (if provided in URL)
    const queryParams = event.queryStringParameters || {};
    const tenantId = queryParams.tenantId;

    // Get session (public access, but validate session exists)
    // Use tenantId if provided, otherwise scan (less efficient)
    const session = await findSessionById(sessionId, tenantId);
    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new ValidationError('Session is not in progress');
    }

    // Get assessment
    const assessment = await getAssessment<Assessment>(
      TABLES.ASSESSMENTS,
      session.tenantId,
      session.assessmentId
    );

    if (!assessment) {
      throw new NotFoundError('Assessment');
    }

    // Select next knowledge area
    const nextArea = selectNextKnowledgeArea(
      assessment.knowledgeAreaMix,
      session.questionsAnswered,
      session.currentDifficulty
    );

    // Get current difficulty for this area
    const currentDifficulty = session.currentDifficulty[nextArea] || assessment.initialDifficulty;

    // Calculate performance for adaptive difficulty
    const recentResponses = session.questionsAnswered.slice(-10); // Last 10 responses

    // Generate adaptive question
    const question = await generateAdaptiveQuestion(
      assessment,
      nextArea,
      currentDifficulty,
      recentResponses.length > 0 ? {
        correct: recentResponses.filter(r => r.isCorrect).length,
        total: recentResponses.length
      } : undefined
    );

    // Validate question was generated successfully
    if (!question || !question.questionId || !question.questionText) {
      console.error('Failed to generate valid question:', {
        question: question,
        assessmentId: assessment.assessmentId,
        knowledgeArea: nextArea,
        difficulty: currentDifficulty
      });
      throw new Error('Failed to generate question. Please try again.');
    }

    // Store the question in the session so we can retrieve it when submitting the answer
    // We'll store it in a temporary field in the session
    // Update session with current question data
    const currentQuestionData = {
      questionId: question.questionId,
      questionText: question.questionText,
      questionType: question.questionType,
      knowledgeArea: question.knowledgeArea,
      difficulty: question.difficulty,
      options: question.options,
      correctAnswer: question.correctAnswer, // Store for validation
      explanation: question.explanation
    };

    await updateItem(
      TABLES.SESSIONS,
      session.tenantId,
      sessionId,
      'SET currentQuestion = :question',
      {
        ':question': currentQuestionData
      }
    );

    // Return question (without correct answer)
    const { correctAnswer, ...questionForCandidate } = question;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        question: questionForCandidate,
        sessionId,
        questionsAnswered: session.questionsAnswered.length,
        maxQuestions: assessment.maxQuestions || 10,
        durationMinutes: assessment.durationMinutes || null,
        startedAt: session.startedAt || null
      })
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Submit answer for a question
 * POST /sessions/{sessionId}/answer
 */
export async function submitAnswer(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      throw new ValidationError('Session ID required');
    }

    // Try to get tenantId from query parameters (if provided in URL)
    const queryParams = event.queryStringParameters || {};
    const tenantId = queryParams.tenantId;

    const body = JSON.parse(event.body || '{}');
    const { questionId, answer, timeSpentSeconds } = body;

    // Validate required fields - allow 0 for timeSpentSeconds
    if (!questionId || answer === undefined || answer === null || timeSpentSeconds === undefined || timeSpentSeconds === null) {
      throw new ValidationError('Missing required fields: questionId, answer, timeSpentSeconds');
    }

    // Get session (use tenantId if provided for efficient lookup)
    const session = await findSessionById(sessionId, tenantId);
    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new ValidationError('Session is not in progress');
    }

    // Validate session tenantId
    const sessionTenantId = session.tenantId;
    if (!sessionTenantId || typeof sessionTenantId !== 'string' || sessionTenantId.trim() === '') {
      console.error('Session has empty tenantId:', {
        sessionId,
        sessionTenantId,
        sessionTenantIdType: typeof sessionTenantId,
        fullSession: JSON.stringify(session, null, 2)
      });
      throw new ValidationError('Session configuration error: tenantId is missing. Please contact support.');
    }

    // Get question - try from session's currentQuestion first (for adaptive questions)
    // Otherwise, try to get from Questions table (pre-generated questions)
    let question: any = null;
    
    if ((session as any).currentQuestion && (session as any).currentQuestion.questionId === questionId) {
      // Use the question stored in the session (adaptive question)
      const storedQuestion = (session as any).currentQuestion;
      if (storedQuestion && storedQuestion.questionId && storedQuestion.questionText) {
        question = storedQuestion;
      } else {
        console.error('Invalid currentQuestion in session:', storedQuestion);
        throw new ValidationError('Invalid question data in session');
      }
      console.log('Using question from session currentQuestion');
    } else {
      // Try to get from Questions table (pre-generated questions)
      question = await getItem<any>(
        TABLES.QUESTIONS,
        sessionTenantId.trim(),
        `${session.assessmentId}#${questionId}`
      );
      console.log('Question from Questions table:', question ? 'found' : 'not found');
    }

    if (!question) {
      console.error('Question not found:', {
        questionId,
        sessionId,
        assessmentId: session.assessmentId,
        tenantId: sessionTenantId,
        hasCurrentQuestion: !!(session as any).currentQuestion,
        currentQuestionId: (session as any).currentQuestion?.questionId
      });
      throw new NotFoundError('Question');
    }

    // Check if already answered
    if (session.questionsAnswered.some(r => r.questionId === questionId)) {
      throw new ValidationError('Question already answered');
    }

    // Validate answer
    const isCorrect = checkAnswer(answer, question.correctAnswer);

    // Create response - include question details for result viewing
    const response: QuestionResponse & {
      questionText?: string;
      questionType?: string;
      options?: string[];
      correctAnswer?: string | string[];
      explanation?: string;
    } = {
      questionId,
      knowledgeArea: question.knowledgeArea,
      difficulty: question.difficulty,
      answer,
      isCorrect,
      timeSpentSeconds,
      answeredAt: new Date().toISOString(),
      // Store question details for result viewing
      questionText: question.questionText,
      questionType: question.questionType,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation
    };

    // Update session
    const updatedQuestions = [...session.questionsAnswered, response];
    const updatedDifficulties = updateSessionDifficulties({
      ...session,
      questionsAnswered: updatedQuestions
    });

    // Get assessment to check maxQuestions
    const assessment = await getAssessment<Assessment>(
      TABLES.ASSESSMENTS,
      sessionTenantId.trim(),
      session.assessmentId
    );

    // Use validated tenantId for update
    // Clear currentQuestion after submitting answer
    await updateItem(
      TABLES.SESSIONS,
      sessionTenantId.trim(),
      sessionId,
      'SET questionsAnswered = :questions, currentDifficulty = :difficulties REMOVE currentQuestion',
      {
        ':questions': updatedQuestions,
        ':difficulties': updatedDifficulties
      }
    );

    // Check if we've reached the maximum number of questions (from assessment config)
    const MAX_QUESTIONS = assessment?.maxQuestions || 10;
    const questionsAnswered = session.questionsAnswered.length + 1; // +1 for the one we just added
    const nextQuestionAvailable = questionsAnswered < MAX_QUESTIONS;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        isCorrect,
        explanation: question.explanation,
        nextQuestionAvailable,
        questionsAnswered,
        maxQuestions: MAX_QUESTIONS
      })
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Submit session (complete assessment)
 * POST /sessions/{sessionId}/submit
 * Optional: ?tenantId= for efficient lookup (no auth required; candidate flow).
 */
export async function submitSession(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      throw new ValidationError('Session ID required');
    }

    const queryParams = event.queryStringParameters || {};
    const tenantId = queryParams.tenantId;

    // Get session (use tenantId if provided, e.g. from candidate question page)
    const session = await findSessionById(sessionId, tenantId);
    if (!session) {
      throw new NotFoundError('Session');
    }

    if (session.status !== 'IN_PROGRESS') {
      throw new ValidationError('Session already submitted');
    }

    // Get assessment
    const assessment = await getAssessment<Assessment>(
      TABLES.ASSESSMENTS,
      session.tenantId,
      session.assessmentId
    );

    if (!assessment) {
      throw new NotFoundError('Assessment');
    }

    // Calculate metrics
    const metrics = calculatePerformanceMetrics(session, assessment);

    // Save metrics - explicitly construct to ensure tenantId is first
    const metricsItem: any = {
      tenantId: session.tenantId.trim(), // Set tenantId FIRST (partition key)
      sessionId: metrics.sessionId, // Set sessionId SECOND (sort key)
      assessmentId: metrics.assessmentId,
      overallScore: metrics.overallScore,
      roleFitScore: metrics.roleFitScore,
      knowledgeAreaScores: metrics.knowledgeAreaScores,
      strengths: metrics.strengths,
      weaknesses: metrics.weaknesses,
      completedAt: metrics.completedAt
    };
    
    await putItem(TABLES.METRICS, metricsItem);

    // Generate AI insights (async, but we'll wait for it)
    let insights;
    try {
      insights = await generateInsights(metrics, assessment);
      // Save insights - explicitly construct to ensure tenantId is first
      const insightsItem: any = {
        tenantId: session.tenantId.trim(), // Set tenantId FIRST (partition key)
        sessionId: insights.sessionId, // Set sessionId SECOND (sort key)
        assessmentId: insights.assessmentId,
        roleFitAssessment: insights.roleFitAssessment,
        strengthAreas: insights.strengthAreas,
        weakAreas: insights.weakAreas,
        trainingRecommendations: insights.trainingRecommendations,
        generatedAt: insights.generatedAt
      };
      
      await putItem(TABLES.INSIGHTS, insightsItem);
    } catch (error) {
      console.error('Error generating insights:', error);
      // Continue even if insights generation fails
    }

    // Update session status
    await updateItem(
      TABLES.SESSIONS,
      session.tenantId,
      sessionId,
      'SET #status = :status, submittedAt = :submittedAt',
      {
        ':status': 'COMPLETED',
        ':submittedAt': new Date().toISOString()
      },
      {
        '#status': 'status'
      }
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        sessionId,
        status: 'COMPLETED',
        overallScore: metrics.overallScore,
        roleFitScore: metrics.roleFitScore,
        insightsAvailable: !!insights
      })
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

/**
 * Get session results (tenant access only)
 * GET /sessions/{sessionId}
 */
export async function getSession(
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

    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
      throw new ValidationError('Session ID required');
    }

    const session = await findSessionById(sessionId);
    if (!session) {
      throw new NotFoundError('Session');
    }

    const tenantId = getTenantId(user);
    if (!hasRole(user, UserRole.ADMIN) && !belongsToTenant(user, session.tenantId)) {
      throw new TenantIsolationError();
    }

    // Get metrics and insights
    const metrics = await getItem<any>(TABLES.METRICS, session.tenantId, sessionId);
    const insights = await getItem<any>(TABLES.INSIGHTS, session.tenantId, sessionId);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        session,
        metrics,
        insights
      })
    };
  } catch (error) {
    return formatErrorResponse(error);
  }
}

// Helper functions
// Note: In production, you should:
// 1. Include tenantId in public assessment links
// 2. Add a GSI on sessionId for efficient lookups
// 3. Use sessionId as a unique identifier that includes tenant context
async function findSessionById(sessionId: string, tenantId?: string): Promise<CandidateSession | null> {
  if (tenantId) {
    // Direct lookup if we have tenantId
    return await getItem<CandidateSession>(TABLES.SESSIONS, tenantId, sessionId);
  }
  
  // Fallback: This is inefficient for production
  // In production, use a GSI on sessionId or include tenantId in the link
  // For now, we'll need to scan (not recommended for large datasets)
  console.warn('Finding session without tenantId - consider optimizing with GSI');
  
  // Try to extract tenantId from sessionId if it's encoded
  // Or use a GSI on sessionId
  // For MVP, we'll do a limited search
  const allSessions = await queryByPartitionKey<CandidateSession>(TABLES.SESSIONS, '');
  return allSessions.find(s => s.sessionId === sessionId) || null;
}

async function findAssessmentById(assessmentId: string, tenantId?: string): Promise<Assessment | null> {
  if (tenantId) {
    return await getItem<Assessment>(TABLES.ASSESSMENTS, tenantId, assessmentId);
  }
  
  // For public endpoints, we need to scan since we don't have tenantId
  // Note: This is inefficient but necessary for public assessment links
  // In production, consider including tenantId in the public URL or adding a GSI on assessmentId
  console.warn('Finding assessment without tenantId - using scan (consider including tenantId in URL)');
  
  const command = new ScanCommand({
    TableName: TABLES.ASSESSMENTS,
    FilterExpression: 'assessmentId = :assessmentId',
    ExpressionAttributeValues: {
      ':assessmentId': assessmentId
    }
  });
  
  const response = await docClient.send(command);
  const item = response.Items?.[0];
  
  if (!item) {
    return null;
  }

  // Log what we got from the scan
  console.log('Scan result:', {
    itemKeys: Object.keys(item),
    tenantId: item.tenantId,
    tenantIdType: typeof item.tenantId,
    tenantIdValue: JSON.stringify(item.tenantId),
    assessmentId: item.assessmentId,
    rawItem: JSON.stringify(item, null, 2)
  });

  // Extract tenantId - handle various possible formats
  let extractedTenantId: string | undefined = item.tenantId;
  
  // If tenantId is not directly accessible, try other ways
  if (!extractedTenantId || extractedTenantId === '') {
    // Check if it's nested or has a different structure
    extractedTenantId = (item as any).tenantId || (item as any)['tenantId'];
  }

  // Ensure tenantId exists and is not empty
  if (!extractedTenantId || (typeof extractedTenantId === 'string' && extractedTenantId.trim() === '')) {
    console.error('Assessment from scan has invalid tenantId:', {
      assessmentId: item.assessmentId,
      tenantId: extractedTenantId,
      itemTenantId: item.tenantId,
      allKeys: Object.keys(item),
      fullItem: JSON.stringify(item, null, 2)
    });
    throw new ValidationError(`Assessment ${assessmentId} has invalid or empty tenantId. Please contact support to fix this assessment.`);
  }

  // Ensure tenantId is a string and not empty
  const validTenantId = String(extractedTenantId).trim();
  if (!validTenantId || validTenantId === '') {
    console.error('Assessment tenantId is empty after trimming:', {
      assessmentId: item.assessmentId,
      extractedTenantId,
      validTenantId,
      fullItem: JSON.stringify(item, null, 2)
    });
    throw new ValidationError(`Assessment ${assessmentId} has empty tenantId. Please contact support to fix this assessment.`);
  }

  // Return assessment with validated tenantId - explicitly construct to avoid spread issues
  const validatedAssessment: Assessment = {
    assessmentId: item.assessmentId,
    tenantId: validTenantId, // Explicitly set the validated tenantId
    title: item.title,
    description: item.description,
    targetRole: item.targetRole,
    knowledgeAreaMix: item.knowledgeAreaMix,
    initialDifficulty: item.initialDifficulty,
    durationMinutes: item.durationMinutes,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdBy: item.createdBy,
    isActive: item.isActive
  };
  
  return validatedAssessment;
}

function checkAnswer(userAnswer: string | string[], correctAnswer: string | string[]): boolean {
  if (Array.isArray(correctAnswer)) {
    if (!Array.isArray(userAnswer)) return false;
    return correctAnswer.every(ans => userAnswer.includes(ans)) &&
           userAnswer.every(ans => correctAnswer.includes(ans));
  }
  return String(userAnswer).trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
}
