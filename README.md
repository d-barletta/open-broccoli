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

## Getting Started

### Prerequisites

This project requires a [Firebase](https://firebase.google.com) project.

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com) and create a new project
2. Enable **Authentication** → Sign-in method → **Email/Password**
3. Create a **Firestore Database** (start in test mode, then apply rules)
4. Enable **Cloud Functions** (requires Blaze pay-as-you-go plan)
5. **Project Settings** → **Your apps** → add a Web app → copy the config

### 2. Configure the Frontend

```bash
cp .env.example .env.local
# Edit .env.local with your Firebase project values
```

### 3. Deploy Cloud Functions

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools
firebase login

# Set your project ID in .firebaserc (copy from .firebaserc.example)
cp .firebaserc.example .firebaserc
# Edit .firebaserc and set your project ID

# Install function dependencies
cd functions && npm install && cd ..

# Deploy
firebase deploy --only functions
```

### 4. Apply Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

Or copy the contents of `firestore.rules` into Firebase Console → Firestore → Rules.

### 5. Run Locally

```bash
npm install
npm run dev
```

### 6. First Login

Register an account — **the first registered user automatically becomes admin**.  
As admin, go to the **Admin Dashboard** (⚙ button in the header) to:
- Set your OpenRouter API key (stored server-side, never exposed to players)
- Configure which models players can choose from (leave empty to allow all)
- Manage users and view match statistics

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


