'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X, Camera, Loader2 } from 'lucide-react';
import { optimizeImage } from '@/lib/storage-utils';
import type { Photo } from '@/lib/types';

interface CameraOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photo: Photo) => void;
  title?: string;
}

/**
 * CameraOverlay - A high-performance full-screen camera interface.
 * Uses React Portals to render at the document root.
 * 
 * CRITICAL FIX: Added pointer-events-auto to the container. 
 * Radix UI (ShadCN Dialogs) locks body pointer events when open, which blocks 
 * portaled elements unless they explicitly re-enable pointer interactions.
 */
export function CameraOverlay({ isOpen, onClose, onCapture, title = "Capture Site Documentation" }: CameraOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(e => console.error("Video auto-play failed:", e));
          setIsReady(true);
        };
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setIsReady(false);
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (isOpen && mounted) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isOpen, mounted, startCamera, stopCamera]);

  const handleCapture = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isProcessing || !isReady) return;

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      
      if (!context || videoWidth === 0) return;

      setIsProcessing(true);

      canvas.width = videoWidth;
      canvas.height = videoHeight;
      context.drawImage(video, 0, 0, videoWidth, videoHeight);

      try {
        const rawUri = canvas.toDataURL('image/jpeg', 0.9);
        const optimizedUri = await optimizeImage(rawUri);
        
        onCapture({
          url: optimizedUri,
          takenAt: new Date().toISOString()
        });
        onClose();
      } catch (err) {
        console.error("Capture processing error:", err);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const toggleCamera = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center animate-in fade-in duration-200 pointer-events-auto select-none overflow-hidden">
      {/* HUD Header */}
      <div className="absolute top-6 left-6 z-[10000] hidden md:block">
        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white/90 text-xs font-bold uppercase tracking-widest">
          {title}
        </div>
      </div>

      <div className="relative w-full h-full md:h-auto md:max-w-4xl md:aspect-video bg-neutral-900 md:rounded-2xl overflow-hidden shadow-2xl md:border md:border-white/10 pointer-events-auto">
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover" 
          autoPlay 
          muted 
          playsInline 
        />
        
        {(!isReady || isProcessing) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 text-white z-[10001]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest animate-pulse">
                  {isProcessing ? 'Processing Image...' : 'Initializing Lens...'}
                </p>
            </div>
        )}

        {/* HUD Controls Overlay */}
        <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-8 z-[10000]">
          {/* Top Bar: Close */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="h-12 w-12 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 border border-white/20 transition-all active:scale-95 shadow-lg pointer-events-auto"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Bottom Bar: Actions */}
          <div className="flex items-center justify-center gap-10 md:gap-16 mb-6">
            {/* Camera Toggle */}
            <button
              type="button"
              onClick={toggleCamera}
              className="h-14 w-14 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 border border-white/20 transition-all active:scale-95 shadow-lg pointer-events-auto"
              title="Switch Camera"
            >
              <RefreshCw className="h-7 w-7" />
            </button>

            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleCapture}
              disabled={!isReady || isProcessing}
              className="h-24 w-24 flex items-center justify-center rounded-full bg-white shadow-[0_0_50px_rgba(255,255,255,0.4)] transition-all active:scale-90 hover:scale-105 group disabled:opacity-50 disabled:scale-100 pointer-events-auto"
            >
              <div className="h-20 w-20 rounded-full border-4 border-black/5 group-hover:border-black/10 flex items-center justify-center">
                <Camera className="h-8 w-8 text-black/20 group-hover:text-black/40 transition-colors" />
              </div>
            </button>

            {/* Visual Spacer */}
            <div className="w-14 h-14" />
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>,
    document.body
  );
}
