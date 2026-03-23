'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Check, X } from 'lucide-react';

interface SignaturePadProps {
  onSave: (dataUri: string) => void;
  onCancel: () => void;
}

export function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas dimensions based on CSS display size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      context.scale(window.devicePixelRatio, window.devicePixelRatio);
      context.lineCap = 'round';
      context.lineWidth = 3;
      context.strokeStyle = '#000000';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    setIsEmpty(false);
    const { x, y } = getCoordinates(e);
    const context = canvasRef.current?.getContext('2d');
    if (context) {
      context.beginPath();
      context.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const context = canvasRef.current?.getContext('2d');
    if (context) {
      context.lineTo(x, y);
      context.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      setIsEmpty(true);
    }
  };

  const handleSave = () => {
    if (canvasRef.current) {
      onSave(canvasRef.current.toDataURL('image/png'));
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full min-h-[300px]">
      <div className="relative flex-1 border-2 border-dashed border-primary/20 rounded-xl bg-muted/5 overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="absolute inset-0 w-full h-full touch-none cursor-crosshair"
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
            <p className="text-sm font-bold uppercase tracking-widest">Sign on screen</p>
          </div>
        )}
      </div>
      
      <div className="flex justify-between items-center gap-3">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" /> Cancel
        </Button>
        
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={clearCanvas}>
            <Eraser className="h-4 w-4 mr-2" /> Clear
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={isEmpty}>
            <Check className="h-4 w-4 mr-2" /> Confirm Signature
          </Button>
        </div>
      </div>
    </div>
  );
}
