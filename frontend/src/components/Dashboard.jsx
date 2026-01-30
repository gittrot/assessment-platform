import React, { useState, useEffect, useRef } from 'react'
import { API_ENDPOINT } from '../config'

function Dashboard({ token, assessments, onNavigateToAssessments, onSelectAssessment }) {
  const [stats, setStats] = useState({
    totalAssessments: 0,
    totalCandidates: 0,
    completionRate: 0,
    avgRoleFitScore: 0,
    tenantId: ''
  })
  const [candidates, setCandidates] = useState([])
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'passed', 'failed'
  const candidatesRef = useRef(null)

  useEffect(() => {
    loadDashboard()
  }, [token])

  const loadDashboard = async () => {
    if (!token) {
      console.warn('No token available for dashboard request')
      return
    }
    try {
      const response = await fetch(`${API_ENDPOINT}dashboard`, {
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        if (data.dashboard) {
          setStats({ ...data.dashboard, tenantId: data.dashboard.tenantId || '' })
        }
        setCandidates(Array.isArray(data.candidates) ? data.candidates : [])
      } else {
        setStats({
          totalAssessments: assessments.length,
          totalCandidates: 0,
          completionRate: 0,
          avgRoleFitScore: 0,
          tenantId: ''
        })
        setCandidates([])
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
      setStats({
        totalAssessments: assessments.length,
        totalCandidates: 0,
        completionRate: 0,
        avgRoleFitScore: 0,
        tenantId: ''
      })
      setCandidates([])
    }
  }

  const scrollToCandidates = () => {
    candidatesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const openCandidateDetail = async (c) => {
    const tid = c.tenantId || stats.tenantId
    if (!tid) {
      alert('Tenant context missing. Cannot load candidate detail.')
      return
    }
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await fetch(
        `${API_ENDPOINT}dashboard/candidates/${c.sessionId}?tenantId=${encodeURIComponent(tid)}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      )
      if (!res.ok) throw new Error(res.statusText)
      const data = await res.json()
      setDetail(data)
    } catch (e) {
      console.error('Failed to load candidate detail:', e)
      setDetail({ error: e.message || 'Failed to load candidate detail.' })
    } finally {
      setDetailLoading(false)
    }
  }

  const formatDate = (s) => {
    if (!s) return '—'
    try {
      const d = new Date(s)
      return isNaN(d.getTime()) ? s : d.toLocaleString()
    } catch {
      return s
    }
  }

  return (
    <div>
      <h2 style={{
        color: 'var(--text-primary)',
        marginBottom: '24px',
        fontSize: '28px',
        fontWeight: '700'
      }}>Dashboard</h2>

      <div className="grid">
        <div
          className="stat-card stat-card-clickable"
          role="button"
          tabIndex={0}
          onClick={() => typeof onNavigateToAssessments === 'function' && onNavigateToAssessments()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (typeof onNavigateToAssessments === 'function' && onNavigateToAssessments())}
        >
          <h3>Total Assessments</h3>
          <div className="stat-value">{stats.totalAssessments}</div>
          {typeof onNavigateToAssessments === 'function' && (
            <div className="stat-card-hint">Click to view</div>
          )}
        </div>
        <div
          className="stat-card stat-card-clickable"
          role="button"
          tabIndex={0}
          onClick={scrollToCandidates}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && scrollToCandidates()}
        >
          <h3>Total Candidates</h3>
          <div className="stat-value">{stats.totalCandidates}</div>
          <div className="stat-card-hint">Click to view ranking</div>
        </div>
        <div
          className="stat-card stat-card-clickable"
          role="button"
          tabIndex={0}
          onClick={scrollToCandidates}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && scrollToCandidates()}
        >
          <h3>Completion Rate</h3>
          <div className="stat-value">{(Number(stats.completionRate) || 0).toFixed(1)}%</div>
          <div className="stat-card-hint">Click to view candidates</div>
        </div>
        <div
          className="stat-card stat-card-clickable"
          role="button"
          tabIndex={0}
          onClick={scrollToCandidates}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && scrollToCandidates()}
        >
          <h3>Avg Role Fit Score</h3>
          <div className="stat-value">{(Number(stats.avgRoleFitScore) || 0).toFixed(1)}</div>
          <div className="stat-card-hint">Click to view ranking</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>Recent Assessments</h3>
        {assessments.length === 0 ? (
          <p>No assessments yet. Create your first assessment!</p>
        ) : (
          <div>
            {assessments.slice(0, 5).map((assessment) => (
              <div
                key={assessment.assessmentId}
                className="dashboard-row dashboard-row-clickable"
                role="button"
                tabIndex={0}
                onClick={() => typeof onSelectAssessment === 'function' && onSelectAssessment(assessment)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (typeof onSelectAssessment === 'function' && onSelectAssessment(assessment))}
              >
                <div>
                  <strong>{assessment.title}</strong>
                  <div style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
                    {assessment.targetRole?.name} – {assessment.targetRole?.seniorityLevel}
                  </div>
                </div>
                <span style={{
                  background: assessment.isActive ? '#4caf50' : '#ccc',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px'
                }}>
                  {assessment.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div ref={candidatesRef} className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Candidates &amp; ranking</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn"
              onClick={() => setFilterStatus('all')}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                background: filterStatus === 'all' ? '#667eea' : '#f0f0f0',
                color: filterStatus === 'all' ? 'white' : '#333'
              }}
            >
              All
            </button>
            <button
              className="btn"
              onClick={() => setFilterStatus('passed')}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                background: filterStatus === 'passed' ? '#4caf50' : '#f0f0f0',
                color: filterStatus === 'passed' ? 'white' : '#333'
              }}
            >
              Passed
            </button>
            <button
              className="btn"
              onClick={() => setFilterStatus('failed')}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                background: filterStatus === 'failed' ? '#f44336' : '#f0f0f0',
                color: filterStatus === 'failed' ? 'white' : '#333'
              }}
            >
              Failed
            </button>
          </div>
        </div>
        {candidates.length === 0 ? (
          <p>No completed candidate results yet.</p>
        ) : (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Status</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Assessment</th>
                  <th>Role fit</th>
                  <th>Overall</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {candidates
                  .filter(c => {
                    if (filterStatus === 'all') return true
                    if (filterStatus === 'passed') return c.passed === true
                    if (filterStatus === 'failed') return c.passed === false
                    return true
                  })
                  .map((c) => (
                  <tr
                    key={c.sessionId}
                    className="dashboard-row-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => openCandidateDetail(c)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openCandidateDetail(c)}
                  >
                    <td>{c.rank}</td>
                    <td>
                      {c.passed === true ? (
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: '#4caf50',
                          color: 'white'
                        }}>PASS</span>
                      ) : c.passed === false ? (
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: '#f44336',
                          color: 'white'
                        }}>FAIL</span>
                      ) : (
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: '#ccc',
                          color: '#666'
                        }}>—</span>
                      )}
                    </td>
                    <td>{c.candidateName}</td>
                    <td>{c.candidateEmail}</td>
                    <td>{c.assessmentTitle}</td>
                    <td>{Number(c.roleFitScore).toFixed(1)}</td>
                    <td>{Number(c.overallScore).toFixed(1)}</td>
                    <td>{formatDate(c.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {(detailLoading || detail) && (
        <div className="modal-overlay" onClick={() => !detailLoading && setDetail(null)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Candidate detail</h3>
              <button
                type="button"
                className="btn"
                onClick={() => setDetail(null)}
                disabled={detailLoading}
              >
                Close
              </button>
            </div>
            {detailLoading && <p>Loading…</p>}
            {!detailLoading && detail?.error && (
              <p className="message message-error">{detail.error}</p>
            )}
            {!detailLoading && detail && !detail.error && (
              <div className="candidate-detail" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
                {detail.session && (
                  <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #ddd' }}>
                    <strong>Candidate:</strong> {detail.session.candidateName} ({detail.session.candidateEmail})<br />
                    <strong>Status:</strong> {detail.session.status} · <strong>Submitted:</strong> {formatDate(detail.session.submittedAt)}
                  </div>
                )}
                {detail.assessment && (
                  <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #ddd' }}>
                    <strong>Assessment:</strong> {detail.assessment.title} · {detail.assessment.targetRole?.name}
                  </div>
                )}
                {detail.performance && (
                  <div style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #ddd' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <strong>Role fit score:</strong> {Number(detail.performance.roleFitScore).toFixed(1)} ·{' '}
                      <strong>Overall score:</strong> {Number(detail.performance.overallScore).toFixed(1)}
                      {detail.performance.passed !== undefined && (
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          background: detail.performance.passed ? '#4caf50' : '#f44336',
                          color: 'white'
                        }}>
                          {detail.performance.passed ? '✓ PASSED' : '✗ FAILED'}
                        </span>
                      )}
                    </div>
                    {detail.performance.strengths?.length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <strong>Strengths:</strong> {detail.performance.strengths.join(', ')}
                      </div>
                    )}
                    {detail.performance.weaknesses?.length > 0 && (
                      <div style={{ marginTop: '4px' }}>
                        <strong>Weaknesses:</strong> {detail.performance.weaknesses.join(', ')}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Question Details Section */}
                {detail.questionDetails && detail.questionDetails.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ marginBottom: '16px', fontSize: '18px', fontWeight: '600' }}>Question Details</h4>
                    {detail.questionDetails.map((q, index) => (
                      <div
                        key={index}
                        style={{
                          marginBottom: '24px',
                          padding: '16px',
                          background: q.isCorrect ? '#f0f9ff' : '#fff5f5',
                          border: `2px solid ${q.isCorrect ? '#4caf50' : '#f44336'}`,
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <strong style={{ fontSize: '16px' }}>Question {q.questionNumber}</strong>
                          <span
                            style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              background: q.isCorrect ? '#4caf50' : '#f44336',
                              color: 'white'
                            }}
                          >
                            {q.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                          </span>
                        </div>
                        
                        <div style={{ marginBottom: '12px', fontSize: '14px', color: '#666' }}>
                          <strong>Knowledge Area:</strong> {q.knowledgeArea.replace(/_/g, ' ')} ·{' '}
                          <strong>Difficulty:</strong> {q.difficulty}/5 ·{' '}
                          <strong>Time:</strong> {q.timeSpentSeconds}s
                        </div>
                        
                        <div
                          style={{
                            marginBottom: '12px',
                            padding: '12px',
                            background: 'white',
                            borderRadius: '6px',
                            fontSize: '14px',
                            lineHeight: '1.6'
                          }}
                          dangerouslySetInnerHTML={{ __html: q.questionText.replace(/\n/g, '<br/>') }}
                        />
                        
                        {q.options && q.options.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            <strong style={{ fontSize: '13px', color: '#666' }}>Options:</strong>
                            <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                              {q.options.map((opt, optIdx) => (
                                <li
                                  key={optIdx}
                                  style={{
                                    marginBottom: '4px',
                                    padding: '4px 8px',
                                    background: Array.isArray(q.candidateAnswer)
                                      ? q.candidateAnswer.includes(opt) ? '#e3f2fd' : 'transparent'
                                      : q.candidateAnswer === opt ? '#e3f2fd' : 'transparent',
                                    borderRadius: '4px'
                                  }}
                                >
                                  {opt}
                                  {Array.isArray(q.correctAnswer)
                                    ? q.correctAnswer.includes(opt) && ' ✓'
                                    : q.correctAnswer === opt && ' ✓'}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                          <div
                            style={{
                              padding: '12px',
                              background: q.isCorrect ? '#e8f5e9' : '#ffebee',
                              borderRadius: '6px',
                              border: `2px solid ${q.isCorrect ? '#4caf50' : '#f44336'}`
                            }}
                          >
                            <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px', color: '#666' }}>
                              Candidate's Answer:
                            </strong>
                            <div style={{ fontSize: '14px', wordBreak: 'break-word' }}>
                              {Array.isArray(q.candidateAnswer)
                                ? q.candidateAnswer.join(', ')
                                : String(q.candidateAnswer || 'No answer provided')}
                            </div>
                          </div>
                          
                          <div
                            style={{
                              padding: '12px',
                              background: '#e8f5e9',
                              borderRadius: '6px',
                              border: '2px solid #4caf50'
                            }}
                          >
                            <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px', color: '#666' }}>
                              Correct Answer:
                            </strong>
                            <div style={{ fontSize: '14px', wordBreak: 'break-word' }}>
                              {Array.isArray(q.correctAnswer)
                                ? q.correctAnswer.join(', ')
                                : String(q.correctAnswer || 'N/A')}
                            </div>
                          </div>
                        </div>
                        
                        {q.explanation && (
                          <div
                            style={{
                              marginTop: '12px',
                              padding: '12px',
                              background: '#fff9e6',
                              borderRadius: '6px',
                              border: '1px solid #ffc107'
                            }}
                          >
                            <strong style={{ fontSize: '13px', display: 'block', marginBottom: '6px' }}>Explanation:</strong>
                            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>{q.explanation}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {detail.insights?.roleFitAssessment && (
                  <div style={{ marginTop: '20px', padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                    <strong>Role fit assessment</strong>
                    <p style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{detail.insights.roleFitAssessment}</p>
                  </div>
                )}
                {detail.insights?.trainingRecommendations?.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <strong>Training recommendations</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                      {detail.insights.trainingRecommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
