import React, { useState, useEffect } from 'react'
import { API_ENDPOINT } from '../config'

function TenantManagement({ token }) {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState({})

  useEffect(() => {
    loadTenants()
  }, [token])

  const loadTenants = async () => {
    try {
      const response = await fetch(`${API_ENDPOINT}admin/tenants`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setTenants(data.tenants || [])
      } else {
        const error = await response.json()
        alert('Error loading tenants: ' + (error.error?.message || 'Failed to load'))
      }
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleTenant = async (tenantId, currentEnabled) => {
    setUpdating({ ...updating, [tenantId]: true })
    try {
      const response = await fetch(`${API_ENDPOINT}admin/tenants/${encodeURIComponent(tenantId)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !currentEnabled })
      })
      if (response.ok) {
        await loadTenants() // Reload list
      } else {
        const error = await response.json()
        alert('Error: ' + (error.error?.message || 'Failed to update tenant'))
      }
    } catch (error) {
      alert('Error: ' + error.message)
    } finally {
      setUpdating({ ...updating, [tenantId]: false })
    }
  }

  if (loading) {
    return <div className="card"><p>Loading tenants...</p></div>
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ 
          color: 'var(--text-primary)', 
          fontSize: '28px',
          fontWeight: '700'
        }}>Tenant Management</h2>
        <button className="btn" onClick={loadTenants}>Refresh</button>
      </div>

      <div className="card">
        {tenants.length === 0 ? (
          <p>No tenants found.</p>
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Tenant ID</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.tenantId}>
                    <td><strong>{tenant.tenantId}</strong></td>
                    <td>{tenant.email}</td>
                    <td>
                      <span style={{
                        background: tenant.enabled ? '#10b981' : '#ef4444',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {tenant.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>{tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '—'}</td>
                    <td>
                      <button
                        className="btn"
                        style={{
                          background: tenant.enabled ? '#ef4444' : '#10b981',
                          padding: '8px 16px',
                          fontSize: '14px'
                        }}
                        onClick={() => toggleTenant(tenant.tenantId, tenant.enabled)}
                        disabled={updating[tenant.tenantId]}
                      >
                        {updating[tenant.tenantId] ? '...' : (tenant.enabled ? 'Disable' : 'Enable')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default TenantManagement
