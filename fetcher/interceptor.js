const reelStore = require('../store/reelStore');
const { isAutomationActive, pausePageVideos, pauseBrowserFeed } = require('../browser/automationState');

const WATCHED_URL_PATTERNS = [
  '/api/v1/feed/timeline/',
  '/api/v1/feed/reels_tray/',
  '/api/graphql',
  '/graphql/query',
];

let lastRefreshAt = 0;
let refreshInFlight = null;
const MIN_REFRESH_INTERVAL_MS = 30000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldCapture(url) {
  return WATCHED_URL_PATTERNS.some((pattern) => url.includes(pattern));
}

async function handleResponse(response) {
  const url = response.url();

  if (!shouldCapture(url)) {
    return;
  }

  const contentType = response.headers()['content-type'] || '';
  if (
    !contentType.includes('application/json') &&
    !contentType.includes('text/javascript') &&
    !contentType.includes('text/plain')
  ) {
    return;
  }

  try {
    const json = await response.json();
    const added = reelStore.ingest(json);

    if (added > 0) {
      console.log(`Captured ${added} new reel(s) from ${url.split('?')[0]}`);
    }
  } catch {
    // Non-JSON or empty responses are ignored
  }
}

function registerInterceptor(page) {
  page.on('response', (response) => {
    handleResponse(response).catch(() => {});
  });
}

async function navigateToReelsFeed(page) {
  if (page.isClosed()) {
    throw new Error('Browser page is closed');
  }
  const currentUrl = page.url();
  if (!currentUrl.includes('/reels')) {
    await page.goto('https://www.instagram.com/reels/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await sleep(3000);
  }
}

async function loadMoreReels(page, steps = 3, { allowWhenIdle = false } = {}) {
  if (!allowWhenIdle && !isAutomationActive()) {
    return { scrolled: 0, skipped: true };
  }

  await navigateToReelsFeed(page);
  await pausePageVideos(page);

  let scrolled = 0;
  for (let i = 0; i < steps; i += 1) {
    if (page.isClosed()) {
      throw new Error('Browser page is closed');
    }
    if (!allowWhenIdle && !isAutomationActive()) {
      break;
    }
    await page.keyboard.press('ArrowDown');
    scrolled += 1;
    await sleep(1500);
  }

  await pausePageVideos(page);
  return { scrolled, skipped: false };
}

async function waitForIngest(baselineCount, { minAdded = 1, timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = reelStore.size();
    if (count >= baselineCount + minAdded) {
      return count;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return reelStore.size();
}

async function runRefresh(page, { fresh = false, allowWhenIdle = false, reason = 'refresh' } = {}) {
  const now = Date.now();
  if (now - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
    const waitMs = MIN_REFRESH_INTERVAL_MS - (now - lastRefreshAt);
    return {
      triggered: false,
      message: `Refresh cooldown active. Try again in ${Math.ceil(waitMs / 1000)} seconds.`,
      bufferedCount: reelStore.size(),
    };
  }

  if (!allowWhenIdle && !isAutomationActive()) {
    return {
      triggered: false,
      message: `Player is idle — refresh skipped (reason=${reason}).`,
      bufferedCount: reelStore.size(),
    };
  }

  console.log(`[interceptor] refresh start reason=${reason} fresh=${fresh}`);
  lastRefreshAt = now;
  const baselineCount = fresh ? 0 : reelStore.size();

  if (fresh) {
    reelStore.clear();
    await page.goto('https://www.instagram.com/reels/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await sleep(3000);
    await pausePageVideos(page);
  }

  const scrollSteps = fresh ? 8 : 3;
  const scrollResult = await loadMoreReels(page, scrollSteps, { allowWhenIdle });
  const bufferedCount = await waitForIngest(baselineCount, {
    minAdded: fresh ? 1 : 0,
    timeoutMs: fresh ? 10000 : 3000,
  });

  if (!isAutomationActive()) {
    await pauseBrowserFeed();
  }

  return {
    triggered: true,
    message: scrollResult.skipped
      ? 'Refresh skipped — player became idle during feed interaction'
      : fresh
        ? 'Cleared buffer and loaded fresh reels from the Reels feed'
        : 'Loaded more reels from the Reels feed',
    bufferedCount,
    addedSinceRefresh: bufferedCount - baselineCount,
  };
}

async function triggerRefresh(page, options = {}) {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = runRefresh(page, options).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

module.exports = {
  registerInterceptor,
  triggerRefresh,
  navigateToReelsFeed,
  loadMoreReels,
  waitForIngest,
};
