# Chronicle — Time Block Planner

Chronicle is a full-stack productivity app that lets users plan and log time blocks, automatically categorises activities using AI, and provides insights on how planned time compares to completed time.

The core idea: most time-tracking tools only record what you've done. Chronicle lets you plan ahead too, so you can see the gap between your intentions and your reality.

---

## What it does

- **Plan and log time blocks** — add activities with a title, date, and time range
- **AI categorisation** — Claude automatically classifies each activity into categories (Work, Fitness, Social, Family, etc.) based on the title and any notes
- **Complete blocks** — tick off activities as you complete them
- **Insights dashboard** — view planned vs completed hours broken down by category, filterable by week, month or all time
- **Secure authentication** — register and log in with email and password

---

## Tech stack

| Layer      | Technology                      | Why                                                                       |
| ---------- | ------------------------------- | ------------------------------------------------------------------------- |
| Frontend   | React + TypeScript              | Industry standard, type safety catches bugs at compile time               |
| Build tool | Vite                            | Fast dev server with hot module replacement                               |
| Backend    | Node.js + Express + TypeScript  | JavaScript end-to-end, no context switching between languages             |
| Database   | PostgreSQL                      | Production-grade relational database, native JSONB support for categories |
| Auth       | bcrypt + JWT + HttpOnly cookies | Secure password hashing, stateless sessions, XSS-resistant token storage  |
| AI         | Anthropic Claude API            | Flexible natural language classification without hardcoded rules          |

---

## Interesting technical decisions

**Why HttpOnly cookies instead of localStorage for JWTs?**

localStorage is vulnerable to XSS attacks — any malicious script running on the page can read it. HttpOnly cookies are inaccessible to JavaScript entirely, so even if an attacker injects a script, they can't steal the token. The browser handles sending the cookie automatically on every request.

**Why keep AI categorisation on the server?**

The Anthropic API key must never be exposed in the browser. By keeping the categorisation call in the Express server, the key stays server-side only. It also means we can add rate limiting or caching later without touching the frontend.

**Why JSONB for categories in Postgres?**

Each block can belong to multiple categories (e.g. "dinner with friends" → Social + Food). JSONB stores this as a native array in Postgres rather than a separate join table, which keeps the schema simple while still being queryable. Postgres returns it already parsed, so no JSON.parse() needed on the server.

**Why separate planned and completed hours in analytics?**

A completion rate metric is more useful than raw hours. If you planned 10 hours of fitness activity but only completed 3, that's a meaningful signal. Showing both side by side makes the gap visible and gives users something to act on.

**Why IF NOT EXISTS on table creation?**

Rather than running migrations on every server start, the CREATE TABLE IF NOT EXISTS pattern means the schema is applied once and never overwrites existing data. This is a pragmatic approach for a solo project — a larger team would use a dedicated migration tool like Flyway or node-pg-migrate.

---

## Project structure

```
planner/
├── server/
│   ├── src/
│   │   └── index.ts        # Express API, auth, DB, AI categorisation
│   ├── package.json
│   └── tsconfig.json
└── client/
    ├── src/
    │   ├── types.ts              # Shared TypeScript interfaces
    │   ├── context/
    │   │   └── AuthContext.tsx   # Global auth state via React Context
    │   ├── pages/
    │   │   ├── AuthPage.tsx
    │   │   ├── BlocksPage.tsx
    │   │   └── AnalyticsPage.tsx
    │   └── components/
    │       ├── BlockForm.tsx     # Handles both create and edit
    │       └── BlockList.tsx
    ├── package.json
    └── tsconfig.json
```

---

## Running locally

### Prerequisites

- Node.js v18+
- PostgreSQL (running locally)

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/planner.git
cd planner
```

### 2. Set environment variables

```bash
# Required
ANTHROPIC_API_KEY=your_key_here
DB_PASSWORD=your_postgres_password

# Optional (defaults shown)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=planner
DB_USER=postgres
JWT_SECRET=change_this_in_production
```

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE planner;"
```

### 4. Install dependencies and run

```bash
# Terminal 1 — backend
cd server
npm install
npm run dev

# Terminal 2 — frontend
cd client
npm install
npm run dev
```

Open http://localhost:5173

---

## API routes

| Method | Route             | Auth | Description                            |
| ------ | ----------------- | ---- | -------------------------------------- |
| POST   | `/auth/register`  | No   | Create account                         |
| POST   | `/auth/login`     | No   | Sign in, sets HttpOnly cookie          |
| POST   | `/auth/logout`    | No   | Clears cookie                          |
| GET    | `/auth/me`        | Yes  | Returns current user from cookie       |
| GET    | `/api/blocks`     | Yes  | Get all blocks for current user        |
| POST   | `/api/blocks`     | Yes  | Create block + AI categorisation       |
| PATCH  | `/api/blocks/:id` | Yes  | Edit block or toggle completion        |
| DELETE | `/api/blocks/:id` | Yes  | Delete block                           |
| GET    | `/api/analytics`  | Yes  | Planned vs completed hours by category |
