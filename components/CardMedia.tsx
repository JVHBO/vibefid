"use client";

import { useState, useRef, useEffect, memo } from 'react';

interface CardMediaProps {
  src: string | undefined;
  alt: string | undefined;
  className?: string;
  loading?: "lazy" | "eager";
  onClick?: () => void;
  poster?: string;
}

/**
 * CardMedia component
 * 
 * FIX: Static image behind video to prevent black flash on loop
 * The image shows through when video briefly shows black during seek
 */
function CardMediaComponent({ src, alt, className, loading = "lazy", onClick, poster }: CardMediaProps) {
  const [useImage, setUseImage] = useState(false);
  const [error, setError] = useState(false);
  const [firstFrame, setFirstFrame] = useState<string | null>(null);
  const prevSrcRef = useRef(src);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Reset state when src changes
  useEffect(() => {
    if (src !== prevSrcRef.current) {
      prevSrcRef.current = src;
      setUseImage(false);
      setError(false);
      setFirstFrame(null);
    }
  }, [src]);

  // Capture first frame as fallback image
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const captureFrame = () => {
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = video.videoWidth || 600;
        canvas.height = video.videoHeight || 840;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        if (dataUrl && dataUrl !== 'data:,') {
          setFirstFrame(dataUrl);
        }
      } catch (e) {
        // CORS or other error, ignore
      }
    };

    // Capture after video has loaded enough
    const handleLoadedData = () => {
      // Small delay to ensure frame is ready
      setTimeout(captureFrame, 100);
    };

    video.addEventListener('loadeddata', handleLoadedData);
    return () => video.removeEventListener('loadeddata', handleLoadedData);
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
      <div style={{ position: 'relative' }} className={className}>
        {/* Hidden canvas for capturing frame */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {/* Background image to prevent black flash */}
        {firstFrame && (
          <img
            src={firstFrame}
            alt=""
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 0,
            }}
          />
        )}
        
        {/* Video on top */}
        <video
          ref={videoRef}
          src={src}
          loop
          muted
          playsInline
          autoPlay
          preload="auto"
          onClick={onClick}
          style={{
            width: '100%',
            objectFit: 'cover',
            position: 'relative',
            zIndex: 1,
          }}
          onError={() => {
            if (isVibeFID) {
              setError(true);
            } else {
              setUseImage(true);
            }
          }}
        />
      </div>
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
