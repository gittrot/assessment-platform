/**
 * Platform constants and configuration
 */

import { KnowledgeArea, QuestionType } from './types';

export const KNOWLEDGE_AREA_DESCRIPTIONS: Record<KnowledgeArea, string> = {
  [KnowledgeArea.PROGRAMMING_LANGUAGE]: 'Language-specific coding & syntax',
  [KnowledgeArea.ALGORITHMS_DATA_STRUCTURES]: 'Algorithms, data structures, problem-solving, implementation, optimization',
  [KnowledgeArea.ANALYTICAL_REASONING]: 'Pattern recognition, logical thinking',
  [KnowledgeArea.QUANTITATIVE_MATH]: 'Numerical reasoning, calculations',
  [KnowledgeArea.SYSTEM_SCENARIO_DESIGN]: 'Real-world problem solving',
  [KnowledgeArea.PSYCHOMETRIC_BEHAVIORAL]: 'Cognitive ability, decision making'
};

export const KNOWLEDGE_AREA_QUESTION_TYPES: Record<KnowledgeArea, QuestionType[]> = {
  [KnowledgeArea.PROGRAMMING_LANGUAGE]: [QuestionType.MCQ, QuestionType.CODING],
  [KnowledgeArea.ALGORITHMS_DATA_STRUCTURES]: [QuestionType.PROBLEM_SOLVING, QuestionType.MCQ],
  [KnowledgeArea.ANALYTICAL_REASONING]: [QuestionType.MCQ, QuestionType.SCENARIO_BASED],
  [KnowledgeArea.QUANTITATIVE_MATH]: [QuestionType.NUMERICAL, QuestionType.MCQ],
  [KnowledgeArea.SYSTEM_SCENARIO_DESIGN]: [QuestionType.SCENARIO_BASED, QuestionType.PROBLEM_SOLVING],
  [KnowledgeArea.PSYCHOMETRIC_BEHAVIORAL]: [QuestionType.SCENARIO_BASED, QuestionType.MCQ]
};

export const DEFAULT_QUESTIONS_PER_ASSESSMENT = 20;
export const MIN_QUESTIONS_PER_KNOWLEDGE_AREA = 2;
export const MAX_DIFFICULTY = 5;
export const MIN_DIFFICULTY = 1;

// Adaptive difficulty thresholds
export const DIFFICULTY_INCREASE_THRESHOLD = 0.8; // 80% correct to increase
export const DIFFICULTY_DECREASE_THRESHOLD = 0.4; // 40% correct to decrease
export const DIFFICULTY_STABLE_WINDOW = 3; // Questions to maintain before changing

// DynamoDB table names (will be set via environment)
export const TABLES = {
  ASSESSMENTS: process.env.ASSESSMENTS_TABLE || 'Assessments',
  QUESTIONS: process.env.QUESTIONS_TABLE || 'Questions',
  SESSIONS: process.env.SESSIONS_TABLE || 'CandidateSessions',
  METRICS: process.env.METRICS_TABLE || 'PerformanceMetrics',
  INSIGHTS: process.env.INSIGHTS_TABLE || 'AIInsights',
  DASHBOARDS: process.env.DASHBOARDS_TABLE || 'TenantDashboards'
};

// Cognito configuration
export const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
export const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || '';

// OpenAI configuration
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
/** Faster model for adaptive (per-question) generation; reduces next-question latency. */
export const OPENAI_MODEL_ADAPTIVE = process.env.OPENAI_MODEL_ADAPTIVE || 'gpt-4o-mini';

// API Gateway
export const API_BASE_URL = process.env.API_BASE_URL || '';
