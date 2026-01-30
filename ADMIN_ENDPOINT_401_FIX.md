# Fix: 401 Unauthorized on /admin/tenants Endpoint

## 🔧 Issues Fixed

### 1. Missing CORS Headers in Error Responses
- **Problem**: Error responses (401, 403, etc.) didn't include CORS headers, causing CORS errors in the browser
- **Fix**: Added comprehensive CORS headers to all error responses in `admin.ts`

### 2. Missing OPTIONS Handler
- **Problem**: No OPTIONS method handler for CORS preflight requests
- **Fix**: Added OPTIONS request handling in `admin-handler.ts`

### 3. Missing CORS Preflight Configuration
- **Problem**: API Gateway didn't have CORS preflight options configured for admin resources
- **Fix**: Added CORS preflight options to `/admin`, `/admin/tenants`, and `/admin/admins` resources in CDK stack

## ✅ Changes Made

### 1. `src/lambda/handlers/admin-handler.ts`
- Added CORS headers constant
- Added OPTIONS request handler
- Added CORS headers to all responses (including 404 and 500 errors)

### 2. `src/lambda/handlers/admin.ts`
- Added comprehensive CORS headers to success responses
- Added CORS headers to error responses (wrapped `formatErrorResponse`)

### 3. `infrastructure/cdk-stack.ts`
- Added CORS preflight options to `/admin` resource
- Added CORS preflight options to `/admin/tenants` resource
- Added CORS preflight options to `/admin/admins` resource
- Changed Lambda integration to use `proxy: true` for proper header passthrough

## 🧪 Testing

### Test 1: OPTIONS Preflight Request
```bash
curl -X OPTIONS https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**Expected**: 200 OK with CORS headers

### Test 2: Create Tenant User (with valid token)
```bash
# First, login as admin
TOKEN=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}' \
  | jq -r '.accessToken')

# Then create tenant user
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

### Test 3: Create Tenant User (without token - should get 401 with CORS)
```bash
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{
    "email": "tenant@example.com",
    "tenantId": "test-tenant"
  }' \
  -v
```

**Expected**: 401 Unauthorized with CORS headers (no CORS error in browser)

## ✅ What Should Work Now

1. **Browser Requests**: CORS preflight (OPTIONS) requests will succeed
2. **Error Responses**: 401/403 errors will include CORS headers, so browsers won't show CORS errors
3. **Success Responses**: All responses include proper CORS headers
4. **Frontend**: The CreateTenantUser component should work without CORS errors

## 🔍 Troubleshooting

If you still get 401 errors:

1. **Check Token Validity**:
   - Make sure you're logged in as an ADMIN user
   - Verify the token hasn't expired (Cognito tokens expire after 1 hour)
   - Try logging in again to get a fresh token

2. **Check Authorization Header**:
   - Ensure the header is: `Authorization: Bearer <token>`
   - No extra spaces or quotes
   - Token should start with `eyJ` (JWT format)

3. **Check User Role**:
   - Only ADMIN users can create tenant users
   - Verify your user is in the ADMIN Cognito group

4. **Browser Console**:
   - Open DevTools (F12)
   - Check Network tab for the actual request
   - Verify Authorization header is being sent
   - Check response headers for CORS headers

## 📝 CORS Headers Now Included

All responses now include:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token
Access-Control-Max-Age: 3600
```

## 🚀 Deployment Status

✅ **Deployed Successfully**
- Lambda functions updated
- API Gateway CORS configuration updated
- All changes are live

Try creating a tenant user now - it should work! 🎉
