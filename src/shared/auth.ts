/**
 * AWS Cognito authentication and authorization utilities
 */

import {
  CognitoIdentityProviderClient,
  GetUserCommand,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminUpdateUserAttributesCommand,
  ListUsersCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand
} from '@aws-sdk/client-cognito-identity-provider';
import { UserRole, CognitoUserAttributes } from './types';
import { COGNITO_USER_POOL_ID } from './constants';

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * Extract user information from API Gateway authorizer context (preferred)
 * This is populated when API Gateway Cognito authorizer validates the token
 */
export function getUserFromAuthorizerContext(event: any): CognitoUserAttributes | null {
  const claims = event?.requestContext?.authorizer?.claims;
  if (!claims) {
    return null;
  }

  return {
    sub: claims.sub || claims['cognito:username'] || '',
    email: claims.email || '',
    'custom:tenantId': claims['custom:tenantId'],
    'custom:role': (claims['custom:role'] as UserRole) || UserRole.CANDIDATE
  };
}

/**
 * Extract user information from Cognito JWT token (ID token or access token)
 * Tries to decode JWT first (for ID tokens), falls back to GetUserCommand (for access tokens)
 */
export async function getUserFromToken(token: string): Promise<CognitoUserAttributes> {
  // Try to decode as JWT first (works for ID tokens)
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      
      // If it's an ID token, extract claims directly
      if (payload.token_use === 'id' || payload.iss?.includes('cognito-idp')) {
        return {
          sub: payload.sub || payload['cognito:username'] || '',
          email: payload.email || '',
          'custom:tenantId': payload['custom:tenantId'],
          'custom:role': (payload['custom:role'] as UserRole) || UserRole.CANDIDATE
        };
      }
    }
  } catch (e) {
    // Not a valid JWT or can't decode, fall through to GetUserCommand
  }

  // Fallback: Use GetUserCommand for access tokens
  const command = new GetUserCommand({ AccessToken: token });
  const response = await cognitoClient.send(command);

  const attributes: CognitoUserAttributes = {
    sub: response.Username || '',
    email: '',
    'custom:role': UserRole.CANDIDATE
  };

  response.UserAttributes?.forEach(attr => {
    if (attr.Name === 'email') {
      attributes.email = attr.Value || '';
    }
    if (attr.Name === 'custom:tenantId') {
      attributes['custom:tenantId'] = attr.Value;
    }
    if (attr.Name === 'custom:role') {
      attributes['custom:role'] = (attr.Value as UserRole) || UserRole.CANDIDATE;
    }
  });

  return attributes;
}

/**
 * Create a new tenant user (Admin only)
 */
export async function createTenantUser(
  email: string,
  tenantId: string,
  temporaryPassword?: string
): Promise<string> {
  const command = new AdminCreateUserCommand({
    UserPoolId: COGNITO_USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'custom:tenantId', Value: tenantId },
      { Name: 'custom:role', Value: UserRole.TENANT }
    ],
    TemporaryPassword: temporaryPassword,
    MessageAction: 'SUPPRESS' // Admin will send password separately
  });

  const response = await cognitoClient.send(command);
  
  // Add user to TENANT group
  await addUserToGroup(response.User?.Username || email, 'TENANT');

  return response.User?.Username || email;
}

/**
 * Create an admin user
 */
export async function createAdminUser(
  email: string,
  temporaryPassword?: string
): Promise<string> {
  const command = new AdminCreateUserCommand({
    UserPoolId: COGNITO_USER_POOL_ID,
    Username: email,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'email_verified', Value: 'true' },
      { Name: 'custom:role', Value: UserRole.ADMIN }
    ],
    TemporaryPassword: temporaryPassword,
    MessageAction: 'SUPPRESS'
  });

  const response = await cognitoClient.send(command);
  
  // Add user to ADMIN group
  await addUserToGroup(response.User?.Username || email, 'ADMIN');

  return response.User?.Username || email;
}

/**
 * Add user to Cognito group
 */
async function addUserToGroup(username: string, groupName: string): Promise<void> {
  const command = new AdminAddUserToGroupCommand({
    UserPoolId: COGNITO_USER_POOL_ID,
    Username: username,
    GroupName: groupName
  });

  await cognitoClient.send(command);
}

/**
 * Verify user has required role
 */
export function hasRole(userAttributes: CognitoUserAttributes, requiredRole: UserRole): boolean {
  return userAttributes['custom:role'] === requiredRole;
}

/**
 * Verify user belongs to tenant (for tenant isolation)
 */
export function belongsToTenant(
  userAttributes: CognitoUserAttributes,
  tenantId: string
): boolean {
  if (userAttributes['custom:role'] === UserRole.ADMIN) {
    return true; // Admins can access all tenants
  }
  return userAttributes['custom:tenantId'] === tenantId;
}

/**
 * Extract tenant ID from user attributes
 */
export function getTenantId(userAttributes: CognitoUserAttributes): string | null {
  return userAttributes['custom:tenantId'] || null;
}

/**
 * List all tenants (users with tenantId attribute)
 */
export async function listTenants(): Promise<Array<{
  tenantId: string;
  email: string;
  username: string;
  enabled: boolean;
  createdAt?: string;
}>> {
  const command = new ListUsersCommand({
    UserPoolId: COGNITO_USER_POOL_ID,
    Filter: 'cognito:user_status = "CONFIRMED"'
  });

  const response = await cognitoClient.send(command);
  const tenants: Array<{
    tenantId: string;
    email: string;
    username: string;
    enabled: boolean;
    createdAt?: string;
  }> = [];

  if (response.Users) {
    for (const user of response.Users) {
      const tenantIdAttr = user.Attributes?.find(attr => attr.Name === 'custom:tenantId');
      const roleAttr = user.Attributes?.find(attr => attr.Name === 'custom:role');
      
      // Only include users with tenantId and role TENANT
      if (tenantIdAttr?.Value && roleAttr?.Value === UserRole.TENANT) {
        const emailAttr = user.Attributes?.find(attr => attr.Name === 'email');
        tenants.push({
          tenantId: tenantIdAttr.Value,
          email: emailAttr?.Value || user.Username || '',
          username: user.Username || '',
          enabled: user.Enabled !== false,
          createdAt: user.UserCreateDate?.toISOString()
        });
      }
    }
  }

  // Deduplicate by tenantId (keep first occurrence)
  const seen = new Set<string>();
  return tenants.filter(t => {
    if (seen.has(t.tenantId)) return false;
    seen.add(t.tenantId);
    return true;
  });
}

/**
 * Enable or disable a tenant
 */
export async function updateTenantStatus(
  tenantId: string,
  enabled: boolean
): Promise<void> {
  // Find all users with this tenantId
  const command = new ListUsersCommand({
    UserPoolId: COGNITO_USER_POOL_ID,
    Filter: `cognito:user_status = "CONFIRMED"`
  });

  const response = await cognitoClient.send(command);
  if (!response.Users) {
    throw new Error('No users found');
  }

  const tenantUsers = response.Users.filter(user => {
    const tenantIdAttr = user.Attributes?.find(attr => attr.Name === 'custom:tenantId');
    return tenantIdAttr?.Value === tenantId;
  });

  if (tenantUsers.length === 0) {
    throw new Error(`No tenant found with tenantId: ${tenantId}`);
  }

  // Enable/disable all users for this tenant
  for (const user of tenantUsers) {
    const username = user.Username;
    if (!username) continue;

    if (enabled) {
      await cognitoClient.send(new AdminEnableUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: username
      }));
    } else {
      await cognitoClient.send(new AdminDisableUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: username
      }));
    }
  }
}
