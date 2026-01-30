# Troubleshooting: 401 Unauthorized Error

## Common Cause: Expired Token

The most common reason for getting a **401 Unauthorized** error is that your authentication token has expired.

### Cognito Token Expiration
- Cognito access tokens typically expire after **1 hour**
- If you've been logged in for more than an hour, your token may have expired
- The token is stored in `localStorage` and doesn't automatically refresh

## ✅ Solution: Re-login

1. **Click "Logout"** in the navigation bar
2. **Log in again** with your admin credentials:
   - Email: `admin@example.com`
   - Password: `AdminPass123!`
3. **Try the operation again**

## 🔍 Other Possible Causes

### 1. Invalid Token
- Token might be corrupted in localStorage
- **Solution**: Clear browser storage and log in again

### 2. Not an ADMIN User
- Only ADMIN users can create tenant users
- **Solution**: Make sure you're logged in as an admin user

### 3. Token Not Being Sent
- Check browser DevTools → Network tab
- Verify the `Authorization: Bearer <token>` header is present
- **Solution**: If header is missing, try logging out and back in

## 🛠️ Quick Fix: Clear Storage

If re-logging doesn't work, try clearing browser storage:

1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Find **Local Storage** → your domain
4. Delete `accessToken` and `user` entries
5. Refresh the page
6. Log in again

## 📝 How to Check Token Status

### In Browser Console:
```javascript
// Check if token exists
console.log('Token:', localStorage.getItem('accessToken'))

// Check token expiration (JWT tokens contain expiration)
const token = localStorage.getItem('accessToken')
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]))
  const expiration = new Date(payload.exp * 1000)
  console.log('Token expires:', expiration)
  console.log('Is expired:', expiration < new Date())
}
```

## 🔄 Automatic Token Refresh (Future Enhancement)

Currently, tokens don't automatically refresh. A future enhancement could:
- Implement token refresh using the refresh token
- Automatically detect 401 errors and attempt refresh
- Redirect to login if refresh fails

## ✅ What's Fixed

The application now:
- ✅ Shows clear error messages when token expires
- ✅ Automatically detects 401 errors when loading assessments
- ✅ Prompts you to log out and log back in
- ✅ Includes CORS headers so you can see the actual error (not just CORS errors)

## 🚀 Quick Test

After logging in, try creating a tenant user. If you get a 401 error:
1. Check the error message - it should clearly say "Your session has expired"
2. Click "Logout"
3. Log in again
4. Try creating the tenant user again

The error message will guide you through the process!
