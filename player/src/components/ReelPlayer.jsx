import React from 'react';

export default function ReelPlayer({
  reel,
  status = 'bootstrapping',
  connected = false,
  videoRef,
  onEnded,
  onPrevious,
  onNext,
  canNavigate,
  onReelChange,
}) {
  const reelId = reel?.id || reel?.shortcode || null;
  const videoUrl = reel?.videoUrl || '';
  const lastUrlRef = React.useRef('');

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    if (lastUrlRef.current !== videoUrl) {
      lastUrlRef.current = videoUrl;
      video.src = videoUrl;
      video.load();
    }

    if (reel?.thumbnailUrl && video.poster !== reel.thumbnailUrl) {
      video.poster = reel.thumbnailUrl;
    }

    onReelChange?.(reel);
  }, [reelId, videoUrl, reel?.thumbnailUrl, videoRef, onReelChange]);

  if (!videoUrl) {
    return (
      <div className="empty-state">
        {!connected ? (
          <div className="loading-indicator">Reconnecting to Reelio…</div>
        ) : status === 'degraded' ? (
          <div className="loading-indicator">Reconnecting to Reelio…</div>
        ) : (
          <div className="spinner-wrap">
            <div className="spinner" aria-hidden="true" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="reel-player">
      <button
        type="button"
        className="nav-btn nav-prev"
        onClick={onPrevious}
        disabled={!canNavigate}
        aria-label="Previous reel"
      >
        ‹
      </button>
      <video
        ref={videoRef}
        className="reel-video"
        playsInline
        preload="auto"
        onEnded={onEnded}
      />
      <button
        type="button"
        className="nav-btn nav-next"
        onClick={onNext}
        disabled={!canNavigate}
        aria-label="Next reel"
      >
        ›
      </button>
    </div>
  );
}
