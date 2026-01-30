/**
 * GET endpoint to show a simple HTML page for candidates to start an assessment
 * GET /assessments/{assessmentId}/start
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand, docClient } from '../../shared/dynamodb';
import { TABLES } from '../../shared/constants';
import { Assessment } from '../../shared/types';

const API_ENDPOINT = process.env.API_ENDPOINT || 'https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/';

// Helper function to find assessment by ID (for public endpoints)
async function findAssessmentById(assessmentId: string, tenantId?: string): Promise<Assessment | null> {
  // If tenantId is provided, use direct lookup (more efficient)
  if (tenantId && tenantId.trim() !== '') {
    const { getItem } = await import('../../shared/dynamodb');
    return await getItem<Assessment>(TABLES.ASSESSMENTS, tenantId.trim(), assessmentId);
  }
  
  // Fallback: For public endpoints without tenantId, we need to scan
  // This is less efficient but necessary for backward compatibility
  console.warn('Finding assessment without tenantId - using scan (consider including tenantId in URL)');
  const command = new ScanCommand({
    TableName: TABLES.ASSESSMENTS,
    FilterExpression: 'assessmentId = :assessmentId',
    ExpressionAttributeValues: {
      ':assessmentId': assessmentId
    }
  });
  
  const response = await docClient.send(command);
  const item = response.Items?.[0] as Assessment | null;
  
  // Validate tenantId if found via scan
  if (item && (!item.tenantId || item.tenantId.trim() === '')) {
    console.error('Assessment found via scan has empty tenantId:', {
      assessmentId,
      itemKeys: Object.keys(item)
    });
    throw new Error('Assessment configuration error: tenantId is missing. Please contact support.');
  }
  
  return item;
}

export async function getAssessmentStartPage(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const assessmentId = event.pathParameters?.assessmentId;
    if (!assessmentId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        },
        body: '<html><body><h1>Error</h1><p>Assessment ID is required</p></body></html>'
      };
    }

    // Get query parameters for pre-filling the form
    const queryParams = event.queryStringParameters || {};
    const candidateEmail = queryParams.email || '';
    const candidateName = queryParams.name || '';
    const tenantId = queryParams.tenantId; // Get tenantId from URL if provided

    // Find assessment (use tenantId if provided for efficient lookup, otherwise scan)
    const assessment = await findAssessmentById(assessmentId, tenantId);
    
    if (!assessment) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        },
        body: '<html><body><h1>Assessment Not Found</h1><p>The assessment you are looking for does not exist or is no longer available.</p></body></html>'
      };
    }

    if (!assessment.isActive) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*'
        },
        body: '<html><body><h1>Assessment Not Active</h1><p>This assessment is not currently active.</p></body></html>'
      };
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Start Assessment: ${assessment.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 600px;
      width: 100%;
      padding: 40px;
    }
    h1 {
      color: #667eea;
      margin-bottom: 10px;
      font-size: 28px;
    }
    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 16px;
    }
    .assessment-info {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }
    .assessment-info h2 {
      color: #333;
      margin-bottom: 15px;
      font-size: 20px;
    }
    .info-row {
      margin: 10px 0;
      color: #555;
    }
    .info-row strong {
      color: #333;
      display: inline-block;
      min-width: 120px;
    }
    form {
      margin-top: 30px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 600;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 2px solid #ddd;
      border-radius: 6px;
      font-size: 16px;
      transition: border-color 0.3s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      background: #667eea;
      color: white;
      border: none;
      padding: 16px;
      border-radius: 6px;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.3s;
      margin-top: 10px;
    }
    button:hover {
      background: #5568d3;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .error {
      background: #fee;
      color: #c33;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: none;
    }
    .success {
      background: #efe;
      color: #3c3;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: none;
    }
    .loading {
      text-align: center;
      color: #667eea;
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 Assessment Invitation</h1>
    <p class="subtitle">Complete the form below to start your assessment</p>
    
    <div class="assessment-info">
      <h2>${assessment.title}</h2>
      ${assessment.description ? `<p class="info-row"><strong>Description:</strong> ${assessment.description}</p>` : ''}
      <p class="info-row"><strong>Role:</strong> ${assessment.targetRole.name} (${assessment.targetRole.seniorityLevel})</p>
      ${assessment.durationMinutes ? `<p class="info-row"><strong>Duration:</strong> ${assessment.durationMinutes} minutes</p>` : ''}
    </div>

    <div class="error" id="error"></div>
    <div class="success" id="success"></div>
    <div class="loading" id="loading">Starting your assessment session...</div>

    <form id="startForm">
      <div class="form-group">
        <label for="candidateEmail">Your Email *</label>
        <input 
          type="email" 
          id="candidateEmail" 
          name="candidateEmail" 
          value="${candidateEmail}"
          required 
          placeholder="your.email@example.com"
        />
      </div>
      
      <div class="form-group">
        <label for="candidateName">Your Name</label>
        <input 
          type="text" 
          id="candidateName" 
          name="candidateName" 
          value="${candidateName}"
          placeholder="John Doe"
        />
      </div>
      
      <button type="submit" id="submitBtn">
        🚀 Start Assessment
      </button>
    </form>
  </div>

  <script>
    const form = document.getElementById('startForm');
    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');
    const loadingDiv = document.getElementById('loading');
    const submitBtn = document.getElementById('submitBtn');
    
    // Get tenantId from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tenantId = urlParams.get('tenantId')${tenantId ? ` || '${tenantId}'` : ''};

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = document.getElementById('candidateEmail').value;
      const name = document.getElementById('candidateName').value || email.split('@')[0];
      
      // Hide previous messages
      errorDiv.style.display = 'none';
      successDiv.style.display = 'none';
      loadingDiv.style.display = 'block';
      submitBtn.disabled = true;
      
      try {
        const requestBody = {
          assessmentId: '${assessmentId}',
          candidateEmail: email,
          candidateName: name
        };
        
        // Include tenantId if available (from URL query parameter)
        if (tenantId && tenantId.trim() !== '') {
          requestBody.tenantId = tenantId;
        }
        
        const response = await fetch('${API_ENDPOINT}sessions/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        if (response.ok) {
          loadingDiv.style.display = 'none';
          successDiv.textContent = 'Assessment started successfully! Session ID: ' + data.sessionId;
          successDiv.style.display = 'block';
          
          // Redirect to question page (include tenantId in URL)
          const questionPageUrl = '${API_ENDPOINT}sessions/' + data.sessionId + '/question' + (tenantId ? '?tenantId=' + encodeURIComponent(tenantId) : '');
          setTimeout(() => {
            window.location.href = questionPageUrl;
          }, 2000);
        } else {
          loadingDiv.style.display = 'none';
          errorDiv.textContent = data.error?.message || data.message || 'Failed to start assessment. Please try again.';
          errorDiv.style.display = 'block';
          submitBtn.disabled = false;
        }
      } catch (error) {
        loadingDiv.style.display = 'none';
        errorDiv.textContent = 'Network error: ' + error.message + '. Please check your connection and try again.';
        errorDiv.style.display = 'block';
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
    `.trim();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '3600'
      },
      body: html
    };
  } catch (error) {
    console.error('Error generating start page:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      },
      body: '<html><body><h1>Error</h1><p>An error occurred while loading the assessment page. Please try again later.</p></body></html>'
    };
  }
}
