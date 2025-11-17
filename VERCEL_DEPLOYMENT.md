# Vercel Deployment Guide - Fixed for VPS Backend

## 🚨 Important: Deployment Architecture

**Vercel** = Frontend only (static React SPA)  
**VPS** = Backend API (Express server at `api.server.mzansiporns.com`)

Vercel does **NOT** run your API. All API calls go to your VPS backend.

---

## ✅ What Was Fixed

### Problem:
- Vercel was trying to run your backend API as serverless functions
- API calls were timing out after 10 seconds (Vercel's limit)
- You were getting 504 Gateway Timeout errors

### Solution:
- Updated `vercel.json` to **only serve the frontend**
- Removed serverless API configuration from Vercel
- Frontend now calls your VPS backend API directly

---

## 🔧 Required Environment Variables in Vercel

### Critical for API Connection:
- **`VITE_API_URL`** = `https://api.server.mzansiporns.com`
  - This tells the frontend where your VPS backend is
  - **Without this, API calls will fail with 404/CORS errors**

### Supabase Configuration:
- **`VITE_SUPABASE_URL`** = Your Supabase project URL
- **`VITE_SUPABASE_ANON_KEY`** = Your Supabase anonymous key

---

## 📝 How to Add Environment Variables in Vercel

1. Go to your Vercel project: https://vercel.com/alcatece-projects/mpz
2. Click **Settings** → **Environment Variables**
3. Add each variable:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://api.server.mzansiporns.com`
   - **Environments:** Check all 3 boxes (Production, Preview, Development)
   - Click **Save**

4. Repeat for Supabase variables

5. **Redeploy** to apply changes:
   - Go to **Deployments** tab
   - Find the latest deployment
   - Click **...** menu → Select **Redeploy**
   - Wait for deployment to complete

---

## 🔒 CORS Configuration on VPS Backend

Your VPS backend must allow requests from Vercel domains.

### Update CORS on VPS:

SSH to your VPS and update the `.env` file:

```bash
ssh admin@45.83.122.61
cd /home/admin/web/api.server.mzansiporns.com/nodeapp
nano .env
```

Add/update this line:

```bash
ALLOWED_ORIGINS=https://mpz-beta.vercel.app,https://mpz-*.vercel.app,https://your-custom-domain.com
```

**Note:** The wildcard `mpz-*.vercel.app` allows all preview deployments.

Restart the API:

```bash
pm2 restart videohub-api
```

---

## ✅ Verify Deployment

After redeploying on Vercel:

### 1. Check Environment Variables:
- Go to Vercel → **Settings** → **Environment Variables**
- Verify `VITE_API_URL` is set to `https://api.server.mzansiporns.com`

### 2. Test the Frontend:
1. Visit https://mpz-beta.vercel.app
2. Open browser console (`F12`)
3. Go to **Network** tab
4. Reload the page

**Expected behavior:**
- API calls in Network tab should show `api.server.mzansiporns.com` as the domain
- Videos should load successfully
- No 504 timeout errors
- No CORS errors

### 3. Common Issues:

**Issue: 404 Not Found on API calls**
- Cause: `VITE_API_URL` not set in Vercel
- Fix: Add the environment variable and redeploy

**Issue: CORS errors in console**
- Cause: VPS backend doesn't allow Vercel domain
- Fix: Update `ALLOWED_ORIGINS` on VPS (see above)

**Issue: Videos still not loading**
- Check VPS API is running: `curl https://api.server.mzansiporns.com/api/ping`
- Check PM2 status: `pm2 status`
- Check logs: `pm2 logs videohub-api`

---

## 📁 Files Modified

### 1. `vercel.json`
**Changes:**
- Removed `/api/:path*` rewrite (no longer routing to serverless functions)
- Removed `functions` configuration (no serverless API)
- Removed `crons` configuration (cron jobs run on VPS, not Vercel)
- Changed `buildCommand` from `npm run build` to `npm run build:client`

**Why:** Vercel now only builds and serves the static frontend. No backend code is deployed to Vercel.

### 2. `vite.config.ts`
**Changes:**
- Made `createServer` import dynamic (lazy-loaded only during development)
- Changed from `import { createServer } from "./server"` at top level
- To `const { createServer } = await import("./server")` inside expressPlugin

**Why:** During production build, Vite doesn't need to load server code which requires Supabase env vars. The dynamic import prevents this.

### 3. `client/lib/api-config.ts` _(No changes - already existed)_
This file handles routing API calls to either:
- **Development (Replit):** Relative URLs → local Express server
- **Production (Vercel):** `VITE_API_URL` → VPS backend

---

## 🎯 Next Steps

1. ✅ Commit and push changes: `git push origin main`
2. ✅ Vercel will auto-deploy (or manually redeploy)
3. ✅ Add `VITE_API_URL` environment variable in Vercel
4. ✅ Update CORS on VPS backend
5. ✅ Test the deployment

---

**Last Updated:** November 17, 2025
