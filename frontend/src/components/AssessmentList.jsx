import React, { useState } from 'react'
import { API_ENDPOINT } from '../config'
import SendEmailModal from './SendEmailModal'

function AssessmentList({ token, assessments, onRefresh, onSelect }) {
  const [copiedId, setCopiedId] = useState(null)
  const [emailModalAssessment, setEmailModalAssessment] = useState(null)

  const copyAssessmentLink = (e, assessment) => {
    e.stopPropagation()
    // Create a shareable link with assessment ID
    // Candidates can use this ID with POST /sessions/start
    const shareableLink = `${API_ENDPOINT}assessments/${assessment.assessmentId}\n\nAssessment ID: ${assessment.assessmentId}\n\nTo start this assessment, use:\nPOST ${API_ENDPOINT}sessions/start\nBody: {"assessmentId": "${assessment.assessmentId}", "candidateEmail": "...", "candidateName": "..."}`
    
    // Try to copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareableLink).then(() => {
        setCopiedId(assessment.assessmentId)
        setTimeout(() => setCopiedId(null), 2000)
      }).catch(() => {
        // Fallback for older browsers
        fallbackCopy(shareableLink, assessment.assessmentId)
      })
    } else {
      fallbackCopy(shareableLink, assessment.assessmentId)
    }
  }

  const fallbackCopy = (text, assessmentId) => {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      setCopiedId(assessmentId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      alert('Failed to copy link. Assessment ID: ' + assessmentId)
    }
    document.body.removeChild(textArea)
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ 
          color: 'var(--text-primary)', 
          fontSize: '28px',
          fontWeight: '700'
        }}>Assessments</h2>
        <button className="btn" onClick={onRefresh}>Refresh</button>
      </div>
      
      {assessments.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '18px', color: '#666', marginBottom: '20px' }}>
            No assessments found. Create your first assessment!
          </p>
        </div>
      ) : (
        <div className="grid">
          {assessments.map(assessment => (
            <div key={assessment.assessmentId} className="card" style={{ cursor: 'pointer' }} onClick={() => onSelect(assessment)}>
              <h3 style={{ color: '#667eea', marginBottom: '12px' }}>{assessment.title}</h3>
              {assessment.description && (
                <p style={{ color: '#666', marginBottom: '12px', fontSize: '14px' }}>
                  {assessment.description}
                </p>
              )}
              <div style={{ marginBottom: '12px' }}>
                <strong>Role:</strong> {assessment.targetRole.name} ({assessment.targetRole.seniorityLevel})
              </div>
              <div style={{ marginBottom: '12px', fontSize: '14px' }}>
                <strong>Knowledge Areas:</strong>
                <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                  {assessment.knowledgeAreaMix.map((area, idx) => (
                    <li key={idx}>{area.area}: {area.percentage}%</li>
                  ))}
                </ul>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #eee'
              }}>
                <span style={{
                  background: assessment.isActive ? '#4caf50' : '#ccc',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}>
                  {assessment.isActive ? 'Active' : 'Inactive'}
                </span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    className="btn" 
                    style={{ 
                      padding: '8px 16px', 
                      fontSize: '14px',
                      background: copiedId === assessment.assessmentId ? '#4caf50' : '#667eea',
                      border: 'none'
                    }}
                    onClick={(e) => copyAssessmentLink(e, assessment)}
                    title="Copy assessment link"
                  >
                    {copiedId === assessment.assessmentId ? '✓ Copied!' : '📋 Copy Link'}
                  </button>
                  <button 
                    className="btn" 
                    style={{ 
                      padding: '8px 16px', 
                      fontSize: '14px',
                      background: '#28a745',
                      border: 'none'
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEmailModalAssessment(assessment)
                    }}
                    title="Send assessment link via email"
                  >
                    📧 Send Email
                  </button>
                  <button 
                    className="btn" 
                    style={{ padding: '8px 16px', fontSize: '14px' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(assessment)
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {emailModalAssessment && (
        <SendEmailModal
          assessment={emailModalAssessment}
          token={token}
          onClose={() => setEmailModalAssessment(null)}
          onSuccess={() => {
            // Optionally refresh assessments or show success message
          }}
        />
      )}
    </div>
  )
}

export default AssessmentList
