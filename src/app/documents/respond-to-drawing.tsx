
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
import { MessageSquareReply, Camera, Upload, FileIcon, X, RefreshCw, FileText, Download, Loader2, CheckCircle2, AlertCircle, ShieldCheck, MessageSquare } from 'lucide-react';
import type { DrawingDocument, Project, DistributionUser, ChatMessage, Photo, FileAttachment, DrawingApprovalStatus } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { ClientDate } from '@/components/client-date';
import { Badge } from '@/components/ui/badge';
import { VoiceInput } from '@/components/voice-input';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { CameraOverlay } from '@/components/camera-overlay';
import { Separator } from '@/components/ui/separator';

const AddChatMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty.'),
});

type AddChatMessageFormValues = z.infer<typeof AddChatMessageSchema>;

type RespondToDrawingProps = {
  drawing: DrawingDocument;
  project?: Project;
  currentUser: DistributionUser;
};

export function RespondToDrawing({ drawing, project, currentUser }: RespondToDrawingProps) {
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

  const handleApplyStatus = (newStatus: DrawingApprovalStatus) => {
    startTransition(async () => {
        try {
            const docRef = doc(db, 'drawings', drawing.id);
            const statusLabels = {
                'status-a': 'Status A: Approved',
                'status-b': 'Status B: Approved with Comments',
                'status-c': 'Status C: Declined'
            };
            const label = statusLabels[newStatus as keyof typeof statusLabels];

            const systemMessage: ChatMessage = {
                id: `sys-${Date.now()}`,
                sender: 'System',
                senderEmail: 'system@sitecommand.internal',
                message: `APPROVAL UPDATE: ${currentUser.name} has applied formal ${label}.`,
                createdAt: new Date().toISOString()
            };

            await updateDoc(docRef, {
                approvalStatus: newStatus,
                messages: arrayUnion(systemMessage)
            });

            toast({ title: 'Status Applied', description: `Drawing formal status set to ${label}.` });
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to update drawing status.', variant: 'destructive' });
        }
    });
  };

  const onSubmit = (values: AddChatMessageFormValues) => {
    startTransition(async () => {
      try {
        toast({ title: 'Uploading', description: 'Persisting media...' });

        const uploadedPhotos = await Promise.all(
          photos.map(async (p, i) => {
            if (p.url.startsWith('data:')) {
              const blob = await dataUriToBlob(p.url);
              const url = await uploadFile(storage, `drawing-threads/photos/${Date.now()}-${i}.jpg`, blob);
              return { ...p, url };
            }
            return p;
          })
        );

        const uploadedFiles = await Promise.all(
          files.map(async (f, i) => {
            if (f.url.startsWith('data:')) {
              const blob = await dataUriToBlob(f.url);
              const url = await uploadFile(storage, `drawing-threads/files/${Date.now()}-${i}-${f.name}`, blob);
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

        const docRef = doc(db, 'drawings', drawing.id);
        await updateDoc(docRef, { 
            messages: arrayUnion(newMessage)
        });
        toast({ title: 'Success', description: 'Clarification posted.' });
        form.reset({ message: '' });
        setPhotos([]);
        setFiles([]);

      } catch (err) {
        console.error('Thread post error:', err);
        toast({ title: 'Error', description: 'Failed to post update.', variant: 'destructive' });
      }
    });
  };

  const sortedMessages = [...(drawing.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const isApprover = project?.drawingApprovers?.includes(currentUser.email.toLowerCase().trim());

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] font-black uppercase tracking-tighter hover:bg-black/5" onClick={e => e.stopPropagation()}>
                Workspace
            </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/10">
            <div className="flex items-center justify-between">
                <div>
                    <DialogTitle>Approval Workspace: {drawing.reference}</DialogTitle>
                    <DialogDescription>Technical discussion and formal sign-off tracking.</DialogDescription>
                </div>
                {isApprover && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1.5">
                        <ShieldCheck className="h-3 w-3" /> Authorised Approver
                    </Badge>
                )}
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Approver Controls */}
              {isApprover && drawing.approvalStatus === 'awaiting' && (
                  <div className="bg-primary/5 p-4 rounded-xl border-2 border-primary/20 space-y-4 animate-in fade-in zoom-in duration-300">
                      <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase text-primary tracking-widest">Apply Formal Project Status</p>
                          <Badge variant="outline" className="text-[8px] bg-white">Mandatory Review</Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <Button 
                            variant="outline" 
                            className="h-11 border-green-200 text-green-700 hover:bg-green-50 font-bold gap-2"
                            onClick={() => handleApplyStatus('status-a')}
                            disabled={isPending}
                          >
                              <CheckCircle2 className="h-4 w-4" /> Status A
                          </Button>
                          <Button 
                            variant="outline" 
                            className="h-11 border-blue-200 text-blue-700 hover:bg-blue-50 font-bold gap-2"
                            onClick={() => handleApplyStatus('status-b')}
                            disabled={isPending}
                          >
                              <MessageSquare className="h-4 w-4" /> Status B
                          </Button>
                          <Button 
                            variant="outline" 
                            className="h-11 border-red-200 text-red-700 hover:bg-red-50 font-bold gap-2"
                            onClick={() => handleApplyStatus('status-c')}
                            disabled={isPending}
                          >
                              <AlertCircle className="h-4 w-4" /> Status C
                          </Button>
                      </div>
                  </div>
              )}

              {drawing.approvalStatus !== 'awaiting' && (
                  <div className={cn(
                      "p-4 rounded-xl border-2 flex items-center justify-between",
                      drawing.approvalStatus === 'status-a' ? 'bg-green-50 border-green-100 text-green-800' :
                      drawing.approvalStatus === 'status-b' ? 'bg-blue-50 border-blue-100 text-blue-800' :
                      'bg-red-50 border-red-100 text-red-800'
                  )}>
                      <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-5 w-5" />
                          <div>
                              <p className="text-xs font-black uppercase tracking-widest">Sign-off Finalised</p>
                              <p className="text-sm font-bold">Formal {drawing.approvalStatus.replace('-', ' ').toUpperCase()} applied.</p>
                          </div>
                      </div>
                      {isApprover && (
                          <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase hover:bg-black/5" onClick={() => handleApplyStatus('awaiting')}>
                              <RefreshCw className="h-3 w-3 mr-1.5" /> Reopen Review
                          </Button>
                      )}
                  </div>
              )}

              <div className='space-y-4 bg-muted/10 p-4 rounded-xl border border-dashed'>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest border-b pb-2">
                      <MessageSquareReply className="h-3 w-3" /> <span>Implementation & Review Thread</span>
                  </div>
                  
                  {sortedMessages.map(msg => {
                      const senderEmail = msg.senderEmail || '';
                      const isSystem = senderEmail === 'system@sitecommand.internal';
                      const isMe = !isSystem && senderEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim();

                      if (isSystem) {
                          return (
                              <div key={msg.id} className="flex justify-center my-2">
                                  <Badge variant="outline" className="bg-white/50 text-[9px] uppercase font-bold px-3 py-1 rounded-full text-muted-foreground border-dashed">
                                      {msg.message}
                                  </Badge>
                              </div>
                          );
                      }

                      return (
                          <div key={msg.id} className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                              <div className={cn(
                                  "px-4 py-2 rounded-2xl max-w-[90%] shadow-sm",
                                  isMe ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white text-foreground rounded-tl-none border"
                              )}>
                                  {!isMe && <p className="text-[10px] font-bold mb-1 text-primary">{msg.sender}</p>}
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                  
                                  {(msg.photos?.length || 0) > 0 && (
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                      {msg.photos?.map((p, i) => (
                                        <div key={i} className="relative aspect-video rounded-lg overflow-hidden border bg-background">
                                          <Image src={p.url} alt="Thread Evidence" fill className="object-cover" />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {(msg.files?.length || 0) > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {msg.files?.map((f, i) => (
                                        <div key={i} className={cn("flex items-center gap-2 p-2 rounded text-[10px] border", isMe ? "bg-primary-foreground/10 border-primary-foreground/20 text-white" : "bg-muted/50 border-border text-primary")}>
                                          <FileText className="h-3.5 w-3.5" />
                                          <span className="truncate max-w-[150px]">{f.name}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className={cn("text-[9px] text-right mt-2 opacity-70")}>
                                      <ClientDate date={msg.createdAt} />
                                  </div>
                              </div>
                          </div>
                      );
                  })}
                  {sortedMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center gap-2 opacity-40">
                          <MessageSquare className="h-10 w-10 text-muted-foreground" />
                          <p className='text-xs font-medium'>No clarifications recorded for this revision.</p>
                      </div>
                  )}
              </div>
          </div>

          <div className="p-6 border-t bg-white shrink-0">
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="flex items-center justify-between">
                          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Post Clarification</p>
                          <VoiceInput onResult={(text) => form.setValue('message', text)} />
                      </div>

                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                            <FormItem>
                            <FormControl>
                                <Textarea 
                                    placeholder="Discuss technical points or add review comments..." 
                                    className="min-h-[80px] resize-none" 
                                    {...field} 
                                />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                      />

                      <div className="flex flex-wrap gap-2">
                        {photos.map((p, i) => (
                            <div key={i} className="relative w-12 h-12 rounded border overflow-hidden">
                                <Image src={p.url} alt="Pre" fill className="object-cover" />
                                <button type="button" className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5" onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}>
                                    <X className="h-2 w-2" />
                                </button>
                            </div>
                        ))}
                        {files.map((f, i) => (
                            <div key={i} className="relative flex items-center gap-1 bg-muted border rounded px-2 py-1 text-[10px]">
                                <FileText className="h-3 w-3 text-primary" />
                                <span className="max-w-[80px] truncate">{f.name}</span>
                                <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>
                                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                                </button>
                            </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-1.5">
                          <Button type="button" variant="outline" size="sm" onClick={() => setIsCameraOpen(true)} className="h-9 px-3"><Camera className="h-4 w-4 mr-2" /> Camera</Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()} className="h-9 px-3"><Upload className="h-4 w-4 mr-2" /> Evidence</Button>
                        </div>
                        
                        <Button type="submit" className="font-bold min-w-[140px]" disabled={isReadingFiles || isPending}>
                            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post Clarification'}
                        </Button>
                      </div>

                      <input type="file" ref={docInputRef} className="hidden" multiple onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx" />
                  </form>
              </Form>
          </div>
        </DialogContent>
      </Dialog>

      <CameraOverlay 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={(photo) => setPhotos(prev => [...prev, photo])} 
        title="Review Documentation"
      />
    </>
  );
}
