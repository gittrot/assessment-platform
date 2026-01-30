/**
 * AI-powered question generation using OpenAI ChatGPT API
 */

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  Assessment,
  Question,
  KnowledgeArea,
  QuestionType,
  DifficultyLevel,
  SeniorityLevel
} from '../shared/types';
import {
  OPENAI_API_KEY,
  OPENAI_MODEL,
  OPENAI_MODEL_ADAPTIVE,
  KNOWLEDGE_AREA_DESCRIPTIONS,
  KNOWLEDGE_AREA_QUESTION_TYPES
} from '../shared/constants';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Generate questions for an assessment based on knowledge area mix
 */
export async function generateQuestionsForAssessment(
  assessment: Assessment,
  questionsPerArea: Record<KnowledgeArea, number>
): Promise<Question[]> {
  const allQuestions: Question[] = [];

  for (const config of assessment.knowledgeAreaMix) {
    const area = config.area;
    const count = questionsPerArea[area];
    
    if (count > 0) {
      const areaQuestions = await generateQuestionsForKnowledgeArea(
        assessment,
        area,
        count,
        assessment.initialDifficulty
      );
      allQuestions.push(...areaQuestions);
    }
  }

  return allQuestions;
}

/**
 * Generate questions for a specific knowledge area
 */
async function generateQuestionsForKnowledgeArea(
  assessment: Assessment,
  knowledgeArea: KnowledgeArea,
  count: number,
  difficulty: DifficultyLevel
): Promise<Question[]> {
  const questionTypes = KNOWLEDGE_AREA_QUESTION_TYPES[knowledgeArea];
  const areaDescription = KNOWLEDGE_AREA_DESCRIPTIONS[knowledgeArea];
  
  const prompt = buildQuestionGenerationPrompt(
    assessment,
    knowledgeArea,
    areaDescription,
    count,
    difficulty,
    questionTypes
  );

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert assessment question generator for technical hiring. Generate high-quality, role-appropriate questions with clear correct answers and explanations.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    return parseGeneratedQuestions(parsed, assessment, knowledgeArea);
  } catch (error) {
    console.error('Error generating questions:', error);
    throw new Error(`Failed to generate questions: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build the prompt for question generation
 */
function buildQuestionGenerationPrompt(
  assessment: Assessment,
  knowledgeArea: KnowledgeArea,
  areaDescription: string,
  count: number,
  difficulty: DifficultyLevel,
  questionTypes: QuestionType[]
): string {
  const role = assessment.targetRole;
  const programmingLang = assessment.knowledgeAreaMix.find(
    k => k.area === KnowledgeArea.PROGRAMMING_LANGUAGE
  )?.programmingLanguage;

  // Add specific guidance for ALGORITHMS_DATA_STRUCTURES to ensure diversity
  let diversityGuidance = '';
  if (knowledgeArea === KnowledgeArea.ALGORITHMS_DATA_STRUCTURES) {
    diversityGuidance = `
CRITICAL REQUIREMENTS - Algorithms & Data Structures Questions:
1. COMPLETELY AVOID time complexity questions. DO NOT generate questions that ask:
   - "What is the time complexity of..."
   - "What is the Big-O of..."
   - "What is the space complexity of..."
   - Any question primarily focused on analyzing complexity

2. REQUIRED Topic Mix (ensure variety across these):
   DATA STRUCTURES (50% of questions):
   - Array operations: insertion, deletion, searching, manipulation
   - Linked list operations: traversal, insertion, deletion, reversal
   - Stack operations: push, pop, peek, applications
   - Queue operations: enqueue, dequeue, applications
   - Tree operations: traversal (inorder, preorder, postorder), insertion, deletion, searching
   - Graph operations: representation, traversal (BFS/DFS), path finding
   - Hash table operations: insertion, lookup, collision handling
   - Heap operations: insertion, deletion, heapify
   
   ALGORITHMS (50% of questions):
   - Sorting algorithms: implementation, how they work, when to use which
   - Searching algorithms: binary search, linear search, implementation
   - Recursion: recursive solutions, base cases, recursive thinking
   - Dynamic programming: problem-solving approach, memoization, tabulation
   - Greedy algorithms: greedy strategy, implementation
   - Graph algorithms: shortest path, minimum spanning tree, topological sort
   - String algorithms: pattern matching, string manipulation
   - Tree algorithms: tree construction, tree manipulation

3. Question Focus Areas:
   - HOW algorithms work (implementation, logic, step-by-step process)
   - WHEN to use which data structure or algorithm
   - HOW to implement data structure operations
   - PROBLEM-SOLVING approaches and strategies
   - REAL-WORLD applications and use cases
   - TRADE-OFFS between different approaches (not complexity, but features/use cases)

4. Example Good Questions:
   - "How would you implement a stack using arrays?"
   - "What is the difference between BFS and DFS traversal?"
   - "How does quicksort partition elements?"
   - "When would you use a hash table vs a binary search tree?"
   - "How would you find the middle element of a linked list?"
   - "What is the process of inserting a node in a binary search tree?"

5. Example BAD Questions (DO NOT GENERATE):
   - "What is the time complexity of quicksort?"
   - "What is the Big-O of binary search?"
   - "What is the space complexity of merge sort?"
   - Any question asking primarily about complexity analysis`;
  }

  return `Generate ${count} assessment questions for a ${role.seniorityLevel} ${role.name} role.

Knowledge Area: ${knowledgeArea} (${areaDescription})
${programmingLang ? `Programming Language: ${programmingLang}` : ''}
Difficulty Level: ${difficulty}/5
Question Types: ${questionTypes.join(', ')}
${diversityGuidance}

Requirements:
- Questions must be appropriate for ${role.seniorityLevel} level ${role.name}
- Difficulty ${difficulty} means: ${getDifficultyDescription(difficulty)}
- Each question should test practical, real-world skills
- Include clear, unambiguous correct answers
- Provide detailed explanations
- For MCQ: you MUST include "options" as an array of strings, e.g. ["Option A text", "Option B text", "Option C text", "Option D text"]. The UI shows these as selectable choices. correctAnswer must match one option exactly.
- Use markdown for code in questionText and options: triple-backtick code blocks and single-backtick inline code so snippets render readably.
- Ensure variety: if generating multiple questions, cover different topics and approaches within the knowledge area.

Output format (JSON):
{
  "questions": [
    {
      "questionText": "Full question text",
      "questionType": "MCQ|CODING|PROBLEM_SOLVING|NUMERICAL|SCENARIO_BASED",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Correct answer or array for multiple correct",
      "explanation": "Detailed explanation of why this is correct",
      "difficulty": ${difficulty}
    }
  ]
}`;
}

/**
 * Get difficulty level description
 */
function getDifficultyDescription(difficulty: DifficultyLevel): string {
  const descriptions: Record<DifficultyLevel, string> = {
    1: 'Basic concepts, entry-level knowledge',
    2: 'Fundamental understanding, some experience required',
    3: 'Intermediate level, solid practical knowledge',
    4: 'Advanced concepts, deep expertise needed',
    5: 'Expert level, complex problem-solving required'
  };
  return descriptions[difficulty];
}

/**
 * Normalize AI questionType (e.g. "mcq", "Multiple Choice") to QuestionType enum.
 */
function normalizeQuestionType(raw: unknown): QuestionType {
  if (!raw || typeof raw !== 'string') return QuestionType.MCQ;
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, '_');
  if (s === 'MCQ' || s === 'MULTIPLE_CHOICE' || s === 'MULTIPLECHOICE') return QuestionType.MCQ;
  if (s === 'CODING') return QuestionType.CODING;
  if (s === 'NUMERICAL') return QuestionType.NUMERICAL;
  if (s === 'PROBLEM_SOLVING' || s === 'PROBLEMSOLVING') return QuestionType.PROBLEM_SOLVING;
  if (s === 'SCENARIO_BASED' || s === 'SCENARIOBASED') return QuestionType.SCENARIO_BASED;
  return QuestionType.MCQ;
}

/**
 * Normalize AI options to string[] for MCQ. Handles array or object shape.
 */
function normalizeOptions(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    const arr = raw.map((o) => (o != null ? String(o).trim() : '')).filter(Boolean);
    return arr.length > 0 ? arr : undefined;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const entries = Object.entries(raw as Record<string, unknown>);
    const sorted = entries.sort(([a], [b]) => {
      const order = 'ABCDEF0123456789';
      const ia = order.indexOf(String(a).toUpperCase()[0] ?? '');
      const ib = order.indexOf(String(b).toUpperCase()[0] ?? '');
      if (ia >= 0 && ib >= 0) return ia - ib;
      return String(a).localeCompare(String(b));
    });
    const arr = sorted.map(([, v]) => (v != null ? String(v).trim() : '')).filter(Boolean);
    return arr.length > 0 ? arr : undefined;
  }
  return undefined;
}

/**
 * Filter out time complexity questions for ALGORITHMS_DATA_STRUCTURES
 */
function isComplexityQuestion(questionText: string): boolean {
  const complexityKeywords = [
    'time complexity',
    'space complexity',
    'big-o',
    'big o',
    'o(n)',
    'o(log n)',
    'o(1)',
    'asymptotic',
    'complexity of',
    'what is the complexity',
    'complexity analysis',
    'time and space',
    'runtime complexity'
  ];
  
  const lowerText = questionText.toLowerCase();
  return complexityKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Parse AI-generated questions into Question objects
 */
function parseGeneratedQuestions(
  parsed: any,
  assessment: Assessment,
  knowledgeArea: KnowledgeArea
): Question[] {
  const questions: Question[] = [];
  const now = new Date().toISOString();

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('Invalid question format from AI');
  }

  for (const q of parsed.questions) {
    // Validate question object exists and has required fields
    if (!q || typeof q !== 'object') {
      console.warn('Skipping invalid question object:', q);
      continue;
    }

    // Validate required fields
    if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim() === '') {
      console.warn('Skipping question with missing or empty questionText:', q);
      continue;
    }

    // Validate tenantId before creating question
    if (!assessment.tenantId || assessment.tenantId.trim() === '') {
      throw new Error(`Cannot generate questions: assessment tenantId is empty (assessmentId: ${assessment.assessmentId})`);
    }

    // Filter out complexity questions for ALGORITHMS_DATA_STRUCTURES
    if (knowledgeArea === KnowledgeArea.ALGORITHMS_DATA_STRUCTURES && isComplexityQuestion(q.questionText)) {
      console.warn(`Filtered out complexity question: ${q.questionText.substring(0, 100)}...`);
      continue; // Skip this question
    }

    const questionType = normalizeQuestionType(q.questionType);
    const options = normalizeOptions(q.options);

    questions.push({
      questionId: uuidv4(),
      assessmentId: assessment.assessmentId,
      tenantId: assessment.tenantId.trim(),
      questionText: q.questionText,
      questionType,
      knowledgeArea,
      difficulty: q.difficulty as DifficultyLevel,
      options: options ?? undefined,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      metadata: {
        generatedBy: 'openai',
        model: OPENAI_MODEL
      },
      createdAt: now
    });
  }

  return questions;
}

/**
 * Generate a single adaptive question for a knowledge area
 */
export async function generateAdaptiveQuestion(
  assessment: Assessment,
  knowledgeArea: KnowledgeArea,
  currentDifficulty: DifficultyLevel,
  previousPerformance?: {
    correct: number;
    total: number;
  }
): Promise<Question> {
  // Cache these lookups to avoid repeated object property access
  const questionTypes = KNOWLEDGE_AREA_QUESTION_TYPES[knowledgeArea];
  const programmingLang = assessment.knowledgeAreaMix.find(
    k => k.area === KnowledgeArea.PROGRAMMING_LANGUAGE
  )?.programmingLanguage;

  // Build concise prompt for faster AI response
  const roleStr = `${assessment.targetRole.seniorityLevel} ${assessment.targetRole.name}`;
  const langStr = programmingLang ? ` (${programmingLang})` : '';
  const perfStr = previousPerformance ? ` | ${previousPerformance.correct}/${previousPerformance.total}` : '';
  const typesStr = questionTypes.join(',');
  
  const prompt = `Generate 1 question for ${roleStr}.

Area: ${knowledgeArea}${langStr}
Difficulty: ${currentDifficulty}/5${perfStr}
Types: ${typesStr}

JSON:
{
  "questionText": "Question with markdown code",
  "questionType": "MCQ|CODING|PROBLEM_SOLVING|NUMERICAL|SCENARIO_BASED",
  "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
  "correctAnswer": "Exact match",
  "explanation": "Brief",
  "difficulty": ${currentDifficulty}
}`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL_ADAPTIVE,
      messages: [
        {
          role: 'system',
          content: 'Generate one assessment question. Return JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5, // Lower for faster, more deterministic responses
      max_tokens: 800, // Limit response size for faster generation
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);
    
    // Handle case where OpenAI returns a single question object instead of array
    let questionData = parsed;
    if (parsed.questions && Array.isArray(parsed.questions)) {
      questionData = parsed.questions[0];
    }
    
    if (!questionData || !questionData.questionText) {
      throw new Error('Invalid question format from OpenAI');
    }
    
    const questions = parseGeneratedQuestions(
      { questions: [questionData] },
      assessment,
      knowledgeArea
    );

    // If question was filtered out (e.g., complexity question), retry once
    if (questions.length === 0) {
      console.warn('Question was filtered out, retrying with explicit instructions...');
      // Retry with more explicit instructions to avoid filtered content
      return await generateAdaptiveQuestionRetry(assessment, knowledgeArea, currentDifficulty, previousPerformance);
    }

    if (!questions[0]) {
      throw new Error('Failed to parse generated question');
    }

    return questions[0];
  } catch (error) {
    console.error('Error generating adaptive question:', error);
    throw new Error(`Failed to generate adaptive question: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retry question generation with more explicit instructions
 */
async function generateAdaptiveQuestionRetry(
  assessment: Assessment,
  knowledgeArea: KnowledgeArea,
  currentDifficulty: DifficultyLevel,
  previousPerformance?: {
    correct: number;
    total: number;
  }
): Promise<Question> {
  const questionTypes = KNOWLEDGE_AREA_QUESTION_TYPES[knowledgeArea];
  const programmingLang = assessment.knowledgeAreaMix.find(
    k => k.area === KnowledgeArea.PROGRAMMING_LANGUAGE
  )?.programmingLanguage;

  const roleStr = `${assessment.targetRole.seniorityLevel} ${assessment.targetRole.name}`;
  const langStr = programmingLang ? ` (${programmingLang})` : '';
  const perfStr = previousPerformance ? ` | ${previousPerformance.correct}/${previousPerformance.total}` : '';
  const typesStr = questionTypes.join(',');
  
  // More explicit prompt to avoid filtered content
  let additionalGuidance = '';
  if (knowledgeArea === KnowledgeArea.ALGORITHMS_DATA_STRUCTURES) {
    additionalGuidance = `
CRITICAL: DO NOT ask about time complexity, space complexity, Big-O, or asymptotic analysis.
Focus on: implementation, how it works, when to use, problem-solving approach, real-world application.`;
  }
  
  const prompt = `Generate 1 question for ${roleStr}.

Area: ${knowledgeArea}${langStr}
Difficulty: ${currentDifficulty}/5${perfStr}
Types: ${typesStr}
${additionalGuidance}

JSON:
{
  "questionText": "Question with markdown code",
  "questionType": "MCQ|CODING|PROBLEM_SOLVING|NUMERICAL|SCENARIO_BASED",
  "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
  "correctAnswer": "Exact match",
  "explanation": "Brief",
  "difficulty": ${currentDifficulty}
}`;

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL_ADAPTIVE,
      messages: [
        {
          role: 'system',
          content: 'Generate one assessment question. Return JSON only. Focus on practical implementation and problem-solving, not complexity analysis.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 800,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI on retry');
    }

    const parsed = JSON.parse(content);
    
    // Handle case where OpenAI returns a single question object instead of array
    let questionData = parsed;
    if (parsed.questions && Array.isArray(parsed.questions)) {
      questionData = parsed.questions[0];
    }
    
    if (!questionData || !questionData.questionText) {
      throw new Error('Invalid question format from OpenAI on retry');
    }
    
    const questions = parseGeneratedQuestions(
      { questions: [questionData] },
      assessment,
      knowledgeArea
    );

    if (questions.length === 0 || !questions[0]) {
      throw new Error('Question was filtered out even after retry');
    }

    return questions[0];
  } catch (error) {
    console.error('Error generating adaptive question on retry:', error);
    throw new Error(`Failed to generate adaptive question after retry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
