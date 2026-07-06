import React from 'react';
import ReelPlayer from './components/ReelPlayer';
import { usePlayback } from './hooks/usePlayback';
import { usePlayerControl } from './hooks/usePlayerControl';

export default function App() {
  const videoRef = React.useRef(null);
  const {
    currentReel,
    displayReel,
    advanceIndex,
    goToPrevious,
    setReelById,
    status,
    reels,
    ensureReadyForPlay,
    isReady,
  } = usePlayback();

  const playCurrentVideo = React.useCallback(() => {
    requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = 1.0;
      video.play().catch((err) => console.warn('Autoplay blocked:', err));
    });
  }, []);

  const { connected, mode } = usePlayerControl({
    videoRef,
    displayReel,
    setReelById,
    isReady,
    onPlayStart: ensureReadyForPlay,
  });

  const handleNext = React.useCallback(async () => {
    const advanced = await advanceIndex();
    if (advanced && mode === 'playing') {
      playCurrentVideo();
    }
  }, [advanceIndex, mode, playCurrentVideo]);

  const handlePrevious = React.useCallback(() => {
    goToPrevious();
    if (mode === 'playing') {
      playCurrentVideo();
    }
  }, [goToPrevious, mode, playCurrentVideo]);

  const handleEnded = React.useCallback(() => {
    handleNext();
  }, [handleNext]);

  React.useEffect(() => {
    if (mode !== 'playing') return;

    const onKeyDown = (e) => {
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
        return;
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleNext();
        return;
      }
      if (e.code !== 'Space' || e.repeat) return;
      e.preventDefault();
      const video = videoRef.current;
      if (video) video.playbackRate = 1.5;
    };

    const onKeyUp = (e) => {
      if (e.code !== 'Space') return;
      e.preventDefault();
      const video = videoRef.current;
      if (video) video.playbackRate = 1.0;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [mode, videoRef, handlePrevious, handleNext]);

  return (
    <div className="app">
      <div className="player-container">
        <ReelPlayer
          reel={displayReel}
          status={status}
          connected={connected}
          videoRef={videoRef}
          onEnded={handleEnded}
          onPrevious={handlePrevious}
          onNext={handleNext}
          canNavigate={reels.length > 0}
          onReelChange={mode === 'playing' ? playCurrentVideo : undefined}
        />
      </div>
      <div className="status-bar">
        <span>
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
          {connected ? 'Connected' : 'Reconnecting...'}
        </span>
        <span>
          {mode} {status !== 'ready' ? `· ${status}` : ''}
          {currentReel ? ` · ${currentReel.shortcode || currentReel.id}` : ''}
        </span>
      </div>
    </div>
  );
}
