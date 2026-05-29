# Kombucha Tracker

A mobile-first web application for fermentation hobbyists to track SCOBY health, fermentation batches, inventory, and bottling — with AI-powered photo analysis, an AI chat advisor, and a guided onboarding experience.

## Features

- **Dashboard** — "Today" view with a week calendar strip, active batch cards, and brewing stats
- **Batch Tracking** — Create and monitor fermentation batches (tea type, start date, status, notes)
- **Daily Logs** — Record temperature, SCOBY appearance, smell, pH, carbonation, and activities; get AI-generated tips per entry
- **AI Photo Analysis** — Upload photos of your SCOBY or bottles for automated health assessment
- **AI Advisor** — Interactive brewing mentor chat with Text-to-Speech (TTS) audio playback
- **Onboarding Quiz** — Guided questionnaire for new users that produces personalized AI brewing advice
- **Flavoring Guide** — Second fermentation (F2) suggestions based on user flavor preferences
- **Bottle Tests** — Track carbonation pressure tests and tasting results for bottled batches
- **Inventory Management** — Raw material stock, blank label tracking, and bottling records
- **AI Persona** — Standalone public-facing AI chatbot with a configurable knowledge base

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Runtime | Node.js 24 |
| Language | TypeScript 5.9 |
| Frontend | React 19, Vite, Tailwind CSS v4, shadcn/ui, wouter |
| Backend | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Clerk (`@clerk/express`, `@clerk/react`) |
| AI | OpenAI (via Replit AI Integrations proxy) |
| File Storage | Replit Object Storage (GCS-backed) |
| API Codegen | Orval (OpenAPI → Zod + React Query) |
| Mobile | Capacitor (iOS & Android) |

## Monorepo Structure

```
.
├── artifacts/
│   ├── api-server/          # Express 5 backend — all API routes
│   ├── kombucha-tracker/    # React + Vite frontend (primary app)
│   ├── ai-persona/          # Standalone AI chatbot (no auth required)
│   └── mockup-sandbox/      # UI component sandbox (development only)
├── lib/
│   ├── db/                  # PostgreSQL schema + Drizzle ORM config + migrations
│   ├── api-spec/            # OpenAPI specification (source of truth for the API)
│   ├── api-zod/             # Zod validation schemas (generated from api-spec)
│   ├── api-client-react/    # React Query hooks (generated from api-spec)
│   ├── integrations-openai-ai-server/   # Server-side OpenAI client wrapper
│   ├── integrations-openai-ai-react/    # Client-side AI integration helpers
│   └── object-storage-web/  # Replit Object Storage client utilities
└── scripts/                 # Internal workspace scripts
```

## Prerequisites

