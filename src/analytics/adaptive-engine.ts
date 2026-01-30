/**
 * Adaptive difficulty engine - adjusts difficulty per knowledge area
 */

import {
  KnowledgeArea,
  DifficultyLevel,
  QuestionResponse,
  CandidateSession
} from '../shared/types';
import {
  DIFFICULTY_INCREASE_THRESHOLD,
  DIFFICULTY_DECREASE_THRESHOLD,
  DIFFICULTY_STABLE_WINDOW,
  MAX_DIFFICULTY,
  MIN_DIFFICULTY
} from '../shared/constants';

/**
 * Calculate next difficulty level for a knowledge area based on performance
 */
export function calculateNextDifficulty(
  currentDifficulty: DifficultyLevel,
  knowledgeArea: KnowledgeArea,
  recentResponses: QuestionResponse[]
): DifficultyLevel {
  // Filter responses for this knowledge area
  const areaResponses = recentResponses.filter(
    r => r.knowledgeArea === knowledgeArea
  );

  if (areaResponses.length < DIFFICULTY_STABLE_WINDOW) {
    // Not enough data, maintain current difficulty
    return currentDifficulty;
  }

  // Calculate accuracy for this area
  const correctCount = areaResponses.filter(r => r.isCorrect).length;
  const accuracy = correctCount / areaResponses.length;

  // Get recent performance (last N questions)
  const recentPerformance = areaResponses.slice(-DIFFICULTY_STABLE_WINDOW);
  const recentCorrect = recentPerformance.filter(r => r.isCorrect).length;
  const recentAccuracy = recentCorrect / recentPerformance.length;

  // Adaptive logic
  if (recentAccuracy >= DIFFICULTY_INCREASE_THRESHOLD && currentDifficulty < MAX_DIFFICULTY) {
    // Strong performance - increase difficulty
    return (currentDifficulty + 1) as DifficultyLevel;
  } else if (recentAccuracy < DIFFICULTY_DECREASE_THRESHOLD && currentDifficulty > MIN_DIFFICULTY) {
    // Weak performance - decrease difficulty
    return (currentDifficulty - 1) as DifficultyLevel;
  }

  // Maintain current difficulty
  return currentDifficulty;
}

/**
 * Update difficulty for all knowledge areas in a session
 */
export function updateSessionDifficulties(
  session: CandidateSession
): Record<KnowledgeArea, DifficultyLevel> {
  const updatedDifficulties: Partial<Record<KnowledgeArea, DifficultyLevel>> = {};

  // Get all knowledge areas from the assessment (would need to fetch assessment)
  // For now, extract from responses
  const knowledgeAreas = new Set<KnowledgeArea>(
    session.questionsAnswered.map(r => r.knowledgeArea)
  );

  for (const area of knowledgeAreas) {
    const currentDifficulty = session.currentDifficulty[area] || 3;
    updatedDifficulties[area] = calculateNextDifficulty(
      currentDifficulty,
      area,
      session.questionsAnswered
    );
  }

  // Merge with existing difficulties
  return {
    ...session.currentDifficulty,
    ...updatedDifficulties
  } as Record<KnowledgeArea, DifficultyLevel>;
}

/**
 * Determine which knowledge area to ask next question from
 * Uses weighted selection based on knowledge area mix and current performance
 */
export function selectNextKnowledgeArea(
  knowledgeAreaMix: Array<{ area: KnowledgeArea; percentage: number }>,
  questionsAnswered: QuestionResponse[],
  currentDifficulties: Record<KnowledgeArea, DifficultyLevel>
): KnowledgeArea {
  // Calculate how many questions have been asked per area
  const areaCounts: Record<KnowledgeArea, number> = {} as Record<KnowledgeArea, number>;
  const areaTargets: Record<KnowledgeArea, number> = {} as Record<KnowledgeArea, number>;

  // Initialize counts
  knowledgeAreaMix.forEach(config => {
    areaCounts[config.area] = 0;
    areaTargets[config.area] = config.percentage;
  });

  // Count answered questions per area
  questionsAnswered.forEach(response => {
    if (areaCounts[response.knowledgeArea] !== undefined) {
      areaCounts[response.knowledgeArea]++;
    }
  });

  // Find areas that are below their target percentage
  const totalAnswered = questionsAnswered.length;
  const underTargetAreas: Array<{ area: KnowledgeArea; deficit: number }> = [];

  knowledgeAreaMix.forEach(config => {
    const currentPercentage = totalAnswered > 0
      ? (areaCounts[config.area] / totalAnswered) * 100
      : 0;
    const deficit = config.percentage - currentPercentage;

    if (deficit > 0) {
      underTargetAreas.push({ area: config.area, deficit });
    }
  });

  // If there are areas under target, prioritize them
  if (underTargetAreas.length > 0) {
    // Sort by deficit (largest first) and select top
    underTargetAreas.sort((a, b) => b.deficit - a.deficit);
    return underTargetAreas[0].area;
  }

  // All areas are on target, use weighted random selection
  return weightedRandomSelection(knowledgeAreaMix);
}

/**
 * Weighted random selection from knowledge area mix
 */
function weightedRandomSelection(
  knowledgeAreaMix: Array<{ area: KnowledgeArea; percentage: number }>
): KnowledgeArea {
  const total = knowledgeAreaMix.reduce((sum, config) => sum + config.percentage, 0);
  let random = Math.random() * total;

  for (const config of knowledgeAreaMix) {
    random -= config.percentage;
    if (random <= 0) {
      return config.area;
    }
  }

  // Fallback to first area
  return knowledgeAreaMix[0].area;
}
