'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type VoiceInputProps = {
  onResult: (text: string) => void;
  className?: string;
};

/**
 * VoiceInput - A component that provides a microphone button to transcribe speech into text.
 * Uses the Web Speech API (SpeechRecognition).
 */
export function VoiceInput({ onResult, className }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    }
  }, []);

  if (!isSupported) return null;

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onResult(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === 'not-allowed') {
        toast({
          title: 'Microphone Access Denied',
          description: 'Please allow microphone access in your browser settings to use voice transcription.',
          variant: 'destructive',
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Speech recognition start error:', e);
      setIsListening(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={startListening}
      disabled={isListening}
      title={isListening ? "Listening..." : "Click to speak"}
    >
      {isListening ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      <span className="sr-only">Voice Input</span>
    </Button>
  );
}
