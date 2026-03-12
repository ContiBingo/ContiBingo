'use strict';

// ============================================================
// Constants & State
// ============================================================
const ADMIN_NAME = 'aidan carter';
const ADMIN_PASSWORD_KEY = 'contibingo_admin_auth';
const NAME_KEY = 'contibingo_name';
const STAMP_RESET_VERSION_KEY = 'contibingo_stamp_reset_version';

let playerName = null;
let serverState = { calledNumbers: [], theme: {}, players: [], winners: [], stampResetVersion: 0, playerStamps: {} };
let socket = null;
let stampDebounceTimer = null;

// ============================================================
// Utilities
// ============================================================
function range(start, end) {
  const arr = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getColumnClass(num) {
  if (num >= 1 && num <= 15)  return 'b';
  if (num >= 16 && num <= 30) return 'i';
  if (num >= 31 && num <= 45) return 'n';
  if (num >= 46 && num <= 60) return 'g';
  return 'o';
}

function generateCard(name) {
  const seed = name.toLowerCase().trim();
  const rng = new Math.seedrandom(seed);
  const cols = [
    shuffle(range(1, 15), rng).slice(0, 5),
    shuffle(range(16, 30), rng).slice(0, 5),
    shuffle(range(31, 45), rng).slice(0, 5),
    shuffle(range(46, 60), rng).slice(0, 5),
    shuffle(range(61, 75), rng).slice(0, 5),
  ];
  // Build row-major 5x5
  const card = [];
  for (let row = 0; row < 5; row++) {
    card[row] = [];
    for (let col = 0; col < 5; col++) {
      card[row][col] = (row === 2 && col === 2) ? 0 : cols[col][row];
    }
  }
  return card;
}

// ============================================================
// Stamps (localStorage)
// ============================================================
function stampKey(name) {
  return `contibingo_stamps_${name.toLowerCase().trim()}`;
}

function getStamps(name) {
  try {
    return JSON.parse(localStorage.getItem(stampKey(name)) || '[]');
  } catch { return []; }
}

function saveStamps(name, stamps) {
  localStorage.setItem(stampKey(name), JSON.stringify(stamps));
}

function clearAllStamps() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('contibingo_stamps_'));
  keys.forEach(k => localStorage.removeItem(k));
}

function getLocalResetVersion() {
  return parseInt(localStorage.getItem(STAMP_RESET_VERSION_KEY) || '0', 10);
}

function setLocalResetVersion(v) {
  localStorage.setItem(STAMP_RESET_VERSION_KEY, String(v));
}

// ============================================================
// Theme
// ============================================================
function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;
  if (theme.bgColor)     root.style.setProperty('--bg-color', theme.bgColor);
  if (theme.cardColor)   root.style.setProperty('--card-color', theme.cardColor);
  if (theme.stampColor)  root.style.setProperty('--stamp-color', theme.stampColor);
  if (theme.headerColor) root.style.setProperty('--header-color', theme.headerColor);
  if (theme.textColor)   root.style.setProperty('--text-color', theme.textColor);
  if (theme.accentColor) root.style.setProperty('--accent-color', theme.accentColor);
}

// ============================================================
// Render bingo card
// ============================================================
function renderCard(containerEl, name, stamps, calledNumbers, isAdmin = false) {
  const card = generateCard(name);
  containerEl.innerHTML = '';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const num = card[row][col];
      const isFree = num === 0;
      const isStamped = isFree || stamps.includes(num);
      const isCallable = !isFree && calledNumbers.includes(num);
      const cell = document.createElement('div');
      cell.className = 'bingo-cell';
      if (isFree)     { cell.classList.add('free', 'stamped'); }
      else if (isStamped) { cell.classList.add('stamped', 'callable'); }
      else if (isCallable) { cell.classList.add('callable'); }
      else            { cell.classList.add('uncallable'); }
      const span = document.createElement('span');
      span.className = 'cell-number';
      span.textContent = isFree ? 'FREE' : num;
      cell.appendChild(span);
      cell.dataset.num = num;
      cell.dataset.row = row;
      cell.dataset.col = col;
      if (!isAdmin && !isFree) {
        cell.addEventListener('click', () => handleCellClick(cell, num, name));
      }
      containerEl.appendChild(cell);
    }
  }
}

function handleCellClick(cell, num, name) {
  const calledNumbers = serverState.calledNumbers || [];
  if (!calledNumbers.includes(num)) {
    cell.classList.add('shake');
    cell.addEventListener('animationend', () => cell.classList.remove('shake'), { once: true });
    return;
  }
  const stamps = getStamps(name);
  if (stamps.includes(num)) return; // already stamped
  stamps.push(num);
  saveStamps(name, stamps);
  cell.classList.add('stamped');
  cell.classList.remove('callable');
  // Report stamp to server (debounced)
  clearTimeout(stampDebounceTimer);
  stampDebounceTimer = setTimeout(() => reportStamps(name, stamps), 500);
  checkWin(name);
}

