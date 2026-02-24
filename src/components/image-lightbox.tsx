'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import type { Photo } from '@/lib/types';
import { useEffect } from 'react';

interface ImageLightboxProps {
  photo: Photo | null;
  onClose: () => void;
}

/**
 * ImageLightbox - A robust full-screen viewer for site documentation.
 * Uses native img tag with max-viewport constraints to guarantee the image 
 * fits the screen perfectly without scrolling or overflow.
 */
export function ImageLightbox({ photo, onClose }: ImageLightboxProps) {
  // Handle escape key and body scroll lock
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (photo) {
      window.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm select-none animate-in fade-in duration-200 overflow-hidden"
      onClick={onClose}
    >
      {/* Close Button - High visibility for site use */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-6 right-6 z-[10000] h-12 w-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/20 shadow-2xl transition-all active:scale-95 focus:outline-none"
      >
        <X className="h-8 w-8" />
        <span className="sr-only">Close Viewer</span>
      </button>

      {/* Image Container - Strictly constrained to viewport bounds */}
      <div 
        className="w-full h-full flex items-center justify-center p-4 md:p-12 overflow-hidden" 
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photo.url}
          alt="Site documentation"
          className="max-w-full max-h-full object-contain shadow-2xl pointer-events-none rounded-sm border border-white/5"
        />
      </div>

      {/* Metadata Overlay */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none px-4">
        <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
          <p className="text-[10px] font-bold text-white/90 uppercase tracking-widest text-center">
            Captured {new Date(photo.takenAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
