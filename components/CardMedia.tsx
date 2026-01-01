"use client";

import { useState, useRef, useEffect, memo } from 'react';

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
 * FIX: Seamless loop using dual-video technique to avoid black flash
 */
function CardMediaComponent({ src, alt, className, loading = "lazy", onClick }: CardMediaProps) {
  const [useImage, setUseImage] = useState(false);
  const [error, setError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const prevSrcRef = useRef(src);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset state when src changes
  useEffect(() => {
    if (src !== prevSrcRef.current) {
      prevSrcRef.current = src;
      setUseImage(false);
      setError(false);
      setIsLoaded(false);
    }
  }, [src]);

  // Setup seamless loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlayThrough = () => {
      setIsLoaded(true);
    };

    // Seamless loop: when near the end, seek to start
    const handleTimeUpdate = () => {
      if (video.duration > 0 && video.currentTime >= video.duration - 0.05) {
        video.currentTime = 0.001; // Seek to just after 0 to avoid edge cases
        video.play().catch(() => {});
      }
    };

    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [src]);

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
        muted
        playsInline
        autoPlay
        preload="auto"
        onClick={onClick}
        style={{ 
          objectFit: 'cover',
          // No background - prevents black flash
        }}
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

export const CardMedia = memo(CardMediaComponent);
