/**
 * Script to find and fix DynamoDB items with empty tenantId
 * 
 * Usage:
 *   npx ts-node scripts/fix-empty-tenantid.ts
 * 
 * This script will:
 * 1. Scan all tables for items with empty tenantId
 * 2. Report findings
 * 3. Optionally fix them (with confirmation)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

// Table names - adjust these to match your actual table names
const TABLES = {
  ASSESSMENTS: process.env.ASSESSMENTS_TABLE || 'Assessments',
  QUESTIONS: process.env.QUESTIONS_TABLE || 'Questions',
  SESSIONS: process.env.SESSIONS_TABLE || 'CandidateSessions',
  METRICS: process.env.METRICS_TABLE || 'PerformanceMetrics',
  INSIGHTS: process.env.INSIGHTS_TABLE || 'AIInsights',
  DASHBOARDS: process.env.DASHBOARDS_TABLE || 'TenantDashboards'
};

interface ItemWithEmptyTenantId {
  tableName: string;
  tenantId: string | undefined | null;
  sortKey: string;
  sortKeyValue: string | undefined;
  item: any;
}

async function scanTableForEmptyTenantId(tableName: string): Promise<ItemWithEmptyTenantId[]> {
  console.log(`\nScanning ${tableName}...`);
  const itemsWithEmptyTenantId: ItemWithEmptyTenantId[] = [];
  
  let lastEvaluatedKey: any = undefined;
  let totalScanned = 0;
  
  do {
    const command = new ScanCommand({
      TableName: tableName,
      ExclusiveStartKey: lastEvaluatedKey
    });
    
    const response = await docClient.send(command);
    totalScanned += response.Count || 0;
    
    if (response.Items) {
      for (const item of response.Items) {
        const tenantId = item.tenantId;
        const isEmpty = !tenantId || 
                       (typeof tenantId === 'string' && tenantId.trim() === '') ||
                       tenantId === null ||
                       tenantId === undefined;
        
        if (isEmpty) {
          // Determine sort key name and value
          let sortKey = 'unknown';
          let sortKeyValue: string | undefined = undefined;
          
          if (tableName === TABLES.ASSESSMENTS) {
            sortKey = 'assessmentId';
            sortKeyValue = item.assessmentId;
          } else if (tableName === TABLES.QUESTIONS) {
            sortKey = 'questionId';
            sortKeyValue = item.questionId;
          } else if (tableName === TABLES.SESSIONS) {
            sortKey = 'sessionId';
            sortKeyValue = item.sessionId;
          } else if (tableName === TABLES.METRICS || tableName === TABLES.INSIGHTS) {
            sortKey = 'sessionId';
            sortKeyValue = item.sessionId;
          } else if (tableName === TABLES.DASHBOARDS) {
            sortKey = 'dashboardId';
            sortKeyValue = item.dashboardId;
          }
          
          itemsWithEmptyTenantId.push({
            tableName,
            tenantId,
            sortKey,
            sortKeyValue,
            item
          });
        }
      }
    }
    
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  console.log(`  Scanned ${totalScanned} items, found ${itemsWithEmptyTenantId.length} with empty tenantId`);
  return itemsWithEmptyTenantId;
}

async function fixAssessmentWithTenantId(
  tableName: string,
  assessmentId: string,
  newTenantId: string
): Promise<void> {
  // First, try to find the assessment by scanning (since we don't have tenantId)
  const scanCommand = new ScanCommand({
    TableName: tableName,
    FilterExpression: 'assessmentId = :assessmentId',
    ExpressionAttributeValues: {
      ':assessmentId': assessmentId
    }
  });
  
  const scanResponse = await docClient.send(scanCommand);
  const item = scanResponse.Items?.[0];
  
  if (!item) {
    throw new Error(`Assessment ${assessmentId} not found`);
  }
  
  // Get the current tenantId (might be empty)
  const currentTenantId = item.tenantId || '';
  
  // We need to delete the old item and create a new one with the correct tenantId
  // But first, let's check if we can determine tenantId from other fields
  
  // For assessments, try to get tenantId from createdBy attribute (if it contains tenant info)
  // Or use a default tenantId if provided
  
  console.log(`  Attempting to fix assessment ${assessmentId}...`);
  console.log(`  Current tenantId: ${JSON.stringify(currentTenantId)}`);
  console.log(`  New tenantId: ${newTenantId}`);
  
  // Since DynamoDB doesn't allow updating the partition key, we need to:
  // 1. Create a new item with the correct tenantId
  // 2. Delete the old item (if we can find it)
  
  // For now, let's just update the tenantId field (this might fail if tenantId is the partition key)
  // Actually, we can't update the partition key in DynamoDB - we need to recreate the item
  
  throw new Error('Cannot update partition key in DynamoDB. Item must be recreated with correct tenantId.');
}

async function main() {
  console.log('🔍 Scanning DynamoDB tables for items with empty tenantId...\n');
  
  const allIssues: ItemWithEmptyTenantId[] = [];
  
  // Scan all tables
  for (const [tableKey, tableName] of Object.entries(TABLES)) {
    try {
      const issues = await scanTableForEmptyTenantId(tableName);
      allIssues.push(...issues);
    } catch (error: any) {
      console.error(`  ❌ Error scanning ${tableName}:`, error.message);
    }
  }
  
  // Report findings
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  
  if (allIssues.length === 0) {
    console.log('✅ No items with empty tenantId found!');
    return;
  }
  
  console.log(`\n❌ Found ${allIssues.length} items with empty tenantId:\n`);
  
  // Group by table
  const byTable: Record<string, ItemWithEmptyTenantId[]> = {};
  for (const issue of allIssues) {
    if (!byTable[issue.tableName]) {
      byTable[issue.tableName] = [];
    }
    byTable[issue.tableName].push(issue);
  }
  
  for (const [tableName, issues] of Object.entries(byTable)) {
    console.log(`\n📋 ${tableName}: ${issues.length} items`);
    for (const issue of issues) {
      console.log(`   - ${issue.sortKey}: ${issue.sortKeyValue || 'N/A'}`);
      console.log(`     tenantId: ${JSON.stringify(issue.tenantId)}`);
      
      // For assessments, show more details
      if (tableName === TABLES.ASSESSMENTS && issue.item.title) {
        console.log(`     Title: ${issue.item.title}`);
      }
    }
  }
  
  // For assessments, try to suggest fixes
  const assessmentIssues = allIssues.filter(i => i.tableName === TABLES.ASSESSMENTS);
  if (assessmentIssues.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('🔧 FIXING ASSESSMENTS');
    console.log('='.repeat(80));
    console.log('\n⚠️  To fix assessments with empty tenantId, you have two options:\n');
    console.log('Option 1: Delete and recreate the assessment (recommended)');
    console.log('Option 2: Use AWS CLI to manually update (if you know the tenantId)\n');
    
    console.log('AWS CLI command to update an assessment:');
    console.log('(Replace ASSESSMENT_ID and TENANT_ID with actual values)\n');
    
    for (const issue of assessmentIssues) {
      if (issue.sortKeyValue) {
        console.log(`\n# For assessment: ${issue.sortKeyValue}`);
        console.log(`aws dynamodb scan \\`);
        console.log(`  --table-name ${TABLES.ASSESSMENTS} \\`);
        console.log(`  --filter-expression "assessmentId = :aid" \\`);
        console.log(`  --expression-attribute-values '{":aid":{"S":"${issue.sortKeyValue}"}}' \\`);
        console.log(`  --region us-east-1`);
        console.log(`\n# Then manually recreate the item with correct tenantId`);
      }
    }
  }
  
  // For other tables, provide similar guidance
  const otherIssues = allIssues.filter(i => i.tableName !== TABLES.ASSESSMENTS);
  if (otherIssues.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('⚠️  OTHER TABLES WITH ISSUES');
    console.log('='.repeat(80));
    console.log('\nItems in other tables (Sessions, Questions, etc.) should be recreated');
    console.log('when their parent assessment is fixed, or deleted if orphaned.\n');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('💡 RECOMMENDATION');
  console.log('='.repeat(80));
  console.log('\n1. Identify the correct tenantId for each assessment');
  console.log('2. Delete assessments with empty tenantId (or recreate with correct tenantId)');
  console.log('3. Ensure all new assessments are created with a valid tenantId');
  console.log('4. The code now validates tenantId, so this should not happen again.\n');
}

// Run the script
main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
