/**
 * Lambda handler for tenant dashboard and analytics
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  TenantDashboard,
  PerformanceMetrics,
  CandidateSession,
  Assessment,
  KnowledgeArea,
  UserRole,
  DifficultyLevel
} from '../../shared/types';
import { getUserFromToken, getUserFromAuthorizerContext, hasRole, getTenantId, belongsToTenant } from '../../shared/auth';
import {
  getItem,
  queryByPartitionKey,
  scanTable
} from '../../shared/dynamodb';
import {
  AuthenticationError,
  AuthorizationError,
  TenantIsolationError,
  ValidationError,
  formatErrorResponse
} from '../../shared/errors';
import { TABLES } from '../../shared/constants';

/**
 * Get tenant dashboard
 * GET /dashboard
 */
export async function getDashboard(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Try to get user from API Gateway authorizer context first (faster, no API call)
    let user = getUserFromAuthorizerContext(event);
    
    // If not available, fall back to token validation
    if (!user) {
      const authHeader = event.headers.Authorization || event.headers.authorization;
      if (!authHeader) {
        throw new AuthenticationError();
      }

      const token = authHeader.replace('Bearer ', '');
      user = await getUserFromToken(token);
    }

    if (!hasRole(user, UserRole.TENANT) && !hasRole(user, UserRole.ADMIN)) {
      throw new AuthorizationError();
    }

    const tenantId = getTenantId(user);
    let requestedTenantId = event.queryStringParameters?.tenantId || tenantId;

    if (!requestedTenantId && hasRole(user, UserRole.ADMIN)) {
      const assessments = await scanTable<Assessment>(TABLES.ASSESSMENTS);
      const first = assessments.find(a => a.tenantId && String(a.tenantId).trim());
      requestedTenantId = first ? String(first.tenantId).trim() : null;
    }

    if (!requestedTenantId) {
      if (hasRole(user, UserRole.ADMIN)) {
        const emptyDashboard = buildEmptyDashboard();
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
            'Access-Control-Max-Age': '3600'
          },
          body: JSON.stringify({ dashboard: emptyDashboard, candidates: [] })
        };
      }
      throw new ValidationError('Tenant ID required');
    }

    if (!hasRole(user, UserRole.ADMIN) && !belongsToTenant(user, requestedTenantId)) {
      throw new TenantIsolationError();
    }

    const built = await buildDashboard(requestedTenantId);
    const dashboard = built.dashboard;
    const candidates = built.candidates;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: JSON.stringify({ dashboard, candidates })
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
 * Get candidate drill-down view
 * GET /dashboard/candidates/{sessionId}
 */
