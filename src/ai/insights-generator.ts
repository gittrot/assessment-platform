/**
 * AI-powered role-fit insights and recommendations generator
 */

import OpenAI from 'openai';
import {
  PerformanceMetrics,
  AIInsight,
  KnowledgeArea,
  Assessment
} from '../shared/types';
import {
  OPENAI_API_KEY,
  OPENAI_MODEL,
  KNOWLEDGE_AREA_DESCRIPTIONS
} from '../shared/constants';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Generate AI insights for a candidate's performance
 */
export async function generateInsights(
  metrics: PerformanceMetrics,
  assessment: Assessment
): Promise<AIInsight> {
  const prompt = buildInsightsPrompt(metrics, assessment);

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert hiring consultant and talent assessment analyst. Provide detailed, actionable insights about candidate performance and role fit.'
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
    return parseInsights(parsed, metrics);
  } catch (error) {
    console.error('Error generating insights:', error);
    throw new Error(`Failed to generate insights: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Build the prompt for insights generation
 */
function buildInsightsPrompt(
  metrics: PerformanceMetrics,
  assessment: Assessment
): string {
  const role = assessment.targetRole;
  const knowledgeAreaScores = Object.entries(metrics.knowledgeAreaScores)
    .map(([area, data]) => {
      const areaName = KNOWLEDGE_AREA_DESCRIPTIONS[area as KnowledgeArea];
      return `- ${area}: ${data.score}% (${data.correctAnswers}/${data.questionsAnswered} correct, avg difficulty: ${data.avgDifficultyReached.toFixed(1)}) - ${areaName}`;
    })
    .join('\n');

  return `Analyze this candidate's assessment performance and provide role-fit insights.

Target Role: ${role.seniorityLevel} ${role.name}
Overall Score: ${metrics.overallScore}% (weighted average across all knowledge areas)
Role Fit Score: ${metrics.roleFitScore}% (emphasizes role-critical areas: ${role.seniorityLevel === 'SENIOR' || role.seniorityLevel === 'LEAD' ? 'System Design and Algorithms' : 'Programming Language and Analytical Reasoning'})

Knowledge Area Performance:
${knowledgeAreaScores}

Strengths: ${metrics.strengths.length > 0 ? metrics.strengths.join(', ') : 'None identified'}
Weaknesses: ${metrics.weaknesses.length > 0 ? metrics.weaknesses.join(', ') : 'None identified'}

Provide a comprehensive analysis including:
1. Overall role-fit assessment (2-3 sentences) - Explain what the scores mean, why they differ (if they do), and overall suitability for the role
2. Detailed analysis of strength areas (why they're strong, what it means) - Only if strengths exist
3. Detailed analysis of weak areas (root causes, implications) - Focus on areas critical for this role
4. Specific training recommendations based on weaknesses
5. Role readiness score (0-100) - Based on role fit score and critical area performance
6. Follow-up assessment suggestions (if applicable) - Only if scores are borderline or need verification

IMPORTANT: 
- If overall score and role fit score are similar, explain that the candidate performed consistently across all areas
- If role fit score is lower than overall score, explain that the candidate struggled particularly in role-critical areas
- If role fit score is higher than overall score, explain that the candidate performed better in role-critical areas despite overall weaknesses

Output format (JSON):
{
  "roleFitAssessment": "2-3 sentence overall assessment",
  "strengthAreas": [
    {
      "area": "KNOWLEDGE_AREA",
      "explanation": "Why this is a strength and what it indicates"
    }
  ],
  "weakAreas": [
    {
      "area": "KNOWLEDGE_AREA",
      "explanation": "Why this is weak",
      "rootCause": "Potential root cause analysis"
    }
  ],
  "trainingRecommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2"
  ],
  "roleReadinessScore": 85,
  "followUpSuggestions": [
    "Suggestion 1",
    "Suggestion 2"
  ]
}`;
}

/**
 * Parse AI-generated insights into AIInsight object
 */
function parseInsights(parsed: any, metrics: PerformanceMetrics): AIInsight {
  return {
    sessionId: metrics.sessionId,
    assessmentId: metrics.assessmentId,
    tenantId: metrics.tenantId,
    roleFitAssessment: parsed.roleFitAssessment || 'Assessment pending',
    strengthAreas: parsed.strengthAreas || [],
    weakAreas: parsed.weakAreas || [],
    trainingRecommendations: parsed.trainingRecommendations || [],
    roleReadinessScore: parsed.roleReadinessScore || 0,
    followUpSuggestions: parsed.followUpSuggestions || [],
    generatedAt: new Date().toISOString()
  };
}
