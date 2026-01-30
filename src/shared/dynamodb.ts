/**
 * DynamoDB client and helper functions
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});
export { ScanCommand } from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB Access Patterns
 * 
 * All tables use tenantId as partition key for multi-tenant isolation
 */

// Assessments Table
// PK: tenantId, SK: assessmentId
export const ASSESSMENT_GSI = 'GSI1'; // GSI: status (active/inactive) + createdAt

// Questions Table  
// PK: tenantId, SK: assessmentId#questionId
export const QUESTION_GSI = 'GSI1'; // GSI: knowledgeArea + difficulty

// Sessions Table
// PK: tenantId, SK: sessionId
export const SESSION_GSI = 'GSI1'; // GSI: assessmentId + startedAt

// Metrics Table
// PK: tenantId, SK: sessionId
export const METRICS_GSI = 'GSI1'; // GSI: assessmentId + completedAt

// Insights Table
// PK: tenantId, SK: sessionId
export const INSIGHTS_GSI = 'GSI1'; // GSI: assessmentId + generatedAt

// Dashboards Table
// PK: tenantId, SK: 'DASHBOARD' (single item per tenant)

/**
 * Helper functions for common DynamoDB operations
 */

export async function getItem<T>(
  tableName: string,
  tenantId: string,
  sortKey: string
): Promise<T | null> {
  const command = new GetCommand({
    TableName: tableName,
    Key: {
      tenantId,
      [getSortKeyName(tableName)]: sortKey
    }
  });

  const response = await docClient.send(command);
  return (response.Item as T) || null;
}

