const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { getReelioHome, getEnvPath } = require('./paths');

const PLACEHOLDER_VALUES = new Set([
  'your_instagram_username',
  'your_instagram_password',
  'your_username',
  'your_password',
  'changeme',
  'password',
  'username',
]);

let loaded = false;

function loadConfig() {
  if (loaded) {
    return;
  }

  const userEnv = getEnvPath();
  const cwdEnv = path.join(process.cwd(), '.env');

  if (fs.existsSync(userEnv)) {
    dotenv.config({ path: userEnv });
  } else if (fs.existsSync(cwdEnv)) {
    dotenv.config({ path: cwdEnv });
  }

  if (!process.env.REELIO_HOME) {
    process.env.REELIO_HOME = getReelioHome();
  }

  loaded = true;
}

function getConfig() {
  loadConfig();

  const reelioHome = getReelioHome();
  const port = parseInt(process.env.PORT, 10) || 3001;
  const sessionDir = process.env.SESSION_DIR
    ? path.resolve(process.env.SESSION_DIR)
    : path.join(reelioHome, 'session');

  return {
    reelioHome,
    port,
    sessionDir,
    headless: process.env.HEADLESS !== 'false',
    reelsPerPage: parseInt(process.env.REELS_PER_PAGE, 10) || 12,
    reelBufferMin: parseInt(process.env.REEL_BUFFER_MIN, 10) || 12,
    reelPrefetchThreshold: parseInt(process.env.REEL_PREFETCH_THRESHOLD, 10) || 3,
    reelStartupSeed: parseInt(process.env.REEL_STARTUP_SEED, 10) || 12,
    reelioApi: process.env.REELIO_API || `http://localhost:${port}`,
    igUsername: process.env.IG_USERNAME || null,
    igPassword: process.env.IG_PASSWORD || null,
    envPath: getEnvPath(),
  };
}

function getApiBase() {
  const { port, reelioApi } = getConfig();
  return reelioApi.replace(/\/$/, '') || `http://localhost:${port}`;
}

function getWsUrl() {
  const apiBase = getApiBase();
  const url = new URL(apiBase);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function isPlaceholderCredential(value) {
  if (value == null) {
    return true;
  }
  const trimmed = String(value).trim();
  if (!trimmed) {
    return true;
  }
  return PLACEHOLDER_VALUES.has(trimmed.toLowerCase());
}

function hasSavedSession(sessionDir) {
  if (!sessionDir || !fs.existsSync(sessionDir)) {
    return false;
  }

  const markers = [
    path.join(sessionDir, 'Default', 'Cookies'),
    path.join(sessionDir, 'Default', 'Network Persistent State'),
    path.join(sessionDir, 'Local State'),
  ];

  return markers.some((marker) => fs.existsSync(marker));
}

function getInstagramCredentialsStatus() {
  loadConfig();
  const config = getConfig();
  const envPath = config.envPath;
  const username = config.igUsername;
  const password = config.igPassword;

  if (!fs.existsSync(envPath)) {
    return {
      configured: false,
      reason: 'missing-env',
      message: `Missing ${envPath} — run: reelio setup`,
      envPath,
    };
  }

  const usernamePlaceholder = isPlaceholderCredential(username);
  const passwordPlaceholder = isPlaceholderCredential(password);

  if (usernamePlaceholder && passwordPlaceholder) {
    return {
      configured: false,
      reason: 'placeholder',
      message:
        `Instagram credentials are still placeholders in ${envPath}\n` +
        '  Set IG_USERNAME and IG_PASSWORD to your real Instagram login.',
      envPath,
    };
  }

  if (usernamePlaceholder) {
    return {
      configured: false,
      reason: 'placeholder-username',
      message: `IG_USERNAME is still a placeholder in ${envPath} — set your real Instagram username.`,
      envPath,
    };
  }

  if (passwordPlaceholder) {
    return {
      configured: false,
      reason: 'placeholder-password',
      message: `IG_PASSWORD is still a placeholder in ${envPath} — set your real Instagram password.`,
      envPath,
    };
  }

  return { configured: true, envPath };
}

function assertInstagramCredentialsForLogin() {
  const status = getInstagramCredentialsStatus();
  if (!status.configured) {
    throw new Error(`${status.message}\n\nThen run: reelio login`);
  }
}

function assertInstagramCredentialsForStart() {
  const status = getInstagramCredentialsStatus();
  if (status.configured) {
    return;
  }

  const { sessionDir } = getConfig();
  if (hasSavedSession(sessionDir)) {
    console.warn(`Warning: ${status.message}`);
    console.warn('Continuing with saved browser session in', sessionDir);
    return;
  }

  throw new Error(`${status.message}\n\nThen run: reelio login`);
}

module.exports = {
  loadConfig,
  getConfig,
  getApiBase,
  getWsUrl,
  isPlaceholderCredential,
  hasSavedSession,
  getInstagramCredentialsStatus,
  assertInstagramCredentialsForLogin,
  assertInstagramCredentialsForStart,
};
