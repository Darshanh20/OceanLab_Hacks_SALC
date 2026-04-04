# Vercel Deployment Guide

This guide explains how to deploy **SyncMind AI** to Vercel for production.

## Deployment Architecture

```
┌─────────────────────────────────────────┐
│      Vercel (Frontend + Serverless)     │
│  - Next.js 16 deployed on Vercel        │
│  - Automatic builds on git push         │
│  - Global CDN for static assets         │
└─────────────────────┬───────────────────┘
                      │ API calls via
                      │ NEXT_PUBLIC_API_BASE_URL
                      ↓
        ┌──────────────────────────┐
        │   Backend (Railway/Render)
        │   - FastAPI + Uvicorn     │
        │   - PostgreSQL (Supabase) │
        │   - Storage (Supabase)    │
        └──────────────────────────┘
```

**Recommendation**: Deploy frontend on Vercel, backend on Railway or Render

---

## Frontend Deployment (Vercel)

### 1. Prerequisites
- GitHub account with repository
- Vercel account (free tier available)
- Environment variables ready

### 2. Connect to Vercel

```bash
# Option A: Using Git (Recommended)
# 1. Push code to GitHub
git push origin main

# 2. Visit https://vercel.com/new
# 3. Select your repository
# 4. Vercel auto-detects Next.js configuration
```

Or use Vercel CLI:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy from project root
cd frontend
vercel
```

### 3. Configure Environment Variables

In Vercel Dashboard:
1. Go to **Settings** → **Environment Variables**
2. Add the following variables:

| Variable | Value | Example |
|----------|-------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Backend API URL | `https://api.yourapp.com` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth ID | `xxx.apps.googleusercontent.com` |
| `NEXTAUTH_SECRET` | Secret (> 32 chars) | `your-secret-key-minimum-32-chars` |
| `NEXTAUTH_URL` | Vercel app URL | `https://yourapp.vercel.app` |

### 4. Custom Domain
1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records as shown

### 5. Deploy

```bash
# Automatic: Push to main branch
git push origin main

# Manual via CLI
vercel --prod
```

---

## Backend Deployment (Railway/Render)

### Option 1: Deploy on Railway (Recommended)

```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Create project
cd backend
railway init

# 4. Add environment variables
railway variable add SUPABASE_URL=https://xxx.supabase.co
railway variable add SUPABASE_KEY=eyJxxx...
railway variable add SECRET_KEY=your-secret-key
# ... add other variables

# 5. Deploy
railway up
```

### Option 2: Deploy on Render

```bash
# 1. Visit https://dashboard.render.com
# 2. Create New → Web Service
# 3. Connect GitHub repository
# 4. Configure:
#    - Runtime: Python 3.11
#    - Build Command: pip install -r requirements.txt
#    - Start Command: uvicorn app.main:app --host 0.0.0.0 --port 8000
# 5. Add environment variables in Render dashboard
# 6. Deploy
```

---

## Database Setup (Supabase)

### 1. Create Supabase Project
```bash
# Visit https://supabase.com
# Create new project
# Wait for initialization
```

### 2. Get Credentials
From Supabase Dashboard:
1. **Settings** → **API** → Copy `URL` and `anon key`
2. **Settings** → **API** → Copy `service_role_key`

### 3. Run Migrations
```bash
# Option A: Using Supabase CLI
supabase link --project-ref your_project_id
supabase push

# Option B: Manual SQL
# Copy migrations from supabase/*.sql
# Paste into Supabase SQL Editor
```

### 4. Add to Environment
Add to backend deployment:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE=eyJxxx...
```

---

## Environment Variables Checklist

### Frontend (.env.local)
```
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

### Backend (.env)
```
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_ROLE=
SECRET_KEY=
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
GROQ_API_KEY=
COHERE_API_KEY=
GOOGLE_API_KEY=
```

---

## GitHub Actions CI/CD (Optional)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: vercel/action@master
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: railway/action@main
        with:
          token: ${{ secrets.RAILWAY_TOKEN }}
          service: ${{ secrets.RAILWAY_SERVICE_ID }}
```

---

## SSL/HTTPS

✅ **Automatic**: Both Vercel and Railway provide free SSL certificates

---

## Monitoring & Logs

### Vercel
- Dashboard: https://vercel.com/dashboard
- Logs: **Settings** → **General** → **Logs**
- Analytics: **Analytics** tab

### Railway/Render
- Dashboard: https://dashboard.railway.app or https://dashboard.render.com
- Live logs visible in deployment view
- Error tracking in Logs section

---

## Troubleshooting

### Build Failed
```bash
# Check build logs in Vercel dashboard
# Common issues:
# - Missing env variables
# - Node/npm version mismatch
# - Dependency conflicts
```

### API Connection Errors
```bash
# Verify NEXT_PUBLIC_API_BASE_URL is correct
# Check backend is running
# Verify CORS headers on backend
```

### Database Connection Failed
```bash
# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/
  -H "Authorization: Bearer YOUR_KEY"

# Check IP whitelist (if applicable)
# Verify credentials in .env
```

---

## Production Checklist

- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Railway/Render
- [ ] Database migrations applied
- [ ] Environment variables set in all services
- [ ] SSL certificates active (auto)
- [ ] Custom domain configured
- [ ] Email notifications enabled
- [ ] Monitoring/error tracking setup
- [ ] Backups configured (Supabase)
- [ ] Rate limiting enabled on backend
- [ ] CORS properly configured
- [ ] NextAuth session cookies secure

---

## Performance Optimization

### Frontend
```javascript
// next.config.js
{
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    unoptimized: false
  }
}
```

### Backend
- Enable Redis caching for RAG queries
- Add rate limiting on public endpoints
- Use connection pooling for database

---

## Scaling

### Automatic Scaling
- **Vercel**: Auto-scales serverless functions
- **Railway**: Configure auto-scale limits in dashboard
- **Supabase**: Scales database automatically

### Manual Scaling
- Upgrade Vercel plan for more concurrent functions
- Increase Railway/Render compute resources
- Upgrade Supabase plan for higher throughput

---

## Support & Resources

- Vercel Docs: https://vercel.com/docs
- Railway Docs: https://docs.railway.app
- Render Docs: https://render.com/docs
- Supabase Docs: https://supabase.com/docs

---

**Last Updated**: April 4, 2026
