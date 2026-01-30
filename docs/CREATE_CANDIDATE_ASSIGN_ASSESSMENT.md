# How to Create a Candidate and Assign an Assessment

## Overview

In this platform, **candidates are not created as separate users**. Instead, candidates are identified by their email and name when they start an assessment session. To assign an assessment to a candidate, you start a session that links the candidate to the assessment.

## Process Flow

1. **Create an Assessment** (requires tenant/admin login)
2. **Start a Candidate Session** (public endpoint, no authentication required)
3. **Candidate takes the assessment** using the session

---

## Step 1: Create an Assessment

First, you need to create an assessment. This requires authentication as a tenant or admin user.

### Using the Web UI

1. Log in as a tenant or admin user
2. Navigate to "Create Assessment"
3. Fill in the assessment details:
   - Title
   - Description
   - Target Role (name and seniority level)
   - Knowledge Area Mix (percentages must sum to 100%)
   - Initial Difficulty (1-5)
   - Duration (minutes)
4. Click "Create Assessment"
5. **Save the `assessmentId`** from the response

### Using cURL

```bash
# First, get your auth token
TOKEN=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"your-email@example.com","password":"YourPassword"}' \
  | jq -r '.idToken')

# Create assessment
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/assessments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**Response:**
```json
{
  "assessment": {
    "assessmentId": "abc-123-def-456",
    "title": "Senior Backend Engineer Assessment",
    ...
  }
}
```

**Save the `assessmentId`** - you'll need it for the next step.

---

## Step 2: Assign Assessment to Candidate (Start Session)

To assign an assessment to a candidate, you start a session. This is a **public endpoint** - no authentication required.

### Using cURL

```bash
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/sessions/start \
  -H "Content-Type: application/json" \
  -d '{
    "assessmentId": "abc-123-def-456",
    "candidateEmail": "candidate@example.com",
    "candidateName": "John Doe"
  }'
```

**Response:**
```json
{
  "sessionId": "session-xyz-789",
  "assessmentId": "abc-123-def-456",
  "startedAt": "2024-01-15T10:30:00Z"
}
```

**Save the `sessionId`** - the candidate will use this to take the assessment.

### Using JavaScript/Fetch

```javascript
const response = await fetch('https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/sessions/start', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    assessmentId: 'abc-123-def-456',
    candidateEmail: 'candidate@example.com',
    candidateName: 'John Doe'
  })
});

const data = await response.json();
console.log('Session ID:', data.sessionId);
```

---

## Step 3: Candidate Takes Assessment

Once a session is started, the candidate can:

1. **Get the next question:**
   ```bash
   GET /sessions/{sessionId}/next-question
   ```

2. **Submit an answer:**
   ```bash
   POST /sessions/{sessionId}/answer
   Body: {
     "questionId": "question-id",
     "answer": "B",
     "timeSpentSeconds": 45
   }
   ```

3. **Submit the session (when done):**
   ```bash
   POST /sessions/{sessionId}/submit
   ```

See the [API Contracts](./api/contracts.md) for full details on the candidate session API.

---

## Complete Example

Here's a complete example of creating an assessment and assigning it to a candidate:

```bash
# 1. Login as tenant/admin
TOKEN=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"tenant@example.com","password":"Password123!"}' \
  | jq -r '.idToken')

# 2. Create assessment
ASSESSMENT_RESPONSE=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/assessments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Java Developer Assessment",
    "targetRole": {
      "name": "Software Engineer",
      "seniorityLevel": "MID"
    },
    "knowledgeAreaMix": [
      {"area": "PROGRAMMING_LANGUAGE", "percentage": 40, "programmingLanguage": "Java"},
      {"area": "ALGORITHMS_DATA_STRUCTURES", "percentage": 30},
      {"area": "ANALYTICAL_REASONING", "percentage": 30}
    ],
    "initialDifficulty": 3,
    "durationMinutes": 45
  }')

ASSESSMENT_ID=$(echo $ASSESSMENT_RESPONSE | jq -r '.assessment.assessmentId')
echo "Assessment ID: $ASSESSMENT_ID"

# 3. Start candidate session
SESSION_RESPONSE=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/sessions/start \
  -H "Content-Type: application/json" \
  -d "{
    \"assessmentId\": \"$ASSESSMENT_ID\",
    \"candidateEmail\": \"john.doe@example.com\",
    \"candidateName\": \"John Doe\"
  }")

SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.sessionId')
echo "Session ID: $SESSION_ID"
echo "Candidate can now use this session ID to take the assessment"
```

---

## Important Notes

1. **No Candidate User Creation Required**: Candidates don't need to be created as Cognito users. They're identified by email/name when starting a session.

2. **Public Endpoint**: The `/sessions/start` endpoint is public - no authentication required. This allows candidates to start assessments without logging in.

3. **Assessment Must Be Active**: The assessment must have `isActive: true` for candidates to start sessions.

4. **Session ID**: Once a session is created, the candidate uses the `sessionId` to:
   - Get questions
   - Submit answers
   - Submit the completed assessment

5. **One Session Per Candidate**: Each session represents one candidate taking one assessment. If you want the same candidate to retake an assessment, start a new session.

---

## Viewing Candidate Results

After a candidate completes an assessment, you can view their results:

```bash
# Get session results (requires tenant/admin authentication)
curl -X GET https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/sessions/{sessionId} \
  -H "Authorization: Bearer $TOKEN"
```

This returns:
- Session details
- Performance metrics
- AI-generated insights
- Role-fit scores

---

## Troubleshooting

### "Assessment is not active"
- Make sure the assessment has `isActive: true`
- Check the assessment status in the dashboard

### "Assessment ID required"
- Verify you're passing the correct `assessmentId` in the request body
- The `assessmentId` comes from the assessment creation response

### "Assessment not found"
- Verify the `assessmentId` exists
- Check that you're using the correct tenant's assessment (if multi-tenant)

---

## Next Steps

- See [API Contracts](./api/contracts.md) for full API documentation
- See [Dashboard Guide](./DASHBOARD.md) for viewing candidate results
- See [Create Assessment](./CREATE_ASSESSMENT.md) for detailed assessment creation
