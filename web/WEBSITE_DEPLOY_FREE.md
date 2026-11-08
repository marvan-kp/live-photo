# Free Website Hosting Deployment Guide

## Options: Zero-Cost Deployment

### 1. Vercel (Recommended)
The web app is configured for Vercel zero-cost deployment.

Steps:
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`

Environment variables: Configure in Vercel Dashboard → Project Settings → Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_STORAGE_BUCKET

### 2. Netlify
Alternative free hosting configured via `netlify.toml`.

Steps:
1. Install CLI: `npm i -g netlify-cli`
2. Login: `netlify login`
3. Deploy: `netlify deploy --prod`

Environment variables: Set in Netlify Dashboard → Site Settings → Environment Variables

### 3. Cloudflare Pages
For ultimate free tier (unlimited bandwidth):
1. Connect Git repository
2. Build Command: `npm run build`
3. Output Directory: `.next`

## Important Notes
- Supabase provides a free 1GB storage tier for photos
- If no cloud credentials are configured, uploads automatically fall back to secure local in-memory storage (works immediately)
- Free tier limits reset monthly and are sufficient for development/production use
