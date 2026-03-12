'use strict';

// ============================================================
// Supabase Configuration
// ============================================================
const SUPABASE_URL = 'https://cwkglzaesqquqasgdedm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__F_Lg6g9x710yVg-ubCXNQ_Yfwf71LK';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
// Constants & State
// ============================================================
const ADMIN_NAME = 'aidan carter';
const ADMIN_PASSWORD = 'Pizza111';
const NAME_KEY = 'contibingo_name';
const ADMIN_AUTH_KEY = 'contibingo_admin_auth';
const STAMP_RESET_VERSION_KEY = 'contibingo_stamp_reset_version';

let playerName = null;
let isAdminView = false;
let calledNumbers = [];
let currentStampResetVersion = 0;

let adminPlayers = [];
let adminWinners = [];
let adminCalledNumbers = [];

let winMode = 'classic';
let customPattern = Array(25).fill(false);

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
  if (num >= 1 && num <= 15) return 'b';
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
// Stamps (localStorage + Supabase)
// ============================================================
function stampKey(name) {
  return `contibingo_stamps_${name.toLowerCase().trim()}`;
}

function getStamps(name) {
  try {
    return JSON.parse(localStorage.getItem(stampKey(name)) || '[]');
  } catch { return []; }
}

function saveStampsLocal(name, stamps) {
  localStorage.setItem(stampKey(name), JSON.stringify(stamps));
}

async function saveStamps(name, stamps) {
  saveStampsLocal(name, stamps);
  try {
    await db.from('players')
      .update({ stamps })
      .eq('name_lower', name.toLowerCase().trim());
  } catch (e) {
    console.warn('Could not sync stamps to Supabase:', e);
  }
}

function clearLocalStamps() {
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
function applyThemeFromDB(dbTheme) {
  if (!dbTheme) return;
  const root = document.documentElement;
  if (dbTheme.bg_color)     root.style.setProperty('--bg-color',     dbTheme.bg_color);
  if (dbTheme.card_color)   root.style.setProperty('--card-color',   dbTheme.card_color);
  if (dbTheme.stamp_color)  root.style.setProperty('--stamp-color',  dbTheme.stamp_color);
  if (dbTheme.header_color) root.style.setProperty('--header-color', dbTheme.header_color);
  if (dbTheme.text_color)   root.style.setProperty('--text-color',   dbTheme.text_color);
  if (dbTheme.accent_color) root.style.setProperty('--accent-color', dbTheme.accent_color);
}

function syncThemePickers(dbTheme) {
  if (!dbTheme) return;
  const map = {
    'theme-bg':     dbTheme.bg_color,
    'theme-card':   dbTheme.card_color,
    'theme-stamp':  dbTheme.stamp_color,
    'theme-header': dbTheme.header_color,
    'theme-text':   dbTheme.text_color,
    'theme-accent': dbTheme.accent_color,
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  });
}

// ============================================================
// Supabase Data Operations
// ============================================================
async function loadState() {
  let settingsRes = { data: null, error: null };
  try {
    settingsRes = await db.from('game_settings').select('win_mode, custom_pattern').eq('id', 1).single();
  } catch(e) {
    console.warn('game_settings table not found, using classic mode');
  }
  const [numbersRes, themeRes, playersRes, winnersRes, resetRes] = await Promise.all([
    db.from('called_numbers').select('number').order('created_at'),
    db.from('theme').select('*').eq('id', 1).single(),
    db.from('players').select('name, stamps').order('created_at'),
    db.from('winners').select('name').order('created_at'),
    db.from('stamp_resets').select('version').eq('id', 1).single(),
  ]);
  if (numbersRes.error) console.error('loadState: called_numbers error', numbersRes.error);
  if (themeRes.error) console.error('loadState: theme error', themeRes.error);
  if (playersRes.error) console.error('loadState: players error', playersRes.error);
  if (winnersRes.error) console.error('loadState: winners error', winnersRes.error);
  if (resetRes.error) console.error('loadState: stamp_resets error', resetRes.error);
  return {
    calledNumbers: (numbersRes.data || []).map(r => r.number),
    theme: themeRes.data || null,
    players: playersRes.data || [],
    winners: (winnersRes.data || []).map(r => r.name),
    stampResetVersion: (resetRes.data || {}).version || 0,
    winMode: (settingsRes.data && settingsRes.data.win_mode) || 'classic',
    customPattern: (settingsRes.data && settingsRes.data.custom_pattern) || Array(25).fill(false),
  };
}

