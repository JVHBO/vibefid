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
 * CardMedia component
 * 
 * FIX: Manual loop control for videos without duration metadata
 * Removes native loop attribute and uses 'ended' event for seamless restart
 */
function CardMediaComponent({ src, alt, className, loading = "lazy", onClick }: CardMediaProps) {
  const [useImage, setUseImage] = useState(false);
  const [error, setError] = useState(false);
  const prevSrcRef = useRef(src);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Reset state when src changes
  useEffect(() => {
    if (src !== prevSrcRef.current) {
      prevSrcRef.current = src;
      setUseImage(false);
      setError(false);
    }
  }, [src]);

  // Manual seamless loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      // Instantly restart without showing black frame
      video.currentTime = 0;
      video.play().catch(() => {});
    };

    // Ensure video plays after load
    const handleCanPlay = () => {
      video.play().catch(() => {});
    };

    video.addEventListener('ended', handleEnded);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('canplay', handleCanPlay);
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
        style={{ objectFit: 'cover' }}
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
