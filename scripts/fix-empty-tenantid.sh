#!/bin/bash

# Script to find and fix DynamoDB items with empty tenantId
# This is a wrapper that uses AWS CLI to scan and report issues

set -e

REGION="${AWS_REGION:-us-east-1}"
TABLES=(
  "Assessments"
  "Questions"
  "CandidateSessions"
  "PerformanceMetrics"
  "AIInsights"
  "TenantDashboards"
)

echo "🔍 Scanning DynamoDB tables for items with empty tenantId..."
echo ""

TOTAL_ISSUES=0

for TABLE in "${TABLES[@]}"; do
  echo "Scanning $TABLE..."
  
  # Scan for items where tenantId is empty or missing
  # Note: This is a simplified check - DynamoDB doesn't easily filter for empty strings
  # We'll scan all items and check in the output
  
  RESULT=$(aws dynamodb scan \
    --table-name "$TABLE" \
    --region "$REGION" \
    --output json 2>/dev/null || echo '{"Items":[]}')
  
  # Count items (this is a basic check - for empty tenantId, we'd need to parse JSON)
  ITEM_COUNT=$(echo "$RESULT" | jq '.Items | length' 2>/dev/null || echo "0")
  
  if [ "$ITEM_COUNT" -gt 0 ]; then
    echo "  Found $ITEM_COUNT items in $TABLE"
    echo "  (To check for empty tenantId, use the TypeScript script: npx ts-node scripts/fix-empty-tenantid.ts)"
  else
    echo "  No items found (or table doesn't exist)"
  fi
done

echo ""
echo "📊 For detailed analysis and fixing, run:"
echo "   npx ts-node scripts/fix-empty-tenantid.ts"
echo ""
echo "Or use AWS CLI to manually check and fix items."
