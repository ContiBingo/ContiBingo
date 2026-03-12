const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'state.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Pizza111';
if (!process.env.ADMIN_PASSWORD) {
  console.warn('Warning: Using default admin password. Set ADMIN_PASSWORD env var in production.');
}

const DEFAULT_STATE = {
  calledNumbers: [],
  theme: {
    bgColor: '#1a1a2e',
    cardColor: '#16213e',
    stampColor: '#e94560',
    headerColor: '#0f3460',
    textColor: '#ffffff',
    accentColor: '#e94560'
  },
  players: [],
  winners: [],
  stampResetVersion: 0,
  playerStamps: {}
};

function validateLoadedState(parsed) {
  if (typeof parsed !== 'object' || parsed === null) return false;
  if (!Array.isArray(parsed.calledNumbers)) return false;
  if (!Array.isArray(parsed.players)) return false;
  if (!Array.isArray(parsed.winners)) return false;
  if (parsed.calledNumbers.some(n => typeof n !== 'number' || n < 1 || n > 75)) return false;
  return true;
}

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (!validateLoadedState(parsed)) {
        console.warn('State file failed validation, using default state.');
        return { ...DEFAULT_STATE };
      }
      return {
        ...DEFAULT_STATE,
        calledNumbers: parsed.calledNumbers || [],
        theme: (typeof parsed.theme === 'object' && parsed.theme) ? { ...DEFAULT_STATE.theme, ...parsed.theme } : DEFAULT_STATE.theme,
        players: parsed.players || [],
        winners: parsed.winners || [],
        stampResetVersion: typeof parsed.stampResetVersion === 'number' ? parsed.stampResetVersion : 0,
        playerStamps: (typeof parsed.playerStamps === 'object' && parsed.playerStamps && !Array.isArray(parsed.playerStamps)) ? parsed.playerStamps : {}
      };
    }
  } catch (e) {
    console.error('Error loading state:', e.message);
  }
  return { ...DEFAULT_STATE };
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('Error saving state:', e.message);
  }
}

let state = loadState();

function checkAdmin(password) {
  return password === ADMIN_PASSWORD;
}

// GET /api/state
app.get('/api/state', (req, res) => {
  res.json({
    calledNumbers: state.calledNumbers,
    theme: state.theme,
    players: state.players,
    winners: state.winners,
    stampResetVersion: state.stampResetVersion,
    playerStamps: state.playerStamps
  });
});

// POST /api/register
app.post('/api/register', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ ok: false, error: 'Name required' });
  }
  const normalized = name.trim().toLowerCase();
  const exists = state.players.some(p => p.name.toLowerCase() === normalized);
  if (!exists) {
    const seed = normalized;
    state.players.push({ name: name.trim(), seed });
    saveState();
    io.emit('state-update', getPublicState());
  }
  res.json({ ok: true });
});

// POST /api/admin/call-numbers
app.post('/api/admin/call-numbers', (req, res) => {
  const { numbers, password } = req.body;
  if (!checkAdmin(password)) return res.status(403).json({ ok: false, error: 'Forbidden' });
  if (!Array.isArray(numbers)) return res.status(400).json({ ok: false, error: 'numbers must be array' });
  const valid = numbers.filter(n => Number.isInteger(n) && n >= 1 && n <= 75);
  valid.forEach(n => {
    if (!state.calledNumbers.includes(n)) state.calledNumbers.push(n);
  });
  saveState();
  io.emit('state-update', getPublicState());
  res.json({ ok: true, calledNumbers: state.calledNumbers });
});

// POST /api/admin/reset-stamps
app.post('/api/admin/reset-stamps', (req, res) => {
  const { password } = req.body;
  if (!checkAdmin(password)) return res.status(403).json({ ok: false, error: 'Forbidden' });
  state.stampResetVersion = (state.stampResetVersion || 0) + 1;
  state.playerStamps = {};
  saveState();
  io.emit('stamp-reset', { version: state.stampResetVersion });
  res.json({ ok: true, version: state.stampResetVersion });
});

// POST /api/admin/set-theme
app.post('/api/admin/set-theme', (req, res) => {
  const { password, theme } = req.body;
  if (!checkAdmin(password)) return res.status(403).json({ ok: false, error: 'Forbidden' });
  if (!theme || typeof theme !== 'object') return res.status(400).json({ ok: false, error: 'theme required' });
  state.theme = { ...state.theme, ...theme };
  saveState();
  io.emit('state-update', getPublicState());
  res.json({ ok: true });
});

// POST /api/admin/clear-numbers
app.post('/api/admin/clear-numbers', (req, res) => {
  const { password } = req.body;
  if (!checkAdmin(password)) return res.status(403).json({ ok: false, error: 'Forbidden' });
  state.calledNumbers = [];
  state.winners = [];
  saveState();
  io.emit('state-update', getPublicState());
  res.json({ ok: true });
});

// POST /api/report-win
app.post('/api/report-win', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ ok: false, error: 'Name required' });
  const normalized = name.trim().toLowerCase();
  const alreadyWinner = state.winners.some(w => w.toLowerCase() === normalized);
  if (!alreadyWinner) {
    state.winners.push(name.trim());
    saveState();
    io.emit('winner', { name: name.trim() });
    io.emit('state-update', getPublicState());
  }
  res.json({ ok: true });
});

// POST /api/report-stamp
app.post('/api/report-stamp', (req, res) => {
  const { name, stamps } = req.body;
  if (!name || !Array.isArray(stamps)) return res.status(400).json({ ok: false, error: 'Invalid' });
  state.playerStamps[name.trim().toLowerCase()] = stamps;
  saveState();
  io.emit('state-update', getPublicState());
  res.json({ ok: true });
});

function getPublicState() {
  return {
    calledNumbers: state.calledNumbers,
    theme: state.theme,
    players: state.players,
    winners: state.winners,
    stampResetVersion: state.stampResetVersion,
    playerStamps: state.playerStamps
  };
}

io.on('connection', (socket) => {
  socket.emit('state-update', getPublicState());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ContiBingo server running on http://localhost:${PORT}`);
});
