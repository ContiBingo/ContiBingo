# ContiBingo

ContiBingo is a real-time multiplayer bingo app powered by **Supabase** (database + realtime). It's a 100% static frontend app that can be hosted on **GitHub Pages**, no server required.

Each player gets a unique, deterministic bingo card generated from a seed based on their name. The admin can call numbers, customize the theme, monitor players, and detect winners, all in real time.

## How Seed-Based Cards Work

Each player's bingo card is generated deterministically from their name using the [seedrandom](https://github.com/davidbau/seedrandom) library:

- Seed = `playerName.toLowerCase().trim()`
- Five numbers are picked from each BINGO column range:
  - **B**: 1–15, **I**: 16–30, **N**: 31–45, **G**: 46–60, **O**: 61–75
- The center square (row 3, col 3) is always **FREE**
- The same name always produces the same card, players can verify fairness

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

`http://localhost:3000`.
