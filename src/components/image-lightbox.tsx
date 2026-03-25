'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Photo } from '@/lib/types';
import { useEffect, useState } from 'react';

interface ImageLightboxProps {
  photo: Photo | null;
  onClose: () => void;
}

/**
 * ImageLightbox - A high-performance full-screen documentation viewer.
 * Now uses React Portals to render at the document root, preventing z-index or 
 * parent clipping issues. Fixed the close button by ensuring it's always at 
 * the top of the stacking context.
 */
export function ImageLightbox({ photo, onClose }: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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

  if (!photo || !mounted) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm select-none animate-in fade-in duration-200 overflow-hidden pointer-events-auto"
      onClick={onClose}
    >
      {/* High-Visibility Close Button - Explicitly top level */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-6 right-6 z-[100000] h-12 w-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/20 shadow-2xl transition-all active:scale-95 focus:outline-none pointer-events-auto"
      >
        <X className="h-8 w-8" />
        <span className="sr-only">Close Viewer</span>
      </button>

      {/* Constraints: Absolute inset ensures image is bounded by viewport */}
      <div 
        className="absolute inset-0 flex items-center justify-center p-4 md:p-12 overflow-hidden pointer-events-none" 
      >
        <img
          src={photo.url}
          alt="Site documentation"
          className="max-w-full max-h-full object-contain shadow-2xl rounded-sm border border-white/5 pointer-events-none select-none"
        />
      </div>

      {/* Capture Metadata Overlay */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none px-4">
        <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
          <p className="text-[10px] font-bold text-white/90 uppercase tracking-widest text-center">
            Captured {new Date(photo.takenAt).toLocaleString()}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
