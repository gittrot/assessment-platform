// API Configuration
// These will be set from environment variables or CDK outputs
// For local development, use the hardcoded values
// For production, these should be injected at build time
export const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || 'https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/'
export const USER_POOL_ID = import.meta.env.VITE_USER_POOL_ID || 'us-east-1_ovE1hjOrD'
export const CLIENT_ID = import.meta.env.VITE_CLIENT_ID || '2ubk3rel7suditqf2i9svcb31c'
export const AWS_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1'
