# Deployment Guide for Tokn

This guide covers deploying Tokn to Vercel (frontend) and Render/Railway (optional backend).

## Architecture Overview

- **Frontend**: React + Vite application (landing page + visual IDE)
- **Backend** (Optional): Python Flask API for DSPy and GEPA optimization features

## Deployment Options

### Option 1: Frontend Only (Recommended for Free Tier)

Deploy only the frontend on Vercel. This gives you:
- ✅ All core features (multi-provider LLM support, visual flow editor, tool calling)
- ✅ Completely free on Vercel
- ✅ API keys stored encrypted in browser (no backend needed)
- ❌ No DSPy or GEPA optimization features

### Option 2: Frontend + Backend

Deploy frontend on Vercel and backend on Render/Railway/Fly.io for full functionality.

---

## Frontend Deployment (Vercel)

### Prerequisites

1. GitHub/GitLab/Bitbucket account with your code pushed
2. Vercel account (free tier)

### Steps

1. **Push your code to GitHub** (if not already done):
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com) and sign in
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect Vite configuration
   - Click "Deploy"

3. **Configuration** (Auto-detected from `vercel.json`):
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. **Environment Variables** (if using backend):
   Go to Project Settings → Environment Variables and add:
   ```
   VITE_BACKEND_URL=https://your-backend-url.onrender.com
   ```

5. **Deploy**: Click "Deploy" and wait for build to complete.

Your frontend will be live at: `https://your-project.vercel.app`

### Custom Domain (Optional)

1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

---

## Backend Deployment (Optional)

Choose one of these platforms for the Python Flask backend:

### Option A: Render (Recommended)

**Free Tier**: Yes (with limitations: sleeps after 15 min of inactivity)

1. **Push your code to GitHub** (if not already done)

