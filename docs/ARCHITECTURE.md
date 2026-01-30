# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                     │
│  (Web App, Mobile App, or Direct API Integration)            │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTPS
                        │
┌───────────────────────▼─────────────────────────────────────┐
│                    API Gateway                              │
│  - RESTful API Endpoints                                    │
│  - Cognito Authorizer (for protected routes)               │
│  - CORS Configuration                                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│   Lambda     │ │   Lambda    │ │   Lambda    │
│ Assessments  │ │  Sessions   │ │  Dashboard  │
└───────┬──────┘ └──────┬──────┘ └──────┬──────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
│  DynamoDB    │ │   Cognito    │ │   OpenAI    │
│  Tables      │ │  User Pool   │ │  ChatGPT    │
└──────────────┘ └──────────────┘ └────────────┘
```

## Component Details

### 1. API Gateway
- **Purpose**: Single entry point for all API requests
- **Features**:
  - RESTful API design
  - Cognito User Pool authorizer for protected endpoints
  - CORS enabled for web clients
  - Request/response transformation

### 2. AWS Lambda Functions

#### Assessments Handler
- **Purpose**: Manage assessment creation and retrieval
- **Operations**:
  - Create assessments with knowledge area mix
  - Generate initial question sets via AI
  - List and retrieve assessments
- **Dependencies**: DynamoDB (Assessments, Questions), OpenAI API

#### Sessions Handler
- **Purpose**: Manage candidate assessment sessions
- **Operations**:
  - Start new candidate sessions (public)
  - Get next adaptive question
  - Submit answers
  - Complete sessions and generate metrics
- **Dependencies**: DynamoDB (Sessions, Assessments, Questions, Metrics, Insights), OpenAI API

#### Dashboard Handler
- **Purpose**: Provide analytics and insights to tenants
- **Operations**:
  - Aggregate dashboard metrics
  - Candidate drill-down views
  - Performance analytics
- **Dependencies**: DynamoDB (all tables)

#### Admin Handler
- **Purpose**: Administrative operations
- **Operations**:
  - Create tenant users
  - Create admin users
- **Dependencies**: Cognito User Pool

### 3. DynamoDB Tables

All tables use `tenantId` as partition key for multi-tenant isolation:

1. **Assessments**: Assessment definitions
2. **Questions**: Generated questions per assessment
3. **CandidateSessions**: Active and completed test sessions
4. **PerformanceMetrics**: Calculated performance scores
5. **AIInsights**: AI-generated role-fit insights
6. **TenantDashboards**: Aggregated dashboard data

### 4. AWS Cognito

- **User Pool**: Manages user authentication
- **Groups**: ADMIN, TENANT
- **Custom Attributes**:
  - `tenantId`: Tenant isolation
  - `role`: User role (ADMIN, TENANT, CANDIDATE)
- **Authentication Flow**: User password, SRP

### 5. OpenAI ChatGPT API

- **Purpose**: AI-powered question generation and insights
- **Usage**:
  - Generate questions per knowledge area
  - Generate adaptive questions based on performance
  - Generate role-fit insights and recommendations
- **Model**: GPT-4 Turbo (configurable)

## Data Flow

### Assessment Creation Flow
```
1. Tenant creates assessment via API
2. Lambda validates and saves to DynamoDB
3. Lambda calls OpenAI to generate questions
4. Questions saved to DynamoDB
5. Assessment ready for candidates
```

### Candidate Session Flow
```
1. Candidate starts session (public endpoint)
2. Session created in DynamoDB
3. Candidate requests next question
4. Adaptive engine selects knowledge area
5. Lambda generates adaptive question via OpenAI
6. Candidate submits answer
7. Adaptive engine updates difficulty per area
8. Repeat until assessment complete
9. Calculate metrics and generate insights
10. Save results to DynamoDB
```

### Dashboard Flow
```
1. Tenant requests dashboard
2. Lambda queries all relevant tables
3. Aggregates metrics per knowledge area
4. Calculates completion rates, averages
5. Returns dashboard data
```

## Security Architecture

### Multi-Tenant Isolation
- **Partition Key Strategy**: All DynamoDB tables use `tenantId` as PK
- **Application-Level Enforcement**: All queries validate tenantId
- **Cognito Attributes**: Tenant ID stored in user attributes
- **Authorization**: Lambda functions verify tenant access

### Authentication & Authorization
- **Public Endpoints**: Candidate session start, question retrieval, answer submission
- **Protected Endpoints**: All tenant/admin operations require Cognito token
- **Role-Based Access**: ADMIN can access all tenants, TENANT only their own

### Data Privacy
- Candidate data isolated per tenant
- No cross-tenant data access
- Optional candidate anonymization
- Encryption at rest (DynamoDB default)

## Scalability

### Serverless Architecture
- **Auto-Scaling**: Lambda and DynamoDB scale automatically
- **No Infrastructure Management**: Fully managed services
- **Cost Optimization**: Pay-per-use model

### Performance Optimizations
- **DynamoDB GSIs**: Efficient querying patterns
- **Lambda Cold Starts**: Minimized with provisioned concurrency (optional)
- **API Gateway Caching**: For frequently accessed data (optional)
- **Async Processing**: AI insights generation can be async

## Cost Optimization

### DynamoDB
- **On-Demand Billing**: No capacity planning
- **Efficient Partitioning**: Even distribution via tenantId
- **GSI Usage**: Only essential indexes

### Lambda
- **Lambda**:
- **Efficient Code**: Minimal dependencies
- **Appropriate Timeouts**: Prevent unnecessary charges
- **Async Processing**: For long-running AI operations

### API Gateway
- **Caching**: Reduce Lambda invocations
- **Request Compression**: Reduce data transfer

## Monitoring & Observability

### CloudWatch Metrics
- Lambda invocation counts, errors, duration
- DynamoDB read/write capacity, throttles
- API Gateway request counts, latency

### CloudWatch Logs
- Lambda function logs
- API Gateway access logs
- Error tracking and debugging

### Recommended Alarms
- Lambda error rate > 5%
- DynamoDB throttling
- API Gateway 5xx errors
- OpenAI API failures

## Disaster Recovery

### Backup Strategy
- **DynamoDB Point-in-Time Recovery**: Enable for critical tables
- **Cross-Region Replication**: Optional for high availability
- **Infrastructure as Code**: CDK allows quick recreation

### High Availability
- **Multi-AZ**: DynamoDB and Lambda are multi-AZ by default
- **Regional Deployment**: Deploy to multiple regions if needed

## Future Enhancements

1. **Real-time Updates**: WebSocket API for live session tracking
2. **Question Bank**: Pre-generated question library
3. **Batch Processing**: Scheduled Lambda for bulk operations
4. **Advanced Analytics**: ML-based insights beyond OpenAI
5. **Multi-Language Support**: Internationalization
6. **Mobile SDK**: Native mobile app support
7. **Video Interviews**: Integration with video assessment tools