export async function putItem<T extends { tenantId: string }>(
  tableName: string,
  item: T
): Promise<void> {
  // Log the incoming item first
  console.log('putItem: Received item:', {
    tableName,
    itemTenantId: item.tenantId,
    itemTenantIdType: typeof item.tenantId,
    itemTenantIdValue: JSON.stringify(item.tenantId),
    itemTenantIdLength: item.tenantId?.length,
    itemKeys: Object.keys(item),
    fullItemStringified: JSON.stringify(item, null, 2)
  });
  
  // Validate tenantId before sending to DynamoDB
  const tenantIdValue = item.tenantId;
  if (!tenantIdValue || typeof tenantIdValue !== 'string' || tenantIdValue.trim() === '') {
    console.error('putItem: ❌ Invalid tenantId detected:', {
      tenantId: tenantIdValue,
      tenantIdType: typeof tenantIdValue,
      tenantIdValue: JSON.stringify(tenantIdValue),
      tenantIdLength: tenantIdValue?.length,
      itemKeys: Object.keys(item),
      tableName,
      fullItem: JSON.stringify(item, null, 2),
      itemStringified: JSON.stringify(item)
    });
    throw new Error(`Cannot save item: tenantId is empty or invalid. Table: ${tableName}, tenantId: ${JSON.stringify(tenantIdValue)}`);
  }

  // Ensure tenantId is a non-empty string
  const validTenantId = String(tenantIdValue).trim();
  if (!validTenantId) {
    throw new Error(`Cannot save item: tenantId is empty after trimming. Table: ${tableName}`);
  }

  // Reconstruct the item explicitly - don't use spread operator to avoid any issues
  // Set tenantId FIRST and explicitly to ensure it's never empty
  const cleanItem: Record<string, any> = {
    tenantId: validTenantId  // Set this FIRST and explicitly
  };
  
  // Copy all other properties one by one, skipping tenantId
  const itemKeys = Object.keys(item);
  for (const key of itemKeys) {
    if (key === 'tenantId') {
      // Skip - we've already set it explicitly above
      continue;
    }
    const value = item[key as keyof T];
    if (value !== undefined && value !== null) {
      cleanItem[key] = value;
    }
  }
  
  // Final explicit assignment to ensure tenantId is correct
  cleanItem.tenantId = validTenantId;
  
  // Verify tenantId is still correct after all operations
  if (cleanItem.tenantId !== validTenantId) {
    console.error('CRITICAL: tenantId was modified during item construction!', {
      original: validTenantId,
      after: cleanItem.tenantId,
      itemKeys: Object.keys(cleanItem)
    });
    cleanItem.tenantId = validTenantId; // Force it back
  }

  // Log what we're sending to DynamoDB
  console.log('putItem: Sending to DynamoDB:', {
    tableName,
    tenantId: cleanItem.tenantId,
    tenantIdType: typeof cleanItem.tenantId,
    tenantIdLength: cleanItem.tenantId.length,
    tenantIdValue: JSON.stringify(cleanItem.tenantId),
    itemKeys: Object.keys(cleanItem),
    hasTenantId: 'tenantId' in cleanItem,
    tenantIdInItem: cleanItem.tenantId
  });

  // Final check - ensure tenantId is still present and valid
  if (!cleanItem.tenantId || cleanItem.tenantId.trim() === '') {
    throw new Error(`putItem: tenantId became empty during item construction. Original: ${JSON.stringify(tenantIdValue)}, Clean: ${JSON.stringify(cleanItem.tenantId)}`);
  }

  // Construct the final item explicitly with tenantId as the FIRST property
  // Use a plain object (not Object.create(null)) to avoid Document Client marshalling issues
  const finalItem: Record<string, any> = {};
  
  // Set tenantId FIRST - this is the partition key
  // Use direct assignment to ensure it's a plain string
  finalItem.tenantId = String(validTenantId).trim();
  
  // Verify tenantId was set correctly
  if (finalItem.tenantId !== validTenantId) {
    console.error('putItem: tenantId mismatch after assignment!', {
      validTenantId,
      finalItemTenantId: finalItem.tenantId,
      validTenantIdType: typeof validTenantId,
      finalItemTenantIdType: typeof finalItem.tenantId
    });
    finalItem.tenantId = validTenantId; // Force it
  }
  
  // Add all other properties from cleanItem
  for (const key of Object.keys(cleanItem)) {
    if (key !== 'tenantId') {
      const value = cleanItem[key];
      if (value !== undefined && value !== null) {
        // Skip empty strings for non-key attributes (but tenantId is already handled)
        if (typeof value === 'string' && value.trim() === '' && key !== 'tenantId') {
          continue; // Skip empty strings for non-key attributes
        }
        finalItem[key] = value;
      }
    }
  }
  
  // Final verification - tenantId must be first and non-empty
  const finalTenantId = finalItem.tenantId;
  if (!finalTenantId || typeof finalTenantId !== 'string' || finalTenantId.trim() === '') {
    console.error('putItem: CRITICAL - tenantId is empty in finalItem!', {
      finalTenantId,
      finalTenantIdType: typeof finalTenantId,
      finalTenantIdValue: JSON.stringify(finalTenantId),
      validTenantId,
      finalItemKeys: Object.keys(finalItem),
      finalItemStringified: JSON.stringify(finalItem, null, 2)
    });
    throw new Error(`putItem: tenantId is empty in finalItem. validTenantId was: ${JSON.stringify(validTenantId)}, finalItem.tenantId is: ${JSON.stringify(finalTenantId)}`);
  }
  
  // Force tenantId to be the validated value one more time (defensive)
  finalItem.tenantId = validTenantId;
  
  // Verify one more time after all operations
  if (finalItem.tenantId !== validTenantId || finalItem.tenantId.trim() === '') {
    console.error('putItem: tenantId changed after all operations!', {
      validTenantId,
      finalItemTenantId: finalItem.tenantId,
      finalItemKeys: Object.keys(finalItem)
    });
    finalItem.tenantId = validTenantId; // Force it again
  }

  // CRITICAL: One final check - ensure tenantId is a non-empty string
  // DynamoDB Document Client might do some marshalling, so we need to be absolutely sure
  const finalTenantIdCheck = finalItem.tenantId;
  if (!finalTenantIdCheck || typeof finalTenantIdCheck !== 'string' || finalTenantIdCheck.trim() === '') {
    console.error('putItem: ❌❌❌ CRITICAL ERROR - tenantId is empty in finalItem right before PutCommand!', {
      finalTenantIdCheck,
      finalTenantIdCheckType: typeof finalTenantIdCheck,
      finalTenantIdCheckValue: JSON.stringify(finalTenantIdCheck),
      validTenantId,
      finalItemKeys: Object.keys(finalItem),
      finalItemStringified: JSON.stringify(finalItem, null, 2),
      finalItemTenantId: finalItem.tenantId
    });
    throw new Error(`putItem: CRITICAL - tenantId became empty right before PutCommand. validTenantId was: ${JSON.stringify(validTenantId)}, finalItem.tenantId is: ${JSON.stringify(finalTenantIdCheck)}`);
  }
  
  // Force tenantId one more time - this is the absolute last chance
  finalItem.tenantId = validTenantId;

  const command = new PutCommand({
    TableName: tableName,
    Item: finalItem  // Use the explicitly constructed item
  });

  // Log the exact command we're sending - check BOTH the command input and the finalItem
  const commandItem = command.input.Item || {};
  console.log('putItem: PutCommand Item (BEFORE send):', {
    finalItemTenantId: finalItem.tenantId,
    finalItemTenantIdType: typeof finalItem.tenantId,
    finalItemTenantIdValue: JSON.stringify(finalItem.tenantId),
    commandItemTenantId: commandItem.tenantId,
    commandItemTenantIdType: typeof commandItem.tenantId,
    commandItemTenantIdValue: JSON.stringify(commandItem.tenantId),
    itemKeys: Object.keys(commandItem),
    finalItemKeys: Object.keys(finalItem),
    hasTenantIdInCommand: 'tenantId' in commandItem,
    hasTenantIdInFinalItem: 'tenantId' in finalItem,
    commandItemStringified: JSON.stringify(commandItem, null, 2)
  });

  try {
    await docClient.send(command);
    console.log('putItem: ✅ Successfully saved to DynamoDB');
  } catch (dynamoError: any) {
    console.error('putItem: DynamoDB error:', {
      errorMessage: dynamoError.message,
      errorName: dynamoError.name,
      errorCode: dynamoError.code,
      errorStack: dynamoError.stack,
      tableName,
      tenantId: cleanItem.tenantId,
      tenantIdType: typeof cleanItem.tenantId,
      tenantIdLength: cleanItem.tenantId?.length,
      commandItemTenantId: command.input.Item?.tenantId,
      commandItemTenantIdType: typeof command.input.Item?.tenantId,
      itemKeys: Object.keys(cleanItem),
      commandItemKeys: Object.keys(command.input.Item || {}),
      fullItem: JSON.stringify(cleanItem, null, 2),
      commandItem: JSON.stringify(command.input.Item, null, 2)
    });
    throw dynamoError;
  }
}