export async function getCandidateDrillDown(
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

    const tenantId = event.queryStringParameters?.tenantId || getTenantId(user);
    if (!tenantId || (typeof tenantId === 'string' && tenantId.trim() === '')) {
      throw new ValidationError('Tenant ID required. Pass ?tenantId= when opening candidate detail.');
    }
    const tid = typeof tenantId === 'string' ? tenantId.trim() : String(tenantId);

    const session = await getItem<CandidateSession>(TABLES.SESSIONS, tid, sessionId);
    if (!session) {
      throw new ValidationError('Session not found');
    }

    if (!hasRole(user, UserRole.ADMIN) && !belongsToTenant(user, session.tenantId)) {
      throw new TenantIsolationError();
    }

    // Get metrics
    const metrics = await getItem<PerformanceMetrics>(
      TABLES.METRICS,
      session.tenantId,
      sessionId
    );

    // Get insights
    const insights = await getItem<any>(
      TABLES.INSIGHTS,
      session.tenantId,
      sessionId
    );

    // Get assessment
    const assessment = await getItem<Assessment>(
      TABLES.ASSESSMENTS,
      session.tenantId,
      session.assessmentId
    );

    // Build question details with candidate answers
    const questionDetails = await buildQuestionDetails(session, session.tenantId);

    // Build detailed breakdown
    const breakdown = {
      session: {
        sessionId: session.sessionId,
        candidateName: session.candidateName,
        candidateEmail: session.candidateEmail,
        startedAt: session.startedAt,
        submittedAt: session.submittedAt,
        status: session.status
      },
      assessment: assessment ? {
        title: assessment.title,
        targetRole: assessment.targetRole
      } : null,
      performance: metrics ? {
        overallScore: metrics.overallScore,
        roleFitScore: metrics.roleFitScore,
        knowledgeAreaScores: metrics.knowledgeAreaScores,
        strengths: metrics.strengths,
        weaknesses: metrics.weaknesses
      } : null,
      insights: insights ? {
        roleFitAssessment: insights.roleFitAssessment,
        strengthAreas: insights.strengthAreas,
        weakAreas: insights.weakAreas,
        trainingRecommendations: insights.trainingRecommendations,
        roleReadinessScore: insights.roleReadinessScore,
        followUpSuggestions: insights.followUpSuggestions
      } : null,
      questionDetails: questionDetails,
      difficultyProgression: buildDifficultyProgression(session),
      timeAnalysis: buildTimeAnalysis(session)
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: JSON.stringify(breakdown)
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

function buildEmptyDashboard(): TenantDashboard {
  const knowledgeAreaBreakdown = {} as TenantDashboard['knowledgeAreaBreakdown'];
  Object.values(KnowledgeArea).forEach(area => {
    knowledgeAreaBreakdown[area] = {
      avgScore: 0,
      candidateCount: 0,
      avgDifficultyReached: 0
    };
  });
  return {
    tenantId: '',
    totalAssessments: 0,
    totalCandidates: 0,
    completionRate: 0,
    avgRoleFitScore: 0,
    knowledgeAreaBreakdown,
    recentSessions: [],
    lastUpdated: new Date().toISOString()
  };
}

export type DashboardBuildResult = {
  dashboard: TenantDashboard;
  candidates: Array<{ sessionId: string; tenantId: string; candidateName: string; candidateEmail: string; assessmentId: string; assessmentTitle: string; roleFitScore: number; overallScore: number; submittedAt: string; rank: number }>;
};

/**
 * Build dashboard from scratch
 */
async function buildDashboard(tenantId: string): Promise<DashboardBuildResult> {
  // Get all assessments
  const assessments = await queryByPartitionKey<Assessment>(
    TABLES.ASSESSMENTS,
    tenantId
  );

  // Get all sessions
  const sessions = await queryByPartitionKey<CandidateSession>(
    TABLES.SESSIONS,
    tenantId
  );

  // Get all metrics
  const allMetrics = await queryByPartitionKey<PerformanceMetrics>(
    TABLES.METRICS,
    tenantId
  );

  // Calculate metrics
  const totalAssessments = assessments.length;
  const totalCandidates = sessions.length;
  const completedSessions = sessions.filter(s => s.status === 'COMPLETED');
  const completionRate = totalCandidates > 0
    ? (completedSessions.length / totalCandidates) * 100
    : 0;

  // Average role-fit score
  const avgRoleFitScore = allMetrics.length > 0
    ? allMetrics.reduce((sum, m) => sum + m.roleFitScore, 0) / allMetrics.length
    : 0;

  // Knowledge area breakdown
  const knowledgeAreaBreakdown: TenantDashboard['knowledgeAreaBreakdown'] = {} as any;

  // Initialize all knowledge areas
  Object.values(KnowledgeArea).forEach(area => {
    knowledgeAreaBreakdown[area] = {
      avgScore: 0,
      candidateCount: 0,
      avgDifficultyReached: 0
    };
  });

  // Aggregate by knowledge area
  allMetrics.forEach(metrics => {
    Object.entries(metrics.knowledgeAreaScores).forEach(([area, data]) => {
      const areaKey = area as KnowledgeArea;
      if (knowledgeAreaBreakdown[areaKey]) {
        knowledgeAreaBreakdown[areaKey].avgScore += data.score;
        knowledgeAreaBreakdown[areaKey].candidateCount += 1;
        knowledgeAreaBreakdown[areaKey].avgDifficultyReached += data.avgDifficultyReached;
      }
    });
  });

  // Calculate averages
  Object.keys(knowledgeAreaBreakdown).forEach(area => {
    const areaKey = area as KnowledgeArea;
    const count = knowledgeAreaBreakdown[areaKey].candidateCount;
    if (count > 0) {
      knowledgeAreaBreakdown[areaKey].avgScore /= count;
      knowledgeAreaBreakdown[areaKey].avgDifficultyReached /= count;
    }
  });

  // Recent sessions (last 10)
  const recentSessions = completedSessions
    .sort((a, b) => {
      const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
      const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 10)
    .map(s => s.sessionId);

  const dashboard: TenantDashboard = {
    tenantId,
    totalAssessments,
    totalCandidates,
    completionRate: Math.round(completionRate * 100) / 100,
    avgRoleFitScore: Math.round(avgRoleFitScore * 100) / 100,
    knowledgeAreaBreakdown,
    recentSessions,
    lastUpdated: new Date().toISOString()
  };

  // Save dashboard
  await putItem(TABLES.DASHBOARDS, {
    ...dashboard,
    tenantId,
    dashboardId: 'DASHBOARD'
  });

  // Build candidates list with ranking (by roleFitScore desc)
  const metricsBySession = new Map<string, PerformanceMetrics>();
  allMetrics.forEach(m => metricsBySession.set(m.sessionId, m));
  const assessmentsById = new Map<string, Assessment>();
  assessments.forEach(a => assessmentsById.set(a.assessmentId, a));

  const candidates: Array<{
    sessionId: string;
    tenantId: string;
    candidateName: string;
    candidateEmail: string;
    assessmentId: string;
    assessmentTitle: string;
    roleFitScore: number;
    overallScore: number;
    submittedAt: string;
    rank: number;
  }> = [];

  completedSessions.forEach(s => {
    const m = metricsBySession.get(s.sessionId);
    const a = assessmentsById.get(s.assessmentId);
    if (!m) return;
    candidates.push({
      sessionId: s.sessionId,
      tenantId: s.tenantId,
      candidateName: s.candidateName || '—',
      candidateEmail: s.candidateEmail || '—',
      assessmentId: s.assessmentId,
      assessmentTitle: a?.title ?? '—',
      roleFitScore: m.roleFitScore,
      overallScore: m.overallScore,
      submittedAt: s.submittedAt || '',
      rank: 0
    });
  });

  candidates.sort((x, y) => y.roleFitScore - x.roleFitScore);
  candidates.forEach((c, i) => { c.rank = i + 1; });

  return { dashboard, candidates };
}

/**
 * Build difficulty progression chart data
 */
function buildDifficultyProgression(session: CandidateSession): Array<{
  questionNumber: number;
  knowledgeArea: KnowledgeArea;
  difficulty: number;
  isCorrect: boolean;
}> {
  return session.questionsAnswered.map((response, index) => ({
    questionNumber: index + 1,
    knowledgeArea: response.knowledgeArea,
    difficulty: response.difficulty,
    isCorrect: response.isCorrect
  }));
}

/**
 * Build question details with candidate answers vs correct answers
 */
async function buildQuestionDetails(
  session: CandidateSession,
  tenantId: string
): Promise<Array<{
  questionNumber: number;
  questionId: string;
  questionText: string;
  questionType: string;
  knowledgeArea: KnowledgeArea;
  difficulty: DifficultyLevel;
  options?: string[];
  candidateAnswer: string | string[];
  correctAnswer: string | string[];
  isCorrect: boolean;
  explanation?: string;
  timeSpentSeconds: number;
}>> {
  const questionDetails = [];

  for (let i = 0; i < session.questionsAnswered.length; i++) {
    const response = session.questionsAnswered[i];
    
    // Try to get question from Questions table
    // Question ID format: assessmentId#questionId
    const questionKey = `${session.assessmentId}#${response.questionId}`;
    let question = await getItem<any>(
      TABLES.QUESTIONS,
      tenantId,
      questionKey
    );

    // If question not found in Questions table, it might be an adaptive question
    // Check if question details were stored in the response
    if (!question) {
      const adaptiveQuestion = response as any;
      questionDetails.push({
        questionNumber: i + 1,
        questionId: response.questionId,
        questionText: adaptiveQuestion.questionText || `Question ${i + 1} (Adaptive)`,
        questionType: adaptiveQuestion.questionType || 'ADAPTIVE',
        knowledgeArea: response.knowledgeArea,
        difficulty: response.difficulty,
        options: adaptiveQuestion.options,
        candidateAnswer: response.answer,
        correctAnswer: adaptiveQuestion.correctAnswer || 'N/A',
        isCorrect: response.isCorrect,
        explanation: adaptiveQuestion.explanation,
        timeSpentSeconds: response.timeSpentSeconds
      });
      continue;
    }

    questionDetails.push({
      questionNumber: i + 1,
      questionId: response.questionId,
      questionText: question.questionText || `Question ${i + 1}`,
      questionType: question.questionType || 'UNKNOWN',
      knowledgeArea: response.knowledgeArea,
      difficulty: response.difficulty,
      options: question.options,
      candidateAnswer: response.answer,
      correctAnswer: question.correctAnswer,
      isCorrect: response.isCorrect,
      explanation: question.explanation,
      timeSpentSeconds: response.timeSpentSeconds
    });
  }

  return questionDetails;
}

/**
 * Build time analysis data
 */
function buildTimeAnalysis(session: CandidateSession): {
  totalTimeSeconds: number;
  avgTimePerQuestion: number;
  timeByKnowledgeArea: Record<KnowledgeArea, {
    totalTime: number;
    avgTime: number;
    questionCount: number;
  }>;
} {
  const totalTime = session.questionsAnswered.reduce(
    (sum, r) => sum + r.timeSpentSeconds,
    0
  );

  const avgTime = session.questionsAnswered.length > 0
    ? totalTime / session.questionsAnswered.length
    : 0;

  const timeByKnowledgeArea: Record<string, {
    totalTime: number;
    questionCount: number;
  }> = {};

  session.questionsAnswered.forEach(response => {
    const area = response.knowledgeArea;
    if (!timeByKnowledgeArea[area]) {
      timeByKnowledgeArea[area] = { totalTime: 0, questionCount: 0 };
    }
    timeByKnowledgeArea[area].totalTime += response.timeSpentSeconds;
    timeByKnowledgeArea[area].questionCount += 1;
  });

  const result: any = {};
  Object.entries(timeByKnowledgeArea).forEach(([area, data]) => {
    result[area] = {
      totalTime: data.totalTime,
      avgTime: data.questionCount > 0 ? data.totalTime / data.questionCount : 0,
      questionCount: data.questionCount
    };
  });

  return {
    totalTimeSeconds: totalTime,
    avgTimePerQuestion: avgTime,
    timeByKnowledgeArea: result
  };
}

// Import putItem
import { putItem } from '../../shared/dynamodb';
