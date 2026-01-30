import React, { useState, useEffect } from 'react'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import AssessmentList from './components/AssessmentList'
import CreateAssessment from './components/CreateAssessment'
import CreateTenantUser from './components/CreateTenantUser'
import TenantManagement from './components/TenantManagement'
import CandidateView from './components/CandidateView'
import './App.css'

import { API_ENDPOINT, USER_POOL_ID, CLIENT_ID } from './config'

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [view, setView] = useState('login')
  const [assessments, setAssessments] = useState([])
  const [selectedAssessment, setSelectedAssessment] = useState(null)

  useEffect(() => {
    // Handle public assessment start route: /assessments/:id/start
    // This allows hiring.trotlabs.com/assessments/{id}/start to redirect to API Gateway
    const path = window.location.pathname
    const assessmentStartMatch = path.match(/^\/assessments\/([^\/]+)\/start/)
    if (assessmentStartMatch) {
      const assessmentId = assessmentStartMatch[1]
      const queryString = window.location.search
      // Redirect to API Gateway assessment start page
      window.location.href = `${API_ENDPOINT}assessments/${assessmentId}/start${queryString}`
      return
    }

    // Check for stored token
    const storedToken = localStorage.getItem('accessToken')
    const storedUser = localStorage.getItem('user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
      setView('dashboard')
      loadAssessments(storedToken)
    }
  }, [])

  const loadAssessments = async (authToken) => {
    try {
      const response = await fetch(`${API_ENDPOINT}assessments`, {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setAssessments(data.assessments || [])
      } else if (response.status === 401) {
        // Token expired, clear storage and redirect to login
        console.warn('Token expired, redirecting to login')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
        setToken(null)
        setUser(null)
        setView('login')
      } else {
        // Handle other errors
        console.error(`Failed to load assessments: ${response.status} ${response.statusText}`)
        try {
          const errorData = await response.json()
          console.error('Error details:', errorData)
        } catch (e) {
          // Response is not JSON
        }
      }
    } catch (error) {
      console.error('Error loading assessments:', error)
      // Don't show alert for network errors during initial load
      // The user will see an empty list instead
    }
  }

  const handleLogin = async (email, password) => {
    try {
      // Use backend auth endpoint (most reliable)
      const response = await fetch(`${API_ENDPOINT}auth/login`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
      
      if (response.ok) {
        const data = await response.json()
        // API Gateway Cognito authorizer expects ID token, not access token
        const tokenToUse = data.idToken || data.accessToken
        if (tokenToUse) {
          setToken(tokenToUse)
          setUser({ email, role: 'ADMIN' })
          localStorage.setItem('accessToken', tokenToUse)
          localStorage.setItem('user', JSON.stringify({ email, role: 'ADMIN' }))
          setView('dashboard')
          loadAssessments(tokenToUse)
          return
        } else {
          throw new Error('No token received from server')
        }
      } else {
        // Try to get error message from response
        let errorMessage = `Authentication failed (${response.status})`
        try {
          const errorData = await response.json()
          errorMessage = errorData.error?.message || errorData.message || errorMessage
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Login error:', error)
      // Show user-friendly error message
      const errorMessage = error.message || 'Invalid credentials. Please check your email and password.'
      alert('Login failed: ' + errorMessage)
    }
  }

  const handleLogout = () => {
    setUser(null)
    setToken(null)
    setView('login')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
  }

  return (
    <div className="App">
      {view === 'login' && (
        <Login onLogin={handleLogin} />
      )}
      {view !== 'login' && user && (
        <div className="app-container">
          <nav className="navbar">
            <h1>🎯 Adaptive Assessment Platform</h1>
            <div className="nav-buttons">
              <button onClick={() => setView('dashboard')}>Dashboard</button>
              <button onClick={() => setView('assessments')}>Assessments</button>
              <button onClick={() => setView('create')}>Create Assessment</button>
              {user?.role === 'ADMIN' && (
                <>
                  <button onClick={() => setView('tenants')}>Manage Tenants</button>
                  <button onClick={() => setView('create-tenant')}>Create Tenant User</button>
                </>
              )}
              <button onClick={handleLogout}>Logout</button>
            </div>
          </nav>
          
          {view === 'dashboard' && (
            <Dashboard
              token={token}
              assessments={assessments}
              onNavigateToAssessments={() => setView('assessments')}
              onSelectAssessment={(a) => {
                setSelectedAssessment(a)
                setView('candidate')
              }}
            />
          )}
          {view === 'assessments' && (
            <AssessmentList 
              token={token} 
              assessments={assessments} 
              onRefresh={() => loadAssessments(token)}
              onSelect={(assessment) => {
                setSelectedAssessment(assessment)
                setView('candidate')
              }}
            />
          )}
          {view === 'create' && (
            <CreateAssessment 
              token={token} 
              onSuccess={() => {
                loadAssessments(token)
                setView('assessments')
              }}
            />
          )}
          {view === 'tenants' && (
            <TenantManagement token={token} />
          )}
          {view === 'create-tenant' && user?.role === 'ADMIN' && (
            <CreateTenantUser 
              token={token} 
              onSuccess={(data) => {
                // Success message is already shown in the component
                console.log('Tenant user created:', data)
              }}
            />
          )}
          {view === 'create-tenant' && user?.role !== 'ADMIN' && (
            <div className="card">
              <p style={{ color: '#ef4444', fontWeight: '600' }}>Access Denied</p>
              <p>Only admin users can create tenant users.</p>
              <button className="btn" onClick={() => setView('dashboard')} style={{ marginTop: '16px' }}>
                Go to Dashboard
              </button>
            </div>
          )}
          {view === 'candidate' && selectedAssessment && (
            <CandidateView 
              assessment={selectedAssessment}
              apiEndpoint={API_ENDPOINT}
              onBack={() => setView('assessments')}
            />
          )}
        </div>
      )}
    </div>
  )
}

export default App
