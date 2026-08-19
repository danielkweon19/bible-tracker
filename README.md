# Bible Tracker

A responsive Bible reader that records reading time and completed chapters, then turns that history into personal insights. It is built with React, TypeScript, Vite, Firebase Authentication, Firestore, and Firebase Hosting.

## Features

- NKJV reader with all 66 books and chapter navigation
- Email/password and Google authentication
- Resumable reading timer stored locally during an active session
- Per-user Firestore history with chapter, verse, duration, and timestamp data
- Reading streaks, pace, activity charts, trends, and favorite-book insights
- Responsive desktop and mobile layouts
- Demo mode at `/?demo=1`

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and add your Firebase web app values.

3. In Firebase Authentication, enable Email/Password and Google.

4. Create a Firestore database and deploy the rules:

   ```bash
   npx firebase use --add
   npx firebase deploy --only firestore:rules
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

## Deploy

Select your Firebase project, then run:

```bash
npm run deploy
```

The app intentionally stores only reading metadata in Firestore. The Bible text remains a static local asset at `public/nkjv.json`.

Every push to `main` also runs the test suite, creates a production build, and deploys
Firebase Hosting through `.github/workflows/firebase-hosting-main.yml`. Deployment uses
GitHub OpenID Connect and short-lived Google credentials; no Firebase credential is
stored in GitHub.

## Bible text licensing

The New King James Version is copyrighted. Confirm that you have permission to distribute the supplied `nkjv.json` before deploying this app publicly. For a public product without an NKJV license, replace the file with a translation whose license permits your intended use and preserve the same JSON shape.
