# Fix Empty tenantId Issues

## Problem

You're getting this error:
```
One or more parameter values are not valid. The AttributeValue for a key attribute cannot contain an empty string value. Key: tenantId
```

This happens when there are items in DynamoDB with empty `tenantId` values.

## Solution

### Option 1: Use the TypeScript Script (Recommended)

1. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```

2. **Run the fix script**:
   ```bash
   npx ts-node scripts/fix-empty-tenantid.ts
   ```

   This will:
   - Scan all DynamoDB tables
   - Report items with empty `tenantId`
   - Provide guidance on how to fix them

### Option 2: Use AWS CLI Script

```bash
./scripts/fix-empty-tenantid-aws-cli.sh
```

### Option 3: Manual Fix via AWS Console

1. **Go to AWS DynamoDB Console**
2. **Select the `Assessments` table**
3. **Scan for items** and look for items with empty `tenantId`
4. **For each assessment with empty tenantId:**
   - Note down the assessment details (title, description, etc.)
   - Delete the assessment
   - Recreate it with a valid `tenantId`

### Option 4: Fix via API

Since DynamoDB doesn't allow updating partition keys, you need to:

1. **Get the assessment details** (via API or AWS CLI)
2. **Delete the old assessment**
3. **Create a new assessment** with the correct `tenantId`

## Prevention

The code now validates that `tenantId` is never empty when:
- Creating assessments
- Creating sessions
- Saving questions
- Saving metrics/insights

All new items will have proper validation, so this issue should not occur again.

## Quick Check

To quickly check if you have assessments with empty tenantId:

```bash
aws dynamodb scan \
  --table-name Assessments \
  --filter-expression "attribute_not_exists(tenantId) OR tenantId = :empty" \
  --expression-attribute-values '{":empty":{"S":""}}' \
  --region us-east-1
```

## Finding the Correct tenantId

If you're not sure what `tenantId` to use:

1. **Check your user's tenantId**:
   - Log in to the app
   - Check the JWT token (in browser dev tools)
   - Look for `custom:tenantId` in the token

2. **For admin users**:
   - You can specify `tenantId` in the request body when creating assessments
   - Or use a default tenant like `"admin-default"`

3. **List all tenants**:
   - Use the `/admin/tenants` endpoint (if available)
   - Or check Cognito user pool for users with `custom:tenantId` attribute

## Need Help?

If you're still having issues:

1. Check CloudWatch logs for the exact error
2. Share the assessment ID that's causing the problem
3. Verify the assessment exists in DynamoDB and check its `tenantId` value
