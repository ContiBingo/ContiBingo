# 🎱 ContiBingo

ContiBingo is a real-time multiplayer bingo app powered by **Supabase** (database + realtime). It's a 100% static frontend app that can be hosted on **GitHub Pages** — no server required.

Each player gets a unique, deterministic bingo card generated from a seed based on their name. The admin can call numbers, customize the theme, monitor players, and detect winners — all in real time.

---

## 🚀 Live App

Once deployed, your app will be available at:

```
https://<your-org>.github.io/ContiBingo
```

---

## 🛠️ One-Time Supabase Setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Copy your **Project URL** and **anon/public key** from:
   - `Project Settings → API`

### 2. Run the database schema

1. In your Supabase project, go to **SQL Editor**
2. Paste the contents of [`supabase/schema.sql`](supabase/schema.sql)
3. Click **Run**

This creates all 5 tables (`called_numbers`, `players`, `winners`, `theme`, `stamp_resets`) with RLS policies and realtime enabled.

### 3. Enable Realtime for all tables

In the Supabase dashboard, go to **Database → Replication** and confirm all 5 tables are listed under the `supabase_realtime` publication (the schema.sql handles this, but you can verify there).

---

## 🌐 GitHub Pages Deployment

### 1. Enable GitHub Pages

1. Go to your repo **Settings → Pages**
2. Under **Source**, select **GitHub Actions**

### 2. Deploy

Push to `main` — the GitHub Actions workflow (`.github/workflows/deploy.yml`) will automatically deploy the `public/` folder to GitHub Pages.

You can also trigger a manual deploy from **Actions → Deploy ContiBingo to GitHub Pages → Run workflow**.

---

## 🔑 Admin Access

- **Name:** `Aidan Carter` (case-insensitive)
- **Password:** `Pizza111`

Admin credentials are checked client-side and stored in localStorage on that device.

---

## 🃏 How Seed-Based Cards Work

Each player's bingo card is generated deterministically from their name using the [seedrandom](https://github.com/davidbau/seedrandom) library:

- Seed = `playerName.toLowerCase().trim()`
- Five numbers are picked from each BINGO column range:
  - **B**: 1–15, **I**: 16–30, **N**: 31–45, **G**: 46–60, **O**: 61–75
- The center square (row 3, col 3) is always **FREE**
- The same name always produces the same card — players can verify fairness

---

## 🏗️ Architecture

```
public/
  index.html    — Single-page app (all views and modals)
  app.js        — All frontend logic (Supabase client, realtime, card gen)
  style.css     — Dark space-themed, mobile-first CSS

supabase/
  schema.sql    — Database schema (run once in Supabase SQL Editor)

.github/
  workflows/
    deploy.yml  — GitHub Pages auto-deploy workflow
```

No server, no build step, no Node dependencies needed to run the app.

---

## 💻 Local Development

```bash
npx serve public
```

Then open `http://localhost:3000`.
