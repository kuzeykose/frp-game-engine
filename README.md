# FRP Game

An AI-driven tabletop RPG engine that generates worlds, characters, and branching narratives on the fly. Supports two settings: **Cyberpunk** and **D&D fantasy**.

## How it works

The game runs through four sequential stages:

1. **World** — Claude generates an opening scene (atmosphere, plot, main quest) for the chosen theme. An image is generated to accompany it.
2. **Characters** — Claude creates four playable characters tied to that world. Each gets a portrait image.
3. **Party** — The player picks a main character; Claude narrates how the four come together and presents the first action choices.
4. **Adventure loop** — Each choice the player makes produces a new scene with consequences, character status updates, and the next set of decisions. The arc ends at a GM-determined finale.

All world and GM data stays in Supabase. The browser only ever receives player-facing text and image URLs.

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| AI (narrative) | Anthropic Claude (`@anthropic-ai/sdk`) |
| AI (images) | Google Gemini (`@google/genai`) |
| Database | Supabase (PostgreSQL) |

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env` file at the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_google_gemini_key
```

### 3. Initialize the database

Run the SQL in `supabase/schema.sql` against your Supabase project (SQL editor or CLI). It is idempotent — safe to re-run.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/world` | POST | Generate a world + opening scene |
| `/api/characters` | POST | Generate 4 characters for a world |
| `/api/party` | POST | Gather the party around the chosen main character |
| `/api/scene` | POST | Advance the adventure with a player decision |

## Database schema

```
campaigns   — optional campaign grouping with a title
worlds      — opening scene (player text + full GM data as JSONB)
characters  — four characters per world (full sheet as JSONB)
parties     — gathering narrative + first choices, linked to world + main character
scenes      — one row per player decision; chains by party_id
```
