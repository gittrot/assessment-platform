import React, { useState } from 'react'
import { API_ENDPOINT } from '../config'

function CreateTenantUser({ token, onSuccess }) {
  const [formData, setFormData] = useState({
    email: '',
    tenantId: '',
    temporaryPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate token
    if (!token) {
      setError('Authentication required. Please log in again.')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Build request body, only include temporaryPassword if it has a value
      const requestBody = {
        email: formData.email,
        tenantId: formData.tenantId
      }
      
      if (formData.temporaryPassword && formData.temporaryPassword.trim()) {
        requestBody.temporaryPassword = formData.temporaryPassword
      }

      const response = await fetch(`${API_ENDPOINT}admin/tenants`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        try {
          const data = await response.json()
          setSuccess(true)
          setFormData({ email: '', tenantId: '', temporaryPassword: '' })
          if (onSuccess && typeof onSuccess === 'function') {
            try {
              onSuccess(data)
            } catch (callbackError) {
              console.error('Error in onSuccess callback:', callbackError)
            }
          }
          setTimeout(() => setSuccess(false), 3000)
        } catch (jsonError) {
          setError('Success but failed to parse response')
        }
      } else {
        // Handle 401 Unauthorized (token expired or invalid)
        if (response.status === 401) {
          setError('Your session has expired. Please log out and log in again to continue.')
          // Optionally, you could automatically redirect to login
          // setTimeout(() => {
          //   window.location.reload()
          // }, 3000)
        } else {
          try {
            const errorData = await response.json()
            const errorMessage = errorData.error?.message || errorData.message || `Failed to create tenant user (${response.status})`
            setError(errorMessage)
          } catch (jsonError) {
            // If response is not JSON, use status text
            setError(`Failed to create tenant user: ${response.status} ${response.statusText}`)
          }
        }
      }
    } catch (error) {
      console.error('Create tenant user error:', error)
      setError('Error: ' + (error.message || 'Network error. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 style={{ 
        color: 'var(--text-primary)', 
        marginBottom: '24px',
        fontSize: '28px',
        fontWeight: '700'
      }}>Create Tenant User</h2>
      
      {success && (
        <div style={{
          padding: '12px 16px',
          background: '#d4edda',
          color: '#155724',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #c3e6cb'
        }}>
          ✓ Tenant user created successfully!
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px',
          background: '#f8d7da',
          color: '#721c24',
          borderRadius: '8px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: error.includes('expired') ? '8px' : '0' }}>
            ✗ {error}
          </div>
          {error.includes('expired') && (
            <div style={{ fontSize: '13px', marginTop: '8px', opacity: 0.9 }}>
              Click "Logout" in the navigation bar, then log in again with your admin credentials.
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <label className="label">Email Address *</label>
        <input
          type="email"
          className="input"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
          placeholder="tenant@example.com"
        />

        <label className="label">Tenant ID *</label>
        <input
          type="text"
          className="input"
          value={formData.tenantId}
          onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
          required
          placeholder="e.g., acme-corp, tenant-123"
          pattern="[a-zA-Z0-9_-]+"
          title="Tenant ID should contain only letters, numbers, hyphens, and underscores"
        />
        <small style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '-12px', marginBottom: '16px', display: 'block' }}>
          Unique identifier for the tenant organization
        </small>

        <label className="label">Temporary Password</label>
        <input
          type="password"
          className="input"
          value={formData.temporaryPassword}
          onChange={(e) => setFormData({ ...formData, temporaryPassword: e.target.value })}
          placeholder="Leave empty to auto-generate"
        />
        <small style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '-12px', marginBottom: '16px', display: 'block' }}>
          Must be at least 8 characters with uppercase, lowercase, digit, and special character. Leave empty to auto-generate.
        </small>

        <button 
          type="submit" 
          className="btn" 
          style={{ width: '100%', marginTop: '8px' }}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading"></span>
              Creating...
            </>
          ) : (
            'Create Tenant User'
          )}
        </button>
      </form>

      <div style={{ 
        marginTop: '24px', 
        padding: '16px', 
        background: 'var(--surface)', 
        borderRadius: '8px', 
        fontSize: '13px',
        border: '1px solid var(--border-color)'
      }}>
        <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>Notes:</strong>
        <ul style={{ color: 'var(--text-secondary)', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
          <li>Tenant users can create and manage assessments for their organization</li>
          <li>The tenant ID will be associated with all assessments created by this user</li>
          <li>If no password is provided, Cognito will generate a temporary password</li>
          <li>Users will be required to change their password on first login</li>
        </ul>
      </div>
    </div>
  )
}

export default CreateTenantUser
