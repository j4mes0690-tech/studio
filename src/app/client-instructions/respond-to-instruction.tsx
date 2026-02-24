
'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageSquareReply, Camera, Upload, FileIcon, X, RefreshCw, FileText } from 'lucide-react';
import type { ClientInstruction, DistributionUser, ChatMessage, Photo, FileAttachment } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { ClientDate } from '../../components/client-date';
import { Badge } from '@/components/ui/badge';
import { VoiceInput } from '@/components/voice-input';
import { Separator } from '@/components/ui/separator';

const AddChatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.'),
});

type AddChatMessageFormValues = z.infer<typeof AddChatMessageSchema>;

type RespondToInstructionProps = {
  instruction: ClientInstruction;
  currentUser: DistributionUser;
};

export function RespondToInstruction({ instruction, currentUser }: RespondToInstructionProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  // Media state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AddChatMessageFormValues>({
    resolver: zodResolver(AddChatMessageSchema),
    defaultValues: {
      message: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({ message: '' });
      setPhotos([]);
      setFiles([]);
      setIsCameraOpen(false);
    }
  }, [open, form]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getCameraPermission = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Camera failed', err);
      }
    };
    if (isCameraOpen) getCameraPermission();
    return () => stream?.getTracks().forEach(t => t.stop());
  }, [isCameraOpen, facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      const aspectRatio = video.videoWidth / video.videoHeight;
      canvas.width = 600;
      canvas.height = 600 / aspectRatio;
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPhotos(prev => [...prev, { url: canvas.toDataURL('image/jpeg', 0.8), takenAt: new Date().toISOString() }]);
      setIsCameraOpen(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    Array.from(selectedFiles).forEach(f => {
      const reader = new FileReader();
      reader.onload = (re) => {
        setFiles(prev => [...prev, {
          name: f.name,
          type: f.type,
          size: f.size,
          url: re.target?.result as string
        }]);
      };
      reader.readAsDataURL(f);
    });
  };

  const onSubmit = (values: AddChatMessageFormValues) => {
    startTransition(async () => {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sender: currentUser.name,
        senderEmail: currentUser.email.toLowerCase().trim(),
        message: values.message,
        createdAt: new Date().toISOString(),
        photos: photos,
        files: files,
      };

      const docRef = doc(db, 'client-instructions', instruction.id);
      const updates = { 
          messages: arrayUnion(newMessage)
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Message sent.' });
          setOpen(false);
        })
        .catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const isAccepted = instruction.status === 'accepted';
  const sortedMessages = [...(instruction.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                  <MessageSquareReply className="h-4 w-4" />
                  <span className="sr-only">Respond to Directive</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Respond to Directive</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Client Instruction Conversation</DialogTitle>
          <DialogDescription>
            Post a message to discuss this directive or provide implementation updates.
          </DialogDescription>
        </DialogHeader>
        
        <div className='flex-1 overflow-y-auto min-h-0 py-4 px-2 space-y-4 bg-muted/10 rounded-md border'>
            <div className='bg-background p-3 rounded-lg border-l-4 border-l-primary shadow-sm mb-6'>
                <p className='text-[10px] font-bold text-primary uppercase tracking-widest mb-1'>Original Directive</p>
                <p className='text-sm text-foreground line-clamp-3 font-medium'>{instruction.originalText}</p>
            </div>

            <div className='space-y-3'>
                {sortedMessages.map(msg => {
                    const normalizedCurrentEmail = (currentUser.email || '').toLowerCase().trim();
                    const normalizedSenderEmail = (msg.senderEmail || '').toLowerCase().trim();
                    const isMe = normalizedSenderEmail === normalizedCurrentEmail;
                    const isSystem = msg.senderEmail === 'system@sitecommand.internal';

                    if (isSystem) {
                        return (
                            <div key={msg.id} className="flex justify-center my-2">
                                <span className="bg-muted/50 text-[9px] uppercase font-bold px-3 py-1 rounded-full text-muted-foreground border">
                                    {msg.message}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                            <div className={cn(
                                "px-3 py-1.5 rounded-2xl max-w-[90%] shadow-sm",
                                isMe 
                                    ? "bg-primary text-primary-foreground rounded-tr-none" 
                                    : "bg-muted text-foreground rounded-tl-none border"
                            )}>
                                {!isMe && <p className="text-[9px] font-bold mb-0.5 text-primary">{msg.sender}</p>}
                                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                
                                {/* Message Attachments */}
                                {(msg.photos?.length || 0) > 0 && (
                                  <div className="grid grid-cols-2 gap-1 mt-2">
                                    {msg.photos?.map((p, i) => (
                                      <Image key={i} src={p.url} alt="Attached" width={100} height={100} className="rounded object-cover aspect-video border bg-background" />
                                    ))}
                                  </div>
                                )}
                                {(msg.files?.length || 0) > 0 && (
                                  <div className="mt-2 space-y-1">
                                    {msg.files?.map((f, i) => (
                                      <a key={i} href={f.url} download={f.name} className={cn("flex items-center gap-1.5 p-1.5 rounded text-[10px] border", isMe ? "bg-primary-foreground/10 border-primary-foreground/20 text-white" : "bg-background border-border text-primary")}>
                                        <FileText className="h-3 w-3" />
                                        <span className="truncate max-w-[120px]">{f.name}</span>
                                      </a>
                                    ))}
                                  </div>
                                )}

                                <div className={cn("text-[8px] text-right mt-1 opacity-70")}>
                                    <ClientDate date={msg.createdAt} />
                                </div>
                            </div>
                        </div>
                    );
                })}
                {sortedMessages.length === 0 && (
                    <p className='text-center text-xs text-muted-foreground py-4 italic'>No discussion yet. Be the first to respond.</p>
                )}
            </div>
        </div>

        {!isAccepted ? (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                            <span>Replying as:</span>
                            <Badge variant="secondary" className="text-[10px] px-2 py-0 h-auto">{currentUser.name}</Badge>
                        </div>
                        <VoiceInput 
                        onResult={(text) => {
                            form.setValue('message', text);
                        }}
                        />
                    </div>

                    <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                        <FormItem>
                        <FormControl>
                            <Textarea 
                                placeholder="Add a follow-up or implementation note..." 
                                className="min-h-[80px] resize-none" 
                                {...field} 
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    {/* Media Previews */}
                    {(photos.length > 0 || files.length > 0) && (
                      <div className="flex flex-wrap gap-2 border rounded-md p-2 bg-muted/20">
                        {photos.map((p, i) => (
                          <div key={i} className="relative w-12 h-12">
                            <Image src={p.url} alt="Pre" fill className="rounded object-cover border" />
                            <button type="button" className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                              <X className="h-2 w-2" />
                            </button>
                          </div>
                        ))}
                        {files.map((f, i) => (
                          <div key={i} className="relative flex items-center gap-1 bg-background border rounded px-2 py-1 text-[10px]">
                            <FileText className="h-3 w-3 text-primary" />
                            <span className="max-w-[60px] truncate">{f.name}</span>
                            <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>
                              <X className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {isCameraOpen ? (
                        <div className="flex-1 space-y-2 border rounded p-2">
                          <video ref={videoRef} className="w-full aspect-video bg-black rounded object-cover" autoPlay muted playsInline />
                          <div className="flex gap-2">
                            <Button type="button" size="sm" onClick={capturePhoto}>Capture</Button>
                            <Button type="button" variant="outline" size="sm" onClick={toggleCamera} title="Switch"><RefreshCw className="h-3 w-3" /></Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setIsCameraOpen(false)}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}><Camera className="h-3.5 w-3.5 mr-1" />Camera</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-1" />Photos</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()}><FileIcon className="h-3.5 w-3.5 mr-1" />Files</Button>
                        </div>
                      )}
                      
                      <Button type="submit" disabled={isPending} className="ml-auto">
                          {isPending ? 'Sending...' : 'Post Update'}
                      </Button>
                    </div>

                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
                      const selected = e.target.files;
                      if (!selected) return;
                      Array.from(selected).forEach(f => {
                        const reader = new FileReader();
                        reader.onload = (re) => setPhotos(prev => [...prev, { url: re.target?.result as string, takenAt: new Date().toISOString() }]);
                        reader.readAsDataURL(f);
                      });
                    }} />
                    <input type="file" ref={docInputRef} className="hidden" multiple onChange={handleFileSelect} />
                    <canvas ref={canvasRef} className="hidden" />
                </form>
            </Form>
        ) : (
            <div className="pt-4 border-t text-center">
                <p className="text-sm text-muted-foreground font-medium bg-green-50 text-green-700 py-3 rounded-md border border-green-100">
                    This instruction has been ACCEPTED. Further comments are disabled.
                </p>
            </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
