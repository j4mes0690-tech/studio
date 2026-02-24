'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import Image from 'next/image';
import { Photo } from '@/lib/types';
import { ClientDate } from './client-date';

interface ImageLightboxProps {
  photo: Photo | null;
  onClose: () => void;
}

/**
 * ImageLightbox - A specialized full-screen viewer for site documentation.
 * Ensures images resize to fit the viewport regardless of aspect ratio.
 */
export function ImageLightbox({ photo, onClose }: ImageLightboxProps) {
  return (
    <Dialog open={!!photo} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-none w-screen h-screen p-0 m-0 overflow-hidden bg-black border-none flex flex-col items-center justify-center z-[150] rounded-none sm:rounded-none !translate-x-0 !translate-y-0 !top-0 !left-0">
        <DialogHeader className="sr-only">
          <DialogTitle>View Photo</DialogTitle>
        </DialogHeader>
        {photo && (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <div className="relative w-full h-full p-2 sm:p-6 md:p-10 flex items-center justify-center">
              <div className="relative w-full h-full">
                <Image
                  src={photo.url}
                  alt="Enlarged Site Documentation"
                  fill
                  className="object-contain"
                  priority
                  sizes="100vw"
                />
              </div>
            </div>
            
            {/* High-visibility Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/20 z-[160] h-12 w-12 rounded-full backdrop-blur-md border border-white/10 shadow-xl"
              onClick={onClose}
            >
              <X className="h-8 w-8" />
              <span className="sr-only">Close</span>
            </Button>

            {/* Information Overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-[160]">
              <div className="bg-black/50 backdrop-blur-lg p-4 rounded-2xl border border-white/10 shadow-2xl text-center">
                <div className="flex flex-col items-center gap-1">
                  <span className="font-bold tracking-[0.2em] uppercase text-[9px] text-primary">Site Documentation</span>
                  <span className="text-[11px] font-medium text-white/90 tabular-nums">
                    Captured <ClientDate date={photo.takenAt} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
