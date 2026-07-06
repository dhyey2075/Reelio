const express = require('express');
const { WebSocketServer } = require('ws');
const playerState = require('../store/playerState');
const bufferManager = require('../store/bufferManager');
const { pauseBrowserFeed } = require('../browser/automationState');

const clients = new Set();

function onPlayerPaused(state) {
  broadcast('pause', state);
  pauseBrowserFeed().catch((err) => {
    console.warn('Browser idle on pause failed:', err.message);
  });
}

playerState.setPauseCallback(onPlayerPaused);

function broadcast(event, state, meta = {}) {
  const message = JSON.stringify({ event, state, ...meta });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
}

function createPlayerRouter() {
  const router = express.Router();

  router.post('/play', (req, res) => {
    const keepAlive = req.body?.keepAlive === true;
    const state = playerState.play({ keepAlive });
    broadcast('play', state, { keepAlive });

    if (!keepAlive) {
      bufferManager.ensureMin(bufferManager.MIN_BUFFER, { reason: 'playback' }).catch((err) => {
        console.warn('Background buffer ensure on play failed:', err.message);
      });
    }

    res.json({ ...state, keepAlive });
  });

  router.post('/pause', (req, res) => {
    const { reelId, currentTime, cursor, force, debounceMs } = req.body || {};
    const { state, scheduled } = playerState.pause({
      reelId,
      currentTime,
      cursor,
      force: force === true,
      debounceMs,
    });
    if (!scheduled) {
      onPlayerPaused(state);
    }
    res.json({ ...state, scheduled });
  });

  router.get('/state', (_req, res) => {
    res.json(playerState.getState());
  });

  return router;
}

function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ event: 'state', state: playerState.getState() }));

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  return wss;
}

module.exports = {
  createPlayerRouter,
  attachWebSocket,
};
