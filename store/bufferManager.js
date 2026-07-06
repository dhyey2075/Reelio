const reelStore = require('./reelStore');
const playerState = require('./playerState');
const browserManager = require('../browser/browserManager');
const { triggerRefresh } = require('../fetcher/interceptor');

const MIN_BUFFER = parseInt(process.env.REEL_BUFFER_MIN, 10) || 12;
const PREFETCH_THRESHOLD = parseInt(process.env.REEL_PREFETCH_THRESHOLD, 10) || 3;
const STARTUP_SEED_COUNT = parseInt(process.env.REEL_STARTUP_SEED, 10) || 12;

let ensureInFlight = null;
let prefetchInFlight = false;

function getMinRequired() {
  return MIN_BUFFER;
}

function getStatus() {
  const bufferedCount = reelStore.size();
  return {
    bufferedCount,
    ready: bufferedCount > 0,
    prefetchInFlight: Boolean(ensureInFlight) || prefetchInFlight || Boolean(fetchMoreInFlight),
    minRequired: MIN_BUFFER,
    prefetchThreshold: PREFETCH_THRESHOLD,
    startupSeedCount: STARTUP_SEED_COUNT,
  };
}

function canScrollForReason(reason) {
  if (reason === 'startup' || reason === 'bootstrap') {
    return true;
  }
  if (reason === 'playback') {
    return playerState.getState().mode === 'playing';
  }
  return false;
}

async function runEnsureMin(min, { reason = 'playback' } = {}) {
  const target = Math.max(1, min);
  let baselineCount = reelStore.size();

  if (baselineCount >= target) {
    return {
      ready: true,
      bufferedCount: baselineCount,
      added: 0,
      triggered: false,
    };
  }

  if (!canScrollForReason(reason)) {
    return {
      ready: baselineCount > 0,
      bufferedCount: baselineCount,
      added: 0,
      triggered: false,
      message: `Buffer ensure skipped — reason=${reason}, player not active`,
    };
  }

  prefetchInFlight = true;
  try {
    const page = await browserManager.ensurePage();
    const allowWhenIdle = reason === 'startup' || reason === 'bootstrap';
    const maxAttempts = reason === 'startup' ? 3 : 2;
    let triggered = false;
    let lastMessage = null;

    for (let attempt = 0; attempt < maxAttempts && reelStore.size() < target; attempt += 1) {
      const result = await triggerRefresh(page, {
        fresh: false,
        allowWhenIdle,
        reason: `${reason}:${attempt + 1}`,
      });
      triggered = triggered || result.triggered;
      lastMessage = result.message;
      if (!result.triggered) {
        break;
      }
    }

    const bufferedCount = reelStore.size();
    return {
      ready: bufferedCount >= target || bufferedCount > baselineCount,
      bufferedCount,
      added: Math.max(0, bufferedCount - baselineCount),
      triggered,
      message: lastMessage,
    };
  } finally {
    prefetchInFlight = false;
  }
}

function ensureMin(min, options = {}) {
  const target = Math.max(1, min);
  const key = `${target}:${options.reason || 'playback'}`;

  if (reelStore.size() >= target) {
    return Promise.resolve({
      ready: true,
      bufferedCount: reelStore.size(),
      added: 0,
      triggered: false,
    });
  }

  if (ensureInFlight?.key === key) {
    return ensureInFlight.promise;
  }

  const promise = runEnsureMin(target, options).finally(() => {
    if (ensureInFlight?.key === key) {
      ensureInFlight = null;
    }
  });

  ensureInFlight = { key, promise };
  return promise;
}

let fetchMoreInFlight = null;

async function runFetchMore({ reason = 'playback' } = {}) {
  if (!canScrollForReason(reason)) {
    return {
      added: 0,
      bufferedCount: reelStore.size(),
      triggered: false,
      message: `Fetch-more skipped — reason=${reason}, player not active`,
    };
  }

  prefetchInFlight = true;
  try {
    const page = await browserManager.ensurePage();
    const baselineCount = reelStore.size();
    const result = await triggerRefresh(page, {
      fresh: false,
      allowWhenIdle: false,
      reason: `fetch-more:${reason}`,
    });

    const bufferedCount = reelStore.size();
    return {
      added: Math.max(0, bufferedCount - baselineCount),
      bufferedCount,
      triggered: result.triggered,
      message: result.message,
    };
  } finally {
    prefetchInFlight = false;
  }
}

function fetchMore(options = {}) {
  if (fetchMoreInFlight) {
    return fetchMoreInFlight;
  }

  fetchMoreInFlight = runFetchMore(options).finally(() => {
    fetchMoreInFlight = null;
  });

  return fetchMoreInFlight;
}

module.exports = {
  MIN_BUFFER,
  PREFETCH_THRESHOLD,
  STARTUP_SEED_COUNT,
  getMinRequired,
  getStatus,
  ensureMin,
  fetchMore,
};
