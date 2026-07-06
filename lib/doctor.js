const fs = require('fs');
const path = require('path');
const { loadConfig, getConfig, getApiBase, getInstagramCredentialsStatus } = require('./config');
const { getHookStatus } = require('./claude-hooks');
const {
  getEnvPath,
  getInstallManifestPath,
  getPackageRoot,
  getPlayerDir,
  getServerPidPath,
} = require('./paths');
const {
  isPortInUse,
  isProcessRunning,
  readPidFile,
  httpGetJson,
} = require('./processManager');

function checkNodeVersion() {
  const major = parseInt(process.version.slice(1).split('.')[0], 10);
  if (major >= 18) {
    return { name: 'Node.js', status: 'pass', message: process.version };
  }
  return {
    name: 'Node.js',
    status: 'fail',
    message: `${process.version} — Node 18+ required`,
  };
}

function checkEnvFile() {
  const envPath = getEnvPath();
  if (fs.existsSync(envPath)) {
    return { name: 'Config', status: 'pass', message: envPath };
  }
  return {
    name: 'Config',
    status: 'fail',
    message: `Missing ${envPath} — run: reelio setup`,
  };
}

function checkInstallManifest() {
  const manifestPath = getInstallManifestPath();
  if (!fs.existsSync(manifestPath)) {
    return {
      name: 'Install manifest',
      status: 'warn',
      message: 'Missing install-manifest.json — re-run npm install',
    };
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (!manifest.playwrightOk) {
      return {
        name: 'Install manifest',
        status: 'fail',
        message: 'postinstall did not install Playwright Chromium',
      };
    }
    if (!manifest.playerOk) {
      return {
        name: 'Install manifest',
        status: 'warn',
        message: 'Player deps incomplete — cd player && npm install && npm run build',
      };
    }
    return {
      name: 'Install manifest',
      status: 'pass',
      message: `v${manifest.version} @ ${manifest.installedAt}`,
    };
  } catch (err) {
    return {
      name: 'Install manifest',
      status: 'warn',
      message: `Invalid manifest: ${err.message}`,
    };
  }
}

function checkInstagramCredentials() {
  const status = getInstagramCredentialsStatus();
  if (status.configured) {
    return {
      name: 'Instagram credentials',
      status: 'pass',
      message: status.envPath,
    };
  }
  return {
    name: 'Instagram credentials',
    status: 'fail',
    message: status.message.replace(/\n/g, ' '),
  };
}

function checkPlaywrightChromium() {
  const browsersPath = path.join(getPackageRoot(), 'node_modules', 'playwright-core', '.local-browsers');
  const cachePaths = [
    browsersPath,
    path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright'),
    path.join(process.env.HOME || '', '.cache', 'ms-playwright'),
  ];

  for (const cachePath of cachePaths) {
    if (fs.existsSync(cachePath)) {
      const entries = fs.readdirSync(cachePath, { withFileTypes: true });
      if (entries.some((e) => e.name.includes('chromium'))) {
        return { name: 'Playwright Chromium', status: 'pass', message: cachePath };
      }
    }
  }

  return {
    name: 'Playwright Chromium',
    status: 'fail',
    message: 'Chromium browser not found — run: npx playwright install chromium',
  };
}

function checkPlayerDist() {
  const distPath = path.join(getPlayerDir(), 'dist', 'index.html');
  if (fs.existsSync(distPath)) {
    return { name: 'Player build', status: 'pass', message: distPath };
  }
  return {
    name: 'Player build',
    status: 'fail',
    message: 'Missing player/dist — run: cd player && npm run build',
  };
}

function checkHooks() {
  const status = getHookStatus();
  if (status.installed) {
    return { name: 'Claude hooks', status: 'pass', message: status.settingsPath };
  }
  return {
    name: 'Claude hooks',
    status: 'warn',
    message: `Not fully installed — run: reelio hooks install (missing: ${status.missingEvents.join(', ')})`,
  };
}

