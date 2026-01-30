#!/bin/bash

# Start Application Script for Adaptive Assessment Platform
# This script checks deployment status and provides access information

set -e

echo "🚀 Adaptive Assessment Platform - Application Startup"
echo "======================================================"
echo ""

# Check if stack exists
STACK_NAME="AdaptiveAssessmentStack"
STACK_STATUS=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$STACK_STATUS" == "NOT_FOUND" ] || [ -z "$STACK_STATUS" ]; then
    echo "❌ Stack not found. Please deploy first:"
    echo "   cd infrastructure && cdk deploy"
    exit 1
fi

echo "📊 Stack Status: $STACK_STATUS"
echo ""

if [ "$STACK_STATUS" != "CREATE_COMPLETE" ] && [ "$STACK_STATUS" != "UPDATE_COMPLETE" ]; then
    echo "⏳ Stack is still deploying. Current status: $STACK_STATUS"
    echo "   Please wait for deployment to complete..."
    echo ""
    echo "   Monitor with: aws cloudformation describe-stacks --stack-name $STACK_NAME"
    exit 0
fi

echo "✅ Stack is deployed!"
echo ""

# Get outputs
echo "📋 Retrieving deployment outputs..."
USER_POOL_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text 2>/dev/null)
USER_POOL_CLIENT_ID=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text 2>/dev/null)
API_ENDPOINT=$(aws cloudformation describe-stacks --stack-name $STACK_NAME --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' --output text 2>/dev/null)

if [ -z "$API_ENDPOINT" ]; then
    echo "⚠️  Could not retrieve API endpoint. Stack may still be deploying."
    exit 1
fi

echo ""
echo "🎯 Application Endpoints:"
echo "========================"
echo "API Endpoint: $API_ENDPOINT"
echo "User Pool ID: $USER_POOL_ID"
echo "Client ID: $USER_POOL_CLIENT_ID"
echo ""

# Check if admin user exists
echo "👤 Checking for admin user..."
ADMIN_EXISTS=$(aws cognito-idp list-users --user-pool-id $USER_POOL_ID --filter "email = \"admin@example.com\"" --query 'Users[0].Username' --output text 2>/dev/null || echo "")

if [ -z "$ADMIN_EXISTS" ]; then
    echo ""
    echo "📝 No admin user found. Creating admin user..."
    echo ""
    
    # Create admin user
    aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username admin@example.com \
        --user-attributes \
            Name=email,Value=admin@example.com \
            Name=email_verified,Value=true \
            Name=custom:role,Value=ADMIN \
        --temporary-password "TempPass123!" \
        --message-action SUPPRESS 2>/dev/null || echo "User might already exist"
    
    # Add to ADMIN group
    aws cognito-idp admin-add-user-to-group \
        --user-pool-id $USER_POOL_ID \
        --username admin@example.com \
        --group-name ADMIN 2>/dev/null || echo "User might already be in group"
    
    # Set permanent password
    aws cognito-idp admin-set-user-password \
        --user-pool-id $USER_POOL_ID \
        --username admin@example.com \
        --password "AdminPass123!" \
        --permanent 2>/dev/null || echo "Password might already be set"
    
    echo "✅ Admin user created!"
    echo "   Email: admin@example.com"
    echo "   Password: AdminPass123!"
    echo ""
else
    echo "✅ Admin user already exists"
    echo ""
fi

echo "🌐 Application is READY!"
echo "========================"
echo ""
echo "📚 Quick Start:"
echo "1. Test API Health:"
echo "   curl $API_ENDPOINT/assessments"
echo ""
echo "2. Authenticate as Admin:"
echo "   aws cognito-idp admin-initiate-auth \\"
echo "     --user-pool-id $USER_POOL_ID \\"
echo "     --client-id $USER_POOL_CLIENT_ID \\"
echo "     --auth-flow ADMIN_NO_SRP_AUTH \\"
echo "     --auth-parameters USERNAME=admin@example.com,PASSWORD=AdminPass123!"
echo ""
echo "3. Create Assessment (use token from step 2):"
echo "   curl -X POST $API_ENDPOINT/assessments \\"
echo "     -H \"Authorization: Bearer <TOKEN>\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{...}'"
echo ""
echo "📖 Full API Documentation: api/contracts.md"
echo "📖 Setup Guide: docs/SETUP.md"
echo ""
echo "✨ Your application is running at: $API_ENDPOINT"
echo ""
