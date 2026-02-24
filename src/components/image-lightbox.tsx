'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import Image from 'next/image';
import { Photo } from '@/lib/types';
import { ClientDate } from './client-date';

interface ImageLightboxProps {
  photo: Photo | null;
  onClose: () => void;
}

/**
 * ImageLightbox - A robust full-screen viewer for site documentation.
 * Uses Radix Primitives directly to escape standard modal constraints.
 */
export function ImageLightbox({ photo, onClose }: ImageLightboxProps) {
  return (
    <DialogPrimitive.Root open={!!photo} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[140] bg-black/95 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content 
          className="fixed inset-0 z-[150] flex items-center justify-center outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {photo && (
            <div className="relative w-screen h-screen flex items-center justify-center p-4 sm:p-10">
              {/* High-visibility Close Button */}
              <button
                onClick={onClose}
                className="absolute top-6 right-6 z-[170] h-12 w-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md border border-white/10 shadow-2xl transition-all"
              >
                <X className="h-8 w-8" />
                <span className="sr-only">Close</span>
              </button>

              {/* Main Image Container - Guaranteed Aspect Ratio Scaling */}
              <div className="relative w-full h-full">
                <Image
                  src={photo.url}
                  alt="Site Documentation"
                  fill
                  className="object-contain"
                  priority
                  sizes="100vw"
                />
              </div>
              
              {/* Documentation Metadata Footer */}
              <div className="absolute bottom-10 left-0 right-0 flex justify-center px-4 z-[160] pointer-events-none">
                <div className="bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-primary">Site Documentation</span>
                    <span className="text-xs font-medium text-white/90">
                      Captured <ClientDate date={photo.takenAt} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
