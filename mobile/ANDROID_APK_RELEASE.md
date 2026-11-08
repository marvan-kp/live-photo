# Android APK Release Guide

## Prerequisites
- Expo CLI installed: `npm install -g expo-cli`
- EAS CLI installed: `npm install -g eas-cli`
- Expo account configured: `eas login`

## Generate Keystore
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore live-photo-share.keystore -alias live-photo-share -keyalg RSA -keysize 2048 -validity 10000
```

## Build APK
```bash
cd D:\code\Live_photo_share\mobile
eas build --platform android --profile production
```

The APK will be available in EAS dashboard.
Download and distribute manually (no app store).

## Local Build Alternative
```bash
npx expo run:android --variant release
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

## Install
```bash
adb install app-release.apk
```

## Version Code
Current versionCode: 1 in app.json
Increment before each release.
