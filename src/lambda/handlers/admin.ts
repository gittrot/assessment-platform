/**
 * Lambda handler for admin operations
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '../../shared/types';
import { getUserFromToken, hasRole, createTenantUser, createAdminUser, listTenants, updateTenantStatus } from '../../shared/auth';
import {
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  formatErrorResponse
} from '../../shared/errors';

/**
 * Create a new tenant user
 * POST /admin/tenants
 */
export async function createTenant(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError();
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(accessToken);

    if (!hasRole(user, UserRole.ADMIN)) {
      throw new AuthorizationError('Admin access required');
    }

    const body = JSON.parse(event.body || '{}');
    const { email, tenantId, temporaryPassword } = body;

    if (!email || !tenantId) {
      throw new ValidationError('Email and tenantId required');
    }

    const username = await createTenantUser(email, tenantId, temporaryPassword);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: JSON.stringify({
        username,
        email,
        tenantId,
        message: 'Tenant user created successfully'
      })
    };
  } catch (error) {
    const errorResponse = formatErrorResponse(error);
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: errorResponse.body
    };
  }
}

/**
 * Create a new admin user
 * POST /admin/admins
 */
export async function createAdmin(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError();
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(accessToken);

    if (!hasRole(user, UserRole.ADMIN)) {
      throw new AuthorizationError('Admin access required');
    }

    const body = JSON.parse(event.body || '{}');
    const { email, temporaryPassword } = body;

    if (!email) {
      throw new ValidationError('Email required');
    }

    const username = await createAdminUser(email, temporaryPassword);

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: JSON.stringify({
        username,
        email,
        message: 'Admin user created successfully'
      })
    };
  } catch (error) {
    const errorResponse = formatErrorResponse(error);
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: errorResponse.body
    };
  }
}

/**
 * List all tenants
 * GET /admin/tenants
 */
export async function listAllTenants(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError();
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(accessToken);

    if (!hasRole(user, UserRole.ADMIN)) {
      throw new AuthorizationError('Admin access required');
    }

    const tenants = await listTenants();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: JSON.stringify({ tenants })
    };
  } catch (error) {
    const errorResponse = formatErrorResponse(error);
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: errorResponse.body
    };
  }
}

/**
 * Update tenant status (enable/disable)
 * PUT /admin/tenants/{tenantId}
 */
export async function updateTenant(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader) {
      throw new AuthenticationError();
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromToken(accessToken);

    if (!hasRole(user, UserRole.ADMIN)) {
      throw new AuthorizationError('Admin access required');
    }

    const tenantId = event.pathParameters?.tenantId;
    if (!tenantId) {
      throw new ValidationError('Tenant ID required');
    }

    const body = JSON.parse(event.body || '{}');
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      throw new ValidationError('enabled must be a boolean');
    }

    await updateTenantStatus(tenantId, enabled);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: JSON.stringify({
        tenantId,
        enabled,
        message: `Tenant ${enabled ? 'enabled' : 'disabled'} successfully`
      })
    };
  } catch (error) {
    const errorResponse = formatErrorResponse(error);
    return {
      statusCode: errorResponse.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token',
        'Access-Control-Max-Age': '3600'
      },
      body: errorResponse.body
    };
  }
}
