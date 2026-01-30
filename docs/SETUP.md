# Setup Instructions

## Quick Start

Follow these steps to get the Adaptive Assessment Platform up and running.

## 1. Prerequisites Check

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm version
npm --version

# Check AWS CLI
aws --version

# Check CDK
cdk --version
```

## 2. Clone and Install

```bash
# Navigate to project directory
cd adaptive-assessment-platform

# Install dependencies
npm install

# Install CDK dependencies
cd infrastructure
npm install
cd ..
```

## 3. Configure AWS

```bash
# Configure AWS credentials
aws configure

# Verify access
aws sts get-caller-identity
```

## 4. Set Environment Variables

Create `.env` file:

```bash
cat > .env << EOF
OPENAI_API_KEY=sk-your-openai-key-here
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
EOF
```

Or export:

```bash
export OPENAI_API_KEY=sk-your-openai-key-here
export AWS_REGION=us-east-1
```

## 5. Build Project

```bash
npm run build
```

## 6. Bootstrap CDK (First Time Only)

```bash
cdk bootstrap aws://$(aws sts get-caller-identity --query Account --output text)/$(aws configure get region)
```

## 7. Deploy

```bash
cd infrastructure
cdk deploy
```

## 8. Get Deployment Outputs

After deployment, note the outputs:
- `UserPoolId`
- `UserPoolClientId`
- `ApiEndpoint`

## 9. Create First Admin User

```bash
# Get UserPoolId from CDK output
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name AdaptiveAssessmentStack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
  --output text)

# Create admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --user-attributes \
    Name=email,Value=admin@example.com \
    Name=email_verified,Value=true \
    Name=custom:role,Value=ADMIN \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

# Add to ADMIN group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --group-name ADMIN

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@example.com \
  --password YourSecurePassword123! \
  --permanent
```

## 10. Test Authentication

```bash
# Get client ID
CLIENT_ID=$(aws cloudformation describe-stacks \
  --stack-name AdaptiveAssessmentStack \
  --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' \
  --output text)

# Authenticate
aws cognito-idp admin-initiate-auth \
  --user-pool-id $USER_POOL_ID \
  --client-id $CLIENT_ID \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=admin@example.com,PASSWORD=YourSecurePassword123!
```

Save the `AccessToken` from the response.

## 11. Test API

```bash
# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name AdaptiveAssessmentStack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text)

# Create a tenant user
curl -X POST $API_ENDPOINT/admin/tenants \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tenant@example.com",
    "tenantId": "tenant-001",
    "temporaryPassword": "TempPass123!"
  }'
```

## 12. Create Your First Assessment

```bash
# Authenticate as tenant user (get new token)
# Then create assessment
curl -X POST $API_ENDPOINT/assessments \
  -H "Authorization: Bearer $TENANT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Backend Engineer Assessment",
    "description": "Comprehensive assessment for senior backend role",
    "targetRole": {
      "name": "Backend Engineer",
      "seniorityLevel": "SENIOR"
    },
    "knowledgeAreaMix": [
      {
        "area": "PROGRAMMING_LANGUAGE",
        "percentage": 30,
        "programmingLanguage": "Java"
      },
      {
        "area": "ALGORITHMS_DATA_STRUCTURES",
        "percentage": 25
      },
      {
        "area": "ANALYTICAL_REASONING",
        "percentage": 15
      },
      {
        "area": "QUANTITATIVE_MATH",
        "percentage": 10
      },
      {
        "area": "PSYCHOMETRIC_BEHAVIORAL",
        "percentage": 20
      }
    ],
    "initialDifficulty": 3,
    "durationMinutes": 60
  }'
```

## Verification Checklist

- [ ] CDK stack deployed successfully
- [ ] All DynamoDB tables created
- [ ] Lambda functions deployed
- [ ] API Gateway endpoint accessible
- [ ] Admin user created and can authenticate
- [ ] Can create tenant users
- [ ] Can create assessments
- [ ] OpenAI API key configured correctly

## Troubleshooting

### Build Errors
```bash
# Clear and rebuild
rm -rf dist node_modules
npm install
npm run build
```

### CDK Errors
```bash
# Update CDK
npm install -g aws-cdk@latest
cdk --version

# Check credentials
aws sts get-caller-identity
```

### Lambda Errors
```bash
# Check logs
aws logs tail /aws/lambda/AdaptiveAssessmentStack-AssessmentsHandler --follow
```

### OpenAI Errors
- Verify API key is correct
- Check OpenAI account has credits
- Review rate limits

## Next Steps

1. Review [API Contracts](./api/contracts.md)
2. Review [Architecture](./ARCHITECTURE.md)
3. Build frontend application
4. Set up monitoring
5. Configure backups

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review API Gateway logs
3. Verify IAM permissions
4. Check DynamoDB table status
