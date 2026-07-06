import React from 'react';
import { initReelioConfig } from '../services/reelioConfig';

export function usePlayerControl({
  videoRef,
  displayReel,
  setReelById,
  isReady,
  onPlayStart,
}) {
  const [connected, setConnected] = React.useState(false);
  const [mode, setMode] = React.useState('idle');
  const savedStateRef = React.useRef(null);
  const displayReelRef = React.useRef(displayReel);
  const isReadyRef = React.useRef(isReady);
  const wsUrlRef = React.useRef(null);
  const apiBaseRef = React.useRef(null);

  displayReelRef.current = displayReel;
  isReadyRef.current = isReady;

  React.useEffect(() => {
    initReelioConfig().then((config) => {
      wsUrlRef.current = config.wsUrl;
      apiBaseRef.current = config.apiBase;
    });
  }, []);

  const ensurePlaying = React.useCallback(async (state) => {
    if (window.reelioWindow?.expand) {
      await window.reelioWindow.expand();
    }
    if (window.reelioWindow?.focus) {
      await window.reelioWindow.focus();
    }

    setMode('playing');

    requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video) return;

      const seekAndPlay = () => {
        if (state?.currentTime > 0 && Math.abs(video.currentTime - state.currentTime) > 0.5) {
          video.currentTime = state.currentTime;
        }
        if (video.paused) {
          video.play().catch((err) => console.warn('Autoplay blocked:', err));
        }
      };

      if (video.readyState >= 1) {
        seekAndPlay();
      } else {
        video.addEventListener('loadedmetadata', seekAndPlay, { once: true });
      }
    });
  }, [videoRef]);

  const pauseWithState = React.useCallback(async () => {
    const config = await initReelioConfig();
    const video = videoRef.current;
    const reelId = displayReelRef.current?.id || displayReelRef.current?.shortcode || null;
    const currentTime = video ? video.currentTime : 0;

    try {
      await fetch(`${config.apiBase}/api/player/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reelId, currentTime, cursor: null }),
      });
    } catch (err) {
      console.error('Pause API error:', err);
    }

    if (video) {
      video.pause();
    }

    if (window.reelioWindow?.minimize) {
      await window.reelioWindow.minimize();
    }
  }, [videoRef]);

  React.useEffect(() => {
    let ws;
    let reconnectTimer;
    let cancelled = false;

    async function connect() {
      const config = await initReelioConfig();
      if (cancelled) return;

      wsUrlRef.current = config.wsUrl;
      apiBaseRef.current = config.apiBase;

      ws = new WebSocket(config.wsUrl);

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onmessage = (event) => {
        try {
          const { event: evt, state, keepAlive } = JSON.parse(event.data);
          savedStateRef.current = state;

          if (evt === 'play') {
            if (keepAlive) {
              ensurePlaying(state);
              return;
            }

            Promise.resolve(onPlayStart?.()).then(() => {
              if (displayReelRef.current?.videoUrl) {
                ensurePlaying({ currentTime: 0 });
              } else if (isReadyRef.current) {
                ensurePlaying({ currentTime: 0 });
              } else {
                setMode('playing');
                if (window.reelioWindow?.expand) {
                  window.reelioWindow.expand();
                }
              }
            });
          } else if (evt === 'pause') {
            setMode('paused');
            const video = videoRef.current;
            if (video) video.pause();
            if (window.reelioWindow?.minimize) {
              window.reelioWindow.minimize();
            }
          } else if (evt === 'state') {
            setMode(state.mode);
            if (state.reelId) {
              setReelById(state.reelId);
            }

            if (state.mode === 'playing') {
              if (displayReelRef.current?.videoUrl) {
                ensurePlaying(state);
              }
              return;
            }

            const video = videoRef.current;
            if (video) {
              video.pause();
              const seek = () => {
                if (state.currentTime > 0) {
                  video.currentTime = state.currentTime;
                }
              };
              if (video.readyState >= 1) {
                seek();
              } else {
                video.addEventListener('loadedmetadata', seek, { once: true });
              }
            }
            if (state.mode === 'paused' || state.window === 'mini') {
              if (window.reelioWindow?.minimize) {
                window.reelioWindow.minimize();
              }
            }
          }
        } catch (err) {
          console.error('WebSocket message error:', err);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [setReelById, videoRef, onPlayStart, ensurePlaying]);

  return { connected, mode, pauseWithState };
}
