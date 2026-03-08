# open-broccoli

⚔️ **LLM Battle Arena** — pit two AI models against each other: one answers your question, the other critiques it.

🔗 **[Live Demo → https://d-barletta.github.io/open-broccoli/](https://d-barletta.github.io/open-broccoli/)**

![LLM Battle Arena](https://github.com/user-attachments/assets/d174a5e4-a642-4080-bb1a-33b62ef34189)

## Features

- Select any two models from [OpenRouter](https://openrouter.ai)'s full model catalogue
- **Challenger** (Model A) streams a live answer to your question
- **Critic** (Model B) then analyses the response — identifying weaknesses, factual gaps, and missing context
- API key stored in your browser's `localStorage` only — never shared

## Getting Started

1. Visit the [demo page](https://d-barletta.github.io/open-broccoli/)
2. Enter your [OpenRouter API key](https://openrouter.ai/keys)
3. Choose your two models and start a battle!

## Local Development

```bash
npm install
npm run dev
```

## Tech Stack

- React 18 + Vite 6 + Tailwind CSS 3
- OpenRouter API (SSE streaming)
- GitHub Actions → GitHub Pages 