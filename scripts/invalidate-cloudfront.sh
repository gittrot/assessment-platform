#!/usr/bin/env bash
# Invalidate CloudFront cache for the frontend distribution.
# Run from repo root. Requires AWS CLI configured.

set -e
cd "$(dirname "$0")/.."

STACK="${1:-AdaptiveAssessmentStack}"
REGION="${AWS_REGION:-us-east-1}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$REGION}"

echo "==> Getting CloudFront distribution ID from stack: $STACK (region: $REGION)"
DIST_ID=$(aws cloudformation describe-stacks --stack-name "$STACK" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" --output text 2>/dev/null || true)

if [ -z "$DIST_ID" ] || [ "$DIST_ID" = "None" ]; then
  echo "ERROR: Could not read FrontendDistributionId from stack outputs."
  echo "  - Ensure the stack is deployed: npm run deploy"
  echo "  - Set AWS region if needed: AWS_REGION=us-east-1 $0"
  echo "  - Or pass stack name: $0 MyStack"
  exit 1
fi

echo "==> Creating invalidation for distribution: $DIST_ID"
aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
echo "Invalidation created. Cache may take 1–2 minutes to clear."
