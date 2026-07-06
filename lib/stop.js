const { loadConfig } = require('./config');
const { getServerPidPath, getPlayerPidPath } = require('./paths');
const {
  readPidFile,
  removePidFile,
  killProcessGracefully,
  isProcessRunning,
} = require('./processManager');

async function stopReelio() {
  loadConfig();

  const serverPid = readPidFile(getServerPidPath());
  const playerPid = readPidFile(getPlayerPidPath());

  if (playerPid) {
    console.log(`Stopping player (pid ${playerPid})...`);
    await killProcessGracefully(playerPid);
    removePidFile(getPlayerPidPath());
  } else {
    console.log('No player pid file found.');
  }

  if (serverPid) {
    console.log(`Stopping server (pid ${serverPid})...`);
    await killProcessGracefully(serverPid);
    removePidFile(getServerPidPath());
  } else {
    console.log('No server pid file found.');
  }

  if (serverPid && isProcessRunning(serverPid)) {
    throw new Error(`Server pid ${serverPid} still running after stop attempt`);
  }

  console.log('Reelio stopped.');
}

module.exports = {
  stopReelio,
};
