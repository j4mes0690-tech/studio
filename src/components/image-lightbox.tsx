'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';
import { Photo } from '@/lib/types';
import { ClientDate } from './client-date';
import { useEffect } from 'react';

interface ImageLightboxProps {
  photo: Photo | null;
  onClose: () => void;
}

/**
 * ImageLightbox - A robust, full-screen documentation viewer.
 * Designed to show the entire site photo without cropping or UI interference.
 */
export function ImageLightbox({ photo, onClose }: ImageLightboxProps) {
  // Prevent body scrolling when the lightbox is active
  useEffect(() => {
    if (photo) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [photo]);

  if (!photo) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-10"
      onClick={onClose}
    >
      {/* High-visibility Close Button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-6 right-6 z-[10000] h-12 w-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/10 shadow-2xl transition-all active:scale-95"
      >
        <X className="h-8 w-8" />
        <span className="sr-only">Close Viewer</span>
      </button>

      {/* Main Image Container */}
      <div className="relative w-full h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <Image
          src={photo.url}
          alt="Site documentation"
          fill
          className="object-contain"
          priority
          sizes="100vw"
        />
      </div>

      {/* Documentation Overlay */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none px-4">
        <div className="bg-black/60 backdrop-blur-xl px-8 py-3 rounded-full border border-white/10 shadow-2xl text-center pointer-events-auto">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary">Site Documentation</span>
            <span className="text-xs font-medium text-white/90">
              Captured <ClientDate date={photo.takenAt} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
