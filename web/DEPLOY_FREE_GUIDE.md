# Free Website Deployment Guide

## Vercel Deployment (Recommended)

### Quick Deploy
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Manual Steps
1. Push code to GitHub
2. Import project at vercel.com
3. Framework: Next.js
4. Build Command: `npm run build`
5. Output Directory: `.next`
6. Add environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - SUPABASE_STORAGE_BUCKET

## Netlify Alternative
```bash
npm i -g netlify-cli
netlify login
netlify deploy --prod
```

netlify.toml already configured.

## Cloudflare Pages
1. Connect Git repo
2. Build command: `npm run build`
3. Output directory: `.next`
4. Unlimited bandwidth free tier

## Cloud Storage
Supabase provides 1GB free storage.
Fallback to local storage if no credentials configured.

## APK Hosting
Place APK at web/public/apk/live-photo-share.apk
Download page at /download

## Public URL
After deployment, URL will be:
https://live-photo-share.vercel.app
or custom domain