export async function queryByPartitionKey<T>(
  tableName: string,
  tenantId: string,
  sortKeyPrefix?: string
): Promise<T[]> {
  const command = new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: 'tenantId = :tenantId' + (sortKeyPrefix ? ' AND begins_with(sortKey, :prefix)' : ''),
    ExpressionAttributeValues: {
      ':tenantId': tenantId,
      ...(sortKeyPrefix && { ':prefix': sortKeyPrefix })
    }
  });

  const response = await docClient.send(command);
  return (response.Items as T[]) || [];
}

export async function queryByGSI<T>(
  tableName: string,
  indexName: string,
  keyConditionExpression: string,
  expressionAttributeValues: Record<string, any>
): Promise<T[]> {
  const command = new QueryCommand({
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: expressionAttributeValues
  });

  const response = await docClient.send(command);
  return (response.Items as T[]) || [];
}

export async function scanTable<T>(
  tableName: string,
  filter?: { expression: string; values: Record<string, unknown> }
): Promise<T[]> {
  const command = new ScanCommand({
    TableName: tableName,
    ...(filter && {
      FilterExpression: filter.expression,
      ExpressionAttributeValues: filter.values
    })
  });
  const response = await docClient.send(command);
  return (response.Items as T[]) || [];
}

export async function updateItem(
  tableName: string,
  tenantId: string,
  sortKey: string,
  updateExpression: string,
  expressionAttributeValues: Record<string, any>,
  expressionAttributeNames?: Record<string, string>
): Promise<void> {
  // Validate tenantId before sending to DynamoDB
  if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
    console.error('updateItem: Invalid tenantId detected:', {
      tenantId,
      tenantIdType: typeof tenantId,
      tenantIdValue: JSON.stringify(tenantId),
      tableName,
      sortKey
    });
    throw new Error(`Cannot update item: tenantId is empty or invalid. Table: ${tableName}, tenantId: ${JSON.stringify(tenantId)}`);
  }

  const validTenantId = tenantId.trim();
  
  console.log('updateItem: Updating item:', {
    tableName,
    tenantId: validTenantId,
    tenantIdType: typeof validTenantId,
    tenantIdLength: validTenantId.length,
    sortKey,
    sortKeyType: typeof sortKey
  });

  const command = new UpdateCommand({
    TableName: tableName,
    Key: {
      tenantId: validTenantId,
      [getSortKeyName(tableName)]: sortKey
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ...(expressionAttributeNames && { ExpressionAttributeNames: expressionAttributeNames })
  });

  try {
    await docClient.send(command);
    console.log('updateItem: ✅ Successfully updated item in DynamoDB');
  } catch (dynamoError: any) {
    console.error('updateItem: ❌ DynamoDB error:', {
      errorMessage: dynamoError.message,
      errorName: dynamoError.name,
      errorCode: dynamoError.code,
      tableName,
      tenantId: validTenantId,
      sortKey,
      commandKey: JSON.stringify(command.input.Key, null, 2)
    });
    throw dynamoError;
  }
}

function getSortKeyName(tableName: string): string {
  // Determine sort key name based on table
  if (tableName.includes('Assessment')) return 'assessmentId';
  if (tableName.includes('Question')) return 'questionId';
  if (tableName.includes('Session')) return 'sessionId';
  if (tableName.includes('Metric')) return 'sessionId';
  if (tableName.includes('Insight')) return 'sessionId';
  if (tableName.includes('Dashboard')) return 'dashboardId';
  return 'id';
}