async function registerPlayer(name) {
  await db.from('players').upsert({
    name: name.trim(),
    name_lower: name.toLowerCase().trim(),
    stamps: [],
  }, { onConflict: 'name_lower', ignoreDuplicates: true });
}

async function reportWin(name) {
  await db.from('winners').upsert({ name: name.trim() }, { onConflict: 'name', ignoreDuplicates: true });
}

async function adminCallNumbers(numbers) {
  const rows = numbers.map(n => ({ number: n }));
  const { error } = await db.from('called_numbers').upsert(rows, { onConflict: 'number', ignoreDuplicates: true });
  return error;
}

async function adminClearNumbers() {
  await db.from('called_numbers').delete().neq('id', 0);
  await db.from('winners').delete().neq('id', 0);
}

async function adminResetStamps() {
  const { data } = await db.from('stamp_resets').select('version').eq('id', 1).single();
  const newVersion = ((data && data.version) || 0) + 1;
  await db.from('stamp_resets').update({ version: newVersion }).eq('id', 1);
  await db.from('players').update({ stamps: [] }).neq('id', 0);
}

async function adminSetTheme(theme) {
  await db.from('theme').update({
    bg_color:     theme.bgColor,
    card_color:   theme.cardColor,
    stamp_color:  theme.stampColor,
    header_color: theme.headerColor,
    text_color:   theme.textColor,
    accent_color: theme.accentColor,
  }).eq('id', 1);
}

async function adminSaveWinMode(mode, pattern) {
  await db.from('game_settings').update({
    win_mode: mode,
    custom_pattern: pattern,
  }).eq('id', 1);
}

// ============================================================
// Bingo Win Detection
// ============================================================
function checkBingo(card, stamps, mode, pattern) {
  mode = mode || winMode;
  pattern = pattern || customPattern;
  const stamped = new Set(stamps);
  const flat = card.flat();

  if (mode === 'blackout') {
    return flat.every(n => n === 0 || stamped.has(n));
  }
  if (mode === 'x') {
    const diag1 = [0,1,2,3,4].every(i => flat[i*5+i] === 0 || stamped.has(flat[i*5+i]));
    const diag2 = [0,1,2,3,4].every(i => flat[i*5+(4-i)] === 0 || stamped.has(flat[i*5+(4-i)]));
    return diag1 && diag2;
  }
  if (mode === 'custom') {
    return pattern.every((active, idx) => {
      if (!active) return true;
      const n = flat[idx];
      return n === 0 || stamped.has(n);
    });
  }
  // classic: any row, col, or either diagonal
  for (let r = 0; r < 5; r++) {
    if (card[r].every(n => n === 0 || stamped.has(n))) return true;
  }
  for (let c = 0; c < 5; c++) {
    if (card.map(row => row[c]).every(n => n === 0 || stamped.has(n))) return true;
  }
  if ([0,1,2,3,4].every(i => card[i][i] === 0 || stamped.has(card[i][i]))) return true;
  if ([0,1,2,3,4].every(i => card[i][4-i] === 0 || stamped.has(card[i][4-i]))) return true;
  return false;
}

function countLines(card, stamps) {
  const stamped = new Set(stamps);
  let lines = 0;
  for (let r = 0; r < 5; r++) {
    if (card[r].every(n => n === 0 || stamped.has(n))) lines++;
  }
  for (let c = 0; c < 5; c++) {
    if (card.map(row => row[c]).every(n => n === 0 || stamped.has(n))) lines++;
  }
  if ([0,1,2,3,4].every(i => card[i][i] === 0 || stamped.has(card[i][i]))) lines++;
  if ([0,1,2,3,4].every(i => card[i][4-i] === 0 || stamped.has(card[i][4-i]))) lines++;
  return lines;
}

