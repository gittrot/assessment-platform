#!/usr/bin/env bash
# Build backend + frontend, deploy CDK stack, then invalidate CloudFront cache.
# Run from repo root.
# Requires OPENAI_API_KEY (set in env or in .env). See .env.example.

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
  echo "ERROR: OPENAI_API_KEY is not set. Adaptive questions will fail with 401."
  echo "  Create .env from .env.example and set OPENAI_API_KEY=sk-..."
  echo "  Or: OPENAI_API_KEY=sk-... npm run deploy:frontend"
  exit 1
fi

echo "==> Building backend..."
npm run build

echo "==> Building frontend..."
(cd frontend && npm run build)

echo "==> Deploying CDK stack..."
npm run deploy -- --require-approval never

echo "==> Invalidating CloudFront cache..."
bash scripts/invalidate-cloudfront.sh
