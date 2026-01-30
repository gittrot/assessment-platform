#!/bin/bash

# AWS CLI script to find and fix assessments with empty tenantId
# This script scans the Assessments table and provides commands to fix issues

set -e

REGION="${AWS_REGION:-us-east-1}"
TABLE="${ASSESSMENTS_TABLE:-Assessments}"

echo "🔍 Finding assessments with empty tenantId in table: $TABLE"
echo ""

# Scan all assessments
echo "Scanning table..."
RESULT=$(aws dynamodb scan \
  --table-name "$TABLE" \
  --region "$REGION" \
  --output json)

# Count total items
TOTAL=$(echo "$RESULT" | jq '.Items | length')
echo "Found $TOTAL total assessments"

# Check for empty tenantId
# Note: DynamoDB stores empty strings differently, so we need to check both
echo ""
echo "Checking for empty tenantId..."

# Use jq to filter items where tenantId is empty, null, or missing
EMPTY_TENANT_ITEMS=$(echo "$RESULT" | jq -r '.Items[] | select(.tenantId.S == "" or .tenantId == null or .tenantId == "") | @json')

if [ -z "$EMPTY_TENANT_ITEMS" ]; then
  echo "✅ No assessments with empty tenantId found!"
  exit 0
fi

echo "❌ Found assessments with empty tenantId:"
echo ""

# Process each item
echo "$EMPTY_TENANT_ITEMS" | while IFS= read -r item; do
  ASSESSMENT_ID=$(echo "$item" | jq -r '.assessmentId.S // .assessmentId // "unknown"')
  TITLE=$(echo "$item" | jq -r '.title.S // .title // "N/A"')
  TENANT_ID=$(echo "$item" | jq -r '.tenantId.S // .tenantId // "EMPTY"')
  
  echo "Assessment ID: $ASSESSMENT_ID"
  echo "  Title: $TITLE"
  echo "  Current tenantId: $TENANT_ID"
  echo ""
done

echo ""
echo "⚠️  To fix these assessments:"
echo ""
echo "1. Determine the correct tenantId for each assessment"
echo "2. Since DynamoDB doesn't allow updating partition keys, you need to:"
echo "   a) Create a new item with the correct tenantId"
echo "   b) Delete the old item"
echo ""
echo "Example AWS CLI commands:"
echo ""
echo "# Step 1: Get the full item (replace ASSESSMENT_ID)"
echo "aws dynamodb scan \\"
echo "  --table-name $TABLE \\"
echo "  --filter-expression 'assessmentId = :aid' \\"
echo "  --expression-attribute-values '{\":aid\":{\"S\":\"ASSESSMENT_ID\"}}' \\"
echo "  --region $REGION"
echo ""
echo "# Step 2: Create new item with correct tenantId (copy the item and update tenantId)"
echo "# Step 3: Delete old item (requires knowing the old tenantId, which is empty - this is tricky)"
echo ""
echo "💡 RECOMMENDATION:"
echo "   Since the partition key (tenantId) cannot be updated, it's easier to:"
echo "   1. Note down the assessment details"
echo "   2. Delete the assessment via the API or manually"
echo "   3. Recreate it with the correct tenantId"
echo ""
