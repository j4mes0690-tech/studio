'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';
import type { Photo } from '@/lib/types';
import { ClientDate } from './client-date';
import { useEffect } from 'react';

interface ImageLightboxProps {
  photo: Photo | null;
  onClose: () => void;
}

/**
 * ImageLightbox - A high-performance, full-screen documentation viewer.
 * Bypasses all UI constraints to ensure site photos fit the screen perfectly.
 */
export function ImageLightbox({ photo, onClose }: ImageLightboxProps) {
  // Lock body scroll when active
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
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm select-none"
      onClick={onClose}
    >
      {/* Close Control */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-6 right-6 z-[10000] h-12 w-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/20 shadow-2xl transition-all active:scale-95"
      >
        <X className="h-8 w-8" />
        <span className="sr-only">Close Viewer</span>
      </button>

      {/* Edge-to-Edge Image Container */}
      <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-full h-full">
          <Image
            src={photo.url}
            alt="Site documentation"
            fill
            className="object-contain"
            priority
            quality={100}
            sizes="100vw"
          />
        </div>
      </div>

      {/* Metadata Footer Overlay */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none px-4">
        <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl pointer-events-auto flex flex-col items-center gap-1">
          <span className="text-[10px] font-black tracking-[0.25em] uppercase text-primary">Documentation Record</span>
          <span className="text-xs font-semibold text-white/90">
            Captured <ClientDate date={photo.takenAt} />
          </span>
        </div>
      </div>
    </div>
  );
}
