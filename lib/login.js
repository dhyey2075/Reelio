const { loadConfig, assertInstagramCredentialsForLogin } = require('./config');
const browserManager = require('../browser/browserManager');
const { ensureLoggedIn } = require('../auth/loginHandler');
const { pauseBrowserFeed } = require('../browser/automationState');

async function runLogin() {
  loadConfig();
  assertInstagramCredentialsForLogin();
  process.env.HEADLESS = 'false';

  console.log('Opening Instagram login browser...');
  console.log(`Session will be saved to: ${browserManager.getSessionDir()}`);

  await browserManager.launch();
  const page = browserManager.getPage();

  const result = await ensureLoggedIn(page);
  await pauseBrowserFeed();
  await browserManager.close();

  return result;
}

module.exports = {
  runLogin,
};
