# 🌐 Frontend Access Guide

## ✅ Frontend Application Created!

A React-based frontend has been created and is ready to use.

## 🚀 How to Access the Frontend

### Option 1: Development Server (Recommended)

1. **Navigate to frontend directory:**
   ```bash
   cd /Users/umaprasathudaiyar/adaptive-assessment-platform/frontend
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open in browser:**
   The application will automatically open at:
   ```
   http://localhost:3000
   ```

### Option 2: If Server is Already Running

If the dev server is already running in the background, simply open:
```
http://localhost:3000
```

## 🔐 Login Credentials

- **Email**: `admin@example.com`
- **Password**: `AdminPass123!`

## 📱 Frontend Features

### Available Pages:

1. **Login Page** - Authenticate with Cognito
2. **Dashboard** - View statistics and overview
3. **Assessments List** - View all assessments
4. **Create Assessment** - Create new role-based assessments
5. **Assessment Details** - View assessment information

## 🛠️ Troubleshooting

### Port Already in Use
If port 3000 is busy, Vite will automatically use the next available port (3001, 3002, etc.)

### Authentication Issues
If login fails, you can also access the API directly:
- API Endpoint: `https://qtg2maclol.execute-api.us-east-1.amazonaws.com/prod/`
- See `APPLICATION_READY.md` for API examples

### Check if Server is Running
```bash
lsof -i :3000
```

### Stop the Server
```bash
# Find the process
ps aux | grep "vite"

# Kill it
kill <PID>
```

## 📚 Frontend Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── AssessmentList.jsx
│   │   ├── CreateAssessment.jsx
│   │   └── CandidateView.jsx
│   ├── App.jsx
│   ├── main.jsx
│   ├── config.js
│   └── index.css
├── index.html
├── package.json
└── vite.config.js
```

## 🎨 Features

- ✅ Modern React UI with Vite
- ✅ Responsive design
- ✅ Cognito authentication integration
- ✅ Assessment management
- ✅ Dashboard with statistics
- ✅ Create assessments with knowledge area mix

## 🔄 Next Steps

1. **Access the frontend** at http://localhost:3000
2. **Login** with admin credentials
3. **Create your first assessment**
4. **View dashboard** statistics

## 📝 Notes

- The frontend uses the deployed API endpoint
- Authentication is handled via AWS Cognito
- All API calls require authentication tokens
- The frontend is a Single Page Application (SPA)

---

**Status**: ✅ Frontend Ready

**Access URL**: http://localhost:3000
