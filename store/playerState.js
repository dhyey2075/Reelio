const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_DIR = path.join(os.homedir(), '.reelio');
const STATE_FILE = path.join(STATE_DIR, 'player-state.json');

const DEFAULT_STATE = {
  mode: 'idle',
  reelId: null,
  currentTime: 0,
  cursor: null,
  window: 'expanded',
};

let state = { ...DEFAULT_STATE };
let pauseTimer = null;
let onPauseCallback = null;

const PAUSE_DEBOUNCE_MS = 500;

function ensureDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

function loadState() {
  try {
    ensureDir();
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      state = { ...DEFAULT_STATE, ...data };
      // Stale "playing" from a crashed/closed session should not auto-resume on reconnect
      if (state.mode === 'playing') {
        state.mode = 'paused';
        saveState();
      }
    }
  } catch (err) {
    console.warn('Failed to load player state:', err.message);
    state = { ...DEFAULT_STATE };
  }
  return state;
}

function saveState() {
  try {
    ensureDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.warn('Failed to save player state:', err.message);
  }
}

function getState() {
  return { ...state };
}

function updateState(partial) {
  state = { ...state, ...partial };
  saveState();
  return getState();
}

function cancelPendingPause() {
  if (pauseTimer) {
    clearTimeout(pauseTimer);
    pauseTimer = null;
  }
}

function setPauseCallback(fn) {
  onPauseCallback = fn;
}

function play({ keepAlive = false } = {}) {
  cancelPendingPause();

  if (keepAlive) {
    return updateState({ mode: 'playing', window: 'expanded' });
  }
  return updateState({
    mode: 'playing',
    window: 'expanded',
    reelId: null,
    currentTime: 0,
  });
}

function applyPause({ reelId, currentTime, cursor } = {}) {
  const updates = { mode: 'paused', window: 'mini' };
  if (reelId !== undefined) updates.reelId = reelId;
  if (currentTime !== undefined) updates.currentTime = currentTime;
  if (cursor !== undefined) updates.cursor = cursor;
  return updateState(updates);
}

function pause({ reelId, currentTime, cursor, force = false, debounceMs = PAUSE_DEBOUNCE_MS } = {}) {
  cancelPendingPause();

  if (force) {
    const nextState = applyPause({ reelId, currentTime, cursor });
    return { state: nextState, scheduled: false };
  }

  pauseTimer = setTimeout(() => {
    pauseTimer = null;
    const nextState = applyPause({ reelId, currentTime, cursor });
    if (onPauseCallback) {
      onPauseCallback(nextState);
    }
  }, debounceMs);

  return { state: getState(), scheduled: true };
}

loadState();

module.exports = {
  getState,
  play,
  pause,
  updateState,
  setPauseCallback,
  cancelPendingPause,
};