// ============================================================
// Render Bingo Card
// ============================================================
function renderCard(container, card, stamps, calledNums, clickable) {
  const stamped = new Set(stamps);
  const called  = new Set(calledNums);
  container.innerHTML = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const num = card[r][c];
      const cell = document.createElement('div');
      cell.className = 'bingo-cell';
      const isFree = (num === 0);
      if (isFree) {
        cell.classList.add('free', 'stamped');
        cell.innerHTML = '<span class="cell-number">FREE</span>';
      } else {
        cell.innerHTML = `<span class="cell-number">${num}</span>`;
        if (stamped.has(num)) cell.classList.add('stamped');
        if (called.has(num)) {
          cell.classList.add('callable');
          if (!stamped.has(num)) cell.classList.add('called-highlight');
          if (clickable) {
            cell.addEventListener('click', () => onCellClick(num, card));
          }
        } else {
          cell.classList.add('uncallable');
        }
      }
      container.appendChild(cell);
    }
  }
}

function onCellClick(num, card) {
  const stamps = getStamps(playerName);
  const idx = stamps.indexOf(num);
  if (idx === -1) {
    stamps.push(num);
  } else {
    stamps.splice(idx, 1);
  }
  saveStamps(playerName, stamps);
  rerenderCard(card, stamps);
  if (checkBingo(card, stamps)) {
    showWinOverlay(playerName);
    reportWin(playerName);
  }
}

function rerenderCard(card, stamps) {
  const container = document.getElementById('bingo-card');
  if (!container) return;
  renderCard(container, card, stamps, calledNumbers, true);
}

// ============================================================
// Called Numbers Display
// ============================================================
function updateCalledNumbersDisplay(nums, containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  nums.slice().sort((a, b) => a - b).forEach(num => {
    const badge = document.createElement('span');
    const col = getColumnClass(num);
    badge.className = `number-badge badge-${col}`;
    badge.textContent = num;
    el.appendChild(badge);
  });
}

// ============================================================
// Views
// ============================================================
function hideAll() {
  document.getElementById('loading-overlay').hidden = true;
  document.getElementById('name-modal').hidden = true;
  document.getElementById('admin-modal').hidden = true;
  document.getElementById('player-view').hidden = true;
  document.getElementById('admin-view').hidden = true;
}

function showNameModal() {
  hideAll();
  document.getElementById('name-entry-step').hidden = false;
  document.getElementById('name-confirm-step').hidden = true;
  document.getElementById('name-modal').hidden = false;
}

function showAdminModal() {
  hideAll();
  document.getElementById('admin-modal').hidden = false;
}

async function showPlayerView(name) {
  hideAll();
  isAdminView = false;
  playerName = name;
  document.getElementById('header-player-name').textContent = name;
  document.getElementById('card-player-name').textContent = name;
  document.getElementById('player-view').hidden = false;

  // Register player and load state
  await registerPlayer(name);
  const state = await loadState();
  calledNumbers = state.calledNumbers;
  currentStampResetVersion = state.stampResetVersion;
  winMode = state.winMode;
  customPattern = state.customPattern;
  if (state.theme) applyThemeFromDB(state.theme);

  // Handle stamp reset
  const localVersion = getLocalResetVersion();
  if (state.stampResetVersion > localVersion) {
    clearLocalStamps();
    setLocalResetVersion(state.stampResetVersion);
  }

  const stamps = getStamps(name);
  const card = generateCard(name);
  rerenderCard(card, stamps);
  updateCalledNumbersDisplay(calledNumbers, 'called-numbers-display');
  updateWinModeDisplay();

  subscribeToRealtime(card);
}

async function showAdminView() {
  hideAll();
  isAdminView = true;
  document.getElementById('admin-view').hidden = false;

  const state = await loadState();
  calledNumbers = state.calledNumbers;
  adminPlayers = state.players;
  adminWinners = state.winners;
  adminCalledNumbers = state.calledNumbers;
  winMode = state.winMode;
  customPattern = state.customPattern;
  if (state.theme) {
    applyThemeFromDB(state.theme);
    syncThemePickers(state.theme);
  }
  updateCalledNumbersDisplay(calledNumbers, 'admin-called-numbers');
  renderWinners(state.winners);
  renderPlayerList(adminPlayers, adminWinners, adminCalledNumbers);
  initWinModeSelector();

  subscribeToRealtimeAdmin();
}

