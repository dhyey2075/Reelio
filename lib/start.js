const path = require('path');
const { spawn } = require('child_process');
const { loadConfig, getConfig, assertInstagramCredentialsForStart } = require('./config');
const {
  getPackageRoot,
  getPlayerDir,
  getServerPidPath,
  getPlayerPidPath,
} = require('./paths');
const {
  readPidFile,
  writePidFile,
  isProcessRunning,
  isPortInUse,
  waitForHttpOk,
} = require('./processManager');

function getElectronCommand() {
  const playerDir = getPlayerDir();
  const binName = process.platform === 'win32' ? 'electron.cmd' : 'electron';
  return path.join(playerDir, 'node_modules', '.bin', binName);
}

function buildServerEnv() {
  const config = getConfig();
  return {
    ...process.env,
    REELIO_HOME: config.reelioHome,
    PORT: String(config.port),
    SESSION_DIR: config.sessionDir,
    REELIO_API: config.reelioApi,
  };
}

async function startReelio({ foreground = false } = {}) {
  loadConfig();
  assertInstagramCredentialsForStart();
  const config = getConfig();
  const apiBase = config.reelioApi.replace(/\/$/, '');
  const statusUrl = `${apiBase}/api/status`;

  const existingServerPid = readPidFile(getServerPidPath());
  if (existingServerPid && isProcessRunning(existingServerPid)) {
    throw new Error(
      `Reelio server already running (pid ${existingServerPid}). Run: reelio stop`
    );
  }

  const portBusy = await isPortInUse(config.port);
  if (portBusy) {
    throw new Error(
      `Port ${config.port} is in use. Stop the other process or change PORT in ${config.envPath}`
    );
  }

  const packageRoot = getPackageRoot();
  const serverEntry = path.join(packageRoot, 'index.js');

  const server = spawn(process.execPath, [serverEntry], {
    cwd: packageRoot,
    env: buildServerEnv(),
    stdio: foreground ? 'inherit' : 'ignore',
    detached: !foreground,
  });

  if (!foreground) {
    server.unref();
  }

  writePidFile(getServerPidPath(), server.pid);
  console.log(`Reelio server starting (pid ${server.pid})...`);

  await waitForHttpOk(statusUrl, { timeoutMs: 120000 });
  console.log(`Reelio server ready at ${apiBase}`);

  const electronBin = getElectronCommand();
  const playerDir = getPlayerDir();
  const fs = require('fs');

  if (!fs.existsSync(electronBin)) {
    throw new Error(
      `Electron not found at ${electronBin}. Re-run npm install or: cd player && npm install`
    );
  }

  const player = spawn(electronBin, ['.'], {
    cwd: playerDir,
    env: {
      ...process.env,
      REELIO_API: apiBase,
    },
    stdio: foreground ? 'inherit' : 'ignore',
    detached: !foreground,
  });

  if (!foreground) {
    player.unref();
  }

  writePidFile(getPlayerPidPath(), player.pid);
  console.log(`Reelio player started (pid ${player.pid})`);

  if (foreground) {
    const shutdown = () => {
      console.log('\nShutting down Reelio...');
      try {
        server.kill('SIGTERM');
      } catch {
        // ignore
      }
      try {
        player.kill('SIGTERM');
      } catch {
        // ignore
      }
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    await new Promise(() => {});
  }

  return { serverPid: server.pid, playerPid: player.pid, apiBase };
}

module.exports = {
  startReelio,
};
