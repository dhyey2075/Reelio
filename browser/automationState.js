const browserManager = require('./browserManager');
const playerState = require('../store/playerState');

function isAutomationActive() {
  return playerState.getState().mode === 'playing';
}

async function pausePageVideos(page) {
  if (!page || page.isClosed()) return;
  await page
    .evaluate(() => {
      document.querySelectorAll('video').forEach((video) => {
        video.pause();
        video.muted = true;
      });
    })
    .catch(() => {});
}

async function pauseBrowserFeed() {
  if (!browserManager.isLaunched()) return;

  try {
    const page = await browserManager.ensurePage();
    await pausePageVideos(page);

    const url = page.url();
    if (url.includes('/reels')) {
      await page.goto('https://www.instagram.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await pausePageVideos(page);
    }
  } catch (err) {
    console.warn('Failed to idle browser feed:', err.message);
  }
}

async function idleOnStartup() {
  return pauseBrowserFeed();
}

module.exports = {
  isAutomationActive,
  pausePageVideos,
  pauseBrowserFeed,
  idleOnStartup,
};
