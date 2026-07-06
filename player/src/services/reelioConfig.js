const DEFAULT_PORT = 3001;
const DEFAULT_API_BASE = `http://localhost:${DEFAULT_PORT}`;

let cached = null;
let initPromise = null;

function buildWsUrl(apiBase) {
  const url = new URL(apiBase);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  url.hash = '';
  return url.toString();
}

function resolveDevApiBase() {
  const envApi = import.meta.env.VITE_REELIO_API;
  if (envApi) {
    return envApi.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.reelioConfig?.apiBase) {
    return window.reelioConfig.apiBase.replace(/\/$/, '');
  }

  return DEFAULT_API_BASE;
}

export async function initReelioConfig() {
  if (cached) {
    return cached;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const devOverride = import.meta.env.VITE_REELIO_API;
    if (devOverride) {
      const apiBase = devOverride.replace(/\/$/, '');
      cached = { apiBase, wsUrl: buildWsUrl(apiBase) };
      return cached;
    }

    const probeBase = resolveDevApiBase();

    try {
      const res = await fetch(`${probeBase}/api/config`);
      if (res.ok) {
        const data = await res.json();
        cached = {
          apiBase: data.apiBase.replace(/\/$/, ''),
          wsUrl: data.wsUrl,
        };
        return cached;
      }
    } catch {
      // server not up yet — fall back
    }

    cached = {
      apiBase: probeBase,
      wsUrl: buildWsUrl(probeBase),
    };
    return cached;
  })();

  return initPromise;
}

export function getReelioConfigSync() {
  if (cached) {
    return cached;
  }
  const apiBase = resolveDevApiBase();
  return { apiBase, wsUrl: buildWsUrl(apiBase) };
}

export { DEFAULT_API_BASE, DEFAULT_PORT };
