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
3. **Setup (Private)** — Each player independently chooses their AI model, writes secret instructions, and places bets. The opponent **never** sees your instructions.
4. **Play** — When both players confirm ready, the game starts. **All AI calls are made server-side** (Vercel Function by default) using the admin's OpenRouter API key — the key is never exposed to players' browsers.
5. **Results** — Both players watch the live board and thinking panels update in real-time. At the end, see the winner and how close your bets were.

## Architecture

```
Players' browsers (React + Vite + Tailwind)
│   ← Read-only: watch Firestore for board/thinking updates via onSnapshot
│   → Write: save private config, mark ready, create match
│   → POST /api/ai-move (Vercel) when pendingAiMove === true
│
Vercel Serverless Function (api/ai-move.js) — SERVER SIDE [DEFAULT]
│   Triggered by browser POST when gameState.pendingAiMove === true
│   Reads admin API key from adminSettings/secret (Admin SDK, bypasses rules)
│   Reads player's private config (model + secret instructions)
│   Calls OpenRouter API (streams partial text back to Firestore in real-time)
│   Writes move result → sets pendingAiMove=true for next player's turn
│
Firebase Firestore (real-time DB)
│   ← Vercel function writes moves, thinking text, results
│   → Players read game state updates in real-time via onSnapshot
│
OpenRouter API (AI models)
    ← Called ONLY by the Vercel function, never by the browser
```

