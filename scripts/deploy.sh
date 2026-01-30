#!/usr/bin/env bash
# Deploy CDK stack. Loads .env from project root if present.
# OPENAI_API_KEY must be set (env or .env) for adaptive questions.

set -e
cd "$(dirname "$0")/.."

export AWS_DEFAULT_REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"

if [ -f .env ]; then
  set -a
  source .env
  set +a
  echo "==> Loaded .env"
fi

if [ -z "${OPENAI_API_KEY:-}" ] || [ "${OPENAI_API_KEY}" = "" ]; then
  echo "ERROR: OPENAI_API_KEY is not set. Set it in .env or export it."
  echo "  See .env.example. Get a key from https://platform.openai.com/account/api-keys"
  exit 1
fi

cd infrastructure && cdk deploy "$@"
