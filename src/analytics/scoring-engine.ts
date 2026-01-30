/**
 * Performance scoring and role-fit calculation engine
 */

import {
  PerformanceMetrics,
  QuestionResponse,
  KnowledgeArea,
  Assessment,
  CandidateSession
} from '../shared/types';

/**
 * Calculate comprehensive performance metrics from a completed session
 */
export function calculatePerformanceMetrics(
  session: CandidateSession,
  assessment: Assessment
): PerformanceMetrics {
  const knowledgeAreaScores: PerformanceMetrics['knowledgeAreaScores'] = {} as any;

  // Group responses by knowledge area
  const areaGroups: Record<KnowledgeArea, QuestionResponse[]> = {} as any;

  assessment.knowledgeAreaMix.forEach(config => {
    areaGroups[config.area] = [];
  });

  session.questionsAnswered.forEach(response => {
    if (areaGroups[response.knowledgeArea]) {
      areaGroups[response.knowledgeArea].push(response);
    }
  });

  // Calculate metrics per knowledge area
  for (const [area, responses] of Object.entries(areaGroups)) {
    if (responses.length === 0) continue;

    const correctAnswers = responses.filter(r => r.isCorrect).length;
    const totalTime = responses.reduce((sum, r) => sum + r.timeSpentSeconds, 0);
    const difficulties = responses.map(r => r.difficulty);
    const avgDifficulty = difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length;

    knowledgeAreaScores[area as KnowledgeArea] = {
      score: (correctAnswers / responses.length) * 100,
      questionsAnswered: responses.length,
      correctAnswers,
      avgDifficultyReached: avgDifficulty,
      avgTimePerQuestion: totalTime / responses.length
    };
  }

  // Calculate overall score (weighted by knowledge area mix)
  const overallScore = calculateWeightedScore(
    knowledgeAreaScores,
    assessment.knowledgeAreaMix
  );

  // Calculate role-fit score (considers target role requirements)
  const roleFitScore = calculateRoleFitScore(
    knowledgeAreaScores,
    assessment.targetRole,
    assessment.knowledgeAreaMix
  );

  // Identify strengths and weaknesses
  const { strengths, weaknesses } = identifyStrengthsAndWeaknesses(
    knowledgeAreaScores,
    assessment.knowledgeAreaMix
  );

  return {
    sessionId: session.sessionId,
    assessmentId: session.assessmentId,
    tenantId: session.tenantId,
    overallScore,
    roleFitScore,
    knowledgeAreaScores,
    strengths,
    weaknesses,
    completedAt: session.submittedAt || new Date().toISOString()
  };
}

/**
 * Calculate weighted overall score based on knowledge area mix
 */
function calculateWeightedScore(
  areaScores: PerformanceMetrics['knowledgeAreaScores'],
  knowledgeAreaMix: Assessment['knowledgeAreaMix']
): number {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  knowledgeAreaMix.forEach(config => {
    const areaScore = areaScores[config.area];
    if (areaScore && areaScore.questionsAnswered > 0) {
      const weight = config.percentage / 100;
      totalWeightedScore += areaScore.score * weight;
      totalWeight += weight;
    }
  });

  return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
}

/**
 * Calculate role-fit score (considers role requirements and performance)
 */
function calculateRoleFitScore(
  areaScores: PerformanceMetrics['knowledgeAreaScores'],
  targetRole: Assessment['targetRole'],
  knowledgeAreaMix: Assessment['knowledgeAreaMix']
): number {
  // Base score from weighted performance
  const baseScore = calculateWeightedScore(areaScores, knowledgeAreaMix);

  // Adjustments based on role requirements
  // For senior roles, weight advanced areas more
  // For junior roles, weight fundamentals more
  let adjustment = 0;

  if (targetRole.seniorityLevel === 'SENIOR' || targetRole.seniorityLevel === 'LEAD') {
    // Senior roles: emphasize system design and advanced algorithms
    const systemDesignScore = areaScores[KnowledgeArea.SYSTEM_SCENARIO_DESIGN]?.score || 0;
    const algorithmsScore = areaScores[KnowledgeArea.ALGORITHMS_DATA_STRUCTURES]?.score || 0;
    adjustment = (systemDesignScore * 0.15 + algorithmsScore * 0.1) * 0.3;
  } else {
    // Junior/Mid: emphasize fundamentals
    const programmingScore = areaScores[KnowledgeArea.PROGRAMMING_LANGUAGE]?.score || 0;
    const analyticalScore = areaScores[KnowledgeArea.ANALYTICAL_REASONING]?.score || 0;
    adjustment = (programmingScore * 0.15 + analyticalScore * 0.1) * 0.3;
  }

  const roleFitScore = Math.min(100, Math.max(0, baseScore + adjustment));
  return Math.round(roleFitScore);
}

/**
 * Identify candidate strengths and weaknesses
 */
function identifyStrengthsAndWeaknesses(
  areaScores: PerformanceMetrics['knowledgeAreaScores'],
  knowledgeAreaMix: Assessment['knowledgeAreaMix']
): {
  strengths: KnowledgeArea[];
  weaknesses: KnowledgeArea[];
} {
  const strengths: KnowledgeArea[] = [];
  const weaknesses: KnowledgeArea[] = [];

  // Calculate average score across all areas
  const scores = Object.values(areaScores)
    .filter(s => s.questionsAnswered > 0)
    .map(s => s.score);
  
  const avgScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + s, 0) / scores.length
    : 0;

  // Areas significantly above average are strengths
  // Areas significantly below average are weaknesses
  const strengthThreshold = avgScore + 10; // 10 points above average
  const weaknessThreshold = avgScore - 15; // 15 points below average

  knowledgeAreaMix.forEach(config => {
    const areaScore = areaScores[config.area];
    if (areaScore && areaScore.questionsAnswered > 0) {
      if (areaScore.score >= strengthThreshold) {
        strengths.push(config.area);
      } else if (areaScore.score <= weaknessThreshold) {
        weaknesses.push(config.area);
      }
    }
  });

  return { strengths, weaknesses };
}
