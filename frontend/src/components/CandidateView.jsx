import React from 'react'

function CandidateView({ assessment, apiEndpoint, onBack }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ 
          color: 'var(--text-primary)', 
          fontSize: '28px',
          fontWeight: '700'
        }}>Assessment: {assessment.title}</h2>
        <button className="btn" onClick={onBack}>Back to List</button>
      </div>
      
      <div className="card">
        <h3 style={{ marginBottom: '16px', color: '#667eea' }}>Assessment Details</h3>
        <div style={{ marginBottom: '12px' }}>
          <strong>Role:</strong> {assessment.targetRole.name} ({assessment.targetRole.seniorityLevel})
        </div>
        {assessment.description && (
          <div style={{ marginBottom: '12px' }}>
            <strong>Description:</strong> {assessment.description}
          </div>
        )}
        <div style={{ marginBottom: '12px' }}>
          <strong>Initial Difficulty:</strong> {assessment.initialDifficulty}/5
        </div>
        {assessment.durationMinutes && (
          <div style={{ marginBottom: '12px' }}>
            <strong>Duration:</strong> {assessment.durationMinutes} minutes
          </div>
        )}
        
        <div style={{ marginTop: '24px' }}>
          <strong>Knowledge Areas:</strong>
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            {assessment.knowledgeAreaMix.map((area, idx) => (
              <li key={idx}>
                {area.area.replace(/_/g, ' ')}: {area.percentage}%
                {area.programmingLanguage && ` (${area.programmingLanguage})`}
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="card" style={{ marginTop: '20px' }}>
        <h3 style={{ marginBottom: '16px', color: '#667eea' }}>Candidate Access</h3>
        <p style={{ marginBottom: '16px' }}>
          To start a candidate session, use the API endpoint:
        </p>
        <code style={{
          display: 'block',
          padding: '12px',
          background: '#f5f5f5',
          borderRadius: '6px',
          marginBottom: '16px',
          fontSize: '14px',
          wordBreak: 'break-all'
        }}>
          POST {apiEndpoint}sessions/start<br />
          Body: {"{"}<br />
          &nbsp;&nbsp;"assessmentId": "{assessment.assessmentId}",<br />
          &nbsp;&nbsp;"candidateEmail": "candidate@example.com",<br />
          &nbsp;&nbsp;"candidateName": "John Doe"<br />
          {"}"}
        </code>
        <p style={{ fontSize: '14px', color: '#666' }}>
          This is a public endpoint - no authentication required for candidates.
        </p>
      </div>
    </div>
  )
}

export default CandidateView
