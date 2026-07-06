import React from 'react';
import { ensureBuffer, fetchMoreReels, fetchPage, getBufferStatus, PAGE_SIZE } from '../services/reelApi';

const PREFETCH_THRESHOLD = 3;
const BOOTSTRAP_RETRIES = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useReelBuffer() {
  const [reels, setReels] = React.useState([]);
  const [hasMore, setHasMore] = React.useState(true);
  const [status, setStatus] = React.useState('bootstrapping');
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const nextServerOffsetRef = React.useRef(0);
  const prefetchInFlightRef = React.useRef(null);
  const inflightFetchRef = React.useRef(null);
  const reelsRef = React.useRef(reels);
  const hasMoreRef = React.useRef(true);
  const currentIndexRef = React.useRef(0);
  const lastReelRef = React.useRef(null);
  const bootstrappedRef = React.useRef(false);
  const boundaryFetchRef = React.useRef(null);

  reelsRef.current = reels;
  hasMoreRef.current = hasMore;
  currentIndexRef.current = currentIndex;

  const appendReels = React.useCallback((incoming) => {
    if (!incoming?.length) return 0;
    let added = 0;
    setReels((prev) => {
      const seen = new Set(prev.map((r) => r.id || r.shortcode));
      const next = [...prev];
      for (const reel of incoming) {
        const key = reel.id || reel.shortcode;
        if (key && !seen.has(key)) {
          seen.add(key);
          next.push(reel);
          added += 1;
        }
      }
      reelsRef.current = next;
      return next;
    });
    return added;
  }, []);

  const applyPageMeta = React.useCallback((data) => {
    setHasMore(Boolean(data?.hasMore));
    hasMoreRef.current = Boolean(data?.hasMore);
    if (data?.nextOffset != null) {
      nextServerOffsetRef.current = data.nextOffset;
    }
  }, []);

  const loadInitialPage = React.useCallback(async () => {
    const data = await fetchPage({ tail: true });
    setReels(data.reels || []);
    reelsRef.current = data.reels || [];
    applyPageMeta(data);
    if (data?.nextOffset != null) {
      nextServerOffsetRef.current = data.nextOffset;
    } else {
      nextServerOffsetRef.current = data?.bufferedCount || (data?.reels?.length || 0);
    }
    return data;
  }, [applyPageMeta]);

  const loadNextPage = React.useCallback(async () => {
    const offset = nextServerOffsetRef.current;
    const requestKey = `offset:${offset}`;
    if (inflightFetchRef.current?.key === requestKey) {
      return inflightFetchRef.current.promise;
    }

    const run = (async () => {
      const data = await fetchPage({ offset });
      const added = appendReels(data.reels);
      applyPageMeta(data);
      return { data, added };
    })();

    inflightFetchRef.current = { key: requestKey, promise: run };
    try {
      return await run;
    } finally {
      if (inflightFetchRef.current?.key === requestKey) {
        inflightFetchRef.current = null;
      }
    }
  }, [appendReels, applyPageMeta]);

  const appendFromServer = React.useCallback(async () => {
    const startLen = reelsRef.current.length;

    if (hasMoreRef.current) {
      const { added } = await loadNextPage();
      if (added > 0 || reelsRef.current.length > startLen) {
        return true;
      }
    }

    const before = await getBufferStatus();
    const countBefore = before.bufferedCount || 0;

    await fetchMoreReels('playback');

    if (hasMoreRef.current || nextServerOffsetRef.current < countBefore) {
      const { added } = await loadNextPage();
      if (added > 0 || reelsRef.current.length > startLen) {
        return true;
      }
    }

    const after = await getBufferStatus();
    if (after.bufferedCount > countBefore) {
      const data = await fetchPage({
        offset: nextServerOffsetRef.current,
        limit: Math.max(PAGE_SIZE, after.bufferedCount - nextServerOffsetRef.current),
      });
      const added = appendReels(data.reels);
      applyPageMeta(data);
      if (added > 0) {
        return true;
      }
    }

    return reelsRef.current.length > startLen;
  }, [loadNextPage, appendReels, applyPageMeta]);

  const prefetchMore = React.useCallback(async () => {
    if (prefetchInFlightRef.current) {
      return prefetchInFlightRef.current;
    }

    const run = appendFromServer().catch((err) => {
      console.warn('Prefetch failed:', err.message);
    });

    prefetchInFlightRef.current = run.finally(() => {
      prefetchInFlightRef.current = null;
    });

    return prefetchInFlightRef.current;
  }, [appendFromServer]);

  const schedulePrefetch = React.useCallback(
    (index) => {
      const list = reelsRef.current;
      if (list.length === 0) return;
      const remaining = list.length - index - 1;
      if (remaining <= PREFETCH_THRESHOLD) {
        prefetchMore();
      }
    },
    [prefetchMore]
  );

  const fetchMoreAtBoundary = React.useCallback(async () => {
    if (boundaryFetchRef.current) {
      return boundaryFetchRef.current;
    }

    const run = appendFromServer();
    boundaryFetchRef.current = run.finally(() => {
      boundaryFetchRef.current = null;
    });

    return boundaryFetchRef.current;
  }, [appendFromServer]);

  const bootstrap = React.useCallback(async () => {
    setStatus('bootstrapping');

    for (let attempt = 0; attempt < BOOTSTRAP_RETRIES; attempt += 1) {
      try {
        await ensureBuffer(1, 'bootstrap');
        const data = await loadInitialPage();
        if (data?.reels?.length > 0) {
          setCurrentIndex(0);
          currentIndexRef.current = 0;
          setStatus('ready');
          return data.reels;
        }
      } catch (err) {
        console.warn('Bootstrap attempt failed:', err.message);
      }
      await sleep(400 * (attempt + 1));
    }

    setStatus('degraded');
    return null;
  }, [loadInitialPage]);

  React.useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    bootstrap();
  }, [bootstrap]);

  const ensureReadyForPlay = React.useCallback(async () => {
    if (reelsRef.current.length > 0) {
      setStatus('ready');
      return reelsRef.current;
    }

    setStatus('bootstrapping');
    try {
      await ensureBuffer(1, 'playback');
      const data = await loadInitialPage();
      if (data?.reels?.length > 0) {
        setCurrentIndex(0);
        currentIndexRef.current = 0;
        setStatus('ready');
        return data.reels;
      }
      return bootstrap();
    } catch (err) {
      console.error('ensureReadyForPlay failed:', err);
      setStatus('degraded');
      return null;
    }
  }, [loadInitialPage, bootstrap]);

  const currentReel = reels[currentIndex] || null;
  if (currentReel) {
    lastReelRef.current = currentReel;
  }

  const displayReel = currentReel;

  const setReelById = React.useCallback((reelId) => {
    const idx = reelsRef.current.findIndex((r) => r.id === reelId || r.shortcode === reelId);
    if (idx >= 0) {
      currentIndexRef.current = idx;
      setCurrentIndex(idx);
    }
  }, []);

  const advanceIndex = React.useCallback(async () => {
    const idx = currentIndexRef.current;
    const nextIndex = idx + 1;

    if (nextIndex < reelsRef.current.length) {
      currentIndexRef.current = nextIndex;
      setCurrentIndex(nextIndex);
      schedulePrefetch(nextIndex);
      return true;
    }

    setStatus('prefetching');
    try {
      const loaded = await fetchMoreAtBoundary();
      if (loaded && nextIndex < reelsRef.current.length) {
        currentIndexRef.current = nextIndex;
        setCurrentIndex(nextIndex);
        schedulePrefetch(nextIndex);
        return true;
      }
    } finally {
      setStatus('ready');
    }

    return false;
  }, [schedulePrefetch, fetchMoreAtBoundary]);

  const goToPrevious = React.useCallback(() => {
    const list = reelsRef.current;
    if (list.length === 0) return;

    const next = currentIndexRef.current > 0 ? currentIndexRef.current - 1 : list.length - 1;
    currentIndexRef.current = next;
    setCurrentIndex(next);
  }, []);

  React.useEffect(() => {
    schedulePrefetch(currentIndex);
  }, [currentIndex, schedulePrefetch]);

  return {
    reels,
    currentReel,
    displayReel,
    currentIndex,
    hasMore,
    status,
    setReelById,
    ensureReadyForPlay,
    advanceIndex,
    goToPrevious,
    isReady: status === 'ready' && reels.length > 0,
  };
}