async function checkPort() {
  loadConfig();
  const { port } = getConfig();
  const inUse = await isPortInUse(port);

  const serverPid = readPidFile(getServerPidPath());
  if (inUse && serverPid && isProcessRunning(serverPid)) {
    return {
      name: `Port ${port}`,
      status: 'pass',
      message: `In use by Reelio server (pid ${serverPid})`,
    };
  }

  if (inUse) {
    return {
      name: `Port ${port}`,
      status: 'warn',
      message: `Port ${port} in use by another process`,
    };
  }

  return {
    name: `Port ${port}`,
    status: 'pass',
    message: 'Available',
  };
}

async function checkServerStatus() {
  loadConfig();
  const apiBase = getApiBase();

  try {
    const status = await httpGetJson(`${apiBase}/api/status`);
    if (status.loggedIn) {
      return {
        name: 'Instagram session',
        status: 'pass',
        message: `Logged in · buffer=${status.bufferedCount}`,
      };
    }
    return {
      name: 'Instagram session',
      status: 'warn',
      message: 'Server running but not logged in — run: reelio login',
    };
  } catch {
    return {
      name: 'Instagram session',
      status: 'warn',
      message: 'Server not running — run: reelio start',
    };
  }
}

async function checkBuffer() {
  loadConfig();
  const apiBase = getApiBase();

  try {
    const buffer = await httpGetJson(`${apiBase}/api/buffer/status`);
    if (buffer.ready) {
      return {
        name: 'Reel buffer',
        status: 'pass',
        message: `${buffer.bufferedCount} reels buffered`,
      };
    }
    return {
      name: 'Reel buffer',
      status: 'warn',
      message: `Buffer empty (${buffer.bufferedCount}) — start server and wait for seed`,
    };
  } catch {
    return {
      name: 'Reel buffer',
      status: 'warn',
      message: 'Server not running — skipped',
    };
  }
}

function printResults(results) {
  for (const result of results) {
    const icon =
      result.status === 'pass' ? '✓' : result.status === 'warn' ? '!' : '✗';
    console.log(`  ${icon} ${result.name}: ${result.message}`);
  }
}

function summarize(results) {
  const fails = results.filter((r) => r.status === 'fail');
  const warns = results.filter((r) => r.status === 'warn');

  console.log('');
  if (fails.length === 0 && warns.length === 0) {
    console.log('All checks passed.');
    return 0;
  }
  if (fails.length === 0) {
    console.log(`${warns.length} warning(s).`);
    return 2;
  }
  console.log(`${fails.length} failure(s), ${warns.length} warning(s).`);
  console.log('\nSuggested next steps:');
  if (fails.some((r) => r.name === 'Config')) console.log('  reelio setup');
  if (fails.some((r) => r.name === 'Instagram credentials')) {
    console.log('  Edit ~/.reelio/.env — set IG_USERNAME and IG_PASSWORD');
    console.log('  reelio login');
  }
  if (fails.some((r) => r.name === 'Playwright Chromium')) {
    console.log('  npx playwright install chromium');
  }
  if (fails.some((r) => r.name === 'Player build')) {
    console.log('  cd player && npm run build');
  }
  if (warns.some((r) => r.name === 'Claude hooks')) console.log('  reelio hooks install');
  if (
    warns.some((r) => r.name === 'Instagram session') &&
    !fails.some((r) => r.name === 'Instagram credentials')
  ) {
    console.log('  reelio login');
  }
  if (warns.some((r) => r.name === 'Reel buffer' || r.name === 'Instagram session')) {
    console.log('  reelio start');
  }
  return 1;
}

async function runDoctor() {
  loadConfig();
  console.log('Reelio doctor\n');

  const results = [
    checkNodeVersion(),
    checkEnvFile(),
    checkInstagramCredentials(),
    checkInstallManifest(),
    checkPlaywrightChromium(),
    checkPlayerDist(),
    checkHooks(),
    await checkPort(),
    await checkServerStatus(),
    await checkBuffer(),
  ];

  printResults(results);
  return summarize(results);
}

module.exports = {
  runDoctor,
};
