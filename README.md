# Chronicle — Time Block Planner

A smart planner that automatically categorises your activities using AI, then shows you insights on how you're spending your time.

## Project Structure

```
planner/
├── server/          # Express API + SQLite database
│   └── index.js     # All backend logic
└── client/          # React frontend
    └── src/
        ├── pages/   # BlocksPage, AnalyticsPage
        └── components/  # BlockForm, BlockList
```

## Setup

### 1. Install dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Set your Anthropic API key

The server uses Claude to categorise activities. Set your API key as an environment variable:

```bash
export ANTHROPIC_API_KEY=your_key_here
```

Get a key at: https://console.anthropic.com

### 3. Run both servers

**Terminal 1 — Backend (port 3001):**

```bash
cd server
npm run dev
```

**Terminal 2 — Frontend (port 5173):**

```bash
cd client
npm run dev
```

Then open: http://localhost:5173

## How it works

1. **Add a time block** — give it a title, time, and optional notes
2. **AI categorisation** — Claude reads the activity name and classifies it into 1-3 categories (Work, Fitness, Social, etc.)
3. **Storage** — saved to a local SQLite file (`server/planner.db`)
4. **Insights** — the Analytics page shows breakdowns by week, month, or all time

## Categories

Work · Fitness · Social · Family · Learning · Health · Creative · Rest · Errands · Travel · Food · Spirituality · Finance · Hobbies
