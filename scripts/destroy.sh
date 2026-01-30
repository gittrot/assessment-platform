#!/bin/bash
# Destroy all AWS infrastructure (CDK stack)

set -e

echo "⚠️  WARNING: This will destroy ALL AWS resources including:"
echo "   - Lambda functions"
echo "   - API Gateway"
echo "   - DynamoDB tables (and all data)"
echo "   - Cognito User Pool"
echo "   - S3 buckets"
echo "   - CloudFront distribution"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Destruction cancelled."
  exit 0
fi

echo ""
echo "🗑️  Destroying CDK stack..."

# Source .env if it exists
if [ -f .env ]; then
  echo "📝 Loading environment variables from .env..."
  set -a
  source .env
  set +a
fi

# Set AWS region
export AWS_DEFAULT_REGION=${AWS_REGION:-us-east-1}
export AWS_REGION=${AWS_REGION:-us-east-1}

cd infrastructure

# Destroy the stack
echo "🚀 Running: cdk destroy --force"
cdk destroy --force

echo ""
echo "✅ Stack destruction complete!"
echo ""
echo "Note: Some resources may take a few minutes to fully delete."
echo "Check CloudFormation console to verify deletion."
