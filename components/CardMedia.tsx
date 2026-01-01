"use client";

import { useState, useRef, useCallback, memo } from 'react';

interface CardMediaProps {
  src: string | undefined;
  alt: string | undefined;
  className?: string;
  loading?: "lazy" | "eager";
  onClick?: () => void;
}

/**
 * CardMedia component - Simplified for mobile stability
 *
 * Renders video or image based on src URL
 * Uses native browser lazy loading - no complex JS
 *
 * FIX: Removed useEffect that caused flash/flicker on re-renders
 * FIX: Added background color to prevent flash during video load
 * FIX: Added React.memo to prevent re-renders when props unchanged
 * FIX: Added seamless loop using onTimeUpdate to avoid flicker at loop point
 */
function CardMediaComponent({ src, alt, className, loading = "lazy", onClick }: CardMediaProps) {
  const [useImage, setUseImage] = useState(false);
  const [error, setError] = useState(false);
  const prevSrcRef = useRef(src);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset state when src ACTUALLY changes - using ref comparison avoids flash
  if (src !== prevSrcRef.current) {
    prevSrcRef.current = src;
    if (useImage) setUseImage(false);
    if (error) setError(false);
  }

  // Seamless loop: seek to start slightly before video ends to avoid flash
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration > 0) {
      // When we're within 0.1 seconds of the end, seek to beginning
      if (video.currentTime >= video.duration - 0.1) {
        video.currentTime = 0;
      }
    }
  }, []);

  if (!src) {
    return null;
  }

  const isDataUrl = src.startsWith('data:');
  const srcLower = src.toLowerCase();
  const hasVideoExtension = srcLower.includes('.mp4') || srcLower.includes('.webm') || srcLower.includes('.mov');
  const isIpfs = srcLower.includes('ipfs');
  const isVibeFID = srcLower.includes('filebase.io');
  const shouldTryVideo = !isDataUrl && (hasVideoExtension || (isIpfs && !useImage));

  if (shouldTryVideo && !error) {
    return (
      <video
        ref={videoRef}
        src={src}
        className={className}
        loop
        muted
        playsInline
        autoPlay
        preload="auto"
        onClick={onClick}
        style={{ objectFit: 'cover', background: '#1a1a1a' }}
        onTimeUpdate={handleTimeUpdate}
        onError={() => {
          if (isVibeFID) {
            setError(true);
          } else {
            setUseImage(true);
          }
        }}
      />
    );
  }

  if (error && isVibeFID) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a', color: '#fff', fontSize: '10px', padding: '10px', textAlign: 'center', flexDirection: 'column' }}>
        <a href={src} target="_blank" rel="noopener noreferrer" style={{ color: '#ffd700' }}>
          Open
        </a>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || ''}
      className={className}
      loading={loading}
      onClick={onClick}
      style={{ background: '#1a1a1a' }}
      onError={() => setError(true)}
    />
  );
}

// Memoize to prevent re-renders when props haven't changed
export const CardMedia = memo(CardMediaComponent);
