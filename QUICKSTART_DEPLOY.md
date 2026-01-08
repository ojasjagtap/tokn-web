# Quick Start: Deploy to Vercel (Free)

Get your Tokn app deployed in 5 minutes!

## Prerequisites

- GitHub account
- Vercel account (sign up free at [vercel.com](https://vercel.com))
- Your code pushed to GitHub

## Step 1: Push to GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

## Step 2: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New Project"**
3. **Import** your GitHub repository
4. Vercel auto-detects settings from `vercel.json`
5. Click **"Deploy"**
6. ✅ Done! Your app is live at `https://your-project.vercel.app`

**That's it for frontend-only deployment!** You now have a fully functional visual prompt engineering IDE with:
- Multi-provider LLM support (OpenAI, Claude, Gemini)
- Visual flow editor
- Tool calling
- Workflow save/load

---

## Optional: Add Backend (DSPy/GEPA Features)

Only follow these steps if you need DSPy or GEPA optimization features.

### Step 3: Deploy Backend to Render

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Render auto-detects `render.yaml`
5. Add environment variable:
   ```
   CORS_ORIGINS=https://your-project.vercel.app
   ```
   (Replace with your actual Vercel URL from Step 2)
6. Click **"Create Web Service"**
7. ✅ Copy your backend URL: `https://tokn-backend.onrender.com`

### Step 4: Connect Frontend to Backend

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add new variable:
   ```
   Name: VITE_BACKEND_URL
   Value: https://your-backend.onrender.com
   ```
   (Replace with your actual Render URL from Step 3)
3. Go to **Deployments** tab
4. Click **"Redeploy"** on the latest deployment
5. ✅ Done! Full-stack deployment complete

---

## Testing Your Deployment

### Frontend Only
1. Visit your Vercel URL
2. Add an API key (OpenAI/Anthropic/Google)
3. Create a prompt flow
4. Test execution

### Frontend + Backend
1. Complete frontend tests above
2. Test DSPy optimization in a node
3. Check backend health: `https://your-backend-url/api/health`

---

## Troubleshooting

**Build fails on Vercel?**
- Check build logs in Vercel dashboard
- Ensure Node.js 18+ is available

**Frontend can't reach backend?**
- Verify `VITE_BACKEND_URL` is set correctly
- Check `CORS_ORIGINS` in Render matches your Vercel URL
- No trailing slashes in URLs!

**Backend slow to respond?**
- Render free tier sleeps after 15 min of inactivity
- First request takes ~30-60 seconds (cold start)
- Consider upgrading to paid tier ($7/month) for production

---

## What's Next?

- ✅ Set up custom domain (optional)
- ✅ Add error tracking with Sentry
- ✅ Upgrade to paid tier for production workloads
- ✅ Read full [DEPLOYMENT.md](./DEPLOYMENT.md) guide

---

## Need Help?

- Full deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Vercel docs: https://vercel.com/docs
- Render docs: https://render.com/docs

---

**Total time**: ~5 minutes (frontend only) or ~10 minutes (with backend)

**Total cost**: $0/month (free tier)

Happy deploying! 🚀