2. **Deploy on Render**:
   - Go to [render.com](https://render.com) and sign in
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Render will auto-detect `render.yaml` configuration

3. **Manual Configuration** (if needed):
   - **Name**: tokn-backend
   - **Region**: Choose nearest to you
   - **Branch**: main
   - **Root Directory**: Leave blank
   - **Environment**: Python 3
   - **Build Command**: `cd backend && pip install -r requirements.txt`
   - **Start Command**: `cd backend && python app.py`

4. **Environment Variables**:
   Add in Render dashboard:
   ```
   PORT=5000
   DEBUG=false
   CORS_ORIGINS=https://your-frontend.vercel.app
   ```

5. **Deploy**: Click "Create Web Service"

6. **Get Backend URL**:
   After deployment, copy your backend URL (e.g., `https://tokn-backend.onrender.com`)

7. **Update Frontend**:
   - Go to Vercel dashboard → Your Project → Settings → Environment Variables
   - Add/Update: `VITE_BACKEND_URL=https://tokn-backend.onrender.com`
   - Redeploy frontend (Deployments → Redeploy)

### Option B: Railway

**Free Tier**: Yes (with $5 monthly credits)

1. **Deploy on Railway**:
   - Go to [railway.app](https://railway.app) and sign in
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository

2. **Configuration**:
   - Railway auto-detects Python
   - Set **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python app.py`

3. **Environment Variables**:
   ```
   PORT=5000
   DEBUG=false
   CORS_ORIGINS=https://your-frontend.vercel.app
   ```

4. **Get Backend URL** and update Vercel frontend environment variables (same as Render step 6-7)

### Option C: Fly.io

**Free Tier**: Yes (limited resources)

1. **Install Fly CLI**:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login**:
   ```bash
   fly auth login
   ```

3. **Create Fly.toml** (already configured):
   See `backend/fly.toml` if needed

4. **Deploy**:
   ```bash
   cd backend
   fly launch
   fly deploy
   ```

5. **Get Backend URL** and update Vercel frontend (same as Render step 6-7)

---

## Environment Variables Reference

### Frontend (Vercel)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_BACKEND_URL` | No | `/api` | Backend API URL (only if using backend) |

### Backend (Render/Railway/Fly.io)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port |
| `DEBUG` | No | `false` | Flask debug mode (set to `false` in production) |
| `CORS_ORIGINS` | Yes | `*` | Comma-separated allowed origins (e.g., `https://your-app.vercel.app`) |

---

## Post-Deployment Testing

### Frontend Only

1. Visit your Vercel URL
2. Try adding an OpenAI/Anthropic/Google API key
3. Create a simple prompt flow
4. Test tool calling functionality
5. Verify workflow save/load

### Frontend + Backend

1. Complete frontend tests above
2. Test DSPy optimization:
   - Create a node with DSPy optimization enabled
   - Verify it connects to backend
3. Test GEPA optimization (if configured)
4. Check backend health: `https://your-backend-url/api/health`

---

## Troubleshooting

### Frontend Issues

**Build Fails on Vercel**:
- Check build logs for errors
- Ensure `package.json` dependencies are correct
- Verify Node.js version (should be 18+)

**SPA Routing Not Working**:
- Ensure `vercel.json` has correct rewrites configuration
- All routes should redirect to `/app.html`

**Assets Not Loading**:
- Check `vite.config.js` publicDir is set to `assets`
- Verify assets are in the `assets/` directory

### Backend Issues

**CORS Errors**:
- Ensure `CORS_ORIGINS` includes your Vercel frontend URL
- No trailing slash in URLs
- Check browser console for specific CORS error

**Backend Not Responding**:
- Check backend logs in Render/Railway/Fly.io dashboard
- Verify environment variables are set correctly
- Ensure backend health endpoint works: `/api/health`

**Cold Starts (Render Free Tier)**:
- Free tier sleeps after 15 minutes of inactivity
- First request after sleep takes ~30-60 seconds
- Consider upgrading to paid tier or using Railway/Fly.io

**Backend Dependencies Failing**:
- Some ML libraries (DSPy, MLflow) can be large
- Ensure your platform has enough memory (1GB+ recommended)
- Check build logs for specific errors

### Frontend-Backend Connection Issues

**Frontend Can't Reach Backend**:
1. Verify `VITE_BACKEND_URL` is set correctly in Vercel
2. Check backend CORS settings
3. Ensure backend is deployed and running
4. Test backend directly: `curl https://your-backend-url/api/health`
5. Check browser Network tab for specific errors

**API Calls Timing Out**:
- DSPy/GEPA optimization can take 30+ seconds
- Ensure your platform doesn't have request timeouts
- Consider implementing streaming for long-running tasks

---

## Monitoring and Logs

### Vercel Frontend

- **Logs**: Vercel Dashboard → Your Project → Deployments → Click deployment → View Logs
- **Analytics**: Available in Vercel Dashboard (free tier has basic analytics)
- **Error Tracking**: Consider integrating Sentry or similar service

### Backend

- **Render**: Dashboard → Service → Logs tab
- **Railway**: Dashboard → Project → Logs
- **Fly.io**: `fly logs` command

---

## Scaling Considerations

### Frontend (Vercel)

- Free tier: Generous limits for personal projects
- Automatic CDN and edge caching
- No action needed for basic scaling

### Backend

- **Render Free Tier**:
  - 512MB RAM, 0.1 CPU
  - Sleeps after 15 min inactivity
  - Good for testing, not production

- **Railway Free Tier**:
  - $5/month credit
  - Better performance than Render free tier
  - No sleep mode

- **Production Recommendations**:
  - Upgrade to paid tier ($7/month on Render)
  - Use dedicated instance (1GB+ RAM)
  - Add Redis for caching
  - Set up monitoring/alerts

---

## Security Checklist

- [ ] Set `DEBUG=false` in backend production environment
- [ ] Configure specific `CORS_ORIGINS` (remove `*` wildcard)
- [ ] Use HTTPS only (both platforms enforce this)
- [ ] API keys stored client-side (encrypted in browser IndexedDB)
- [ ] Review security headers in `vercel.json`
- [ ] Enable Vercel deployment protection (optional)
- [ ] Set up error tracking (Sentry, etc.)

---

## Cost Estimate

### Frontend Only

- **Vercel Free Tier**: $0/month
- **Limits**: 100GB bandwidth, unlimited requests
- **Good for**: Personal projects, portfolios, demos

### Frontend + Backend

**Option 1: Render Free**
- Frontend: $0 (Vercel)
- Backend: $0 (Render free tier with sleep)
- **Total**: $0/month
- **Limits**: Backend sleeps after 15 min

**Option 2: Railway Free Credits**
- Frontend: $0 (Vercel)
- Backend: $0 (uses $5 free monthly credits)
- **Total**: $0/month (while credits last)

**Option 3: Production Setup**
- Frontend: $0 (Vercel)
- Backend: $7/month (Render paid) or $5/month (Railway)
- **Total**: $5-7/month

---

## Next Steps

1. ✅ Deploy frontend to Vercel
2. ⏸️ Test frontend-only deployment
3. ⏸️ If needed, deploy backend to Render/Railway
4. ⏸️ Configure environment variables
5. ⏸️ Test full functionality
6. ⏸️ Set up custom domain (optional)
7. ⏸️ Configure monitoring/error tracking

---

## Support and Resources

- **Vercel Docs**: https://vercel.com/docs
- **Render Docs**: https://render.com/docs
- **Railway Docs**: https://docs.railway.app
- **Fly.io Docs**: https://fly.io/docs
- **Project Issues**: https://github.com/yourusername/tokn-web/issues

---

## Rollback Plan

If something goes wrong:

1. **Vercel**:
   - Go to Deployments
   - Click on previous working deployment
   - Click "Promote to Production"

2. **Render/Railway**:
   - Go to Deployments
   - Redeploy previous version
   - Or rollback via Git: `git revert HEAD` and push

---

Good luck with your deployment! 🚀
