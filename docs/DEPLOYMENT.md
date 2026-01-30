# Deployment Guide

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Node.js** 18+ and npm
3. **AWS CLI** configured with credentials
4. **AWS CDK** CLI installed globally
5. **OpenAI API Key** for question generation

## Initial Setup

### 1. Install Dependencies

```bash
cd adaptive-assessment-platform
npm install
```

### 2. Install AWS CDK (if not already installed)

```bash
npm install -g aws-cdk
cdk --version
```

### 3. Bootstrap CDK (First time only)

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

Replace `ACCOUNT-ID` and `REGION` with your AWS account ID and desired region.

### 4. Set Environment Variables

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your-openai-api-key-here
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=your-account-id
```

Or export them:

```bash
export OPENAI_API_KEY=your-openai-api-key-here
export AWS_REGION=us-east-1
```

## Build the Project

### 1. Compile TypeScript

```bash
npm run build
```

This compiles all TypeScript files to JavaScript in the `dist/` directory.

### 2. Verify Build Output

```bash
ls -la dist/
```

You should see compiled JavaScript files.

## Deploy Infrastructure

### 1. Navigate to Infrastructure Directory

```bash
cd infrastructure
```

### 2. Install CDK Dependencies

```bash
npm install
```

### 3. Synthesize CloudFormation Template

```bash
cdk synth
```

This generates the CloudFormation template without deploying.

### 4. Review Changes

```bash
cdk diff
```

This shows what will be created/modified.

### 5. Deploy Stack

```bash
cdk deploy
```

This will:
- Create Cognito User Pool
- Create DynamoDB tables
- Create Lambda functions
- Create API Gateway
- Set up IAM roles and permissions

**Note**: The first deployment may take 10-15 minutes.

### 6. Save Outputs

After deployment, CDK will output:
- `UserPoolId`: Cognito User Pool ID
- `UserPoolClientId`: Cognito Client ID
- `ApiEndpoint`: API Gateway endpoint URL

Save these values for configuration.

## Post-Deployment Setup

### 1. Create Initial Admin User

Use AWS Console or CLI to create the first admin user:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username admin@example.com \
  --user-attributes Name=email,Value=admin@example.com Name=custom:role,Value=ADMIN \
  --temporary-password TempPass123! \
  --message-action SUPPRESS

aws cognito-idp admin-add-user-to-group \
  --user-pool-id <UserPoolId> \
  --username admin@example.com \
  --group-name ADMIN
```

### 2. Set Permanent Password

User must change password on first login or use:

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId> \
  --username admin@example.com \
  --password YourSecurePassword123! \
  --permanent
```

### 3. Create Tenant Users

Use the Admin API endpoint or AWS CLI:

```bash
curl -X POST https://<ApiEndpoint>/admin/tenants \
  -H "Authorization: Bearer <admin-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tenant@example.com",
    "tenantId": "tenant-001",
    "temporaryPassword": "TempPass123!"
  }'
```

## Configuration

### 1. Update Lambda Environment Variables

If you need to update environment variables after deployment:

```bash
aws lambda update-function-configuration \
  --function-name <FunctionName> \
  --environment Variables="{OPENAI_API_KEY=your-key,COGNITO_USER_POOL_ID=pool-id}"
```

### 2. Configure API Gateway CORS (if needed)

CORS is already configured in the CDK stack, but you can customize it in `cdk-stack.ts`.

## Testing the Deployment

### 1. Test Authentication

```bash
# Get access token
aws cognito-idp admin-initiate-auth \
  --user-pool-id <UserPoolId> \
  --client-id <UserPoolClientId> \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=admin@example.com,PASSWORD=YourPassword
```

### 2. Test API Endpoints

```bash
# Create assessment
curl -X POST https://<ApiEndpoint>/assessments \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Assessment",
    "targetRole": {
      "name": "Software Engineer",
      "seniorityLevel": "MID"
    },
    "knowledgeAreaMix": [
      {
        "area": "PROGRAMMING_LANGUAGE",
        "percentage": 50,
        "programmingLanguage": "JavaScript"
      },
      {
        "area": "ALGORITHMS_DATA_STRUCTURES",
        "percentage": 50
      }
    ],
    "initialDifficulty": 3
  }'
```

## Monitoring

### 1. View CloudWatch Logs

```bash
aws logs tail /aws/lambda/<FunctionName> --follow
```

### 2. View Metrics

- Navigate to CloudWatch Console
- View Lambda metrics: invocations, errors, duration
- View DynamoDB metrics: read/write capacity, throttles
- View API Gateway metrics: request count, latency

### 3. Set Up Alarms

Create CloudWatch alarms for:
- Lambda error rate
- DynamoDB throttling
- API Gateway 5xx errors

## Troubleshooting

### Common Issues

1. **CDK Deployment Fails**
   - Check AWS credentials: `aws sts get-caller-identity`
   - Verify region and account ID
   - Check CloudFormation console for detailed errors

2. **Lambda Timeout**
   - Increase timeout in `cdk-stack.ts`
   - Check OpenAI API response times
   - Review Lambda logs

3. **DynamoDB Throttling**
   - Check table capacity settings
   - Review access patterns
   - Consider on-demand billing

4. **OpenAI API Errors**
   - Verify API key is correct
   - Check API rate limits
   - Review OpenAI account status

5. **Cognito Authentication Issues**
   - Verify user pool ID and client ID
   - Check user attributes (tenantId, role)
   - Verify user is in correct group

## Updating the Deployment

### 1. Make Code Changes

Edit source files in `src/`

### 2. Rebuild

```bash
npm run build
```

### 3. Redeploy

```bash
cd infrastructure
cdk deploy
```

CDK will only update changed resources.

## Rollback

If deployment fails or you need to rollback:

```bash
cd infrastructure
cdk destroy
```

**Warning**: This deletes all resources. Data in DynamoDB will be lost unless you have backups.

## Production Considerations

1. **Enable Point-in-Time Recovery** for DynamoDB tables
2. **Set up CloudWatch Alarms** for critical metrics
3. **Configure WAF** for API Gateway (optional)
4. **Set up CI/CD** pipeline for automated deployments
5. **Enable CloudTrail** for audit logging
6. **Set up backup strategy** for DynamoDB
7. **Configure VPC** for Lambda if needed (not required for this architecture)
8. **Enable API Gateway caching** for frequently accessed endpoints
9. **Set up monitoring dashboards** in CloudWatch
10. **Configure rate limiting** per tenant

## Cost Estimation

### Monthly Costs (Approximate)

- **DynamoDB On-Demand**: ~$0.25 per million reads, $1.25 per million writes
- **Lambda**: First 1M requests free, then $0.20 per million requests
- **API Gateway**: $3.50 per million requests
- **Cognito**: First 50K MAU free, then $0.0055 per MAU
- **OpenAI API**: Pay-per-use (varies by model and usage)

**Example**: 10K assessments/month, 100K questions, 1K candidates
- DynamoDB: ~$5-10/month
- Lambda: ~$2-5/month
- API Gateway: ~$1-3/month
- Cognito: Free (under 50K MAU)
- OpenAI: ~$50-200/month (depends on usage)

**Total**: ~$60-220/month for this example workload

## Next Steps

1. Set up monitoring and alerts
2. Create tenant onboarding process
3. Build frontend application
4. Set up CI/CD pipeline
5. Configure custom domain for API Gateway
6. Implement additional security measures
