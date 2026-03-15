'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X, Camera } from 'lucide-react';
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
 * Uses React Portals to render at the document root, ensuring that camera control
 * buttons never interfere with or trigger parent form submissions.
 */
export function CameraOverlay({ isOpen, onClose, onCapture, title = "Capture Site Documentation" }: CameraOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isReady, setIsReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen || !mounted) return;

    let stream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        setIsReady(false);
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsReady(true);
        }
      } catch (err) {
        console.error("Camera access error:", err);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, mounted, facingMode]);

  const handleCapture = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context || video.videoWidth === 0) return;

      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 1600;
      canvas.height = 1600 / aspectRatio;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const rawUri = canvas.toDataURL('image/jpeg', 0.9);
      const optimizedUri = await optimizeImage(rawUri);
      
      onCapture({
        url: optimizedUri,
        takenAt: new Date().toISOString()
      });
      onClose();
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

  const content = (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center animate-in fade-in duration-200">
      <div className="absolute top-6 left-6 z-10 hidden md:block">
        <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-white/90 text-xs font-bold uppercase tracking-widest">
          {title}
        </div>
      </div>

      <div className="relative w-full h-full md:h-auto md:max-w-4xl md:aspect-video bg-muted md:rounded-2xl overflow-hidden shadow-2xl md:border md:border-white/10">
        <video 
          ref={videoRef} 
          className="w-full h-full object-cover" 
          autoPlay 
          muted 
          playsInline 
        />
        
        {!isReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 text-white">
                <RefreshCw className="h-8 w-8 animate-spin opacity-50" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-50">Initializing Lens...</p>
            </div>
        )}

        {/* HUD Controls */}
        <div className="absolute inset-0 flex flex-col justify-between p-6 md:p-8">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="h-12 w-12 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 border border-white/20 transition-all active:scale-95 focus:outline-none"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-10 md:gap-16 mb-6">
            <button
              type="button"
              onClick={toggleCamera}
              className="h-14 w-14 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 border border-white/20 transition-all active:scale-95 focus:outline-none"
              title="Switch Camera"
            >
              <RefreshCw className="h-7 w-7" />
            </button>

            <button
              type="button"
              onClick={handleCapture}
              disabled={!isReady}
              className="h-24 w-24 flex items-center justify-center rounded-full bg-white shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all active:scale-90 hover:scale-105 group focus:outline-none disabled:opacity-50"
            >
              <div className="h-20 w-20 rounded-full border-4 border-black/5 group-hover:border-black/10 flex items-center justify-center">
                <Camera className="h-8 w-8 text-black/20 group-hover:text-black/40 transition-colors" />
              </div>
            </button>

            <div className="w-14" /> {/* Visual Balance Spacer */}
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );

  return createPortal(content, document.body);
}
