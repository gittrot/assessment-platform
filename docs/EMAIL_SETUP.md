# Email Setup Guide

## Overview

The platform now supports sending assessment invitation emails to candidates via AWS SES (Simple Email Service).

## Prerequisites

1. **AWS SES Configuration**
   - You need to verify your sender email address in AWS SES
   - If you're in the SES sandbox, you can only send to verified email addresses
   - To send to any email address, request production access in SES

2. **Environment Variable**
   - Set `FROM_EMAIL` environment variable to your verified SES email address
   - Default: `noreply@example.com` (you must change this)

## Setup Steps

### 1. Verify Email Address in SES

```bash
# Verify your sender email address
aws ses verify-email-identity --email-address noreply@yourdomain.com --region us-east-1
```

Check your email and click the verification link.

### 2. Set FROM_EMAIL Environment Variable

Before deploying, set the FROM_EMAIL:

```bash
export FROM_EMAIL=noreply@yourdomain.com
```

Or add it to your `.env` file:

```bash
echo "FROM_EMAIL=noreply@yourdomain.com" >> .env
```

### 3. Deploy the Stack

```bash
cd infrastructure
npx cdk deploy
```

The email handler Lambda will be created with SES send permissions.

## Using the Email Feature

### From the Web UI

1. Navigate to the Assessments list
2. Click **"📧 Send Email"** button on any assessment card
3. Fill in:
   - Candidate Email (required)
   - Candidate Name (optional)
   - Custom Message (optional)
4. Click **"Send Email"**

The candidate will receive an email with:
- Assessment details
- Assessment ID
- Instructions on how to start the assessment
- API endpoint information

### From the API

```bash
# Get your auth token
TOKEN=$(curl -s -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}' \
  | jq -r '.idToken')

# Send assessment email
curl -X POST https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/assessments/{assessmentId}/send-email \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "candidateEmail": "candidate@example.com",
    "candidateName": "John Doe",
    "customMessage": "You have been selected to take our assessment!"
  }'
```

## Email Content

The email includes:
- Personalized greeting
- Assessment title and description
- Role information
- Duration (if specified)
- Assessment ID
- API endpoint and instructions
- Formatted HTML and plain text versions

## Troubleshooting

### "Email address not verified"
- Make sure you've verified your sender email in SES
- Check that FROM_EMAIL matches the verified address

### "Account is in SES sandbox"
- You can only send to verified email addresses
- Request production access in AWS SES console
- Or verify the recipient email address

### "Access Denied" error
- Check that the Lambda has SES send permissions
- Verify IAM role has `ses:SendEmail` and `ses:SendRawEmail` permissions

### Email not received
- Check spam/junk folder
- Verify recipient email is correct
- Check CloudWatch logs for the email handler Lambda
- Verify SES sending limits haven't been exceeded

## SES Sandbox vs Production

### Sandbox Mode (Default)
- Can only send to verified email addresses
- Limited to 200 emails per day
- Good for testing

### Production Mode
- Can send to any email address
- Higher sending limits
- Requires AWS approval

To request production access:
1. Go to AWS SES Console
2. Click "Request production access"
3. Fill out the form
4. Wait for approval (usually 24-48 hours)

## Cost

AWS SES pricing:
- **Free tier**: 62,000 emails/month (if using EC2)
- **Paid**: $0.10 per 1,000 emails after free tier
- Very cost-effective for assessment invitations

## Security

- Emails are sent via AWS SES (secure, reliable)
- Only authenticated users (tenants/admins) can send emails
- Email content includes assessment details but not sensitive data
- Assessment links require candidate email/name to start session
