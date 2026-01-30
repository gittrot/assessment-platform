/**
 * Performance scoring and role-fit calculation engine
 */

import {
  PerformanceMetrics,
  QuestionResponse,
  KnowledgeArea,
  Assessment,
  CandidateSession,
  SeniorityLevel
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
    const incorrectAnswers = responses.filter(r => !r.isCorrect).length;
    const totalTime = responses.reduce((sum, r) => sum + r.timeSpentSeconds, 0);
    const difficulties = responses.map(r => r.difficulty);
    const avgDifficulty = difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length;

    // Log scoring calculation for debugging
    console.log(`Scoring for ${area}:`, {
      totalQuestions: responses.length,
      correctAnswers,
      incorrectAnswers,
      calculatedScore: (correctAnswers / responses.length) * 100,
      responses: responses.map(r => ({
        questionId: r.questionId,
        isCorrect: r.isCorrect,
        answer: r.answer
      }))
    });

    knowledgeAreaScores[area as KnowledgeArea] = {
      score: (correctAnswers / responses.length) * 100,
      questionsAnswered: responses.length,
      correctAnswers,
      avgDifficultyReached: avgDifficulty,
      avgTimePerQuestion: totalTime / responses.length
    };
  }
  
  // Log overall calculation
  console.log('Overall score calculation:', {
    knowledgeAreaScores: Object.entries(knowledgeAreaScores).map(([area, data]) => ({
      area,
      score: data.score,
      questionsAnswered: data.questionsAnswered,
      correctAnswers: data.correctAnswers
    })),
    knowledgeAreaMix: assessment.knowledgeAreaMix
  });

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

  // Determine if candidate passed based on passThreshold
  const passThreshold = assessment.passThreshold || getDefaultPassThreshold(assessment.targetRole.seniorityLevel);
  const passed = roleFitScore >= passThreshold;

  return {
    sessionId: session.sessionId,
    assessmentId: session.assessmentId,
    tenantId: session.tenantId,
    overallScore,
    roleFitScore,
    passed,
    knowledgeAreaScores,
    strengths,
    weaknesses,
    completedAt: session.submittedAt || new Date().toISOString()
  };
}

/**
 * Get default pass threshold based on role seniority level
 */
function getDefaultPassThreshold(seniorityLevel: string | SeniorityLevel): number {
  const level = String(seniorityLevel).toUpperCase();
  switch (level) {
    case 'JUNIOR':
      return 50; // 50% for junior roles
    case 'MID':
      return 60; // 60% for mid-level roles
    case 'SENIOR':
      return 70; // 70% for senior roles
    case 'LEAD':
      return 75; // 75% for lead roles
    default:
      return 60; // Default to 60%
  }
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
 * This score emphasizes role-critical knowledge areas more than overall score
 */
function calculateRoleFitScore(
  areaScores: PerformanceMetrics['knowledgeAreaScores'],
  targetRole: Assessment['targetRole'],
  knowledgeAreaMix: Assessment['knowledgeAreaMix']
): number {
  // Calculate role-fit using a modified weighting that emphasizes role-critical areas
  let totalWeightedScore = 0;
  let totalWeight = 0;

  knowledgeAreaMix.forEach(config => {
    const areaScore = areaScores[config.area];
    if (areaScore && areaScore.questionsAnswered > 0) {
      let weight = config.percentage / 100;
      
      // Apply role-specific multipliers to emphasize critical areas
      if (targetRole.seniorityLevel === 'SENIOR' || targetRole.seniorityLevel === 'LEAD') {
        // Senior roles: boost system design and algorithms weight
        if (config.area === KnowledgeArea.SYSTEM_SCENARIO_DESIGN) {
          weight *= 1.5; // 50% more weight
        } else if (config.area === KnowledgeArea.ALGORITHMS_DATA_STRUCTURES) {
          weight *= 1.3; // 30% more weight
        }
      } else {
        // Junior/Mid roles: boost programming and analytical reasoning weight
        if (config.area === KnowledgeArea.PROGRAMMING_LANGUAGE) {
          weight *= 1.5; // 50% more weight
        } else if (config.area === KnowledgeArea.ANALYTICAL_REASONING) {
          weight *= 1.3; // 30% more weight
        }
      }
      
      totalWeightedScore += areaScore.score * weight;
      totalWeight += weight;
    }
  });

  // If no questions were answered, return 0
  if (totalWeight === 0) {
    return 0;
  }

  // Calculate role-fit score (can be different from overall score due to weighting)
  const roleFitScore = totalWeightedScore / totalWeight;
  return Math.round(Math.min(100, Math.max(0, roleFitScore)));
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
