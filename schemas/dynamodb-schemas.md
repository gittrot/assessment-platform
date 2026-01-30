# DynamoDB Schemas & Access Patterns

## Table Design Principles

- **Partition Key**: Always `tenantId` for multi-tenant isolation
- **Sort Key**: Entity-specific identifier
- **GSI**: For querying by other attributes
- **Billing**: On-Demand (pay-per-request) for cost optimization

---

## Tables

### 1. Assessments Table

**Table Name**: `Assessments`

**Schema**:
```
PK: tenantId (String)
SK: assessmentId (String)

Attributes:
- title (String)
- description (String)
- targetRole (Map)
  - name (String)
  - seniorityLevel (String)
- knowledgeAreaMix (List of Maps)
  - area (String)
  - percentage (Number)
  - programmingLanguage (String, optional)
- initialDifficulty (Number)
- durationMinutes (Number, optional)
- createdAt (String)
- updatedAt (String)
- createdBy (String)
- isActive (Boolean)
```

**Access Patterns**:
1. Get assessment by tenantId + assessmentId
2. List all assessments for a tenant
3. List active assessments for a tenant (GSI: isActive + createdAt)

**GSI1**: `status-createdAt-index`
- PK: isActive (String)
- SK: createdAt (String)

---

### 2. Questions Table

**Table Name**: `Questions`

**Schema**:
```
PK: tenantId (String)
SK: questionId (String) // Format: assessmentId#questionId

Attributes:
- assessmentId (String)
- questionText (String)
- questionType (String)
- knowledgeArea (String)
- difficulty (Number)
- options (List of Strings, optional)
- correctAnswer (String or List)
- explanation (String)
- metadata (Map, optional)
- createdAt (String)
```

**Access Patterns**:
1. Get question by tenantId + questionId
2. List questions for an assessment (query by tenantId, SK begins_with assessmentId)
3. Get questions by knowledge area and difficulty (GSI)

**GSI1**: `knowledgeArea-difficulty-index`
- PK: knowledgeArea (String)
- SK: difficulty (Number)

---

### 3. CandidateSessions Table

**Table Name**: `CandidateSessions`

**Schema**:
```
PK: tenantId (String)
SK: sessionId (String)

Attributes:
- assessmentId (String)
- candidateEmail (String, optional)
- candidateName (String, optional)
- startedAt (String)
- submittedAt (String, optional)
- currentDifficulty (Map)
  - KnowledgeArea -> DifficultyLevel
- questionsAnswered (List of Maps)
  - questionId (String)
  - knowledgeArea (String)
  - difficulty (Number)
  - answer (String or List)
  - isCorrect (Boolean)
  - timeSpentSeconds (Number)
  - answeredAt (String)
- status (String) // IN_PROGRESS, COMPLETED, ABANDONED
```

**Access Patterns**:
1. Get session by tenantId + sessionId
2. List sessions for an assessment (GSI: assessmentId + startedAt)
3. List all sessions for a tenant

**GSI1**: `assessmentId-startedAt-index`
- PK: assessmentId (String)
- SK: startedAt (String)

---

### 4. PerformanceMetrics Table

**Table Name**: `PerformanceMetrics`

**Schema**:
```
PK: tenantId (String)
SK: sessionId (String)

Attributes:
- assessmentId (String)
- overallScore (Number)
- roleFitScore (Number)
- knowledgeAreaScores (Map)
  - KnowledgeArea -> {
      score (Number)
      questionsAnswered (Number)
      correctAnswers (Number)
      avgDifficultyReached (Number)
      avgTimePerQuestion (Number)
    }
- strengths (List of Strings)
- weaknesses (List of Strings)
- completedAt (String)
```

**Access Patterns**:
1. Get metrics by tenantId + sessionId
2. List metrics for an assessment (GSI: assessmentId + completedAt)
3. Aggregate metrics for dashboard

**GSI1**: `assessmentId-completedAt-index`
- PK: assessmentId (String)
- SK: completedAt (String)

---

### 5. AIInsights Table

**Table Name**: `AIInsights`

**Schema**:
```
PK: tenantId (String)
SK: sessionId (String)

Attributes:
- assessmentId (String)
- roleFitAssessment (String)
- strengthAreas (List of Maps)
  - area (String)
  - explanation (String)
- weakAreas (List of Maps)
  - area (String)
  - explanation (String)
  - rootCause (String, optional)
- trainingRecommendations (List of Strings)
- roleReadinessScore (Number)
- followUpSuggestions (List of Strings, optional)
- generatedAt (String)
```

**Access Patterns**:
1. Get insights by tenantId + sessionId
2. List insights for an assessment (GSI: assessmentId + generatedAt)

**GSI1**: `assessmentId-generatedAt-index`
- PK: assessmentId (String)
- SK: generatedAt (String)

---

### 6. TenantDashboards Table

**Table Name**: `TenantDashboards`

**Schema**:
```
PK: tenantId (String)
SK: dashboardId (String) // Always "DASHBOARD"

Attributes:
- totalAssessments (Number)
- totalCandidates (Number)
- completionRate (Number)
- avgRoleFitScore (Number)
- knowledgeAreaBreakdown (Map)
  - KnowledgeArea -> {
      avgScore (Number)
      candidateCount (Number)
      avgDifficultyReached (Number)
    }
- recentSessions (List of Strings) // sessionIds
- lastUpdated (String)
```

**Access Patterns**:
1. Get dashboard by tenantId + "DASHBOARD"
2. Update dashboard (replace entire item)

**Note**: Single item per tenant, updated on-demand or via scheduled Lambda

---

## Query Examples

### Get all assessments for a tenant
```typescript
const assessments = await queryByPartitionKey<Assessment>(
  TABLES.ASSESSMENTS,
  tenantId
);
```

### Get questions for an assessment
```typescript
const questions = await queryByPartitionKey<Question>(
  TABLES.QUESTIONS,
  tenantId,
  `${assessmentId}#`
);
```

### Get sessions for an assessment
```typescript
const sessions = await queryByGSI<CandidateSession>(
  TABLES.SESSIONS,
  'GSI1',
  'assessmentId = :assessmentId',
  { ':assessmentId': assessmentId }
);
```

---

## Cost Optimization

- **On-Demand Billing**: No capacity planning needed, pay only for what you use
- **Efficient Partitioning**: tenantId ensures even distribution
- **GSI Usage**: Only create GSIs for frequently queried patterns
- **Item Size**: Keep items under 400KB (DynamoDB limit)
- **Batch Operations**: Use batch writes for bulk inserts

---

## Security

- **Tenant Isolation**: Enforced at application level via partition key
- **IAM Policies**: Lambda functions have minimal required permissions
- **Encryption**: Enable encryption at rest (default in CDK)
- **Access Control**: All tenant-scoped queries validate tenantId
