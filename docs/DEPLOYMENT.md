# tokn Deployment Guide

Complete guide for deploying tokn to production.

## Overview

tokn consists of two parts:
1. **Frontend** - React web app (static files)
2. **Backend** - Python Flask API (optional, for DSPy/GEPA features)

## Frontend Deployment

The frontend is a static React app that can be deployed to any static hosting service.

### Step 1: Build the Frontend

```bash
npm install
npm run build
```

This creates optimized production files in `dist/` directory.

### Step 2: Deploy to Hosting Service

#### Option A: Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy:
```bash
vercel --prod
```

3. Configure:
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

#### Option B: Netlify

1. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

2. Deploy:
```bash
netlify deploy --prod --dir=dist
```

3. Configure:
- Build command: `npm run build`
- Publish directory: `dist`

#### Option C: GitHub Pages

1. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

2. Add to package.json:
```json
{
  "scripts": {
    "deploy": "npm run build && gh-pages -d dist"
  },
  "homepage": "https://yourusername.github.io/tokn"
}
```

3. Deploy:
```bash
npm run deploy
```

#### Option D: AWS S3 + CloudFront

1. Build:
```bash
npm run build
```

2. Create S3 bucket with static website hosting enabled

3. Upload dist/ contents:
```bash
aws s3 sync dist/ s3://your-bucket-name/
```

4. Configure CloudFront distribution pointing to S3 bucket

#### Option E: Custom Server (Nginx)

1. Build:
```bash
npm run build
```

2. Copy to server:
```bash
scp -r dist/* user@server:/var/www/tokn/
```

3. Nginx configuration:
```nginx
server {
    listen 80;
    server_name tokn.yourdomain.com;

    root /var/www/tokn;
    index index.html;

    # Enable gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Backend proxy (if backend on same server)
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. Enable HTTPS:
```bash
sudo certbot --nginx -d tokn.yourdomain.com
```

## Backend Deployment

The backend is required for DSPy and GEPA optimization features.

### Step 1: Prepare Backend

```bash
cd backend
```

### Step 2: Deploy to Hosting Service

#### Option A: Heroku

1. Install Heroku CLI

2. Create app:
```bash
heroku create tokn-backend
```

3. Deploy:
```bash
git subtree push --prefix backend heroku main
```

4. Set environment variables:
```bash
heroku config:set CORS_ORIGINS=https://your-frontend-domain.com
```

5. Scale:
```bash
heroku ps:scale web=1
```

#### Option B: Railway

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Initialize:
```bash
railway init
```

3. Deploy:
```bash
railway up
```

4. Set environment variables in Railway dashboard

#### Option C: Docker on any platform

1. Build image:
```bash
docker build -t tokn-backend backend/
```

2. Run locally to test:
```bash
docker run -p 5000:5000 -e CORS_ORIGINS=* tokn-backend
```

3. Push to Docker Hub:
```bash
docker tag tokn-backend yourusername/tokn-backend
docker push yourusername/tokn-backend
```

4. Deploy to your platform (AWS ECS, Google Cloud Run, etc.)

#### Option D: AWS Lambda (Serverless)

Use Zappa or AWS SAM to deploy Flask as serverless functions.

Example with Zappa:

1. Install Zappa:
```bash
pip install zappa
```

2. Initialize:
```bash
zappa init
```

3. Deploy:
```bash
zappa deploy production
```

#### Option E: Custom Server (Gunicorn + Nginx)

1. Install on server:
```bash
sudo apt-get update
sudo apt-get install python3-pip python3-venv nginx
```

2. Setup:
```bash
cd /var/www/tokn-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn
```

3. Create systemd service `/etc/systemd/system/tokn-backend.service`:
```ini
[Unit]
Description=tokn Backend API
After=network.target

[Service]
User=www-data
WorkingDirectory=/var/www/tokn-backend
Environment="PATH=/var/www/tokn-backend/venv/bin"
ExecStart=/var/www/tokn-backend/venv/bin/gunicorn --workers 4 --bind 0.0.0.0:5000 app:app

[Install]
WantedBy=multi-user.target
```

4. Start service:
```bash
sudo systemctl enable tokn-backend
sudo systemctl start tokn-backend
```

5. Configure Nginx reverse proxy (see frontend nginx config above)

## Environment Variables

### Frontend

Configure in your hosting platform:
- No environment variables needed for frontend
- API endpoint defaults to same origin (`/api`)

### Backend

Required environment variables:

```env
# Server
PORT=5000
DEBUG=False

# CORS - UPDATE THIS FOR PRODUCTION
CORS_ORIGINS=https://your-frontend-domain.com

