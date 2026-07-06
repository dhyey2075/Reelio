const fs = require('fs');
const os = require('os');
const path = require('path');

function getReelioHome() {
  return process.env.REELIO_HOME || path.join(os.homedir(), '.reelio');
}

function getPackageRoot() {
  return path.resolve(__dirname, '..');
}

function getBundledHooksDir() {
  return path.join(getPackageRoot(), 'hooks');
}

function getInstalledHooksDir() {
  return path.join(getReelioHome(), 'hooks');
}

function getClaudeGlobalSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function getEnvPath() {
  return path.join(getReelioHome(), '.env');
}

function ensureReelioHome() {
  const home = getReelioHome();
  if (!fs.existsSync(home)) {
    fs.mkdirSync(home, { recursive: true });
  }
  return home;
}

function getSessionDir() {
  if (process.env.SESSION_DIR) {
    return path.resolve(process.env.SESSION_DIR);
  }
  return path.join(getReelioHome(), 'session');
}

function getServerPidPath() {
  return path.join(getReelioHome(), 'reelio.pid');
}

function getPlayerPidPath() {
  return path.join(getReelioHome(), 'player.pid');
}

function getInstallManifestPath() {
  return path.join(getReelioHome(), 'install-manifest.json');
}

function getPlayerDir() {
  return path.join(getPackageRoot(), 'player');
}

function getEnvExamplePath() {
  return path.join(getPackageRoot(), '.env.example');
}

module.exports = {
  getReelioHome,
  getPackageRoot,
  getBundledHooksDir,
  getInstalledHooksDir,
  getClaudeGlobalSettingsPath,
  getEnvPath,
  ensureReelioHome,
  getSessionDir,
  getServerPidPath,
  getPlayerPidPath,
  getInstallManifestPath,
  getPlayerDir,
  getEnvExamplePath,
};
