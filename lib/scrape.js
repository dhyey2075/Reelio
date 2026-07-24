const fs = require('fs');
const path = require('path');

const { loadConfig } = require('./config');
const browserManager = require('../browser/browserManager');
const { isLoggedIn } = require('../auth/loginHandler');
const {
  registerInterceptor,
  navigateToReelsFeed,
  loadMoreReels,
  waitForIngest,
} = require('../fetcher/interceptor');
const reelStore = require('../store/reelStore');

const SCROLL_STEPS_PER_BATCH = 3;
const MAX_STALL_BATCHES = 3;
const INGEST_WAIT_MS = 5000;

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function resolveOutputPath(outOption) {
  const now = new Date();
  const defaultName = `reels-${formatTimestamp(now)}.json`;

  if (!outOption) {
    return path.join(process.cwd(), 'scrapes', defaultName);
  }

  const resolved = path.resolve(process.cwd(), outOption);

  if (fs.existsSync(resolved)) {
    if (fs.statSync(resolved).isDirectory()) {
      return path.join(resolved, defaultName);
    }
    return resolved;
  }

  if (outOption.endsWith('/') || outOption.endsWith('\\') || !path.extname(outOption)) {
    return path.join(resolved, defaultName);
  }

  return resolved;
}

function writeScrapeJson(outputPath, reels) {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  const payload = {
    scrapedAt: new Date().toISOString(),
    source: 'instagram_reels_explore',
    count: reels.length,
    reels,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function collectReels(page, { count, fresh }) {
  reelStore.clear();

  if (fresh) {
    await page.goto('https://www.instagram.com/reels/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } else {
    await navigateToReelsFeed(page);
  }

  let stallBatches = 0;

  while (reelStore.size() < count && stallBatches < MAX_STALL_BATCHES) {
    const before = reelStore.size();
    await loadMoreReels(page, SCROLL_STEPS_PER_BATCH, { allowWhenIdle: true });
    await waitForIngest(before, { minAdded: 0, timeoutMs: INGEST_WAIT_MS });

    const after = reelStore.size();
    if (after === before) {
      stallBatches += 1;
    } else {
      stallBatches = 0;
    }

    console.log(`[scrape] buffered ${after}/${count} reel(s)`);
  }

  return reelStore.getAll({ order: 'newest' });
}

async function runScrape({ count = 50, out = null, fresh = false, headless } = {}) {
  loadConfig();

  if (headless === true) {
    process.env.HEADLESS = 'true';
  }

  const outputPath = resolveOutputPath(out);

  console.log(`Scraping up to ${count} reel(s) from Instagram explore feed...`);

  await browserManager.launch();
  const page = browserManager.getPage();
  registerInterceptor(page);

  try {
    const loggedIn = await isLoggedIn(page);
    if (!loggedIn) {
      throw new Error('Not logged in. Run: reelio login');
    }

    const reels = await collectReels(page, { count, fresh });
    writeScrapeJson(outputPath, reels);

    console.log(`Wrote ${reels.length} reel(s) to ${outputPath}`);

    return { outputPath, count: reels.length };
  } finally {
    await browserManager.close();
  }
}

module.exports = {
  runScrape,
  resolveOutputPath,
};
