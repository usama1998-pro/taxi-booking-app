# BarcelonaTaxi24 Driver App (Expo)

React Native app powered by Expo.

## Prerequisites

- Node.js 18+
- npm 9+
- Expo Go app on your phone (optional for quick testing)
- Android Studio (for Android emulator/native builds)
- Xcode (for iOS simulator/native builds on macOS)

## Environment setup

Create or update `app/.env`:

```env
# FastAPI server-side (no trailing slash). Local dev:
BASE_API_URL=http://localhost:8000
# Physical device on same Wi‑Fi: http://<your-pc-ip>:8000
```

Notes:

- The app calls versioned routes under `/api/v1` (for example `/api/v1/auth/verify-code`).
- For local backend testing from a real device, use your PC's LAN IP or ngrok, not `localhost`.

## Install dependencies

From the `app` folder:

```bash
npm install
```

## Run with Expo

Start Metro bundler:

```bash
npm run start
```

Then choose one of the following:

- Press `a` in terminal to open Android
- Press `i` in terminal to open iOS (macOS only)
- Scan the QR code with Expo Go to run on a physical device

## Other useful scripts

```bash
npm run android   # Native Android run (expo run:android)
npm run ios       # Native iOS run (expo run:ios)
npm run web       # Run Expo web
```

## Production build (Android)

Use EAS to create a production Android APK/AAB:

```bash
npx eas build -p android --profile production
```

If this is your first EAS build on this machine, run:

```bash
npx eas login
npx eas build:configure
```

## Troubleshooting

- If the app shows stale bundle/cache issues:

```bash
npx expo start --clear
```

- If API calls fail, verify:
  - `BASE_API_URL` value
  - backend server is reachable
  - CORS/network access for your device/emulator
