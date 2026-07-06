const express = require('express');
const cors = require('cors');
const reelStore = require('../store/reelStore');
const bufferManager = require('../store/bufferManager');
const browserManager = require('../browser/browserManager');
const { checkSessionOnPage } = require('../auth/loginHandler');
const { triggerRefresh } = require('../fetcher/interceptor');
const { createPlayerRouter } = require('./player');
const { getApiBase, getWsUrl } = require('../lib/config');

function createApiServer({ onRefresh }) {
  const app = express();

  app.use(
    cors({
      origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5173',
      ],
    })
  );

  app.use(express.json());

  app.get('/api/config', (_req, res) => {
    res.json({
      apiBase: getApiBase(),
      wsUrl: getWsUrl(),
    });
  });

  app.get('/api/reels', (req, res) => {
    const cursor = req.query.cursor || null;
    const offset = req.query.offset != null ? parseInt(req.query.offset, 10) : null;
    const tail = req.query.tail === 'true';
    const defaultLimit = parseInt(process.env.REELS_PER_PAGE, 10) || 12;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : defaultLimit;
    const order = req.query.order === 'newest' ? 'newest' : 'oldest';
    const shuffle = req.query.shuffle === 'true';

    const result = tail
      ? reelStore.getReelsTail(limit, { order: 'oldest', shuffle })
      : reelStore.getReels(cursor, limit, { order, shuffle, offset });
    res.json(result);
  });

  app.post('/api/reels/refresh', async (req, res) => {
    try {
      const fresh = req.query.fresh === 'true' || req.body?.fresh === true;
      const force = req.query.force === 'true' || req.body?.force === true;
      const page = await browserManager.ensurePage();
      const refreshOptions = { fresh, allowWhenIdle: force, reason: 'manual' };
      const result = onRefresh
        ? await onRefresh(page, refreshOptions)
        : await triggerRefresh(page, refreshOptions);
      res.json({ ...result, cleared: fresh && result.triggered });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/buffer/status', (_req, res) => {
    res.json(bufferManager.getStatus());
  });

  app.post('/api/buffer/ensure', async (req, res) => {
    try {
      const min = req.body?.min ?? bufferManager.MIN_BUFFER;
      const reason = req.body?.reason || 'playback';
      const allowedReasons = ['startup', 'bootstrap', 'playback'];
      if (!allowedReasons.includes(reason)) {
        res.status(400).json({ error: `Invalid reason. Use one of: ${allowedReasons.join(', ')}` });
        return;
      }
      const result = await bufferManager.ensureMin(min, { reason });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/buffer/fetch-more', async (req, res) => {
    try {
      const reason = req.body?.reason || 'playback';
      const allowedReasons = ['playback', 'bootstrap'];
      if (!allowedReasons.includes(reason)) {
        res.status(400).json({ error: `Invalid reason. Use one of: ${allowedReasons.join(', ')}` });
        return;
      }
      const result = await bufferManager.fetchMore({ reason });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.use('/api/player', createPlayerRouter());

  app.get('/api/status', async (req, res) => {
    try {
      const page = browserManager.getPage();
      const loggedIn = await checkSessionOnPage(page);

      res.json({
        browserLaunched: browserManager.isLaunched(),
        loggedIn,
        headless: browserManager.isHeadless(),
        sessionDir: browserManager.getSessionDir(),
        bufferedCount: reelStore.size(),
        fetchedAt: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        browserLaunched: browserManager.isLaunched(),
        loggedIn: false,
        error: error.message,
        bufferedCount: reelStore.size(),
        fetchedAt: new Date().toISOString(),
      });
    }
  });

  return app;
}

function startServer(app) {
  const port = parseInt(process.env.PORT, 10) || 3001;

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`API server running on http://localhost:${port}`);
      resolve(server);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Port ${port} is already in use. Stop the other Reelio process or change PORT in .env`
          )
        );
        return;
      }
      reject(error);
    });
  });
}

module.exports = {
  createApiServer,
  startServer,
};
