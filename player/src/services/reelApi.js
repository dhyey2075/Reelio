import { getReelioConfigSync, initReelioConfig } from './reelioConfig';

const PAGE_SIZE = parseInt(import.meta.env.VITE_REEL_PAGE_SIZE, 10) || 12;

let apiBase = getReelioConfigSync().apiBase;

export async function ensureReelApiReady() {
  const config = await initReelioConfig();
  apiBase = config.apiBase;
  return config;
}

export function getApiBase() {
  return apiBase;
}

export async function fetchPage({ offset = null, tail = false, limit = PAGE_SIZE } = {}) {
  const params = new URLSearchParams({ limit: String(limit), order: 'oldest' });
  if (tail) {
    params.set('tail', 'true');
  } else if (offset != null) {
    params.set('offset', String(offset));
  }

  const res = await fetch(`${apiBase}/api/reels?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch reels: ${res.status}`);
  }

  return res.json();
}

export async function ensureBuffer(min = 1, reason = 'bootstrap') {
  const res = await fetch(`${apiBase}/api/buffer/ensure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ min, reason }),
  });

  if (!res.ok) {
    throw new Error(`Failed to ensure buffer: ${res.status}`);
  }

  return res.json();
}

export async function fetchMoreReels(reason = 'playback') {
  const res = await fetch(`${apiBase}/api/buffer/fetch-more`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch more reels: ${res.status}`);
  }

  return res.json();
}

export async function getBufferStatus() {
  const res = await fetch(`${apiBase}/api/buffer/status`);
  if (!res.ok) {
    throw new Error(`Failed to get buffer status: ${res.status}`);
  }
  return res.json();
}

export { PAGE_SIZE };
