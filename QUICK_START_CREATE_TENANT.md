# Quick Start: Create Tenant User

## 🚀 Quick Methods

### Method 1: Using the Web UI (Easiest)

1. **Log in as Admin**
   - Go to: http://localhost:3000
   - Email: `admin@example.com`
   - Password: `AdminPass123!`

2. **Navigate to Create Tenant User**
   - Click "Create Tenant User" in the navigation bar

3. **Fill in the Form**
   - **Email**: `tenant@example.com`
   - **Tenant ID**: `acme-corp` (or any unique identifier)
   - **Temporary Password**: `TempPass123!` (optional - leave empty to auto-generate)

4. **Click "Create Tenant User"**

✅ Done! The tenant user is created and can now log in.

---

### Method 2: Using cURL (Command Line)

```bash
# Step 1: Login as admin and get token
TOKEN=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}' \
  | jq -r '.accessToken')

# Step 2: Create tenant user
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email": "tenant@example.com",
    "tenantId": "acme-corp",
    "temporaryPassword": "TempPass123!"
  }'
```

---

### Method 3: Using JavaScript/Fetch

```javascript
// Login first
const loginRes = await fetch('https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'AdminPass123!'
  })
});
const { accessToken } = await loginRes.json();

// Create tenant user
const createRes = await fetch('https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    email: 'tenant@example.com',
    tenantId: 'acme-corp',
    temporaryPassword: 'TempPass123!'
  })
});
const result = await createRes.json();
console.log('Created:', result);
```

---

## 📋 Required Fields

- **email** (required): Valid email address
- **tenantId** (required): Unique identifier (letters, numbers, hyphens, underscores only)
- **temporaryPassword** (optional): Must meet password policy if provided

## 🔐 Password Policy

If providing a temporary password, it must:
- Be at least 8 characters
- Include uppercase letter
- Include lowercase letter
- Include a digit
- Include a special character

## ✅ What Happens Next?

1. Tenant user is created in Cognito
2. User is assigned to the `TENANT` group
3. User attributes are set:
   - `email`: The provided email
   - `custom:tenantId`: The tenant ID
   - `custom:role`: TENANT
4. User can log in with the temporary password
5. On first login, user must change password

## 📚 Full Documentation

See `docs/CREATE_TENANT_USER.md` for complete documentation with error handling, examples, and troubleshooting.
