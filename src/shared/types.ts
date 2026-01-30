/**
 * Core type definitions for the Adaptive Assessment Platform
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  TENANT = 'TENANT',
  CANDIDATE = 'CANDIDATE'
}

export enum KnowledgeArea {
  PROGRAMMING_LANGUAGE = 'PROGRAMMING_LANGUAGE',
  ALGORITHMS_DATA_STRUCTURES = 'ALGORITHMS_DATA_STRUCTURES',
  ANALYTICAL_REASONING = 'ANALYTICAL_REASONING',
  QUANTITATIVE_MATH = 'QUANTITATIVE_MATH',
  SYSTEM_SCENARIO_DESIGN = 'SYSTEM_SCENARIO_DESIGN',
  PSYCHOMETRIC_BEHAVIORAL = 'PSYCHOMETRIC_BEHAVIORAL'
}

export enum SeniorityLevel {
  JUNIOR = 'JUNIOR',
  MID = 'MID',
  SENIOR = 'SENIOR',
  LEAD = 'LEAD'
}

export enum QuestionType {
  MCQ = 'MCQ',
  CODING = 'CODING',
  PROBLEM_SOLVING = 'PROBLEM_SOLVING',
  NUMERICAL = 'NUMERICAL',
  SCENARIO_BASED = 'SCENARIO_BASED'
}

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export interface KnowledgeAreaConfig {
  area: KnowledgeArea;
  percentage: number; // 0-100
  programmingLanguage?: string; // e.g., "Java", "Python" for PROGRAMMING_LANGUAGE
}

export interface TargetRole {
  name: string;
  seniorityLevel: SeniorityLevel;
}

export interface Assessment {
  assessmentId: string;
  tenantId: string;
  title: string;
  description?: string;
  targetRole: TargetRole;
  knowledgeAreaMix: KnowledgeAreaConfig[];
  initialDifficulty: DifficultyLevel;
  durationMinutes?: number;
  maxQuestions?: number; // Configurable number of questions (default: 10)
  createdAt: string;
  updatedAt: string;
  createdBy: string; // userId
  isActive: boolean;
}

export interface Question {
  questionId: string;
  assessmentId: string;
  tenantId: string;
  questionText: string;
  questionType: QuestionType;
  knowledgeArea: KnowledgeArea;
  difficulty: DifficultyLevel;
  options?: string[]; // For MCQ
  correctAnswer: string | string[];
  explanation: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface CandidateSession {
  sessionId: string;
  assessmentId: string;
  tenantId: string;
  candidateEmail?: string;
  candidateName?: string;
  startedAt: string;
  submittedAt?: string;
  currentDifficulty: Record<KnowledgeArea, DifficultyLevel>;
  questionsAnswered: QuestionResponse[];
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
}

export interface QuestionResponse {
  questionId: string;
  knowledgeArea: KnowledgeArea;
  difficulty: DifficultyLevel;
  answer: string | string[];
  isCorrect: boolean;
  timeSpentSeconds: number;
  answeredAt: string;
}

export interface PerformanceMetrics {
  sessionId: string;
  assessmentId: string;
  tenantId: string;
  overallScore: number; // 0-100
  roleFitScore: number; // 0-100
  knowledgeAreaScores: Record<KnowledgeArea, {
    score: number;
    questionsAnswered: number;
    correctAnswers: number;
    avgDifficultyReached: number;
    avgTimePerQuestion: number;
  }>;
  strengths: KnowledgeArea[];
  weaknesses: KnowledgeArea[];
  completedAt: string;
}

export interface AIInsight {
  sessionId: string;
  assessmentId: string;
  tenantId: string;
  roleFitAssessment: string;
  strengthAreas: Array<{
    area: KnowledgeArea;
    explanation: string;
  }>;
  weakAreas: Array<{
    area: KnowledgeArea;
    explanation: string;
    rootCause?: string;
  }>;
  trainingRecommendations: string[];
  roleReadinessScore: number; // 0-100
  followUpSuggestions?: string[];
  generatedAt: string;
}

export interface TenantDashboard {
  tenantId: string;
  totalAssessments: number;
  totalCandidates: number;
  completionRate: number; // 0-100
  avgRoleFitScore: number;
  knowledgeAreaBreakdown: Record<KnowledgeArea, {
    avgScore: number;
    candidateCount: number;
    avgDifficultyReached: number;
  }>;
  recentSessions: string[]; // sessionIds
  lastUpdated: string;
}

export interface CognitoUserAttributes {
  sub: string;
  email: string;
  'custom:tenantId'?: string;
  'custom:role': UserRole;
}