> **Alternative:** `functions/index.js` (Firebase Cloud Function) contains the same logic and can replace the Vercel function for deployments that already use Firebase Blaze plan. See [Alternative: Firebase Cloud Functions](#alternative-firebase-cloud-functions).

**Security model:**
- The OpenRouter API key is stored in `adminSettings/secret` — only readable by admin users and the server-side AI backend (Admin SDK bypasses Firestore rules)
- Each player's AI instructions are in private `matchPrivate/{matchId}_pN` docs — only readable by the owner and by the server
- Neither player's browser ever sees the API key or the other player's instructions

## Required Accounts

| Account | Purpose | Cost |
|---------|---------|------|
| **[Google Account](https://accounts.google.com)** | Firebase Console (Auth + Firestore — **Spark/free plan is enough**) | Free |
| **[Vercel Account](https://vercel.com)** | Hosts the frontend + AI serverless function | Free (Hobby plan, no card required) |
| **[OpenRouter Account](https://openrouter.ai)** | Admin API key for AI model access | Free tier + pay-per-use |

> ✅ **No credit card required** — Firebase Spark plan (free) covers Auth + Firestore. Vercel Hobby plan (free) handles both the static frontend and the AI serverless function.

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
2. Give it a name (e.g. `open-broccoli`) and finish the wizard — **stay on the free Spark plan**
3. In the left sidebar, enable these services:

**Authentication**
- Click **Authentication** → **Get started** → **Sign-in method** tab
- Enable **Email/Password** and click **Save**

**Firestore**
- Click **Firestore Database** → **Create database**
- Choose a region close to your users (e.g. `europe-west1`)
- Start in **test mode** (you'll deploy security rules in Step 4)

**Web App Config**
- Click the **⚙ gear icon** → **Project settings** → **Your apps** tab
- Click the **</>** (Web) icon → register the app (any nickname) → copy the `firebaseConfig` values — you'll need them in Step 3

> ✅ No need to enable Cloud Functions or upgrade to Blaze plan. The AI runs on Vercel.

---

### Step 3 — Create a Vercel Account & Import the Repo

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account (free Hobby plan, no card)
2. Click **Add New → Project** → import your forked `open-broccoli` repository
3. Vercel auto-detects Vite — leave all build settings at their defaults
4. Before clicking **Deploy**, add the **Environment Variables** (listed below)

**Firebase config variables** (from the Web App config in Step 2):

| Variable | Example value |
|----------|---------------|
| `VITE_FIREBASE_API_KEY` | `AIzaSy...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project-id.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `your-project-id` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project-id.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `123456789` |
| `VITE_FIREBASE_APP_ID` | `1:123456789:web:abc123` |

**Firebase Admin SDK** (for the `api/ai-move.js` serverless function):

| Variable | Value |
|----------|-------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON content of a service account key (see below) |

To get the service account key:
- Firebase Console → **Project settings** → **Service accounts** tab
- Click **Generate new private key** → download the JSON file
- Copy the **entire contents** of that file and paste as the `FIREBASE_SERVICE_ACCOUNT_JSON` value in Vercel

5. Click **Deploy** — Vercel builds and publishes the app. Your URL will be `https://<project-name>.vercel.app`

---

### Step 4 — Deploy Firestore Security Rules

```bash
# Install Firebase CLI globally (one-time)
npm install -g firebase-tools

# Log in with the Google account that owns the Firebase project
firebase login

# Set your Firebase project ID
cp .firebaserc.example .firebaserc
# Edit .firebaserc and replace YOUR_FIREBASE_PROJECT_ID with your project ID

# Deploy Firestore security rules
firebase deploy --only firestore:rules
```

Expected output:
```
✔  Deploy complete!
```

---

### Step 5 — First Login & Admin Setup

1. Open your Vercel deployment URL and click **Register**
2. **The very first account registered automatically becomes admin** — use your own email
3. Log in and click the **⚙** icon in the top-right to open the **Admin Dashboard**
4. Go to **Settings** and:
   - Paste your **OpenRouter API key** (get one at [openrouter.ai/keys](https://openrouter.ai/keys)) — stored in `adminSettings/secret` in Firestore with security rules that prevent client access; only the server-side AI backend reads it via Admin SDK
   - Optionally add model IDs (one per line) to restrict which models players can choose — leave blank to allow all models
5. Click **Save Settings**

You're ready to play! Share the app URL with friends and create your first match.

---

### Local Development

```bash
npm install
cp .env.example .env.local   # fill in your Firebase values
npm run dev                   # frontend dev server at http://localhost:5173
```

> The `/api/ai-move` endpoint does **not** run locally with `npm run dev` (it is a Vercel serverless function). To test AI moves locally, use the [Vercel CLI](https://vercel.com/docs/cli): `npx vercel dev`.

---

## Alternative: Firebase Cloud Functions

If you already have a Firebase **Blaze (pay-as-you-go)** plan with billing enabled, you can use `functions/index.js` instead of the Vercel function. The Cloud Function contains the same game logic and is triggered automatically by the `pendingAiMove` Firestore field — no browser call needed.

```bash
# Install Cloud Function dependencies
cd functions && npm install && cd ..

# Deploy Cloud Functions + Firestore rules
firebase deploy --only functions,firestore:rules
```

With this approach, use GitHub Pages for the frontend (the existing `.github/workflows/deploy.yml` workflow handles it — add the Firebase config values as GitHub Actions secrets in repo **Settings → Secrets → Actions**).

> Both backends are compatible with the same Firestore schema and Admin Dashboard. You can switch between them at any time.

---

## Admin Dashboard

| Section | Features |
|---------|----------|
| **Settings** | Set shared OpenRouter API key (server-side only), configure available models for players |
| **Users** | View all users, ban/unban, grant/revoke admin |
| **Matches** | Stats overview + full match table (status, players, winner, move count) |

## Tech Stack

- React 18 + Vite 6 + Tailwind CSS 3
- React Router 7 (Hash Router for static hosting compatibility)
- Firebase (Authentication + Firestore — **Spark/free plan**)
- Vercel Serverless Functions (AI backend — **free Hobby plan**)
- OpenRouter API (AI models — called server-side only)

## Security Notes

- The OpenRouter API key is stored in `adminSettings/secret` and is **not readable by non-admin browser clients**. The server-side AI backend uses the Firebase Admin SDK which bypasses Firestore security rules.
- Player AI instructions are stored in private `matchPrivate/{matchId}_pN` documents that only the owner can read from the browser. The server reads them server-side.
- `firestore.rules` enforces least-privilege access — review before deploying to production.


