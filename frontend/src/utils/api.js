// API utility with CORS handling
import { API_ENDPOINT } from '../config'

export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_ENDPOINT}${endpoint}`
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  }

  try {
    const response = await fetch(url, defaultOptions)
    
    // Handle CORS errors
    if (!response.ok && response.status === 0) {
      throw new Error('CORS error: Unable to reach server')
    }
    
    return response
  } catch (error) {
    if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
      console.error('CORS Error:', error)
      throw new Error('CORS error: Please check API Gateway CORS configuration')
    }
    throw error
  }
}

export const login = async (email, password) => {
  return apiCall('auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  })
}
