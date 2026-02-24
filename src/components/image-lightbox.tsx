'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogPortal, DialogOverlay } from '@/components/ui/dialog';
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
 * ImageLightbox - A robust full-screen viewer for site documentation.
 * Uses object-contain to ensure images fit the screen perfectly without cropping.
 */
export function ImageLightbox({ photo, onClose }: ImageLightboxProps) {
  return (
    <Dialog open={!!photo} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95 z-[140]" />
        <DialogContent 
          className="fixed inset-0 z-[150] flex flex-col items-center justify-center p-0 m-0 border-none bg-transparent shadow-none max-w-none w-screen h-screen rounded-none !translate-x-0 !translate-y-0 !top-0 !left-0 outline-none"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>View Photo</DialogTitle>
          </DialogHeader>
          
          {photo && (
            <div className="relative w-full h-full flex flex-col items-center justify-center">
              {/* Close Button - High Z-Index */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-6 right-6 text-white hover:bg-white/20 z-[170] h-12 w-12 rounded-full backdrop-blur-md border border-white/10 shadow-2xl"
                onClick={onClose}
              >
                <X className="h-8 w-8" />
                <span className="sr-only">Close</span>
              </Button>

              {/* Main Image Container */}
              <div className="relative w-full h-full p-4 sm:p-8 md:p-12 flex items-center justify-center">
                <div className="relative w-full h-full max-w-full max-h-full">
                  <Image
                    src={photo.url}
                    alt="Site Documentation"
                    fill
                    className="object-contain"
                    priority
                    sizes="100vw"
                  />
                </div>
              </div>
              
              {/* Info Footer */}
              <div className="absolute bottom-10 left-0 right-0 flex justify-center px-4 z-[160] pointer-events-none">
                <div className="bg-black/60 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-2xl pointer-events-auto">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-primary">Site Evidence</span>
                    <span className="text-xs font-medium text-white/90">
                      Captured <ClientDate date={photo.takenAt} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
