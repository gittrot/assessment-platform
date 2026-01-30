/**
 * Script to check a specific assessment in DynamoDB
 * Usage: npx ts-node scripts/check-assessment.ts <assessmentId>
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.ASSESSMENTS_TABLE || 'Assessments';

async function checkAssessment(assessmentId: string) {
  console.log(`\n🔍 Checking assessment: ${assessmentId}\n`);
  
  const command = new ScanCommand({
    TableName: TABLE_NAME,
    FilterExpression: 'assessmentId = :assessmentId',
    ExpressionAttributeValues: {
      ':assessmentId': assessmentId
    }
  });
  
  const response = await docClient.send(command);
  const items = response.Items || [];
  
  if (items.length === 0) {
    console.log('❌ Assessment not found');
    return;
  }
  
  if (items.length > 1) {
    console.log(`⚠️  Warning: Found ${items.length} assessments with the same ID`);
  }
  
  for (const item of items) {
    console.log('📋 Assessment Details:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(item, null, 2));
    console.log('='.repeat(80));
    
    const tenantId = item.tenantId;
    console.log(`\n🔑 tenantId Analysis:`);
    console.log(`   Value: ${JSON.stringify(tenantId)}`);
    console.log(`   Type: ${typeof tenantId}`);
    console.log(`   Is null: ${tenantId === null}`);
    console.log(`   Is undefined: ${tenantId === undefined}`);
    console.log(`   Is empty string: ${tenantId === ''}`);
    console.log(`   Length: ${tenantId?.length ?? 'N/A'}`);
    console.log(`   Trimmed length: ${typeof tenantId === 'string' ? tenantId.trim().length : 'N/A'}`);
    console.log(`   Truthy: ${!!tenantId}`);
    console.log(`   After trim check: ${typeof tenantId === 'string' && tenantId.trim() === ''}`);
    
    if (!tenantId || (typeof tenantId === 'string' && tenantId.trim() === '')) {
      console.log(`\n❌ PROBLEM: tenantId is empty or invalid!`);
      console.log(`\n💡 To fix this assessment, you need to:`);
      console.log(`   1. Note down all the assessment details above`);
      console.log(`   2. Delete this assessment`);
      console.log(`   3. Recreate it with a valid tenantId`);
    } else {
      console.log(`\n✅ tenantId looks valid`);
    }
  }
}

const assessmentId = process.argv[2];
if (!assessmentId) {
  console.error('Usage: npx ts-node scripts/check-assessment.ts <assessmentId>');
  process.exit(1);
}

checkAssessment(assessmentId).catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