async function reportStamps(name, stamps) {
  try {
    await fetch('/api/report-stamp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stamps })
    });
  } catch (e) { /* silent */ }
}

// ============================================================
// Win Detection
// ============================================================
function checkWin(name) {
  const card = generateCard(name);
  const stamps = getStamps(name);
  const lines = [];
  // rows
  for (let r = 0; r < 5; r++) lines.push(card[r]);
  // cols
  for (let c = 0; c < 5; c++) lines.push(card.map(r => r[c]));
  // diagonals
  lines.push([card[0][0], card[1][1], card[2][2], card[3][3], card[4][4]]);
  lines.push([card[0][4], card[1][3], card[2][2], card[3][1], card[4][0]]);

  for (const line of lines) {
    if (line.every(n => n === 0 || stamps.includes(n))) {
      triggerWin(name);
      return;
    }
  }
}

let winReported = false;
async function triggerWin(name) {
  if (winReported) return;
  winReported = true;
  document.getElementById('win-player-name').textContent = name;
  document.getElementById('win-overlay').hidden = false;
  try {
    await fetch('/api/report-win', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
  } catch (e) { /* silent */ }
}

// ============================================================
// Called numbers display
// ============================================================
function renderCalledNumbers(containerEl, numbers) {
  containerEl.innerHTML = '';
  [...numbers].sort((a, b) => a - b).forEach(n => {
    const badge = document.createElement('span');
    badge.className = `number-badge badge-${getColumnClass(n)}`;
    badge.textContent = n;
    containerEl.appendChild(badge);
  });
}

// ============================================================
// Socket.IO
// ============================================================
function initSocket() {
  socket = io();
  socket.on('state-update', (state) => {
    handleStateUpdate(state);
  });
  socket.on('stamp-reset', ({ version }) => {
    if (version > getLocalResetVersion()) {
      setLocalResetVersion(version);
      clearAllStamps();
      winReported = false;
      if (playerName) refreshPlayerView();
    }
  });
  socket.on('winner', ({ name }) => {
    if (isAdminView()) {
      renderAdminWinners(serverState.winners);
      showAdminWinnerAlert(name);
    }
  });
}

function isAdminView() {
  return !document.getElementById('admin-view').hidden;
}

function handleStateUpdate(state) {
  serverState = state;
  applyTheme(state.theme);
  if (!document.getElementById('player-view').hidden) {
    refreshPlayerView();
  }
  if (isAdminView()) {
    refreshAdminView();
  }
  // Check stamp reset version
  const serverVersion = state.stampResetVersion || 0;
  if (serverVersion > getLocalResetVersion()) {
    setLocalResetVersion(serverVersion);
    clearAllStamps();
    winReported = false;
    if (playerName) refreshPlayerView();
  }
}

function refreshPlayerView() {
  const stamps = getStamps(playerName);
  const cardEl = document.getElementById('bingo-card');
  renderCard(cardEl, playerName, stamps, serverState.calledNumbers || []);
  renderCalledNumbers(document.getElementById('called-numbers-display'), serverState.calledNumbers || []);
}

// ============================================================
// Admin View
// ============================================================
function refreshAdminView() {
  renderCalledNumbers(document.getElementById('admin-called-numbers'), serverState.calledNumbers || []);
  renderPlayerList(serverState.players || []);
  renderAdminWinners(serverState.winners || []);
  // Sync theme pickers
  const t = serverState.theme || {};
  if (t.bgColor)     document.getElementById('theme-bg').value = t.bgColor;
  if (t.cardColor)   document.getElementById('theme-card').value = t.cardColor;
  if (t.stampColor)  document.getElementById('theme-stamp').value = t.stampColor;
  if (t.headerColor) document.getElementById('theme-header').value = t.headerColor;
  if (t.textColor)   document.getElementById('theme-text').value = t.textColor;
  if (t.accentColor) document.getElementById('theme-accent').value = t.accentColor;
}

let allPlayers = [];
function renderPlayerList(players) {
  allPlayers = players;
  filterAndRenderPlayers(document.getElementById('player-search').value);
}

function filterAndRenderPlayers(query) {
  const list = document.getElementById('player-list');
  const filtered = allPlayers.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
  list.innerHTML = '';
  if (filtered.length === 0) {
    list.innerHTML = '<p style="opacity:0.5;font-size:0.9rem">No players yet.</p>';
    return;
  }
  filtered.forEach(player => {
    const item = document.createElement('div');
    item.className = 'player-item';
    const isWinner = (serverState.winners || []).some(w => w.toLowerCase() === player.name.toLowerCase());
    if (isWinner) item.classList.add('bingo-winner');
    item.innerHTML = `${isWinner ? '🏆 ' : '👤 '}<span>${player.name}</span>`;
    item.addEventListener('click', () => showPlayerCardModal(player.name));
    list.appendChild(item);
  });
}

function renderAdminWinners(winners) {
  const el = document.getElementById('admin-winners');
  if (!winners || winners.length === 0) {
    el.innerHTML = '<p style="opacity:0.5;font-size:0.9rem">No winners yet.</p>';
    return;
  }
  el.innerHTML = winners.map(w =>
    `<div class="winner-item"><span class="winner-item-trophy">🏆</span>${w}</div>`
  ).join('');
}

function showAdminWinnerAlert(name) {
  const msg = `🏆 Winner detected: ${name}!`;
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;top:80px;right:1.5rem;
    background:#f1c40f;color:#000;
    padding:1rem 1.5rem;border-radius:10px;
    font-weight:700;font-size:1rem;
    z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.4);
    animation:slideUp 0.3s ease;
  `;
  banner.textContent = msg;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 5000);
}

function showPlayerCardModal(name) {
  const modal = document.getElementById('player-card-modal');
  document.getElementById('modal-player-name-title').textContent = name;

  const stamps = (serverState.playerStamps || {})[name.toLowerCase().trim()] || [];
  const cardEl = document.getElementById('modal-bingo-card');
  renderCard(cardEl, name, stamps, serverState.calledNumbers || [], true);

  // Stats
  const card = generateCard(name);
  const lines = [];
  for (let r = 0; r < 5; r++) lines.push(card[r]);
  for (let c = 0; c < 5; c++) lines.push(card.map(r => r[c]));
  lines.push([card[0][0], card[1][1], card[2][2], card[3][3], card[4][4]]);
  lines.push([card[0][4], card[1][3], card[2][2], card[3][1], card[4][0]]);

  const completedLines = lines.filter(line => line.every(n => n === 0 || stamps.includes(n))).length;
  const totalStamped = stamps.length;
  const isBingo = completedLines > 0;

  document.getElementById('modal-player-stats').innerHTML = `
    <strong>Stamps:</strong> ${totalStamped} &nbsp;|&nbsp;
    <strong>Lines:</strong> ${completedLines} / 12 &nbsp;|&nbsp;
    <strong>Status:</strong> ${isBingo ? '🏆 BINGO!' : `${completedLines === 0 ? 'No lines yet' : `${completedLines} line(s) complete`}`}
    ${stamps.length > 0 ? `<br/><strong>Stamped numbers:</strong> ${stamps.join(', ')}` : ''}
    <br/><small style="opacity:0.5">Stamps based on server-reported data</small>
  `;

  modal.hidden = false;
}

// ============================================================
// Admin actions
// ============================================================
async function adminPost(path, body) {
  const adminPassword = localStorage.getItem('contibingo_admin_pass') || '';
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, password: adminPassword })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============================================================
// View switching
// ============================================================
function showLoading(show) {
  document.getElementById('loading-overlay').hidden = !show;
}

function showView(viewId) {
  ['name-modal', 'admin-modal', 'player-view', 'admin-view'].forEach(id => {
    const el = document.getElementById(id);
    el.hidden = (id !== viewId);
  });
}

function showNameModal() {
  showView('name-modal');
  showLoading(false);
}

function showAdminModal() {
  showView('admin-modal');
  showLoading(false);
}

function showPlayerView(name) {
  document.getElementById('header-player-name').textContent = name;
  document.getElementById('card-player-name').textContent = name;
  showView('player-view');
  showLoading(false);
  refreshPlayerView();
}

function showAdminView() {
  showView('admin-view');
  showLoading(false);
  refreshAdminView();
}

// ============================================================
// Initialization
// ============================================================
async function loadInitialState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('Failed to load state');
    serverState = await res.json();
    applyTheme(serverState.theme);
    // Check stamp reset
    const serverVersion = serverState.stampResetVersion || 0;
    if (serverVersion > getLocalResetVersion()) {
      setLocalResetVersion(serverVersion);
      clearAllStamps();
    }
  } catch (e) {
    console.error('Failed to load state:', e);
  }
}

async function init() {
  showLoading(true);
  initSocket();
  await loadInitialState();

  const savedName = localStorage.getItem(NAME_KEY);
  if (!savedName) {
    showNameModal();
    return;
  }

  playerName = savedName;
  if (playerName.toLowerCase().trim() === ADMIN_NAME) {
    const adminAuth = localStorage.getItem(ADMIN_PASSWORD_KEY);
    if (adminAuth === 'true') {
      showAdminView();
    } else {
      showAdminModal();
    }
  } else {
    showPlayerView(playerName);
  }
}

// ============================================================
// Event Listeners
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Name form
  document.getElementById('name-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('name-input').value.trim();
    const errEl = document.getElementById('name-error');
    if (!input || input.split(/\s+/).filter(Boolean).length < 2) {
      errEl.textContent = 'Please enter your first and last name.';
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;
    playerName = input;
    localStorage.setItem(NAME_KEY, playerName);
    // Register with server
    try {
      await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName })
      });
    } catch (e) { /* silent */ }

    if (playerName.toLowerCase().trim() === ADMIN_NAME) {
      showAdminModal();
    } else {
      showPlayerView(playerName);
    }
  });

  // Admin password form
  document.getElementById('admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('admin-password-input').value;
    const errEl = document.getElementById('admin-error');
    // Validate with server
    try {
      const res = await fetch('/api/admin/call-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: [], password: pwd })
      });
      if (res.ok) {
        localStorage.setItem(ADMIN_PASSWORD_KEY, 'true');
        localStorage.setItem('contibingo_admin_pass', pwd);
        errEl.hidden = true;
        showAdminView();
      } else {
        errEl.hidden = false;
        document.getElementById('admin-password-input').value = '';
      }
    } catch (err) {
      errEl.textContent = 'Connection error. Try again.';
      errEl.hidden = false;
    }
  });

  document.getElementById('admin-back-btn').addEventListener('click', () => {
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(ADMIN_PASSWORD_KEY);
    playerName = null;
    showNameModal();
  });

  document.getElementById('admin-logout-btn').addEventListener('click', () => {
    localStorage.removeItem(ADMIN_PASSWORD_KEY);
    localStorage.removeItem('contibingo_admin_pass');
    localStorage.removeItem(NAME_KEY);
    playerName = null;
    showNameModal();
  });

  // Apply theme
  document.getElementById('apply-theme-btn').addEventListener('click', async () => {
    const theme = {
      bgColor:     document.getElementById('theme-bg').value,
      cardColor:   document.getElementById('theme-card').value,
      stampColor:  document.getElementById('theme-stamp').value,
      headerColor: document.getElementById('theme-header').value,
      textColor:   document.getElementById('theme-text').value,
      accentColor: document.getElementById('theme-accent').value,
    };
    try {
      await adminPost('/api/admin/set-theme', { theme });
    } catch (e) {
      alert('Failed to apply theme. Check admin credentials.');
    }
  });

  // Call single number
  document.getElementById('call-number-btn').addEventListener('click', async () => {
    const val = parseInt(document.getElementById('single-number-input').value, 10);
    if (!val || val < 1 || val > 75) {
      alert('Please enter a valid number between 1 and 75.');
      return;
    }
    try {
      await adminPost('/api/admin/call-numbers', { numbers: [val] });
      document.getElementById('single-number-input').value = '';
    } catch (e) {
      alert('Failed to call number.');
    }
  });

  // Call multiple numbers
  document.getElementById('call-multi-btn').addEventListener('click', async () => {
    const raw = document.getElementById('multi-number-input').value;
    const nums = raw.split(/[\s,]+/).map(s => parseInt(s, 10)).filter(n => !isNaN(n) && n >= 1 && n <= 75);
    if (nums.length === 0) {
      alert('No valid numbers found. Enter numbers between 1 and 75.');
      return;
    }
    try {
      await adminPost('/api/admin/call-numbers', { numbers: nums });
      document.getElementById('multi-number-input').value = '';
    } catch (e) {
      alert('Failed to call numbers.');
    }
  });

  // Clear all numbers
  document.getElementById('clear-numbers-btn').addEventListener('click', async () => {
    if (!confirm('Clear all called numbers and winners?')) return;
    try {
      await adminPost('/api/admin/clear-numbers', {});
    } catch (e) {
      alert('Failed to clear numbers.');
    }
  });

  // Reset stamps
  document.getElementById('reset-stamps-btn').addEventListener('click', async () => {
    if (!confirm('Reset ALL player stamps? This cannot be undone.')) return;
    try {
      await adminPost('/api/admin/reset-stamps', {});
    } catch (e) {
      alert('Failed to reset stamps.');
    }
  });

  // Player search
  document.getElementById('player-search').addEventListener('input', (e) => {
    filterAndRenderPlayers(e.target.value);
  });

  // Close player card modal
  document.getElementById('close-player-modal').addEventListener('click', () => {
    document.getElementById('player-card-modal').hidden = true;
  });
  document.getElementById('player-card-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('player-card-modal')) {
      document.getElementById('player-card-modal').hidden = true;
    }
  });

  // Start!
  init();
});
