# Setting Up OpenAI API Key

The Adaptive Assessment Platform uses OpenAI's API to generate questions and insights. You need to configure your OpenAI API key.

## Option 1: Environment Variable (Recommended for Development)

Set the `OPENAI_API_KEY` environment variable before deploying:

```bash
export OPENAI_API_KEY=sk-your-api-key-here
cd infrastructure
npx cdk deploy
```

## Option 2: AWS SSM Parameter Store (Recommended for Production)

Store the API key securely in AWS Systems Manager Parameter Store:

```bash
aws ssm put-parameter \
  --name /adaptive-assessment/openai-api-key \
  --value "sk-your-api-key-here" \
  --type SecureString \
  --region us-east-1
```

Then update the CDK stack to read from SSM (requires code changes).

## Option 3: Manual Lambda Configuration

After deployment, manually set the environment variable in the Lambda console:

1. Go to AWS Lambda Console
2. Find the `SessionsHandler` function
3. Go to Configuration → Environment variables
4. Add `OPENAI_API_KEY` with your API key value
5. Repeat for `AssessmentsHandler` function

## Getting Your OpenAI API Key

1. Go to https://platform.openai.com/account/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (it starts with `sk-`)

## Verify Setup

After setting up, test by:
1. Creating an assessment (should generate questions)
2. Starting a session and getting the next question (should generate adaptive questions)

If you see errors about missing API key, the environment variable is not set correctly.
