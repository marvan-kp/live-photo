# Android APK Release Guide

## Building Standalone APK (No Google Play / Apple Store)

This project produces a React Native mobile application for Android via Expo or bare React Native.

### 1. Prerequisites
- Node.js 20+
- Java JDK 17+
- Android SDK (Android Studio installed)
- Expo CLI or React Native CLI

### 2. Configure Release Signing Keystore
Generate a keystore for release builds:

```bash
keytool -genkey -v -keystore live-photo-share-release.keystore -alias livephoto -keyalg RSA -keysize 2048 -validity 10000
```
Store `live-photo-share-release.keystore` securely. Never commit it.

### 3. Build APK with EAS (Expo Application Services) / Gradlew

**Expo managed workflow:**
```bash
npm install -g eas-cli
eas build --platform android --profile production
```

**Bare React Native:**
```bash
cd android
./gradlew assembleRelease
```

APK output: `android/app/build/outputs/apk/release/app-release.apk`

### 4. Free Distribution Options
- **Direct APK Download**: Host `app-release.apk` on the same free website (Vercel/Netlify static file hosting)
- **Firebase App Distribution**: Free for small teams
- **GitHub Releases**: Attach APK to release assets for users to download

### 5. Next Steps
- Test on Android device/emulator
- Upload APK to website download page
- Update version code in `android/app/build.gradle` for each release

⚠️ This approach deliberately avoids Apple App Store submission and Google Play Store.
