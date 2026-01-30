# Login Troubleshooting Guide

## ✅ Backend is Working

The login endpoint is working correctly - verified with curl:
```bash
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}'
```

This returns 200 OK with tokens.

## 🔍 If Browser Shows 401 Error

### Step 1: Clear Browser Cache
1. **Hard Refresh**: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Clear Cache**: 
   - Chrome: Settings → Privacy → Clear browsing data
   - Firefox: Settings → Privacy → Clear Data
3. **Try Incognito/Private Window**: This bypasses cache

### Step 2: Check Browser DevTools
1. Open DevTools (F12)
2. Go to **Network** tab
3. Try logging in
4. Check the actual request:
   - Look for the `/auth/login` request
   - Check the **Status Code** (should be 200, not 401)
   - Check **Response Headers** (should include CORS headers)
   - Check **Response Body** (should contain tokens)

### Step 3: Check for CORS Issues
If you see CORS errors in the console:
- The Gateway Responses should handle this
- Try the hard refresh first
- Check that the response includes `Access-Control-Allow-Origin: *`

### Step 4: Verify Credentials
Make sure you're using:
- **Email**: `admin@example.com`
- **Password**: `AdminPass123!`

### Step 5: Check Console for Errors
Look for:
- Network errors
- CORS errors
- JavaScript errors
- Any error messages in the console

## 🧪 Test Directly

Open browser console and run:
```javascript
fetch('https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'AdminPass123!'
  })
})
.then(r => {
  console.log('Status:', r.status);
  console.log('Headers:', [...r.headers.entries()]);
  return r.json();
})
.then(data => {
  console.log('Response:', data);
  if (data.idToken) {
    console.log('✅ Login successful!');
    console.log('ID Token:', data.idToken.substring(0, 50) + '...');
  }
})
.catch(err => console.error('Error:', err));
```

## 🔧 Common Issues

### Issue: "Auth flow not enabled for this client"
- **Cause**: USER_PASSWORD_AUTH might not be enabled (but admin auth should work)
- **Solution**: The code automatically falls back to ADMIN_NO_SRP_AUTH, which always works
- **Status**: This is expected and handled automatically

### Issue: 401 Unauthorized in Browser but curl works
- **Cause**: Browser cache, CORS preflight, or response parsing issue
- **Solution**: 
  1. Hard refresh (Cmd+Shift+R)
  2. Clear cache
  3. Try incognito window
  4. Check Network tab for actual response

### Issue: Token not being stored
- **Cause**: localStorage might be blocked
- **Solution**: Check browser settings, try different browser

## ✅ Expected Behavior

After successful login:
1. Response status: **200 OK**
2. Response body contains:
   - `accessToken`
   - `idToken` (used for API Gateway)
   - `refreshToken`
3. Frontend stores `idToken` in localStorage
4. User is redirected to dashboard

## 🚀 Quick Fix

If nothing else works:
1. **Clear all browser data** for localhost:3000
2. **Restart the frontend dev server**
3. **Try logging in again**

The backend is confirmed working, so any issues are likely browser-side (cache, CORS, or response parsing).
