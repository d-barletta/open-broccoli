# open-broccoli 🥦

**AI-powered Connect 4 — Online Multiplayer Platform**

🔗 **[Live Demo → https://d-barletta.github.io/open-broccoli/](https://d-barletta.github.io/open-broccoli/)**

## Screenshots

**Login Page**

![Login Page](https://github.com/user-attachments/assets/70f26a57-65c0-4931-940e-4e1897dd5247)

**Register Page**

![Register Page](https://github.com/user-attachments/assets/c4c369be-87c0-45ab-877a-66d7cc615dcc)

## Features

- 🎮 **Online Multiplayer Connect 4** — create a match and share the link with a friend
- 🔒 **Private AI Configuration** — each player secretly instructs their AI (opponent never sees your strategy)
- 💰 **Betting System** — predict the winning column and total move count before the game starts
- 👤 **User Accounts** — register with a unique username, track wins and games played
- 🤖 **Model Selection** — admin configures which OpenRouter models are available to players
- ⚙ **Admin Dashboard** — manage users, set the shared API key, configure available models, view match stats

## How It Works

1. **Create Match** — Player 1 creates a game and copies the shareable link
2. **Share** — Send the link to your opponent (Player 2)
3. **Setup (Private)** — Each player independently chooses their AI model, writes secret instructions, and places bets. The opponent **never** sees your instructions or API key.
4. **Play** — When both players confirm ready, the game starts. **All AI calls are made by the server** (Firebase Cloud Function) using the admin's OpenRouter API key — the key is never exposed to players' browsers.
5. **Results** — Both players watch the live board and thinking panels update in real-time. At the end, see the winner and how close your bets were.

## Architecture

```
Players' browsers (React + Vite + Tailwind)
│   ← Read-only: watch Firestore for board/thinking updates
│   → Write: save private config, mark ready, create match
│
Firebase Firestore (real-time DB)
│   ← Cloud Function writes moves, thinking text, results
│   → Players read game state updates in real-time
│
Firebase Cloud Function (functions/index.js) — SERVER SIDE
│   Triggered when gameState.pendingAiMove === true
│   Reads admin API key from adminSettings/secret (Admin SDK, bypasses rules)
│   Reads player's private config (model + secret instructions)
│   Calls OpenRouter API (streams partial text back to Firestore)
│   Writes move result → triggers next player's turn
│
OpenRouter API (AI models)
    ← Called ONLY by the Cloud Function, never by the browser
```

**Security model:**
- The OpenRouter API key is stored in `adminSettings/secret` — only readable by the admin user's browser and by the Cloud Function (Admin SDK bypasses Firestore rules)
- Each player's AI instructions are in private `matchPrivate/{matchId}_pN` docs — only readable by the owner and by the Cloud Function
- Neither player's browser ever sends instructions or the API key to the other player

## Required Accounts

You need three free accounts to run open-broccoli:

| Account | Purpose | Cost |
|---------|---------|------|
| **[Google Account](https://accounts.google.com)** | Access Firebase Console (auth, database, functions) | Free |
| **[GitHub Account](https://github.com)** | Host the frontend on GitHub Pages, run CI/CD | Free |
| **[OpenRouter Account](https://openrouter.ai)** | Admin API key for AI model access | Free tier + pay-per-use |

> ⚠️ **Firebase Cloud Functions** (needed to run AI server-side) requires the **Blaze (pay-as-you-go)** plan. You are only charged for actual usage — a typical game costs fractions of a cent in Firebase compute. Billing is not required for local development.

---

## Full Deployment Guide

### Step 1 — Fork & Clone

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/open-broccoli.git
cd open-broccoli
npm install
```

---

### Step 2 — Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com) → **Add project**
2. Give it a name (e.g. `open-broccoli`) and finish the wizard
3. In the left sidebar, enable these services:

**Authentication**
- Click **Authentication** → **Get started** → **Sign-in method** tab
- Enable **Email/Password** and click **Save**

**Firestore**
- Click **Firestore Database** → **Create database**
- Choose a region close to your users (e.g. `europe-west1`)
- Start in **test mode** (you'll apply the security rules in Step 5)

**Cloud Functions**
- Click **Functions** → **Get started**
- You will be prompted to **upgrade to the Blaze plan** — follow the link, add a billing account (Google requires a credit card; you won't be charged unless you exceed the generous free tier)

**Web App Config**
- Click the **⚙ gear icon** → **Project settings** → **Your apps** tab
- Click the **</>** (Web) icon → register the app (any nickname) → copy the `firebaseConfig` values — you'll need them in Step 3

---

### Step 3 — Configure Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in the values from the Firebase Web App config:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

> **Never commit `.env.local`** — it is already in `.gitignore`.

---

### Step 4 — Deploy the Backend (Cloud Functions + Firestore Rules)

```bash
# Install Firebase CLI globally (one-time)
npm install -g firebase-tools

# Log in with the Google account that owns the Firebase project
firebase login

# Set your Firebase project ID
cp .firebaserc.example .firebaserc
# Edit .firebaserc and replace YOUR_FIREBASE_PROJECT_ID with your project ID

# Install Cloud Function dependencies
cd functions && npm install && cd ..

# Deploy functions AND Firestore security rules in one command
firebase deploy --only functions,firestore:rules
```

Expected output:
```
✔  Deploy complete!
  Project Console: https://console.firebase.google.com/project/<your-project-id>
  Function URL (processAiMove): https://us-central1-<your-project-id>.cloudfunctions.net/processAiMove
```

> The `processAiMove` function is a **Firestore trigger** — it has no public URL and cannot be called directly. It fires automatically whenever a game move is needed.

---

### Step 5 — Deploy the Frontend to GitHub Pages

The GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and deploys the frontend automatically on every push to `main`. You need to:

**a) Add Firebase config as GitHub Actions secrets**

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret** — add each variable:

| Secret name | Value |
|-------------|-------|
| `VITE_FIREBASE_API_KEY` | your Firebase API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project-id.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | your project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project-id.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | messaging sender ID |
| `VITE_FIREBASE_APP_ID` | app ID |

**b) Update the workflow to use the secrets**

Edit `.github/workflows/deploy.yml` — add the environment variables to the **Build** step:

```yaml
- name: Build
  run: npm run build
  env:
    VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
    VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
    VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
    VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
    VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
    VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
```

**c) Enable GitHub Pages**

Go to your repo → **Settings** → **Pages** → under **Source**, select **GitHub Actions**.

**d) Push to `main` to trigger the deploy**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: add Firebase secrets to deploy workflow"
git push origin main
```

The Actions tab will show the build and deploy progress. Once done, your app is live at:
`https://<your-username>.github.io/open-broccoli/`

---

### Step 6 — First Login & Admin Setup

1. Open your deployed app and click **Register**
2. **The very first account registered automatically becomes admin** — use your own email
3. Log in and click the **⚙** icon in the top-right to open the **Admin Dashboard**
4. Go to **Settings** and:
   - Paste your **OpenRouter API key** (get one at [openrouter.ai/keys](https://openrouter.ai/keys)) — this is stored server-side and never exposed to players
   - Optionally add model IDs (one per line) to restrict which models players can choose — leave blank to allow all models
5. Click **Save Settings**

You're ready to play! Share the app URL with friends and create your first match.

---

### Local Development

```bash
npm install
npm run dev    # Frontend dev server with hot reload at http://localhost:5173
npm run build  # Production build (outputs to dist/)
```

> Local dev requires a real Firebase project (the `.env.local` file). Cloud Functions must already be deployed — they cannot run locally without the Firebase emulators suite.

## Admin Dashboard

| Section | Features |
|---------|----------|
| **Settings** | Set shared OpenRouter API key (server-side only), configure available models for players |
| **Users** | View all users, ban/unban, grant/revoke admin |
| **Matches** | Stats overview + full match table (status, players, winner, move count) |

## Tech Stack

- React 18 + Vite 6 + Tailwind CSS 3
- React Router 7 (Hash Router for GitHub Pages compatibility)
- Firebase (Authentication + Firestore + Cloud Functions)
- OpenRouter API (AI models — called server-side only)
- GitHub Actions → GitHub Pages

## Local Development

```bash
npm install
npm run dev    # Frontend dev server with hot reload
npm run build  # Production build
```

## Security Notes

- The OpenRouter API key is stored in `adminSettings/secret` and is **not readable by non-admin browser clients**. The Cloud Function uses the Firebase Admin SDK which bypasses Firestore security rules.
- Player AI instructions are stored in private `matchPrivate/{matchId}_pN` documents that only the owner can read from the browser. The Cloud Function reads them server-side.
- `firestore.rules` enforces least-privilege access — review before deploying to production.


