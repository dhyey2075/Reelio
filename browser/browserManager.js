const { chromium } = require('playwright');

let context = null;
let page = null;

function getSessionDir() {
  const { getSessionDir: resolveSessionDir } = require('../lib/paths');
  return resolveSessionDir();
}

function isHeadless() {
  return process.env.HEADLESS !== 'false';
}

async function launch() {
  if (context) {
    return { context, page };
  }

  const sessionDir = getSessionDir();
  const headless = isHeadless();

  // Desktop fingerprint — Instagram serves a tablet app interstitial at
  // ~1280x800 and other mid-size viewports, which hides the login form.
  context = await chromium.launchPersistentContext(sessionDir, {
    headless,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
  });

  const pages = context.pages();
  page = pages.length > 0 ? pages[0] : await context.newPage();

  return { context, page };
}

function getPage() {
  if (!context) {
    throw new Error('Browser not launched. Call launch() first.');
  }
  if (!page || page.isClosed()) {
    const openPages = context.pages().filter((p) => !p.isClosed());
    page = openPages.length > 0 ? openPages[0] : null;
  }
  if (!page || page.isClosed()) {
    throw new Error('Browser page is closed. Restart Reelio or call ensurePage().');
  }
  return page;
}

async function ensurePage() {
  if (!context) {
    throw new Error('Browser not launched. Call launch() first.');
  }
  if (page && !page.isClosed()) {
    return page;
  }
  const openPages = context.pages().filter((p) => !p.isClosed());
  if (openPages.length > 0) {
    page = openPages[0];
    return page;
  }
  page = await context.newPage();
  return page;
}

function getContext() {
  if (!context) {
    throw new Error('Browser not launched. Call launch() first.');
  }
  return context;
}

function isLaunched() {
  return context !== null && page !== null;
}

async function close() {
  if (context) {
    await context.close();
    context = null;
    page = null;
  }
}

module.exports = {
  launch,
  getPage,
  ensurePage,
  getContext,
  isLaunched,
  close,
  getSessionDir,
  isHeadless,
};
