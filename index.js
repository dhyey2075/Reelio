require('./lib/config').loadConfig();

const browserManager = require('./browser/browserManager');
const { ensureLoggedIn } = require('./auth/loginHandler');
const { registerInterceptor } = require('./fetcher/interceptor');
const { pauseBrowserFeed } = require('./browser/automationState');
const bufferManager = require('./store/bufferManager');
const { createApiServer, startServer } = require('./server/api');
const { attachWebSocket } = require('./server/player');
const { triggerRefresh } = require('./fetcher/interceptor');

async function main() {
  console.log('Starting Reelio...');

  await browserManager.launch();
  const page = browserManager.getPage();

  registerInterceptor(page);
  await ensureLoggedIn(page);
  await pauseBrowserFeed();

  console.log(`Seeding initial reel buffer (target=${bufferManager.STARTUP_SEED_COUNT})...`);
  const seedResult = await bufferManager.ensureMin(bufferManager.STARTUP_SEED_COUNT, {
    reason: 'startup',
  });
  console.log(
    `[buffer] startup seed: buffered=${seedResult.bufferedCount}, added=${seedResult.added}`
  );
  await pauseBrowserFeed();

  const app = createApiServer({
    onRefresh: (page, options) => triggerRefresh(page, options),
  });

  const server = await startServer(app);
  attachWebSocket(server);

  const shutdown = async () => {
    console.log('Shutting down...');
    await browserManager.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(async (error) => {
  console.error('Fatal error:', error.message);
  await browserManager.close();
  process.exit(1);
});
