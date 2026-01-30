# Frontend Application

React-based frontend for the Adaptive Assessment Platform.

## Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

The application will open at: **http://localhost:3000**

## Features

- ✅ Login with Cognito authentication
- ✅ Dashboard with statistics
- ✅ Create and manage assessments
- ✅ View assessment details
- ✅ Candidate session management

## Configuration

The API endpoint is configured in `src/App.jsx`:
- API Endpoint: `https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/`
- User Pool ID: `us-east-1_ovE1hjOrD`
- Client ID: `2ubk3rel7suditqf2i9svcb31c`

## Default Credentials

- Email: `admin@example.com`
- Password: `AdminPass123!`

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.
