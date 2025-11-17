# Vercel Deployment Guide

## Environment Variables Required in Vercel

Your Vercel project needs these environment variables configured:

### Critical for API Connection:
- **`VITE_API_URL`** = `https://api.server.mzansiporns.com`
  - This tells the frontend where your VPS backend API is located
  - Without this, the frontend will try to call Vercel itself (404/504 errors)

### Supabase Configuration:
- **`VITE_SUPABASE_URL`** = Your Supabase project URL
- **`VITE_SUPABASE_ANON_KEY`** = Your Supabase anonymous key

## How to Add Environment Variables in Vercel

1. Go to your Vercel project: https://vercel.com/alcatece-projects/mpz
2. Click **Settings** → **Environment Variables**
3. Add each variable:
   - Name: `VITE_API_URL`
   - Value: `https://api.server.mzansiporns.com`
   - Environment: Production, Preview, Development (select all)
   - Click **Save**

4. After adding variables, **redeploy**:
   - Go to **Deployments** tab
   - Click **...** on the latest deployment
   - Select **Redeploy**

## Verify Deployment

After redeploying:

1. Visit https://mpz-beta.vercel.app
2. Open browser console (F12)
3. Check Network tab - API calls should go to `api.server.mzansiporns.com`, not `mpz-beta.vercel.app`
4. Videos should load without 504 errors

## What Changed

We updated the frontend to use environment-based API URLs:
- **Development (Replit)**: Uses relative URLs → Local Express server
- **Production (Vercel)**: Uses `VITE_API_URL` → VPS backend

Files modified:
- `client/lib/api-config.ts` - New API configuration utility
- `client/pages/Index.tsx` - Updated to use `apiFetch()`
- `client/pages/VideoPlayer.tsx` - Updated to use `apiFetch()`
