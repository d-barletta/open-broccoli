# open-broccoli 🥦

**AI-powered Connect 4 — Online Multiplayer Platform**

🔗 **[Live Demo → https://d-barletta.github.io/open-broccoli/](https://d-barletta.github.io/open-broccoli/)**

![Login Page](https://github.com/user-attachments/assets/70f26a57-65c0-4931-940e-4e1897dd5247)

## Features

- 🎮 **Online Multiplayer Connect 4** — create a match and share the link with a friend
- 🔒 **Private AI Configuration** — each player secretly instructs their AI (opponent never sees your strategy)
- 💰 **Betting System** — predict the winning column and total move count before the game starts
- 👤 **User Accounts** — register with a unique username, track wins and games played
- 🤖 **50+ AI Models** — any model available on [OpenRouter](https://openrouter.ai) can play
- ⚙ **Admin Dashboard** — manage users, set the shared API key, configure available models, view match stats

## How It Works

1. **Create Match** — Player 1 creates a game and copies the shareable link
2. **Share** — Send the link to your opponent (Player 2)
3. **Setup (Private)** — Each player independently chooses their AI model, writes secret instructions, and places bets
4. **Play** — When both players are ready, the AIs battle live — each player's browser runs their own AI's turns
5. **Results** — Both players see the winner and how close their bets were

## Getting Started

### Prerequisites

This project requires a [Firebase](https://firebase.google.com) project for the backend.

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com) and create a new project
2. Enable **Authentication** → Sign-in method → **Email/Password**
3. Create a **Firestore Database** (start in test mode, then apply the rules below)
4. Go to **Project Settings** → **Your apps** → add a Web app → copy the config

### 2. Configure Firebase

```bash
cp .env.example .env.local
# Edit .env.local with your Firebase project values
```

### 3. Apply Firestore Security Rules

In Firebase Console → Firestore → Rules, paste the contents of `firestore.rules`.

### 4. Run Locally

```bash
npm install
npm run dev
```

### 5. First Login

Register an account — **the first registered user automatically becomes admin**.  
As admin, go to the **Admin Dashboard** (⚙ button in the header) to:
- Set your OpenRouter API key (shared across all matches)
- Restrict which models players can choose
- Manage users and view match statistics

## Admin Dashboard

The admin dashboard provides:

| Section | Features |
|---------|----------|
| **Settings** | Set shared OpenRouter API key, restrict available models |
| **Users** | View all users, ban/unban, grant/revoke admin |
| **Matches** | View all matches with status, players, winner, move count |

## Architecture

```
Frontend (React + Vite + Tailwind)
├── Firebase Auth — email/password login, user profiles
├── Firestore — matches, game state, private configs, admin settings
└── OpenRouter API — AI model calls (runs in each player's browser)
```

**Game execution is distributed** — each player's browser calls OpenRouter for their own AI's moves. Player 1's instructions are never sent to Player 2's browser, and vice versa.

## Tech Stack

- React 18 + Vite 6 + Tailwind CSS 3
- React Router 7 (Hash Router for GitHub Pages compatibility)
- Firebase (Authentication + Firestore)
- OpenRouter API (SSE streaming)
- GitHub Actions → GitHub Pages

## Local Development

```bash
npm install
npm run dev    # Dev server with hot reload
npm run build  # Production build
```

## Security Notes

- Each player's AI instructions are stored in a private Firestore document only they can read
- The admin's OpenRouter API key is stored in Firestore and readable by all authenticated users (required for game play) — apply proper Firestore rules and consider OpenRouter's rate limiting
- Firestore security rules in `firestore.rules` should be applied to restrict access appropriately

