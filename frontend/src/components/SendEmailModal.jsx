import React, { useState } from 'react'
import { API_ENDPOINT } from '../config'

function SendEmailModal({ assessment, token, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    candidateEmail: '',
    candidateName: '',
    customMessage: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.candidateEmail) {
      setError('Candidate email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.candidateEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${API_ENDPOINT}assessments/${assessment.assessmentId}/send-email`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          candidateEmail: formData.candidateEmail,
          candidateName: formData.candidateName || formData.candidateEmail.split('@')[0],
          customMessage: formData.customMessage || undefined
        })
      })

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          onClose()
          if (onSuccess) onSuccess()
        }, 2000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.error?.message || `Failed to send email (${response.status})`)
      }
    } catch (err) {
      console.error('Send email error:', err)
      setError('Error: ' + (err.message || 'Network error. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}>
        <div className="card" style={{ maxWidth: '500px', width: '90%', padding: '30px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>✓</div>
            <h3 style={{ color: '#4caf50', marginBottom: '10px' }}>Email Sent!</h3>
            <p style={{ color: '#666' }}>The assessment invitation has been sent to {formData.candidateEmail}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }} onClick={onClose}>
      <div className="card" style={{ 
        maxWidth: '500px', 
        width: '90%', 
        padding: '30px',
        maxHeight: '90vh',
        overflowY: 'auto'
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ color: '#667eea', margin: 0 }}>Send Assessment Invitation</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666',
              padding: '0',
              width: '30px',
              height: '30px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '6px' }}>
          <strong>Assessment:</strong> {assessment.title}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Candidate Email <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              type="email"
              value={formData.candidateEmail}
              onChange={(e) => setFormData({ ...formData, candidateEmail: e.target.value })}
              placeholder="candidate@example.com"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Candidate Name (optional)
            </label>
            <input
              type="text"
              value={formData.candidateName}
              onChange={(e) => setFormData({ ...formData, candidateName: e.target.value })}
              placeholder="John Doe"
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Custom Message (optional)
            </label>
            <textarea
              value={formData.customMessage}
              onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
              placeholder="Add a personal message to the invitation..."
              rows={4}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '12px',
              background: '#fee',
              color: '#c33',
              borderRadius: '6px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn"
              style={{ background: '#ccc', border: 'none' }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              disabled={loading}
              style={{ background: '#667eea', border: 'none' }}
            >
              {loading ? 'Sending...' : '📧 Send Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SendEmailModal
