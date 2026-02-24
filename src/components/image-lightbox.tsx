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

export function ImageLightbox({ photo, onClose }: ImageLightboxProps) {
  return (
    <Dialog open={!!photo} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[100vw] w-screen h-[100dvh] p-0 overflow-hidden bg-black/95 border-none flex flex-col items-center justify-center z-[150]">
        <DialogHeader className="sr-only">
          <DialogTitle>View Photo</DialogTitle>
        </DialogHeader>
        {photo && (
          <div className="relative w-full h-full flex items-center justify-center">
            <Image
              src={photo.url}
              alt="Enlarged Site Documentation"
              fill
              className="object-contain"
              priority
            />
            
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-6 right-6 text-white hover:bg-white/20 z-50 h-12 w-12 rounded-full backdrop-blur-sm"
              onClick={onClose}
            >
              <X className="h-8 w-8" />
              <span className="sr-only">Close</span>
            </Button>

            {/* Info Overlay */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-50">
              <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-bold tracking-widest uppercase text-[10px] text-primary">Site Documentation</span>
                  <span className="text-[10px] font-medium text-white/70 tabular-nums">
                    <ClientDate date={photo.takenAt} />
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
