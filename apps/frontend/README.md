# Lucida Frontend

React + Vite dashboard for Lucida lead scoring.

## Setup
```bash
cp .env.example .env.local
npm install
npm run dev
```

## Environment
- `VITE_API_URL`: backend base URL
- `VITE_MASTER_KEY`: local access key used by login page

## Firebase Production Build
Firebase Hosting serves the Vite build output from `dist`, so production API and Firebase values must be present before `npm run build`.

```powershell
Copy-Item .env.production.example .env.production
# Fill in Firebase web app values from Firebase Console > Project settings > Your apps
npm run build:production
firebase deploy --only hosting
```

For production, `VITE_API_URL` must be the Cloud Run backend URL, not `http://localhost:8000`.
