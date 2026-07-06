const { parseReelsFromPayload } = require('../parser/reelParser');

const reelsById = new Map();
const reelOrder = [];
let ingestGeneration = 0;
let shuffledOrder = null;

function buildOrder({ order = 'newest', shuffle = false } = {}) {
  if (shuffle) {
    if (!shuffledOrder || shuffledOrder.length !== reelOrder.length) {
      shuffledOrder = [...reelOrder];
      for (let i = shuffledOrder.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledOrder[i], shuffledOrder[j]] = [shuffledOrder[j], shuffledOrder[i]];
      }
    }
    return shuffledOrder;
  }

  shuffledOrder = null;
  if (order === 'oldest') {
    return reelOrder;
  }
  return [...reelOrder].reverse();
}

function ingest(rawJson) {
  const genAtStart = ingestGeneration;
  const parsed = parseReelsFromPayload(rawJson);
  let added = 0;

  for (const reel of parsed) {
    if (genAtStart !== ingestGeneration) {
      return added;
    }

    const key = reel.id || reel.shortcode;
    if (!key) {
      continue;
    }

    if (!reelsById.has(key)) {
      reelsById.set(key, reel);
      reelOrder.push(key);
      shuffledOrder = null;
      added += 1;
    }
  }

  if (added > 0) {
    console.log(`[reelStore] ingested ${added} new reel(s), total=${reelOrder.length}`);
  }

  return added;
}

function getReels(offsetOrCursor, limit = 12, options = {}) {
  const pageLimit = Math.max(1, parseInt(limit, 10) || 12);
  const orderKeys = buildOrder(options);

  if (options.offset != null) {
    const startIndex = Math.max(0, parseInt(options.offset, 10) || 0);
    const sliceKeys = orderKeys.slice(startIndex, startIndex + pageLimit);
    const reels = sliceKeys.map((key) => reelsById.get(key)).filter(Boolean);
    const nextOffset = startIndex + sliceKeys.length;
    const hasMore = nextOffset < orderKeys.length;

    return {
      reels,
      nextOffset: hasMore ? nextOffset : null,
      hasMore,
      bufferedCount: reelOrder.length,
      fetchedAt: new Date().toISOString(),
    };
  }

  let startIndex = 0;
  const cursor = offsetOrCursor;

  if (cursor) {
    const cursorIndex = orderKeys.indexOf(String(cursor));
    if (cursorIndex >= 0) {
      startIndex = cursorIndex + 1;
    }
  }

  const sliceKeys = orderKeys.slice(startIndex, startIndex + pageLimit);
  const reels = sliceKeys.map((key) => reelsById.get(key)).filter(Boolean);
  const hasMore = startIndex + pageLimit < orderKeys.length;
  const nextCursor = hasMore && sliceKeys.length > 0 ? sliceKeys[sliceKeys.length - 1] : null;

  return {
    reels,
    nextCursor,
    hasMore,
    bufferedCount: reelOrder.length,
    fetchedAt: new Date().toISOString(),
  };
}

function getReelsTail(limit = 12, options = {}) {
  const orderKeys = buildOrder({ ...options, order: 'oldest' });
  const pageLimit = Math.max(1, parseInt(limit, 10) || 12);
  const startIndex = Math.max(0, orderKeys.length - pageLimit);
  return getReels(null, pageLimit, { ...options, order: 'oldest', offset: startIndex });
}

function size() {
  return reelOrder.length;
}

function clear() {
  ingestGeneration += 1;
  reelsById.clear();
  reelOrder.length = 0;
  shuffledOrder = null;
}

module.exports = {
  ingest,
  getReels,
  getReelsTail,
  size,
  clear,
};
