# Fix: Empty tenantId in Assessments

## Problem

When starting an assessment session, you may encounter this error:
```
One or more parameter values are not valid. The AttributeValue for a key attribute cannot contain an empty string value. Key: tenantId
```

This happens when an assessment was created with an empty or missing `tenantId`.

## Solution

### For New Assessments
The code now validates that `tenantId` is never empty when creating assessments. If you're an admin without a tenantId, you must specify one in the request body.

### For Existing Assessments

If you have existing assessments with empty `tenantId`, you need to update them:

1. **Find assessments with empty tenantId:**
   ```bash
   aws dynamodb scan \
     --table-name Assessments \
     --filter-expression "attribute_not_exists(tenantId) OR tenantId = :empty" \
     --expression-attribute-values '{":empty":{"S":""}}' \
     --region us-east-1
   ```

2. **Update the assessment with a valid tenantId:**
   ```bash
   # Replace ASSESSMENT_ID and TENANT_ID with actual values
   aws dynamodb update-item \
     --table-name Assessments \
     --key '{"tenantId":{"S":"YOUR_TENANT_ID"},"assessmentId":{"S":"ASSESSMENT_ID"}}' \
     --update-expression "SET tenantId = :tid" \
     --expression-attribute-values '{":tid":{"S":"YOUR_TENANT_ID"}}' \
     --region us-east-1
   ```

### Alternative: Use a Default Tenant

If you're an admin and don't have a specific tenant, you can:
1. Create a default tenant user
2. Use that tenant's ID for admin-created assessments
3. Or specify `tenantId` in the request body when creating assessments

## Prevention

- Always ensure assessments have a valid `tenantId` when created
- For admins: Specify `tenantId` in the request body when creating assessments
- The code now validates this and will reject assessments with empty `tenantId`