- **Node.js** 24+
- **pnpm** 9+ — install with `npm install -g pnpm`
- A **Supabase** project (PostgreSQL database) — [supabase.com](https://supabase.com)
- A **Clerk** application — [clerk.com](https://clerk.com)
- An **OpenAI** API key (or use Replit AI Integrations if running on Replit)

## Environment Variables

Each application reads its own environment variables. The API server reads from the shell environment (no automatic `.env` loading), while the Vite frontend loads its variables from a `.env` file placed inside the `artifacts/kombucha-tracker/` directory.

### API Server (`artifacts/api-server`)

These must be exported in your shell (or injected via a tool like [direnv](https://direnv.net/)) before running the API server.

| Variable | Description |
|---|---|
| `PORT` | Port the API server listens on. Use `3001` for local dev. |
| `DATABASE_URL` | PostgreSQL connection string. Use the **session pooler** URI from Supabase (port `5432`), with the password URL-encoded. |
| `CLERK_SECRET_KEY` | Secret key from your Clerk dashboard (Settings → API Keys). |
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`). |
| `SUPABASE_KEY` | Supabase `anon` or `service_role` key from your Supabase project settings. |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key (or Replit AI Integrations key). |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI base URL. Use `https://api.openai.com/v1` for standard OpenAI, or the Replit AI Integrations proxy URL. |
| `PERSONA_ADMIN_SECRET` | A secret string you choose — required to manage the AI Persona knowledge base via the admin API. |
| `LOG_LEVEL` | (Optional) Log verbosity — `debug`, `info`, `warn`, or `error`. Defaults to `info`. |
| `PRIVATE_OBJECT_DIR` | (Optional) Object storage directory prefix for private user files. |
| `PUBLIC_OBJECT_SEARCH_PATHS` | (Optional) Comma-separated public storage path prefixes. |

### Frontend (`artifacts/kombucha-tracker/.env`)

Vite loads these automatically from a `.env` file placed inside `artifacts/kombucha-tracker/`.

| Variable | Description |
|---|---|
| `PORT` | Port the Vite dev server listens on. Use `5173` for local dev. |
| `BASE_PATH` | URL base path for the app. Use `/` for local dev. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Publishable key from your Clerk dashboard (Settings → API Keys). |
| `VITE_API_BASE_URL` | URL of the running API server. Must match the API server's `PORT` (e.g. `http://localhost:3001`). |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` above. |
| `VITE_SUPABASE_KEY` | Same as `SUPABASE_KEY` above. |
| `VITE_CLERK_PROXY_URL` | (Optional) Clerk proxy URL — only needed when running behind a custom proxy. |

## Local Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <repo-name>
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment variables

The API server and frontend each have their own env files.

**API server** — create `artifacts/api-server/.env` and export it before starting the server:

```env
PORT=3001
DATABASE_URL=postgresql://postgres.xxxx:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
CLERK_SECRET_KEY=sk_test_...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJ...
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
PERSONA_ADMIN_SECRET=your-secret-here
```

> The API server does not load `.env` automatically. Export the vars in your shell before running `pnpm dev`, or use a tool like [direnv](https://direnv.net/) to load them from a file automatically.

**Frontend** — create `artifacts/kombucha-tracker/.env` (Vite loads this automatically):

```env
PORT=5173
BASE_PATH=/
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_API_BASE_URL=http://localhost:3001
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_KEY=eyJ...
```

> `PORT` and `BASE_PATH` are read by the Vite config at startup. `BASE_PATH=/` is correct for all local development.

> If your Supabase password contains special characters, URL-encode them in `DATABASE_URL` (e.g. `@` → `%40`, `#` → `%23`).

### 4. Run database migrations

Migrations are managed with Drizzle Kit inside the `lib/db` package.

```bash
# Apply all pending migrations to your database
cd lib/db
pnpm push
cd ../..
```

> **Note:** If your Supabase password contains special characters, URL-encode it in `DATABASE_URL` (e.g. `@` → `%40`, `#` → `%23`).

### 5. Set up Clerk

1. Create an application at [clerk.com](https://clerk.com).
2. Under **Settings → API Keys**, copy the publishable key and secret key into your `.env`.
3. In your Clerk dashboard, add `http://localhost:5173` (or your dev port) as an allowed origin.
4. Enable any sign-in methods you want (email/password, Google, etc.).

### 6. Start the development servers

Open two terminal tabs:

```bash
# Terminal 1 — API server (port 3001)
# Export env vars first (or use direnv to load them automatically)
export $(grep -v '^#' artifacts/api-server/.env | xargs)
cd artifacts/api-server
pnpm dev

# Terminal 2 — Kombucha Tracker frontend (port 5173, reads .env automatically)
cd artifacts/kombucha-tracker
pnpm dev
```

The app will be available at `http://localhost:5173`.

To also run the AI Persona chatbot, open a third terminal:

```bash
cd artifacts/ai-persona
pnpm dev
```

## Mobile Build (Capacitor)

The Kombucha Tracker is configured as a Capacitor app (`com.kombuchatracker.app`) and can be compiled into a native iOS or Android app.

```bash
cd artifacts/kombucha-tracker

# Build the mobile web bundle and sync to native projects
pnpm cap:sync

# Open in Xcode (iOS)
pnpm cap:open:ios

# Open in Android Studio (Android)
pnpm cap:open:android
```

> Requires Xcode (macOS, for iOS) or Android Studio (for Android) to be installed.

## Code Generation

The API client libraries (`lib/api-zod` and `lib/api-client-react`) are generated from the OpenAPI spec in `lib/api-spec`. If you change the API spec, regenerate them:

```bash
cd lib/api-spec
pnpm codegen
```

## Useful Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm build` | Typecheck and build all packages |
| `pnpm typecheck` | Run TypeScript checks across the monorepo |
| `cd lib/db && pnpm push` | Apply schema changes to the database |
| `cd lib/db && pnpm generate` | Generate a new migration file from schema changes |
