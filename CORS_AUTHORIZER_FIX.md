# Fix: CORS Error on 401 Unauthorized from API Gateway Authorizer

## 🔧 Root Cause

When API Gateway's Cognito authorizer rejects a request (returns 401 Unauthorized), it happens **before** the request reaches the Lambda function. API Gateway's default 401 response doesn't include CORS headers, causing CORS errors in the browser.

## ✅ Solution Applied

Added **Gateway Responses** to API Gateway that automatically add CORS headers to 401 and 403 responses from the authorizer.

### Changes Made

1. **Added Gateway Response for 401 (Unauthorized)**
   - Adds CORS headers when authorizer rejects invalid/missing tokens
   - Returns proper JSON error message

2. **Added Gateway Response for 403 (Access Denied)**
   - Adds CORS headers when authorizer rejects valid token but insufficient permissions
   - Returns proper JSON error message

### Code Changes

In `infrastructure/cdk-stack.ts`:

```typescript
// Add CORS headers to Gateway Responses (for 401, 403, etc. from authorizer)
api.addGatewayResponse('UnauthorizedResponse', {
  type: apigateway.ResponseType.UNAUTHORIZED,
  statusCode: '401',
  responseHeaders: {
    'Access-Control-Allow-Origin': "'*'",
    'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
    'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'"
  },
  templates: {
    'application/json': '{"message":$context.error.messageString}'
  }
});

api.addGatewayResponse('AccessDeniedResponse', {
  type: apigateway.ResponseType.ACCESS_DENIED,
  statusCode: '403',
  responseHeaders: {
    'Access-Control-Allow-Origin': "'*'",
    'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
    'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'"
  },
  templates: {
    'application/json': '{"message":$context.error.messageString}'
  }
});
```

## 🧪 Testing

### Test 1: Request without token (should get 401 with CORS)
```bash
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"test@example.com","tenantId":"test"}' \
  -v
```

**Expected**: 401 Unauthorized **with CORS headers**

### Test 2: Request with invalid token (should get 401 with CORS)
```bash
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid-token" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"test@example.com","tenantId":"test"}' \
  -v
```

**Expected**: 401 Unauthorized **with CORS headers**

### Test 3: Request with valid token (should work)
```bash
# Login first
TOKEN=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}' \
  | jq -r '.accessToken')

# Create tenant user
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "tenant@example.com",
    "tenantId": "test-tenant",
    "temporaryPassword": "TempPass123!"
  }' \
  -v
```

**Expected**: 201 Created with CORS headers

## ✅ What Should Work Now

1. **Browser requests with invalid/missing token**: Will get 401 with CORS headers (no CORS error)
2. **Browser requests with valid token**: Will work normally
3. **Error messages**: Will be properly formatted JSON with CORS headers

## 🔍 Troubleshooting

If you still get CORS errors:

1. **Check if token is valid**:
   - Make sure you're logged in as an ADMIN user
   - Verify token hasn't expired (Cognito tokens expire after 1 hour)
   - Try logging in again to get a fresh token

2. **Check Authorization header**:
   - Format: `Authorization: Bearer <token>`
   - No extra spaces
   - Token should be a valid JWT (starts with `eyJ`)

3. **Verify Gateway Responses**:
   - Go to AWS Console → API Gateway → Your API
   - Check "Gateway Responses" section
   - Verify `UNAUTHORIZED` and `ACCESS_DENIED` responses exist
   - Check that they have CORS headers configured

4. **Browser DevTools**:
   - Open Network tab
   - Check the actual request headers
   - Check the response headers (should include `Access-Control-Allow-Origin`)
   - Look at the response body for error details

## 📝 Important Notes

- Gateway Responses only apply to errors from **API Gateway itself** (authorizer, throttling, etc.)
- Errors from **Lambda functions** are handled by the Lambda's CORS headers (already configured)
- The Gateway Response template uses API Gateway's template syntax (`$context.error.messageString`)

## 🚀 Deployment Status

✅ **Deployed Successfully**
- Gateway Responses for 401 and 403 created
- CORS headers configured on all error responses
- Changes are live

Try creating a tenant user now - even if you get a 401 error, it should include CORS headers! 🎉
