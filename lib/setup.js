const fs = require('fs');
const path = require('path');
const { installGlobalHooks } = require('./claude-hooks');
const {
  ensureReelioHome,
  getEnvPath,
  getEnvExamplePath,
  getSessionDir,
} = require('./paths');

function runSetup({ hooks = false } = {}) {
  const home = ensureReelioHome();
  const envPath = getEnvPath();
  const examplePath = getEnvExamplePath();
  const sessionDir = getSessionDir();

  fs.mkdirSync(sessionDir, { recursive: true });

  let envCreated = false;
  if (!fs.existsSync(envPath)) {
    if (!fs.existsSync(examplePath)) {
      throw new Error(`Missing template: ${examplePath}`);
    }
    fs.copyFileSync(examplePath, envPath);
    envCreated = true;
  }

  let hooksResult = null;
  if (hooks) {
    hooksResult = installGlobalHooks();
  }

  return {
    home,
    envPath,
    sessionDir,
    envCreated,
    hooksResult,
  };
}

module.exports = {
  runSetup,
};
