# Quick Start: Assign Assessment to Candidate

## 🚀 Quick Method

### Step 1: Get Assessment ID

First, list your assessments or create a new one:

```bash
# Login
TOKEN=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}' \
  | jq -r '.idToken')

# List assessments
curl -X GET https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/assessments \
  -H "Authorization: Bearer $TOKEN" | jq '.assessments[0].assessmentId'
```

### Step 2: Start Candidate Session

```bash
# Replace ASSESSMENT_ID with your actual assessment ID
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/sessions/start \
  -H "Content-Type: application/json" \
  -d '{
    "assessmentId": "YOUR_ASSESSMENT_ID",
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

### Step 3: Share Session ID with Candidate

The candidate uses the `sessionId` to:
- Get questions: `GET /sessions/{sessionId}/next-question`
- Submit answers: `POST /sessions/{sessionId}/answer`
- Complete assessment: `POST /sessions/{sessionId}/submit`

---

## 📝 Example: Complete Flow

```bash
#!/bin/bash

API_ENDPOINT="https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/"

# 1. Login
TOKEN=$(curl -s -X POST ${API_ENDPOINT}auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}' \
  | jq -r '.idToken')

# 2. Get first assessment ID
ASSESSMENT_ID=$(curl -s -X GET ${API_ENDPOINT}assessments \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.assessments[0].assessmentId')

echo "Assessment ID: $ASSESSMENT_ID"

# 3. Start candidate session
SESSION=$(curl -s -X POST ${API_ENDPOINT}sessions/start \
  -H "Content-Type: application/json" \
  -d "{
    \"assessmentId\": \"$ASSESSMENT_ID\",
    \"candidateEmail\": \"john.doe@example.com\",
    \"candidateName\": \"John Doe\"
  }")

SESSION_ID=$(echo $SESSION | jq -r '.sessionId')
echo "Session ID: $SESSION_ID"
echo ""
echo "✅ Candidate can now use session ID: $SESSION_ID"
echo "   to take the assessment"
```

---

## 💡 Key Points

- ✅ **No candidate user creation needed** - just email and name
- ✅ **Public endpoint** - no authentication required for `/sessions/start`
- ✅ **One session = one candidate taking one assessment**
- ✅ **Session ID is what the candidate uses** to take the test

---

## 🔍 View Results Later

```bash
# Get candidate results (requires auth)
curl -X GET ${API_ENDPOINT}sessions/$SESSION_ID \
  -H "Authorization: Bearer $TOKEN" | jq
```