# Optional: MLflow
MLFLOW_TRACKING_URI=http://your-mlflow-server:5001
```

## Post-Deployment Configuration

### 1. Update Backend URL in Frontend (if needed)

If backend is on a different domain, users will need to configure it in Settings.

Or, hardcode it by editing `renderer/dspy-worker.js` and `renderer/gepa-worker.js`:
```javascript
let backendApiUrl = 'https://your-backend-domain.com/api';
```

Then rebuild frontend.

### 2. Configure CORS

**Critical**: Update backend CORS to only allow your frontend domain:

In `backend/app.py`:
```python
CORS(app, origins=[
    "https://your-frontend-domain.com"
])
```

### 3. Enable HTTPS

Both frontend and backend MUST use HTTPS in production:
- Most hosting platforms provide automatic HTTPS
- For custom servers, use Let's Encrypt (certbot)

### 4. Set up monitoring

Recommended monitoring:
- **Frontend**: Vercel Analytics, Google Analytics, or Sentry
- **Backend**: Sentry, CloudWatch, or DataDog
- **MLflow**: Deploy MLflow tracking server

## Testing Deployment

### Test Frontend

1. Visit your deployed URL
2. Open browser DevTools console
3. Check for errors
4. Try configuring an API key
5. Create a simple workflow and run it

### Test Backend

1. Health check:
```bash
curl https://your-backend-domain.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "features": {
    "dspy": true,
    "gepa": true,
    "mlflow": true
  }
}
```

2. Test DSPy endpoint:
```bash
curl -X POST https://your-backend-domain.com/api/optimize/dspy \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Answer the question.",
    "examples": [{"input": "What is 2+2?", "expected_output": "4"}],
    "model": "gpt-4o-mini",
    "provider": "openai",
    "apiKey": "your-test-key"
  }'
```

## Scaling

### Frontend Scaling

Static frontend scales automatically with most hosting providers.

For high traffic:
- Use CDN (CloudFront, Cloudflare)
- Enable caching headers
- Optimize images and assets

### Backend Scaling

For high load:

1. **Horizontal scaling**: Run multiple instances behind a load balancer
2. **Vertical scaling**: Increase server resources
3. **Caching**: Implement Redis for caching optimization results
4. **Queue system**: Use Celery + Redis for long-running optimizations
5. **Rate limiting**: Implement per-user rate limits

Example with Gunicorn workers:
```bash
gunicorn --workers 8 --timeout 600 app:app
```

## Maintenance

### Updating Frontend

```bash
npm run build
# Deploy new dist/ files
```

### Updating Backend

```bash
cd backend
git pull
source venv/bin/activate
pip install -r requirements.txt
# Restart backend service
```

### Monitoring Costs

API calls to OpenAI, Claude, and Gemini incur costs:
- Implement usage tracking
- Set up billing alerts
- Consider rate limiting per user

## Troubleshooting

### CORS Errors

**Symptom**: Console shows "blocked by CORS policy"
**Solution**: Update `CORS_ORIGINS` in backend to include your frontend domain

### File System Access API Not Working

**Symptom**: Save/Open buttons not working
**Solution**: Ensure site is served over HTTPS (File System Access API requires secure context)

### Backend 502/503 Errors

**Symptom**: Backend requests timing out
**Solution**:
- Increase timeout limits (optimization can take 5+ minutes)
- Check backend logs for errors
- Verify dependencies are installed

### API Keys Not Saving

**Symptom**: API keys don't persist after page refresh
**Solution**:
- Check browser allows IndexedDB
- Verify HTTPS (some browsers restrict crypto APIs on HTTP)
- Check browser console for errors

## Security Checklist

Before going to production:

- [ ] Frontend served over HTTPS
- [ ] Backend served over HTTPS
- [ ] CORS restricted to your frontend domain
- [ ] Rate limiting implemented
- [ ] API keys never logged
- [ ] Environment variables set correctly
- [ ] `.env` files not committed to git
- [ ] Security headers configured (CSP, HSTS)
- [ ] Dependencies updated to latest secure versions
- [ ] Error messages don't leak sensitive info

## Backup Strategy

### Frontend

- Code: Stored in Git
- User workflows: Stored locally in browser (users responsible for saving)

### Backend

- Code: Stored in Git
- MLflow data: Backup MLflow database and artifact store regularly

## Support

If you encounter deployment issues:

1. Check this guide
2. Review backend logs
3. Check browser console
4. Verify environment variables
5. Test with curl commands
6. Open GitHub issue with details

---

Good luck with your deployment! 🚀
