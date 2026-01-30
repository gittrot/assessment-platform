/**
 * AWS CDK Stack for Adaptive Assessment Platform
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export class AdaptiveAssessmentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const openaiKey = process.env.OPENAI_API_KEY?.trim() || '';
    if (!openaiKey && process.env.ALLOW_MISSING_OPENAI_KEY !== 'true') {
      throw new Error(
        'OPENAI_API_KEY is required for adaptive question generation. ' +
        'Set it when deploying: OPENAI_API_KEY=sk-... npm run deploy ' +
        'Or export it first: export OPENAI_API_KEY=sk-... && npm run deploy. ' +
        'To skip this check (not recommended): ALLOW_MISSING_OPENAI_KEY=true npm run deploy'
      );
    }

    // Cognito User Pool
    const userPool = new cognito.UserPool(this, 'AssessmentUserPool', {
      userPoolName: 'adaptive-assessment-users',
      signInAliases: {
        email: true
      },
      autoVerify: {
        email: true
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true
        }
      },
      customAttributes: {
        tenantId: new cognito.StringAttribute({ minLen: 1, maxLen: 50, mutable: true }),
        role: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: true })
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      }
    });

    // Cognito User Pool Client
    const userPoolClient = new cognito.UserPoolClient(this, 'AssessmentUserPoolClient', {
      userPool,
      userPoolClientName: 'assessment-client',
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true  // Enable ADMIN_NO_SRP_AUTH for fallback authentication
      }
    });

    // Cognito Groups
    const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'ADMIN',
      description: 'Administrator users'
    });

    const tenantGroup = new cognito.CfnUserPoolGroup(this, 'TenantGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'TENANT',
      description: 'Tenant users'
    });

    // DynamoDB Tables
    const assessmentsTable = new dynamodb.Table(this, 'AssessmentsTable', {
      tableName: 'Assessments',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'assessmentId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const questionsTable = new dynamodb.Table(this, 'QuestionsTable', {
      tableName: 'Questions',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'questionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    questionsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'knowledgeArea', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'difficulty', type: dynamodb.AttributeType.NUMBER }
    });

    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'CandidateSessions',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    sessionsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'assessmentId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'startedAt', type: dynamodb.AttributeType.STRING }
    });

    const metricsTable = new dynamodb.Table(this, 'MetricsTable', {
      tableName: 'PerformanceMetrics',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const insightsTable = new dynamodb.Table(this, 'InsightsTable', {
      tableName: 'AIInsights',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sessionId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    const dashboardsTable = new dynamodb.Table(this, 'DashboardsTable', {
      tableName: 'TenantDashboards',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dashboardId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN
    });

    // Lambda Layer for shared code (optional optimization)
    // For now, we'll bundle everything in each function

    // Lambda Functions
    const assessmentsHandler = new lambda.Function(this, 'AssessmentsHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda/handlers/assessments-handler.handler',
      code: lambda.Code.fromAsset('../dist'),
      environment: {
        ASSESSMENTS_TABLE: assessmentsTable.tableName,
        QUESTIONS_TABLE: questionsTable.tableName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        OPENAI_API_KEY: openaiKey,
        OPENAI_MODEL: 'gpt-4-turbo-preview'
      },
      timeout: cdk.Duration.seconds(29) // Just under API Gateway's 30s limit
    });

    const sessionsHandler = new lambda.Function(this, 'SessionsHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda/handlers/sessions-handler.handler',
      code: lambda.Code.fromAsset('../dist'),
      environment: {
        SESSIONS_TABLE: sessionsTable.tableName,
        ASSESSMENTS_TABLE: assessmentsTable.tableName,
        QUESTIONS_TABLE: questionsTable.tableName,
        METRICS_TABLE: metricsTable.tableName,
        INSIGHTS_TABLE: insightsTable.tableName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        OPENAI_API_KEY: openaiKey,
        OPENAI_MODEL: 'gpt-4-turbo-preview',
        OPENAI_MODEL_ADAPTIVE: process.env.OPENAI_MODEL_ADAPTIVE || 'gpt-4o-mini'
      },
      timeout: cdk.Duration.seconds(60)
    });

    const dashboardHandler = new lambda.Function(this, 'DashboardHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda/handlers/dashboard-handler.handler',
      code: lambda.Code.fromAsset('../dist'),
      environment: {
        SESSIONS_TABLE: sessionsTable.tableName,
        ASSESSMENTS_TABLE: assessmentsTable.tableName,
        METRICS_TABLE: metricsTable.tableName,
        INSIGHTS_TABLE: insightsTable.tableName,
        DASHBOARDS_TABLE: dashboardsTable.tableName,
        COGNITO_USER_POOL_ID: userPool.userPoolId
      },
      timeout: cdk.Duration.seconds(29) // Just under API Gateway's 30s limit
    });

    const adminHandler = new lambda.Function(this, 'AdminHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda/handlers/admin-handler.handler',
      code: lambda.Code.fromAsset('../dist'),
      environment: {
        COGNITO_USER_POOL_ID: userPool.userPoolId
      },
      timeout: cdk.Duration.seconds(29) // Just under API Gateway's 30s limit
    });

    const authHandler = new lambda.Function(this, 'AuthHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda/handlers/auth-handler.handler',
      code: lambda.Code.fromAsset('../dist'),
      environment: {
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        COGNITO_CLIENT_ID: userPoolClient.userPoolClientId
      },
      timeout: cdk.Duration.seconds(29) // Just under API Gateway's 30s limit
    });

    const emailHandler = new lambda.Function(this, 'EmailHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda/handlers/email-handler.handler',
      code: lambda.Code.fromAsset('../dist'),
      environment: {
        ASSESSMENTS_TABLE: assessmentsTable.tableName,
        COGNITO_USER_POOL_ID: userPool.userPoolId,
        FROM_EMAIL: process.env.FROM_EMAIL || 'info@trotlabs.com'
        // API_ENDPOINT will be added after API is created
      },
      timeout: cdk.Duration.seconds(29) // Just under API Gateway's 30s limit
    });

    // Grant permissions
    assessmentsTable.grantReadWriteData(assessmentsHandler);
    questionsTable.grantReadWriteData(assessmentsHandler);
    sessionsTable.grantReadWriteData(sessionsHandler);
    assessmentsTable.grantReadData(sessionsHandler);
    questionsTable.grantReadData(sessionsHandler);
    metricsTable.grantReadWriteData(sessionsHandler);
    insightsTable.grantReadWriteData(sessionsHandler);
    
    dashboardsTable.grantReadWriteData(dashboardHandler);
    sessionsTable.grantReadData(dashboardHandler);
    assessmentsTable.grantReadData(dashboardHandler);
    metricsTable.grantReadData(dashboardHandler);
    insightsTable.grantReadData(dashboardHandler);
    
    // Email handler permissions
    assessmentsTable.grantReadData(emailHandler);
    emailHandler.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*']
    }));

    // Admin handler needs permissions to list, create, enable/disable users
    userPool.grant(adminHandler, 
      'cognito-idp:AdminCreateUser', 
      'cognito-idp:AdminAddUserToGroup',
      'cognito-idp:ListUsers',
      'cognito-idp:AdminGetUser',
      'cognito-idp:AdminEnableUser',
      'cognito-idp:AdminDisableUser'
    );
    userPool.grant(authHandler, 'cognito-idp:AdminInitiateAuth', 'cognito-idp:InitiateAuth');

    // API Gateway
    const api = new apigateway.RestApi(this, 'AssessmentApi', {
      restApiName: 'Adaptive Assessment API',
      description: 'API for Adaptive Assessment Platform',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: false,
        statusCode: 200
      }
    });

    // Add CORS headers to Gateway Responses (for 401, 403, etc. from authorizer)
    api.addGatewayResponse('UnauthorizedResponse', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'"
      },
      templates: {
        'application/json': '{"message":$context.error.messageString}'
      }
    });

    api.addGatewayResponse('AccessDeniedResponse', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'",
        'Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'"
      },
      templates: {
        'application/json': '{"message":$context.error.messageString}'
      }
    });

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool]
    });

    // API Routes - Assessments
    const assessmentsResource = api.root.addResource('assessments', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: false,
        maxAge: cdk.Duration.seconds(3600)
      }
    });
    assessmentsResource.addMethod('POST', new apigateway.LambdaIntegration(assessmentsHandler, {
      proxy: true
    }), {
      authorizer
    });
    assessmentsResource.addMethod('GET', new apigateway.LambdaIntegration(assessmentsHandler, {
      proxy: true
    }), {
      authorizer
    });
    const assessmentIdResource = assessmentsResource.addResource('{assessmentId}', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: false,
        maxAge: cdk.Duration.seconds(3600)
      }
    });
    assessmentIdResource.addMethod('GET', new apigateway.LambdaIntegration(assessmentsHandler), {
      authorizer
    });
    // Public start page for candidates (no auth required)
    assessmentIdResource.addResource('start', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
        allowCredentials: false,
        maxAge: cdk.Duration.seconds(3600)
      }
    }).addMethod('GET', new apigateway.LambdaIntegration(assessmentsHandler));
    const sendEmailResource = assessmentIdResource.addResource('send-email', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: false,
        maxAge: cdk.Duration.seconds(3600)
      }
    });
    // POST method with authorizer
    // Using proxy integration to pass through all Lambda headers including CORS
    sendEmailResource.addMethod('POST', new apigateway.LambdaIntegration(emailHandler, {
      proxy: true
    }), {
      authorizer
    });
    
    // Update email handler environment with API endpoint and frontend URL after API is created
    // Frontend will handle /assessments/:id/start route and redirect to API Gateway
    emailHandler.addEnvironment('API_ENDPOINT', `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/prod/`);
    emailHandler.addEnvironment('FRONTEND_URL', process.env.FRONTEND_URL || 'https://hiring.trotlabs.com');

    // API Routes - Sessions (public for start, protected for results)
    const sessionsResource = api.root.addResource('sessions');
    sessionsResource.addResource('start').addMethod('POST', new apigateway.LambdaIntegration(sessionsHandler));
    const sessionIdResource = sessionsResource.addResource('{sessionId}');
    sessionIdResource.addMethod('GET', new apigateway.LambdaIntegration(sessionsHandler), {
      authorizer
    });
    sessionIdResource.addResource('next-question').addMethod('GET', new apigateway.LambdaIntegration(sessionsHandler));
    
    // Question page (HTML) - public endpoint
    const questionPageHandler = new lambda.Function(this, 'QuestionPageHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda/handlers/question-page.getQuestionPage',
      code: lambda.Code.fromAsset('../dist'),
      environment: {
        SESSIONS_TABLE: sessionsTable.tableName,
        ASSESSMENTS_TABLE: assessmentsTable.tableName,
        QUESTIONS_TABLE: questionsTable.tableName
      },
      timeout: cdk.Duration.seconds(29) // Just under API Gateway's 30s limit
    });
    
    // Grant read permissions
    sessionsTable.grantReadData(questionPageHandler);
    assessmentsTable.grantReadData(questionPageHandler);
    questionsTable.grantReadData(questionPageHandler);
    
    // Add API endpoint after API is created
    questionPageHandler.addEnvironment('API_ENDPOINT', `https://${api.restApiId}.execute-api.${this.region}.amazonaws.com/prod/`);
    
    sessionIdResource.addResource('question', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type'],
        allowCredentials: false,
        maxAge: cdk.Duration.seconds(3600)
      }
    }).addMethod('GET', new apigateway.LambdaIntegration(questionPageHandler));
    sessionIdResource.addResource('answer').addMethod('POST', new apigateway.LambdaIntegration(sessionsHandler));
    sessionIdResource.addResource('submit').addMethod('POST', new apigateway.LambdaIntegration(sessionsHandler));

    // API Routes - Dashboard
    const dashboardResource = api.root.addResource('dashboard');
    dashboardResource.addMethod('GET', new apigateway.LambdaIntegration(dashboardHandler), {
      authorizer
    });
    dashboardResource.addResource('candidates').addResource('{sessionId}').addMethod('GET', new apigateway.LambdaIntegration(dashboardHandler), {
      authorizer
    });

    // API Routes - Auth (public)
    const authResource = api.root.addResource('auth', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: false,
        maxAge: cdk.Duration.seconds(3600)
      }
    });
    
    const loginResource = authResource.addResource('login', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: false
      }
    });
    
    // POST method - Lambda handles CORS headers
    loginResource.addMethod('POST', new apigateway.LambdaIntegration(authHandler, {
      proxy: true
    }));

    // API Routes - Admin
    const adminResource = api.root.addResource('admin', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: false,
        maxAge: cdk.Duration.seconds(3600)
      }
    });
    
    const tenantsResource = adminResource.addResource('tenants', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: false
      }
    });
    tenantsResource.addMethod('GET', new apigateway.LambdaIntegration(adminHandler, {
      proxy: true
    }), {
      authorizer
    });
    tenantsResource.addMethod('POST', new apigateway.LambdaIntegration(adminHandler, {
      proxy: true
    }), {
      authorizer
    });
    const tenantIdResource = tenantsResource.addResource('{tenantId}');
    tenantIdResource.addMethod('PUT', new apigateway.LambdaIntegration(adminHandler, {
      proxy: true
    }), {
      authorizer
    });
    
    const adminsResource = adminResource.addResource('admins', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
        allowCredentials: false
      }
    });
    adminsResource.addMethod('POST', new apigateway.LambdaIntegration(adminHandler, {
      proxy: true
    }), {
      authorizer
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url
    });

    // Frontend Hosting (S3 + CloudFront)
    // Use OAC (Origin Access Control); OAI is legacy and often causes 403 Access Denied.
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `adaptive-assessment-frontend-${this.account}-${this.region}`,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // CloudFront Distribution with OAC (recommended over OAI; fixes Access Denied)
    // Use CACHING_DISABLED to avoid serving cached 403s while OAC/bucket policy propagate.
    // Switch back to CACHING_OPTIMIZED after confirming 403 is resolved.
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0)
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0)
        }
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100
    });

    // Deploy frontend build to S3
    new s3deploy.BucketDeployment(this, 'FrontendDeployment', {
      sources: [s3deploy.Source.asset('../frontend/dist')],
      destinationBucket: frontendBucket,
      distribution,
      distributionPaths: ['/*'], // Invalidate all paths on deployment
      memoryLimit: 1024
    });

    // Outputs — use FrontendUrl to access the app; S3 bucket URL returns Access Denied
    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Use this URL to access the frontend (CloudFront). Do not use the S3 bucket URL.'
    });

    new cdk.CfnOutput(this, 'FrontendDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID. Use for cache invalidation: aws cloudfront create-invalidation --distribution-id <id> --paths "/*"'
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'Frontend S3 bucket (deployment only). Access the app via FrontendUrl.'
    });
  }
}
