# ContiBingo 🎱

A real-time multiplayer bingo web application where each player gets a unique, deterministic bingo card generated from their name.

## Features

- 🎴 **Unique cards** — Each player's card is deterministically generated from their name seed
- ⚡ **Real-time sync** — Live number broadcasting via Socket.IO
- 🎨 **Customizable themes** — Admin can change colors for all players simultaneously
- 📊 **Player monitoring** — Admin can view any player's card and stamp progress
- 🏆 **Automatic win detection** — Bingo detected across all 12 lines (5 rows + 5 cols + 2 diagonals)
- 📱 **Mobile-friendly** — Responsive design that works on any device
- 💾 **Persistent state** — Game state survives server restarts

## Getting Started

### Prerequisites

- Node.js 16+
- npm

### Installation

```bash
npm install
```

### Running

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Play

1. Visit the app in your browser
2. Enter your **First and Last Name** — this generates your unique bingo card
3. Wait for the admin to call numbers
4. Click a number on your card to stamp it (only callable numbers can be stamped)
5. Get 5 in a row (horizontal, vertical, or diagonal) to win!


### Admin Features

- **Theme Customizer** — Change colors for all players' cards
- **Number Caller** — Call individual or multiple bingo numbers
- **Player Monitor** — View all players and their card progress
- **Winners Panel** — Real-time winner notifications
- **Reset Stamps** — Clear all player stamps globally

## Tech Stack

- **Backend:** Node.js + Express + Socket.IO
- **Frontend:** Vanilla HTML/CSS/JavaScript (no build step needed)
- **Storage:** In-memory + `data/state.json` for persistence, `localStorage` for player stamps

## Project Structure

```
ContiBingo/
├── server.js          # Express + Socket.IO backend
├── package.json
├── data/
│   └── state.json     # Persisted game state (auto-created)
└── public/
    ├── index.html     # Single-page app
    ├── style.css      # Dark theme with CSS custom properties
    └── app.js         # Frontend logic
```
