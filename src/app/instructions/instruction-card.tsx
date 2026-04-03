'use client';

import { useState, useMemo, useTransition } from 'react';
import type { Instruction, Project, DistributionUser, ChatMessage, Photo, SubContractor } from '@/lib/types';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { 
  MessageCircle, 
  Trash2, 
  CheckCircle2, 
  FileText, 
  Download, 
  Maximize2, 
  Loader2,
  User,
  X,
  RefreshCw,
  Link as LinkIcon,
  Pencil,
  Circle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { RespondToInstruction } from './respond-to-instruction';
import { cn } from '@/lib/utils';
import { ImageLightbox } from '@/components/image-lightbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { EditInstruction } from './edit-instruction';
import { DistributeInstructionButton } from './distribute-instruction-button';
import { DownloadInstructionButton } from './download-instruction-button';

/**
 * InstructionCard - Displays a site instruction record with its audit trail.
 */
export function InstructionCard({ 
    instruction, 
    projects, 
    distributionUsers,
    subContractors,
    onDelete 
}: { 
    instruction: Instruction, 
    projects: Project[], 
    distributionUsers: DistributionUser[],
    subContractors: SubContractor[],
    onDelete?: () => void
}) {
  const project = projects.find((p) => p.id === instruction.projectId);
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isIssued = instruction.status === 'issued';
  
  const recipientEmail = instruction.recipients?.[0];
  const recipient = subContractors.find(s => s.email === recipientEmail) || distributionUsers.find(u => u.email === recipientEmail);

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'instructions', instruction.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Instruction deleted.' });
      if (onDelete) onDelete();
    });
  };

  const sortedMessages = useMemo(() => [...(instruction.messages || [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [instruction.messages]);

  return (
    <>
      <Card className={cn(
          "border-l-4 transition-all hover:shadow-md", 
          isIssued ? "border-l-green-500 bg-green-50/5" : "border-l-orange-400 bg-orange-50/5"
      )}>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">{project?.name || 'Unknown Project'}</CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] bg-background shrink-0">{instruction.reference}</Badge>
              </div>
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-xs text-muted-foreground/80">
                  Logged <ClientDate date={instruction.createdAt} />
                </span>
                {instruction.clientInstructionId && (
                    <Badge variant="outline" className="text-[9px] gap-1 h-4 bg-background">
                        <LinkIcon className="h-2 w-2" /> From Client Directive
                    </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <Badge variant={isIssued ? "secondary" : "default"} className={cn("h-6", isIssued && "bg-green-100 text-green-800 border-green-200")}>
                  {isIssued ? "Issued" : "Draft"}
              </Badge>

              <div className="flex items-center gap-1">
                  <DownloadInstructionButton instruction={instruction} project={project} subContractors={subContractors} />
                  <DistributeInstructionButton instruction={instruction} project={project} subContractors={subContractors} />
                  
                  <Button variant="ghost" size="icon" onClick={() => setIsEditDialogOpen(true)}>
                      <Pencil className="h-4 w-4" />
                  </Button>

                  <RespondToInstruction instruction={instruction} currentUser={distributionUsers[0] || { email: 'unknown' } as any} />

                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Instruction?</AlertDialogTitle><AlertDialogDescription>Permanently remove this record and its audit trail.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-6">
          <div className="bg-muted/30 p-4 rounded-xl border border-dashed space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Trade Instruction</span>
                  <span className="text-xs font-bold text-primary">{recipient?.name || recipientEmail || 'Unassigned'}</span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{instruction.originalText}</p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {sortedMessages.length > 0 && (
              <AccordionItem value="conversation" className="border-b-0">
                  <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2">
                      <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          <span>Implementation Thread ({sortedMessages.length})</span>
                      </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                      <div className="space-y-4 bg-muted/10 p-4 rounded-lg border">
                          {sortedMessages.map((msg) => {
                              const isSystem = msg.senderEmail === 'system@sitecommand.internal';
                              return (
                                  <div key={msg.id} className={cn("flex flex-col", isSystem ? "items-center" : "items-start")}>
                                      {isSystem ? (
                                          <Badge variant="outline" className="text-[10px]">{msg.message}</Badge>
                                      ) : (
                                          <div className="bg-background px-4 py-2 rounded-2xl rounded-tl-none border shadow-sm max-w-[90%]">
                                              <p className="text-[10px] font-bold mb-1 text-primary">{msg.sender}</p>
                                              <p className="text-sm leading-relaxed">{msg.message}</p>
                                              <div className="text-[9px] mt-2 text-muted-foreground opacity-70"><ClientDate date={msg.createdAt} /></div>
                                          </div>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  </AccordionContent>
              </AccordionItem>
            )}

            {instruction.photos && instruction.photos.length > 0 && (
              <AccordionItem value="photo" className="border-b-0">
                <AccordionTrigger className="text-sm font-semibold hover:no-underline py-2">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    <span>Site Evidence ({instruction.photos.length})</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                      {instruction.photos.map((p, i) => (
                        <div key={i} className="relative aspect-video rounded-lg overflow-hidden border cursor-pointer group" onClick={() => setViewingPhoto(p)}>
                            <Image src={p.url} alt="Evidence" fill className="object-cover" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Maximize2 className="h-5 w-5 text-white" />
                            </div>
                        </div>
                      ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </CardContent>
      </Card>

      <EditInstruction 
        item={instruction} 
        projects={projects} 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
      />

      <ImageLightbox photo={viewingPhoto} onClose={() => setViewingPhoto(null)} />
    </>
  );
}
