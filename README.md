# 🚀 Multi-Tenant, Role-Based Adaptive Assessment Platform

Enterprise-grade hiring and assessment SaaS built on AWS serverless architecture.

## 🎯 Overview

A secure, multi-tenant platform that:
- Creates role-based assessments with configurable knowledge area mixes
- Generates AI-powered questions dynamically
- Adapts difficulty per knowledge area based on candidate performance
- Provides AI-driven role-fit insights and analytics
- Scales with minimal infrastructure cost

## 🏗️ Architecture

- **Authentication**: AWS Cognito (Admin, Tenant, Candidate roles)
- **Database**: DynamoDB (On-Demand, tenant-isolated)
- **Compute**: AWS Lambda (serverless functions)
- **API**: API Gateway (RESTful endpoints)
- **AI**: OpenAI ChatGPT API (question generation & insights)

## 📁 Project Structure

```
.
├── infrastructure/          # AWS CDK/SAM templates
├── src/
│   ├── lambda/             # Lambda function handlers
│   ├── shared/             # Shared utilities and models
│   ├── ai/                 # AI prompt strategies
│   └── analytics/          # Analytics and scoring engines
├── schemas/                # DynamoDB schemas and access patterns
├── api/                    # API Gateway contracts
└── docs/                   # Architecture and API documentation
```

## 🚀 Quick Start

1. **Prerequisites**
   ```bash
   npm install -g aws-cdk
   npm install
   ```

2. **Configure AWS**
   ```bash
   aws configure
   ```

3. **Deploy Infrastructure**
   ```bash
   cd infrastructure
   cdk deploy
   ```

4. **Set Environment Variables**
   - `OPENAI_API_KEY`: Your ChatGPT API key
   - `COGNITO_USER_POOL_ID`: Created during deployment

## 🔐 User Roles

- **Admin**: Manages tenants and user creation
- **Tenant**: Creates assessments, views analytics
- **Candidate**: Takes assessments via public links

## 📊 Knowledge Areas

- Programming Language
- Algorithms & Data Structures
- Analytical Reasoning
- Quantitative / Math
- System / Scenario Design
- Psychometric / Behavioral

## 🧠 Features

- ✅ Multi-tenant isolation
- ✅ Role-based access control
- ✅ AI question generation
- ✅ Adaptive difficulty per knowledge area
- ✅ Role-fit scoring
- ✅ AI-driven insights
- ✅ Real-time analytics dashboards