function renderMiniCard(name, stamps, calledNums) {
  const card = generateCard(name);
  const stamped = new Set(stamps);
  const called = new Set(calledNums);
  const grid = document.createElement('div');
  grid.className = 'player-mini-card';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const num = card[r][c];
      const cell = document.createElement('div');
      cell.className = 'player-mini-cell';
      const isFree = (num === 0);
      if (isFree) {
        cell.classList.add('mini-free', 'mini-stamped');
        cell.innerHTML = '<span class="mini-cell-num" style="font-size:0.45rem;">★</span>';
      } else {
        cell.innerHTML = `<span class="mini-cell-num">${num}</span>`;
        if (stamped.has(num)) {
          cell.classList.add('mini-stamped');
        } else if (called.has(num)) {
          cell.classList.add('mini-called');
        } else {
          cell.classList.add('mini-uncalled');
        }
      }
      grid.appendChild(cell);
    }
  }
  return grid;
}

async function adminDeletePlayer(nameLower) {
  await db.from('players').delete().eq('name_lower', nameLower);
}

// ============================================================
// Admin — Player Monitor
// ============================================================
function renderPlayerList(players, winners, nums) {
  const list = document.getElementById('player-list');
  if (!list) return;
  const winnerSet = new Set((winners || []).map(w => w.toLowerCase()));
  list.innerHTML = '';

  const countEl = document.createElement('p');
  countEl.style.cssText = 'font-size:0.8rem;opacity:0.6;margin-bottom:0.5rem;';
  countEl.textContent = `${players.length} player${players.length !== 1 ? 's' : ''} registered`;
  if (players.length > 0) list.appendChild(countEl);

  if (players.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'opacity:0.5;font-size:0.9rem;';
    empty.textContent = 'No players yet.';
    list.appendChild(empty);
    return;
  }
  players.forEach(p => {
    const isWinner = winnerSet.has(p.name.toLowerCase());
    const item = document.createElement('div');
    item.className = 'player-item' + (isWinner ? ' bingo-winner' : '');

    const initials = p.name.split(' ').slice(0,2).map(w => w.charAt(0)).join('').toUpperCase();

    // Header row (avatar + name + delete button)
    const header = document.createElement('div');
    header.className = 'player-item-header';
    header.innerHTML = `<span class="player-avatar">${initials}</span><span class="player-name">${(isWinner ? '🏆 ' : '') + p.name}</span>`;
    header.addEventListener('click', () => showPlayerCardModal(p.name, p.stamps || [], nums));

    const delBtn = document.createElement('button');
    delBtn.className = 'player-delete-btn';
    delBtn.textContent = '🗑️ Delete';
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete card for ${p.name}? They will be sent back to the login screen.`)) return;
      const nameLower = p.name.toLowerCase().trim();
      await adminDeletePlayer(nameLower);
      adminPlayers = adminPlayers.filter(pl => pl.name.toLowerCase().trim() !== nameLower);
      renderPlayerList(adminPlayers, adminWinners, adminCalledNumbers);
    });
    header.appendChild(delBtn);
    item.appendChild(header);

    // Mini card preview
    item.appendChild(renderMiniCard(p.name, p.stamps || [], nums || []));

    list.appendChild(item);
  });
}

async function refreshPlayerMonitor() {
  const state = await loadState();
  adminPlayers = state.players;
  adminWinners = state.winners;
  adminCalledNumbers = state.calledNumbers;
  renderPlayerList(adminPlayers, adminWinners, adminCalledNumbers);
  renderWinners(adminWinners);
}

function renderWinners(winners) {
  const el = document.getElementById('admin-winners');
  if (!el) return;
  el.innerHTML = '';
  if (!winners || winners.length === 0) {
    el.innerHTML = '<p style="opacity:0.5;font-size:0.9rem;">No winners yet.</p>';
    return;
  }
  winners.forEach(name => {
    const item = document.createElement('div');
    item.className = 'winner-item';
    item.innerHTML = `<span class="winner-item-trophy">🏆</span><span>${name}</span>`;
    el.appendChild(item);
  });
}

function showWinnerAlert(name) {
  const el = document.getElementById('admin-winners');
  if (!el) return;
  // A simple flash alert at top of winners section
  const alert = document.createElement('div');
  alert.style.cssText = 'background:#f1c40f;color:#000;padding:0.75rem 1rem;border-radius:8px;font-weight:700;margin-bottom:0.5rem;animation:badgeSlideIn 0.3s ease';
  alert.textContent = `🎉 Winner detected: ${name}!`;
  el.insertBefore(alert, el.firstChild);
  setTimeout(() => alert.remove(), 8000);
}

function showPlayerCardModal(name, stamps, nums) {
  const card = generateCard(name);
  const modal = document.getElementById('player-card-modal');
  document.getElementById('modal-player-name-title').textContent = name;
  const cardContainer = document.getElementById('modal-bingo-card');
  renderCard(cardContainer, card, stamps, nums, false);

  // Stats
  const statsEl = document.getElementById('modal-player-stats');
  const stamped = new Set(stamps);
  const lines = countLines(card, stamps);
  const totalCallable = card.flat().filter(n => n !== 0 && new Set(nums).has(n)).length;
  const totalStamped = card.flat().filter(n => n !== 0 && stamped.has(n)).length;
  const hasBingo = checkBingo(card, stamps);
  statsEl.innerHTML = `
    <div>Stamped: ${totalStamped} / ${totalCallable} callable numbers</div>
    <div>Lines: ${lines} / 12</div>
    <div>Status: ${hasBingo ? '🏆 BINGO!' : lines >= 3 ? '🔥 Near bingo!' : '🎯 Playing'}</div>
  `;

  modal.hidden = false;
}

// ============================================================
// Win Overlay (player)
// ============================================================
function showWinOverlay(name) {
  const overlay = document.getElementById('win-overlay');
  document.getElementById('win-player-name').textContent = name;
  overlay.hidden = false;
}

// ============================================================
// Win Mode Display
// ============================================================
function updateWinModeDisplay() {
  const el = document.getElementById('win-mode-display');
  if (!el) return;
  const labels = {
    classic: '🎯 Classic (Lines)',
    x: '❌ X Pattern',
    blackout: '⬛ Blackout',
    custom: '🖊️ Custom Pattern',
  };
  el.textContent = labels[winMode] || labels.classic;

  const preview = document.getElementById('win-pattern-preview');
  if (!preview) return;
  if (winMode !== 'custom') {
    preview.hidden = true;
    return;
  }
  preview.hidden = false;
  preview.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    const isFree = (i === 12);
    cell.className = 'pattern-preview-cell';
    if (isFree) {
      cell.classList.add('pattern-preview-free');
      cell.textContent = '★';
    } else if (customPattern[i]) {
      cell.classList.add('pattern-preview-active');
    }
    preview.appendChild(cell);
  }
}

function getWinPatternCells() {
  if (winMode === 'blackout') return Array.from({length:25}, (_, i) => i);
  if (winMode === 'x') return [0,6,12,18,24, 4,8,12,16,20];
  if (winMode === 'custom') return customPattern.map((v, i) => v ? i : null).filter(i => i !== null);
  return null;
}

// ============================================================
// Admin — Call Random Number
// ============================================================
async function adminCallRandom() {
  const remaining = [];
  for (let i = 1; i <= 75; i++) {
    if (!calledNumbers.includes(i)) remaining.push(i);
  }
  if (remaining.length === 0) {
    alert('All 75 numbers have been called!');
    return;
  }
  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  await adminCallNumbers([pick]);
  const state = await loadState();
  calledNumbers = state.calledNumbers;
  adminCalledNumbers = calledNumbers;
  updateCalledNumbersDisplay(calledNumbers, 'admin-called-numbers');
  showCalledNumberToast(pick);
}

function showCalledNumberToast(num) {
  const col = getColumnClass(num);
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'called-number-toast';
  toast.innerHTML = `<span class="toast-label">Called!</span><span class="toast-number badge-${col}">${num}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

function showSaveToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'called-number-toast';
  toast.innerHTML = `<span class="toast-label" style="font-size:1rem;opacity:1;">${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 400);
  }, 2500);
}

// ============================================================
// Admin — Win Mode Selector
// ============================================================
function initWinModeSelector() {
  const cards = document.querySelectorAll('#win-mode-selector .win-mode-card');
  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      winMode = card.dataset.mode;
      const editor = document.getElementById('custom-pattern-editor');
      if (editor) editor.style.display = winMode === 'custom' ? 'block' : 'none';
    });
  });

  // Set active card based on current winMode
  cards.forEach(card => {
    card.classList.toggle('active', card.dataset.mode === winMode);
  });
  const editor = document.getElementById('custom-pattern-editor');
  if (editor) editor.style.display = winMode === 'custom' ? 'block' : 'none';

  renderCustomPatternGrid();
}

function renderCustomPatternGrid() {
  const grid = document.getElementById('custom-pattern-grid');
  if (!grid) return;
  const cols = ['B','I','N','G','O'];
  grid.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement('div');
    cell.className = 'bingo-cell pattern-cell' + (customPattern[i] ? ' pattern-active' : '');
    const row = Math.floor(i / 5);
    const col = i % 5;
    const isFree = (row === 2 && col === 2);
    if (isFree) {
      cell.classList.add('free');
      cell.innerHTML = '<span class="cell-number">FREE</span>';
    } else {
      cell.innerHTML = `<span class="cell-number">${cols[col]}${row + 1}</span>`;
      cell.addEventListener('click', () => {
        customPattern[i] = !customPattern[i];
        cell.classList.toggle('pattern-active', customPattern[i]);
      });
    }
    grid.appendChild(cell);
  }
}

// ============================================================
// Realtime Subscriptions
// ============================================================
function subscribeToRealtime(card) {
  db.channel('called_numbers_ch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'called_numbers' }, async () => {
      const state = await loadState();
      calledNumbers = state.calledNumbers;
      updateCalledNumbersDisplay(calledNumbers, 'called-numbers-display');
      const stamps = getStamps(playerName);
      rerenderCard(card, stamps);
    })
    .subscribe();

  db.channel('theme_ch')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'theme' }, (payload) => {
      applyThemeFromDB(payload.new);
    })
    .subscribe();

  db.channel('stamp_resets_ch')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stamp_resets' }, (payload) => {
      const serverVersion = payload.new.version;
      const localVersion = getLocalResetVersion();
      if (serverVersion > localVersion) {
        clearLocalStamps();
        setLocalResetVersion(serverVersion);
        const stamps = getStamps(playerName); // will be empty now
        rerenderCard(card, stamps);
      }
    })
    .subscribe();

  db.channel('game_settings_ch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_settings' }, (payload) => {
      winMode = payload.new.win_mode || 'classic';
      customPattern = payload.new.custom_pattern || Array(25).fill(false);
      updateWinModeDisplay();
    })
    .subscribe();

  db.channel('player_deleted_ch')
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'players' }, (payload) => {
      if (!playerName) return;
      if (payload.old && payload.old.name_lower === playerName.toLowerCase().trim()) {
        localStorage.removeItem(NAME_KEY);
        clearLocalStamps();
        showNameModal();
      }
    })
    .subscribe();
}

function subscribeToRealtimeAdmin() {
  db.channel('called_numbers_admin_ch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'called_numbers' }, async () => {
      const state = await loadState();
      calledNumbers = state.calledNumbers;
      updateCalledNumbersDisplay(calledNumbers, 'admin-called-numbers');
    })
    .subscribe();

  db.channel('theme_admin_ch')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'theme' }, (payload) => {
      applyThemeFromDB(payload.new);
      syncThemePickers(payload.new);
    })
    .subscribe();

  db.channel('winners_admin_ch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'winners' }, (payload) => {
      showWinnerAlert(payload.new.name);
      refreshPlayerMonitor();
    })
    .subscribe();

  db.channel('players_admin_ch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, async () => {
      await refreshPlayerMonitor();
    })
    .subscribe();

  db.channel('game_settings_admin_ch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'game_settings' }, (payload) => {
      winMode = payload.new.win_mode || 'classic';
      customPattern = payload.new.custom_pattern || Array(25).fill(false);
    })
    .subscribe();
}

// ============================================================
// DOM Event Handlers
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Show loading
  document.getElementById('loading-overlay').hidden = false;

  // Name form
  let pendingName = null;
  document.getElementById('name-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const raw = document.getElementById('name-input').value.trim();
    const errorEl = document.getElementById('name-error');
    errorEl.hidden = true;

    const parts = raw.trim().split(/\s+/);
    if (parts.length < 2) {
      errorEl.textContent = 'Please enter your first and last name.';
      errorEl.hidden = false;
      return;
    }

    pendingName = raw.trim();
    document.getElementById('confirm-name-text').textContent = pendingName;
    document.getElementById('name-entry-step').hidden = true;
    document.getElementById('name-confirm-step').hidden = false;
  });

  document.getElementById('confirm-name-yes-btn').addEventListener('click', async () => {
    if (!pendingName) return;
    const name = pendingName;
    pendingName = null;
    localStorage.setItem(NAME_KEY, name);
    if (name.toLowerCase() === ADMIN_NAME) {
      showAdminModal();
    } else {
      await showPlayerView(name);
    }
  });

  document.getElementById('confirm-name-back-btn').addEventListener('click', () => {
    pendingName = null;
    document.getElementById('name-confirm-step').hidden = true;
    document.getElementById('name-entry-step').hidden = false;
  });

  // Admin password form
  document.getElementById('admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('admin-password-input').value;
    const errorEl = document.getElementById('admin-error');
    if (pw !== ADMIN_PASSWORD) {
      errorEl.hidden = false;
      document.getElementById('admin-password-input').value = '';
      return;
    }
    errorEl.hidden = true;
    localStorage.setItem(ADMIN_AUTH_KEY, '1');
    await showAdminView();
  });

  // Admin back button
  document.getElementById('admin-back-btn').addEventListener('click', () => {
    localStorage.removeItem(NAME_KEY);
    showNameModal();
  });

  // Admin logout
  document.getElementById('admin-logout-btn').addEventListener('click', () => {
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(ADMIN_AUTH_KEY);
    location.reload();
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
    await adminSetTheme(theme);
    applyThemeFromDB({
      bg_color: theme.bgColor, card_color: theme.cardColor,
      stamp_color: theme.stampColor, header_color: theme.headerColor,
      text_color: theme.textColor, accent_color: theme.accentColor,
    });
  });

  // Call random number
  document.getElementById('call-random-btn').addEventListener('click', async () => {
    await adminCallRandom();
  });

  // Call single number
  document.getElementById('call-number-btn').addEventListener('click', async () => {
    const val = parseInt(document.getElementById('single-number-input').value, 10);
    if (!val || val < 1 || val > 75) return;
    await adminCallNumbers([val]);
    document.getElementById('single-number-input').value = '';
    const state = await loadState();
    calledNumbers = state.calledNumbers;
    updateCalledNumbersDisplay(calledNumbers, 'admin-called-numbers');
  });

  // Call multiple numbers
  document.getElementById('call-multi-btn').addEventListener('click', async () => {
    const raw = document.getElementById('multi-number-input').value;
    const nums = raw.split(/[\s,]+/)
      .map(s => parseInt(s, 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= 75);
    if (nums.length === 0) return;
    await adminCallNumbers(nums);
    document.getElementById('multi-number-input').value = '';
    const state = await loadState();
    calledNumbers = state.calledNumbers;
    updateCalledNumbersDisplay(calledNumbers, 'admin-called-numbers');
  });

  // Clear all numbers
  document.getElementById('clear-numbers-btn').addEventListener('click', async () => {
    if (!confirm('Clear all called numbers and winners?')) return;
    await adminClearNumbers();
    calledNumbers = [];
    updateCalledNumbersDisplay([], 'admin-called-numbers');
    renderWinners([]);
  });

  // Reset stamps
  document.getElementById('reset-stamps-btn').addEventListener('click', async () => {
    if (!confirm('Reset ALL player stamps? This cannot be undone.')) return;
    await adminResetStamps();
  });

  // Refresh players button
  document.getElementById('refresh-players-btn').addEventListener('click', async () => {
    await refreshPlayerMonitor();
  });

  // Save win mode
  document.getElementById('save-win-mode-btn').addEventListener('click', async () => {
    await adminSaveWinMode(winMode, customPattern);
    showSaveToast('✓ Win condition saved!');
  });

  // Close player card modal
  document.getElementById('close-player-modal').addEventListener('click', () => {
    document.getElementById('player-card-modal').hidden = true;
  });

  // ---- Initialization Flow ----
  const savedName = localStorage.getItem(NAME_KEY);
  if (!savedName) {
    hideAll();
    document.getElementById('name-modal').hidden = false;
    return;
  }

  if (savedName.toLowerCase() === ADMIN_NAME) {
    const isAuthed = localStorage.getItem(ADMIN_AUTH_KEY);
    if (isAuthed) {
      await showAdminView();
    } else {
      hideAll();
      document.getElementById('admin-modal').hidden = false;
    }
  } else {
    await showPlayerView(savedName);
  }
});
