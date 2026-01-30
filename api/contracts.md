# API Contracts

## Base URL
```
https://{api-id}.execute-api.{region}.amazonaws.com/prod
```

## Authentication

### Admin & Tenant Endpoints
Require Bearer token in Authorization header:
```
Authorization: Bearer {cognito-access-token}
```

### Public Endpoints
No authentication required (candidate sessions)

---

## Endpoints

### Assessments

#### Create Assessment
```
POST /assessments
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "title": "Senior Backend Engineer Assessment",
  "description": "Comprehensive assessment for senior backend role",
  "targetRole": {
    "name": "Backend Engineer",
    "seniorityLevel": "SENIOR"
  },
  "knowledgeAreaMix": [
    {
      "area": "PROGRAMMING_LANGUAGE",
      "percentage": 30,
      "programmingLanguage": "Java"
    },
    {
      "area": "ALGORITHMS_DATA_STRUCTURES",
      "percentage": 25
    },
    {
      "area": "ANALYTICAL_REASONING",
      "percentage": 15
    },
    {
      "area": "QUANTITATIVE_MATH",
      "percentage": 10
    },
    {
      "area": "PSYCHOMETRIC_BEHAVIORAL",
      "percentage": 20
    }
  ],
  "initialDifficulty": 3,
  "durationMinutes": 60
}

Response: 201 Created
{
  "assessment": {
    "assessmentId": "uuid",
    "tenantId": "tenant-123",
    "title": "...",
    ...
  }
}
```

#### Get Assessment
```
GET /assessments/{assessmentId}
Authorization: Bearer {token}

Response: 200 OK
{
  "assessment": { ... }
}
```

#### List Assessments
```
GET /assessments?activeOnly=true
Authorization: Bearer {token}

Response: 200 OK
{
  "assessments": [ ... ]
}
```

---

### Candidate Sessions

#### Start Session
```
POST /sessions/start
Content-Type: application/json

Request Body:
{
  "assessmentId": "uuid",
  "candidateEmail": "candidate@example.com",
  "candidateName": "John Doe"
}

Response: 201 Created
{
  "sessionId": "uuid",
  "assessmentId": "uuid",
  "startedAt": "2024-01-01T00:00:00Z"
}
```

#### Get Next Question
```
GET /sessions/{sessionId}/next-question

Response: 200 OK
{
  "question": {
    "questionId": "uuid",
    "questionText": "...",
    "questionType": "MCQ",
    "options": ["A", "B", "C", "D"],
    "knowledgeArea": "PROGRAMMING_LANGUAGE",
    "difficulty": 3
  },
  "sessionId": "uuid",
  "questionsAnswered": 5
}
```

#### Submit Answer
```
POST /sessions/{sessionId}/answer
Content-Type: application/json

Request Body:
{
  "questionId": "uuid",
  "answer": "B",
  "timeSpentSeconds": 45
}

Response: 200 OK
{
  "isCorrect": true,
  "explanation": "...",
  "nextQuestionAvailable": true
}
```

#### Submit Session
```
POST /sessions/{sessionId}/submit

Response: 200 OK
{
  "sessionId": "uuid",
  "status": "COMPLETED",
  "overallScore": 85,
  "roleFitScore": 82,
  "insightsAvailable": true
}
```

#### Get Session Results (Tenant Only)
```
GET /sessions/{sessionId}
Authorization: Bearer {token}

Response: 200 OK
{
  "session": { ... },
  "metrics": { ... },
  "insights": { ... }
}
```

---

### Dashboard

#### Get Dashboard
```
GET /dashboard?tenantId=tenant-123
Authorization: Bearer {token}

Response: 200 OK
{
  "dashboard": {
    "tenantId": "tenant-123",
    "totalAssessments": 10,
    "totalCandidates": 150,
    "completionRate": 87.5,
    "avgRoleFitScore": 78.5,
    "knowledgeAreaBreakdown": { ... },
    "recentSessions": [ ... ]
  }
}
```

#### Get Candidate Drill-Down
```
GET /dashboard/candidates/{sessionId}
Authorization: Bearer {token}

Response: 200 OK
{
  "session": { ... },
  "assessment": { ... },
  "performance": { ... },
  "insights": { ... },
  "difficultyProgression": [ ... ],
  "timeAnalysis": { ... }
}
```

---

### Admin

#### Create Tenant User
```
POST /admin/tenants
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "email": "tenant@example.com",
  "tenantId": "tenant-123",
  "temporaryPassword": "TempPass123!"
}

Response: 201 Created
{
  "username": "uuid",
  "email": "tenant@example.com",
  "tenantId": "tenant-123",
  "message": "Tenant user created successfully"
}
```

#### Create Admin User
```
POST /admin/admins
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "email": "admin@example.com",
  "temporaryPassword": "TempPass123!"
}

Response: 201 Created
{
  "username": "uuid",
  "email": "admin@example.com",
  "message": "Admin user created successfully"
}
```

---

## Error Responses

All errors follow this format:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Error Codes
- `AUTHENTICATION_ERROR` (401)
- `AUTHORIZATION_ERROR` (403)
- `TENANT_ISOLATION_ERROR` (403)
- `VALIDATION_ERROR` (400)
- `NOT_FOUND_ERROR` (404)
- `CONFLICT_ERROR` (409)
- `INTERNAL_ERROR` (500)
