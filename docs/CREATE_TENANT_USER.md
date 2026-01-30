# How to Create a Tenant User

## Overview

Tenant users are users who belong to a specific tenant organization. They can create and manage assessments for their organization. Only **ADMIN** users can create tenant users.

---

## Method 1: Using the API (cURL)

### Prerequisites
- You must be logged in as an ADMIN user
- You need the admin's access token

### Step 1: Login as Admin

```bash
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "AdminPass123!"
  }'
```

**Response:**
```json
{
  "accessToken": "eyJraWQiOiJ...",
  "idToken": "eyJraWQiOiJ...",
  "refreshToken": "eyJjdHkiOiJ..."
}
```

### Step 2: Create Tenant User

```bash
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -d '{
    "email": "tenant@example.com",
    "tenantId": "tenant-123",
    "temporaryPassword": "TempPass123!"
  }'
```

**Request Body:**
- `email` (required): Email address for the tenant user
- `tenantId` (required): Unique identifier for the tenant organization
- `temporaryPassword` (optional): Initial password. If not provided, Cognito will generate one.

**Response (201 Created):**
```json
{
  "username": "tenant@example.com",
  "email": "tenant@example.com",
  "tenantId": "tenant-123",
  "message": "Tenant user created successfully"
}
```

---

## Method 2: Using JavaScript/Fetch

```javascript
// First, login as admin
const loginResponse = await fetch('https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'admin@example.com',
    password: 'AdminPass123!'
  })
});

const loginData = await loginResponse.json();
const accessToken = loginData.accessToken;

// Then, create tenant user
const createTenantResponse = await fetch('https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({
    email: 'tenant@example.com',
    tenantId: 'tenant-123',
    temporaryPassword: 'TempPass123!'
  })
});

const tenantData = await createTenantResponse.json();
console.log('Tenant user created:', tenantData);
```

---

## Method 3: Using Postman

1. **Create a POST request** to:
   ```
   https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants
   ```

2. **Add Headers:**
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_ACCESS_TOKEN`

3. **Add Body (JSON):**
   ```json
   {
     "email": "tenant@example.com",
     "tenantId": "tenant-123",
     "temporaryPassword": "TempPass123!"
   }
   ```

4. **Send the request**

---

## Method 4: Using the Frontend UI (if available)

If a UI component has been added to the frontend:
1. Log in as an admin user
2. Navigate to the "Admin" or "Users" section
3. Click "Create Tenant User"
4. Fill in the form:
   - Email
   - Tenant ID
   - Temporary Password (optional)
5. Click "Create"

---

## Important Notes

### Password Requirements
The temporary password must meet Cognito's password policy:
- Minimum 8 characters
- At least one lowercase letter
- At least one uppercase letter
- At least one digit
- At least one special character

### Tenant ID Format
- Tenant IDs should be unique identifiers for your organization
- Common formats: `tenant-123`, `acme-corp`, `company-abc`
- Avoid spaces and special characters (use hyphens or underscores)

### User Attributes Set
When a tenant user is created, the following attributes are automatically set:
- `email`: The user's email address
- `email_verified`: Set to `true`
- `custom:tenantId`: The tenant ID
- `custom:role`: Set to `TENANT`
- User is added to the `TENANT` Cognito group

### First Login
When a tenant user logs in for the first time with a temporary password, they will be required to change their password.

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Authentication required"
  }
}
```
**Solution:** Make sure you're logged in and include the Authorization header.

### 403 Forbidden
```json
{
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Admin access required"
  }
}
```
**Solution:** Only ADMIN users can create tenant users. Make sure you're logged in as an admin.

### 400 Bad Request
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email and tenantId required"
  }
}
```
**Solution:** Make sure you provide both `email` and `tenantId` in the request body.

### 409 Conflict
```json
{
  "error": {
    "code": "CONFLICT_ERROR",
    "message": "User already exists"
  }
}
```
**Solution:** A user with this email already exists. Use a different email or update the existing user.

---

## Example: Complete Workflow

```bash
# 1. Login as admin
ADMIN_TOKEN=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}' \
  | jq -r '.accessToken')

# 2. Create tenant user
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "email": "tenant@example.com",
    "tenantId": "acme-corp",
    "temporaryPassword": "TempPass123!"
  }'

# 3. Tenant user can now login
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tenant@example.com",
    "password": "TempPass123!"
  }'
```

---

## Testing

You can test the tenant user creation with:

```bash
# Replace with your actual admin credentials
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="AdminPass123!"
TENANT_EMAIL="newtenant@example.com"
TENANT_ID="test-tenant-001"
TEMP_PASSWORD="TempPass123!"

# Login and get token
TOKEN=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | jq -r '.accessToken')

# Create tenant user
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/admin/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"email\": \"$TENANT_EMAIL\",
    \"tenantId\": \"$TENANT_ID\",
    \"temporaryPassword\": \"$TEMP_PASSWORD\"
  }"
```

---

## Next Steps

After creating a tenant user:
1. Share the credentials with the tenant user
2. They should log in and change their password on first login
3. They can then create assessments for their tenant organization
4. All assessments created by this user will be associated with their `tenantId`
