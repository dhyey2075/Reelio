#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ensureReelioHome,
  getPackageRoot,
  getInstallManifestPath,
  getPlayerDir,
} = require('../lib/paths');

const packageRoot = getPackageRoot();
const packageJson = require(path.join(packageRoot, 'package.json'));

function log(msg) {
  console.log(`[reelio postinstall] ${msg}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: options.cwd || packageRoot,
    env: { ...process.env, ...options.env },
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function ensureSessionDir() {
  const home = ensureReelioHome();
  const sessionDir = path.join(home, 'session');
  fs.mkdirSync(sessionDir, { recursive: true });
  return home;
}

function installPlaywrightChromium() {
  if (process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1') {
    log('Skipping Playwright Chromium (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)');
    return true;
  }

  log('Installing Playwright Chromium (required for Instagram session)...');
  try {
    run('npx', ['playwright', 'install', 'chromium']);
    return true;
  } catch (err) {
    console.error(
      '[reelio postinstall] Failed to install Playwright Chromium.\n' +
        '  Check network connectivity and disk space, then run:\n' +
        '    npx playwright install chromium\n' +
        `  Error: ${err.message}`
    );
    return false;
  }
}

function playerDistExists() {
  return fs.existsSync(path.join(getPlayerDir(), 'dist', 'index.html'));
}

function playerElectronExists() {
  const electronPath = path.join(getPlayerDir(), 'node_modules', 'electron');
  return fs.existsSync(electronPath);
}

function installPlayerDeps() {
  const playerDir = getPlayerDir();

  if (!fs.existsSync(path.join(playerDir, 'package.json'))) {
    log('Player package.json not found — skipping player deps');
    return false;
  }

  if (playerElectronExists() && playerDistExists()) {
    log('Player Electron + dist already present — skipping player install');
    return true;
  }

  log('Installing player dependencies (Electron)...');
  try {
    run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: playerDir });

    if (!playerDistExists()) {
      log('Player dist missing — installing dev deps and building UI...');
      run('npm', ['install', '--no-audit', '--no-fund'], { cwd: playerDir });
      run('npm', ['run', 'build'], { cwd: playerDir });
    }

    return playerDistExists() && playerElectronExists();
  } catch (err) {
    console.error(
      '[reelio postinstall] Failed to install player dependencies.\n' +
        '  From the reelio package directory run:\n' +
        '    cd player && npm install && npm run build\n' +
        `  Error: ${err.message}`
    );
    return false;
  }
}

function writeManifest({ playwrightOk, playerOk }) {
  const manifest = {
    version: packageJson.version,
    playwrightOk,
    playerOk,
    installedAt: new Date().toISOString(),
  };

  fs.writeFileSync(getInstallManifestPath(), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function main() {
  log(`Reelio v${packageJson.version} — first-install setup`);

  ensureSessionDir();

  const playwrightOk = installPlaywrightChromium();
  const playerOk = installPlayerDeps();

  const manifest = writeManifest({ playwrightOk, playerOk });

  if (!playwrightOk) {
    process.exit(1);
  }

  if (!playerOk) {
    log('Warning: player not fully ready — run `cd player && npm install && npm run build` or reinstall');
  }

  log(`Done. manifest: ${JSON.stringify(manifest)}`);
}

main();
