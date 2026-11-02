# ◈ CrateDig

> Community-driven DJ transition database. Search a track, see what DJs mix with it.

---

## Running Locally (5 minutes)

### 1. Install dependencies

```bash
cd cratedig
npm install
```

### 2. Start in demo mode (no DB needed)

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). You'll see demo data and can submit mixes — they'll live in memory for the session only.

---

## Connecting Supabase (persistent data)

### Step 1 — Create a free Supabase project
Go to [supabase.com](https://supabase.com) → New Project. Free tier is plenty.

### Step 2 — Run the schema
In Supabase → SQL Editor, paste the contents of **`supabase-schema.sql`** and click Run.

### Step 3 — Get your API keys
Supabase → Settings → API. Copy:
- **Project URL** (looks like `https://xxxx.supabase.co`)
- **anon / public** key

### Step 4 — Create your .env file
```bash
cp .env.example .env.local
```
Fill in your values in `.env.local`.

### Step 5 — Restart dev server
```bash
npm run dev
```

Now all submitted mixes persist to your Supabase database.

---

## Deploying for Free

### Vercel (recommended)
```bash
npm install -g vercel
vercel
```
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables in the Vercel dashboard.

### Netlify
```bash
npm run build
# Drag the dist/ folder to netlify.com/drop
```

---

## Tech Stack

| Layer | Tech | Cost |
|---|---|---|
| Frontend | React + Vite | Free |
| Song search | MusicBrainz API | Free, no key needed |
| Database | Supabase | Free tier (500MB, 2GB bandwidth) |
| Hosting | Vercel / Netlify | Free tier |

**Total monthly cost: $0**

---

## Features

- 🔍 **Song search** via MusicBrainz (no API key required)
- 🎚️ **Mix pairings** with exact transition timestamps (A out at X:XX → B in at Y:YY)
- 🏷️ **Genre filtering** (House, Techno, DnB, Jungle, and more)
- 👆 **Upvoting** on pairings
- 📝 **Optional notes** — technique tips, EQ advice, BPM info
- 📱 **Mobile + desktop** responsive

---

## Roadmap Ideas

- User accounts (Supabase Auth)
- BPM display from MusicBrainz / AcousticBrainz
- "Find key-compatible tracks" using Camelot wheel
- Embed Spotify previews (requires Spotify OAuth)
- Comments on pairings
- DJ profiles / submission history
