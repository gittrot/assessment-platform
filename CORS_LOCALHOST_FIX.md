# CORS Fix for Localhost

## 🔧 Issue
CORS errors when accessing API from `http://localhost:3000`

## ✅ Solution Applied

### 1. Resource-Level CORS Configuration
- Added CORS preflight options at the `/auth` resource level
- Added CORS preflight options at the `/auth/login` resource level
- This ensures CORS is properly configured for the entire auth path

### 2. Simplified Integration
- Using simple Lambda proxy integration
- Lambda function returns CORS headers in response
- API Gateway passes through headers from Lambda

### 3. Headers Configured
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

## 🚀 After Deployment

1. **Wait for deployment** (2-3 minutes)
2. **Hard refresh browser**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. **Clear browser cache** if needed
4. **Try login again**

## 🧪 Test CORS

### In Browser Console:
```javascript
fetch('https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'AdminPass123!'
  })
})
.then(r => r.json())
.then(console.log)
.catch(console.error)
```

### With curl:
```bash
curl -X POST "https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}' \
  -v
```

## ✅ Expected Result

- No CORS errors in browser console
- OPTIONS preflight request succeeds
- POST request succeeds with CORS headers
- Login works from localhost:3000

## 🔍 Verify

Check browser Network tab:
1. OPTIONS request to `/auth/login` → 200 OK with CORS headers
2. POST request to `/auth/login` → 200 OK with CORS headers
3. Response includes `Access-Control-Allow-Origin: *`
