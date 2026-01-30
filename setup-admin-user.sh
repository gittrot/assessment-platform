#!/bin/bash

# Setup Admin User for Adaptive Assessment Platform

USER_POOL_ID="us-east-1_ovE1hjOrD"
CLIENT_ID="2ubk3rel7suditqf2i9svcb31c"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="AdminPass123!"

echo "🔧 Setting up admin user..."
echo ""

# Check if admin user exists
echo "Checking if admin user exists..."
ADMIN_EXISTS=$(aws cognito-idp list-users \
  --user-pool-id $USER_POOL_ID \
  --filter "email = \"$ADMIN_EMAIL\"" \
  --query 'Users[0].Username' \
  --output text \
  --region us-east-1 2>/dev/null || echo "")

if [ -z "$ADMIN_EXISTS" ] || [ "$ADMIN_EXISTS" == "None" ]; then
    echo "📝 Admin user not found. Creating admin user..."
    
    # Create admin user
    aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username $ADMIN_EMAIL \
        --user-attributes \
            Name=email,Value=$ADMIN_EMAIL \
            Name=email_verified,Value=true \
            Name=custom:role,Value=ADMIN \
        --temporary-password "TempPass123!" \
        --message-action SUPPRESS \
        --region us-east-1
    
    echo "✅ Admin user created"
else
    echo "✅ Admin user already exists: $ADMIN_EXISTS"
fi

# Add to ADMIN group
echo ""
echo "Adding user to ADMIN group..."
aws cognito-idp admin-add-user-to-group \
    --user-pool-id $USER_POOL_ID \
    --username $ADMIN_EMAIL \
    --group-name ADMIN \
    --region us-east-1 2>/dev/null || echo "User might already be in group"

# Set permanent password
echo ""
echo "Setting permanent password..."
aws cognito-idp admin-set-user-password \
    --user-pool-id $USER_POOL_ID \
    --username $ADMIN_EMAIL \
    --password "$ADMIN_PASSWORD" \
    --permanent \
    --region us-east-1 2>/dev/null || echo "Password might already be set"

echo ""
echo "✅ Admin user setup complete!"
echo ""
echo "Credentials:"
echo "  Email: $ADMIN_EMAIL"
echo "  Password: $ADMIN_PASSWORD"
echo ""
echo "Test login:"
echo "  curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}'"
