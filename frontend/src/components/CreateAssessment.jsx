import React, { useState } from 'react'
import { API_ENDPOINT } from '../config'

const KNOWLEDGE_AREAS = [
  'PROGRAMMING_LANGUAGE',
  'ALGORITHMS_DATA_STRUCTURES',
  'ANALYTICAL_REASONING',
  'QUANTITATIVE_MATH',
  'SYSTEM_SCENARIO_DESIGN',
  'PSYCHOMETRIC_BEHAVIORAL'
]

const SENIORITY_LEVELS = ['JUNIOR', 'MID', 'SENIOR', 'LEAD']

function CreateAssessment({ token, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    roleName: '',
    seniorityLevel: 'MID',
    initialDifficulty: 3,
    durationMinutes: 60,
    maxQuestions: 10,
    knowledgeAreas: []
  })
  const [loading, setLoading] = useState(false)

  const addKnowledgeArea = () => {
    setFormData({
      ...formData,
      knowledgeAreas: [...formData.knowledgeAreas, { area: 'PROGRAMMING_LANGUAGE', percentage: 0, programmingLanguage: '' }]
    })
  }

  const updateKnowledgeArea = (index, field, value) => {
    const updated = [...formData.knowledgeAreas]
    updated[index] = { ...updated[index], [field]: value }
    setFormData({ ...formData, knowledgeAreas: updated })
  }

  const removeKnowledgeArea = (index) => {
    setFormData({
      ...formData,
      knowledgeAreas: formData.knowledgeAreas.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate percentages sum to 100
    const totalPercentage = formData.knowledgeAreas.reduce((sum, area) => sum + (parseInt(area.percentage) || 0), 0)
    if (Math.abs(totalPercentage - 100) > 0.01) {
      alert(`Knowledge area percentages must sum to 100. Current total: ${totalPercentage}%`)
      return
    }

    // Validate maxQuestions
    const maxQuestionsValue = parseInt(formData.maxQuestions)
    if (isNaN(maxQuestionsValue) || maxQuestionsValue < 1 || maxQuestionsValue > 50) {
      alert('Maximum Questions must be a number between 1 and 50')
      return
    }

    setLoading(true)
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        targetRole: {
          name: formData.roleName,
          seniorityLevel: formData.seniorityLevel
        },
        knowledgeAreaMix: formData.knowledgeAreas.map(area => ({
          area: area.area,
          percentage: parseInt(area.percentage),
          ...(area.area === 'PROGRAMMING_LANGUAGE' && area.programmingLanguage ? { programmingLanguage: area.programmingLanguage } : {})
        })),
        initialDifficulty: parseInt(formData.initialDifficulty),
        durationMinutes: parseInt(formData.durationMinutes),
        maxQuestions: parseInt(formData.maxQuestions)
      }

      const response = await fetch(`${API_ENDPOINT}assessments`, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        alert('Assessment created successfully!')
        onSuccess()
      } else {
        const error = await response.json()
        alert('Error: ' + (error.error?.message || 'Failed to create assessment'))
      }
    } catch (error) {
      alert('Error: ' + error.message)
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
      }}>Create Assessment</h2>
      <form onSubmit={handleSubmit} className="card">
        <label className="label">Assessment Title *</label>
        <input
          type="text"
          className="input"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          placeholder="e.g., Senior Backend Engineer Assessment"
        />

        <label className="label">Description</label>
        <textarea
          className="input"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows="3"
          placeholder="Assessment description"
        />

        <label className="label">Role Name *</label>
        <input
          type="text"
          className="input"
          value={formData.roleName}
          onChange={(e) => setFormData({ ...formData, roleName: e.target.value })}
          required
          placeholder="e.g., Backend Engineer"
        />

        <label className="label">Seniority Level *</label>
        <select
          className="input"
          value={formData.seniorityLevel}
          onChange={(e) => setFormData({ ...formData, seniorityLevel: e.target.value })}
          required
        >
          {SENIORITY_LEVELS.map(level => (
            <option key={level} value={level}>{level}</option>
          ))}
        </select>

        <label className="label">Initial Difficulty (1-5) *</label>
        <input
          type="number"
          className="input"
          min="1"
          max="5"
          value={formData.initialDifficulty}
          onChange={(e) => setFormData({ ...formData, initialDifficulty: e.target.value })}
          required
        />

        <label className="label">Duration (minutes)</label>
        <input
          type="number"
          className="input"
          value={formData.durationMinutes}
          onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
          placeholder="60"
        />

        <label className="label">Maximum Questions *</label>
        <input
          type="number"
          className="input"
          min="1"
          max="50"
          value={formData.maxQuestions}
          onChange={(e) => setFormData({ ...formData, maxQuestions: e.target.value })}
          required
          placeholder="10"
        />
        <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
          Number of questions candidates will answer (1-50)
        </p>

        <div style={{ marginTop: '24px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <label className="label" style={{ marginBottom: 0 }}>Knowledge Areas *</label>
            <button type="button" className="btn" onClick={addKnowledgeArea} style={{ padding: '8px 16px' }}>
              + Add Area
            </button>
          </div>
          
          {formData.knowledgeAreas.map((area, index) => (
            <div key={index} style={{ 
              padding: '16px', 
              background: '#f5f5f5', 
              borderRadius: '8px', 
              marginBottom: '12px' 
            }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                <select
                  className="input"
                  style={{ flex: 1 }}
                  value={area.area}
                  onChange={(e) => updateKnowledgeArea(index, 'area', e.target.value)}
                >
                  {KNOWLEDGE_AREAS.map(ka => (
                    <option key={ka} value={ka}>{ka.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <input
                  type="number"
                  className="input"
                  style={{ width: '120px' }}
                  min="0"
                  max="100"
                  value={area.percentage}
                  onChange={(e) => updateKnowledgeArea(index, 'percentage', e.target.value)}
                  placeholder="%"
                  required
                />
                <button
                  type="button"
                  onClick={() => removeKnowledgeArea(index)}
                  style={{
                    background: '#f44336',
                    color: 'white',
                    border: 'none',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
              {area.area === 'PROGRAMMING_LANGUAGE' && (
                <input
                  type="text"
                  className="input"
                  value={area.programmingLanguage}
                  onChange={(e) => updateKnowledgeArea(index, 'programmingLanguage', e.target.value)}
                  placeholder="Programming Language (e.g., Java, Python)"
                />
              )}
            </div>
          ))}
          
          {formData.knowledgeAreas.length === 0 && (
            <p style={{ color: '#666', fontStyle: 'italic' }}>
              Click "Add Area" to add knowledge areas. Percentages must sum to 100%.
            </p>
          )}
        </div>

        <button type="submit" className="btn" style={{ width: '100%' }} disabled={loading || formData.knowledgeAreas.length === 0}>
          {loading ? 'Creating...' : 'Create Assessment'}
        </button>
      </form>
    </div>
  )
}

export default CreateAssessment
