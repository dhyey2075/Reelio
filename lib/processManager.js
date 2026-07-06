const fs = require('fs');
const net = require('net');
const http = require('http');

function readPidFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    const pid = parseInt(raw, 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function writePidFile(filePath, pid) {
  fs.mkdirSync(require('path').dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, String(pid));
}

function removePidFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }
}

function isProcessRunning(pid) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function killProcess(pid, signal = 'SIGTERM') {
  if (!pid) {
    return;
  }
  try {
    process.kill(pid, signal);
  } catch {
    // already dead
  }
}

async function killProcessGracefully(pid, { timeoutMs = 5000 } = {}) {
  if (!pid || !isProcessRunning(pid)) {
    return;
  }

  killProcess(pid, 'SIGTERM');

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessRunning(pid)) {
      return;
    }
    await sleep(200);
  }

  killProcess(pid, 'SIGKILL');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortInUse(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, host);
  });
}

function waitForHttpOk(url, { timeoutMs = 60000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve(true);
          return;
        }
        schedule();
      });

      req.on('error', schedule);
      req.setTimeout(3000, () => {
        req.destroy();
        schedule();
      });
    };

    const schedule = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(attempt, intervalMs);
    };

    attempt();
  });
}

function httpGetJson(url, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timed out: ${url}`));
    });
  });
}

module.exports = {
  readPidFile,
  writePidFile,
  removePidFile,
  isProcessRunning,
  killProcess,
  killProcessGracefully,
  isPortInUse,
  waitForHttpOk,
  httpGetJson,
  sleep,
};
