
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
import { MessageSquareReply, Camera, Upload, FileIcon, X, RefreshCw, FileText, Download, Loader2 } from 'lucide-react';
import type { ClientInstruction, DistributionUser, ChatMessage, Photo, FileAttachment } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { ClientDate } from '../../components/client-date';
import { Badge } from '@/components/ui/badge';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { CameraOverlay } from '@/components/camera-overlay';

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
  const storage = useStorage();
  const [isPending, startTransition] = useTransition();

  // Media state
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
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
      setIsReadingFiles(false);
    }
  }, [open, form]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    
    setIsReadingFiles(true);
    const readers = Array.from(selectedFiles).map(f => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (re) => {
          setFiles(prev => [...prev, {
            name: f.name,
            type: f.type,
            size: f.size,
            url: re.target?.result as string
          }]);
          resolve();
        };
        reader.readAsDataURL(f);
      });
    });

    await Promise.all(readers);
    setIsReadingFiles(false);
  };

  const onSubmit = (values: AddChatMessageFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Uploading', description: 'Persisting media to cloud storage...' });

        // 1. Upload Photos
        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `instruction-threads/photos/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        // 2. Upload Files
        const uploadedFiles = await Promise.all(
          files.map(async (f, i) => {
            if (f.url.startsWith('data:')) {
              const blob = await dataUriToBlob(f.url);
              const url = await uploadFile(storage, `instruction-threads/files/${Date.now()}-${i}-${f.name}`, blob);
              return { ...f, url };
            }
            return f;
          })
        );

        const newMessage: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          sender: currentUser.name,
          senderEmail: currentUser.email.toLowerCase().trim(),
          message: values.message,
          createdAt: new Date().toISOString(),
          photos: uploadedPhotos,
          files: uploadedFiles,
        };

        const docRef = doc(db, 'client-instructions', instruction.id);
        const updates = { 
            messages: arrayUnion(newMessage)
        };

        await updateDoc(docRef, updates);
        toast({ title: 'Success', description: 'Update posted.' });
        setOpen(false);

      } catch (err) {
        console.error('Thread post error:', err);
        toast({ title: 'Error', description: 'Failed to post update. Check your connection.', variant: 'destructive' });
      }
    });
  };

  const isAccepted = instruction.status === 'accepted';
  const sortedMessages = [...(instruction.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Client Instruction Conversation</DialogTitle>
            <DialogDescription>
              Discuss requirements or provide implementation updates.
            </DialogDescription>
          </DialogHeader>
          
          <div className='py-4 space-y-4'>
              <div className='bg-muted/30 p-3 rounded-lg border-l-4 border-l-primary shadow-sm'>
                  <p className='text-[10px] font-bold text-primary uppercase tracking-widest mb-1'>Original Directive</p>
                  <p className='text-sm text-foreground mb-2 line-clamp-3 font-medium'>{instruction.originalText}</p>
                  
                  {(instruction.photos && instruction.photos.length > 0) || (instruction.files && instruction.files.length > 0) ? (
                    <div className="flex gap-2 flex-wrap pt-2 border-t border-dashed">
                      {instruction.photos?.map((p, i) => (
                        <div key={`ref-p-${i}`} className="relative w-8 h-8 rounded border overflow-hidden">
                          <Image src={p.url} alt="Ref" fill className="object-cover" />
                        </div>
                      ))}
                      {instruction.files?.map((f, i) => (
                        <div key={`ref-f-${i}`} className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded text-[8px] text-muted-foreground border">
                          <FileText className="h-2 w-2" />
                          <span className="truncate max-w-[60px]">{f.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
              </div>

              <div className='space-y-3 bg-muted/10 p-3 rounded-md border'>
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
                                  
                                  {(msg.photos?.length || 0) > 0 && (
                                    <div className="grid grid-cols-2 gap-1 mt-2">
                                      {msg.photos?.map((p, i) => (
                                        <div key={i} className="relative aspect-video rounded overflow-hidden border bg-background min-w-[100px]">
                                          <Image src={p.url} alt="Attached" fill className="object-cover" />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {(msg.files?.length || 0) > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {msg.files?.map((f, i) => (
                                        <div key={i} className={cn("flex items-center gap-1.5 p-1.5 rounded text-[10px] border", isMe ? "bg-primary-foreground/10 border-primary-foreground/20 text-white" : "bg-background border-border text-primary")}>
                                          <FileText className="h-3 w-3" />
                                          <span className="truncate max-w-[120px]">{f.name}</span>
                                        </div>
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
                          <VoiceInput onResult={(text) => form.setValue('message', text)} />
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

                      {(photos.length > 0 || files.length > 0 || isReadingFiles || isPending) && (
                        <div className="flex flex-wrap gap-2 border rounded-md p-2 bg-muted/20">
                          {isReadingFiles && <div className="flex items-center gap-2 text-[10px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Processing files...</div>}
                          {isPending && <div className="flex items-center gap-2 text-[10px] text-primary"><Loader2 className="h-3 w-3 animate-spin" /> Uploading to cloud...</div>}
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
                        <div className="flex gap-1.5">
                          <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)}><Camera className="h-3.5 w-3.5 mr-1" />Camera</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-1" />Photos</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()}><FileIcon className="h-3.5 w-3.5 mr-1" />Files</Button>
                        </div>
                        
                        <Button type="submit" className="ml-auto" disabled={isReadingFiles || isPending}>
                            {isPending ? 'Posting...' : 'Post Update'}
                        </Button>
                      </div>

                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={(e) => {
                        const selected = e.target.files;
                        if (!selected) return;
                        Array.from(selected).forEach(f => {
                          const reader = new FileReader();
                          reader.onload = (re) => {
                              setPhotos(prev => [...prev, { 
                                  url: re.target?.result as string, 
                                  takenAt: new Date().toISOString() 
                              }]);
                          };
                          reader.readAsDataURL(f);
                        });
                      }} />
                      <input type="file" ref={docInputRef} className="hidden" multiple onChange={handleFileSelect} />
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

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(photo) => setPhotos(prev => [...prev, photo])} 
        title="Implementation documentation"
      />
    </>
  );
}
