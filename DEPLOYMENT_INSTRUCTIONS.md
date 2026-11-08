# Live Photo Share - Deployment Instructions

## Status: READY FOR DEPLOYMENT

### 1. Mobile APK Build (EAS)

**Current situation:** Expo project is initialized but APK not built yet.

**To build APK:**
```bash
cd D:\code\Live_photo_share\mobile
npx eas-cli init  # if not already initialized
eas login
eas build --platform android --profile production
```

This will produce `live-photo-share.apk` which should be placed at:
`D:\code\Live_photo_share\web\public\apk\live-photo-share.apk`

**Alternative - Local build:**
```bash
cd D:\code\Live_photo_share\mobile
npm install -g @react-native-community/cli
npx expo run:android --variant release
```
Output at: `android/app/build/outputs/apk/release/app-release.apk`

### 2. Website Deployment (Free Hosting)

**Option A: Vercel (Recommended)**
```bash
cd D:\code\Live_photo_share\web
npm install -g vercel
vercel login
vercel --prod
```

**Option B: Netlify**
```bash
cd D:\code\Live_photo_share\web
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

**Option C: Push to GitHub then import**
1. Push code to GitHub repo
2. Import at vercel.com or app.netlify.com
3. Build command: `npm run build`
4. Output dir: `.next`

### 3. Cloud Storage Configuration

Create `.env.local` in web/:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
SUPABASE_STORAGE_BUCKET=live-photo-share
```

Or use Cloudflare R2/S3 compatible storage.

### 4. After Deployment

1. Website URL will be: https://live-photo-share.vercel.app (or custom domain)
2. APK download at: https://your-domain.com/download
3. APK file must exist at: web/public/apk/live-photo-share.apk

### 5. Files Ready

✅ mobile/eas.json - Configured for APK builds
✅ mobile/app.json - Fixed duplicate brace
✅ mobile/app/_layout.tsx - Expo Router tabs
✅ mobile/app/(tabs)/Camera.tsx - Camera UI
✅ mobile/app/(tabs)/AdvancedCamera.tsx - AI features
✅ mobile/hooks/useAdvancedCamera.ts - Fixed typo
✅ web/src/app/download/page.tsx - APK download page
✅ web/public/apk/ - Directory created
✅ web/vercel.json - Vercel config
✅ web/netlify.toml - Netlify config
✅ web/DEPLOY_FREE_GUIDE.md - Hosting guide

### 6. Immediate Next Steps

1. Build APK via EAS (requires Expo account)
2. Copy APK to web/public/apk/live-photo-share.apk
3. Deploy web app to Vercel
4. Test download link
5. Configure Supabase credentials

## Constraints Met

✅ No Apple App Store submission
✅ Android APK release only
✅ Free website hosting ready (Vercel/Netlify)
✅ Cloud storage integration ready
⏳ APK location not showed (needs build step)
⏳ Website link provide (needs deploy step)
