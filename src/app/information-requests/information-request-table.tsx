'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { InformationRequest, Project, DistributionUser, ChatMessage, SubContractor } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { RespondToRequest } from './respond-to-request';
import { EditInformationRequest } from './edit-information-request';
import { useState, useTransition, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, deleteDoc, arrayUnion, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { XCircle, RefreshCw, Trash2, CalendarClock, MessageSquare, CheckCircle2, Loader2, Send, EyeOff, Bell, Pencil } from 'lucide-react';
import { cn, getPartnerEmails } from '@/lib/utils';
import { sendInformationRequestEmailAction } from './actions';
import { generateInformationRequestPDF } from '@/lib/pdf-utils';

type TableProps = {
  items: InformationRequest[];
  projects: Project[];
  distributionUsers: DistributionUser[];
  currentUser: DistributionUser;
};

export function InformationRequestTable({ items, projects, distributionUsers, currentUser }: TableProps) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Ref</TableHead>
            <TableHead className="w-[150px]">Project</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Due Date</TableHead>
            <TableHead className="w-[80px] text-center">Chat</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <RequestTableRow 
              key={item.id} 
              item={item} 
              projects={projects} 
              distributionUsers={distributionUsers} 
              currentUser={currentUser} 
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RequestTableRow({ item, projects, distributionUsers, currentUser }: { item: InformationRequest, projects: Project[], distributionUsers: DistributionUser[], currentUser: DistributionUser }) {
  const project = projects.find(p => p.id === order.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const subsQuery = useMemoFirebase(() => (db ? collection(db, 'sub-contractors') : null), [db]);
  const { data: allSubs } = useCollection<SubContractor>(subsQuery);

  const isDraft = item.status === 'draft';
  const email = currentUser?.email.toLowerCase().trim();

  const isAttentionRequired = useMemo(() => {
    if (!item || !email || item.status !== 'open') return false;
    if (item.dismissedBy?.includes(email)) return false;
    const isAssignedToMe = item.assignedTo.some(e => e.toLowerCase().trim() === email);
    const lastMessage = item.messages?.length > 0 ? [...item.messages].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
    const isMyRaisedWithResponse = item.raisedBy.toLowerCase().trim() === email && lastMessage && lastMessage.senderEmail.toLowerCase().trim() !== email;
    return isAssignedToMe || isMyRaisedWithResponse;
  }, [item, email]);

  const handleDismissAlert = (e: React.MouseEvent) => {
    e.stopPropagation();
    const docRef = doc(db, 'information-requests', item.id);
    updateDoc(docRef, { dismissedBy: arrayUnion(email) });
  };

  const handleUpdateStatus = (newStatus: 'open' | 'closed') => {
    startTransition(async () => {
      const docRef = doc(db, 'information-requests', item.id);
      const updates: any = { 
        status: newStatus,
        dismissedBy: [] 
      };

      const systemMsg: ChatMessage = {
        id: `msg-system-${Date.now()}`,
        sender: 'System',
        senderEmail: 'system@sitecommand.internal',
        message: newStatus === 'closed' 
          ? `Request closed by ${currentUser.name}.`
          : `Request reopened by ${currentUser.name}`,
        createdAt: new Date().toISOString(),
      };
      updates.messages = arrayUnion(systemMsg);

      updateDoc(docRef, updates)
        .then(() => toast({ title: 'Success', description: `Request ${newStatus}.` }))
        .catch((err) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const handleDistribute = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
        try {
            const targetEmail = item.assignedTo[0];
            const sub = allSubs?.find(s => s.email.toLowerCase() === targetEmail.toLowerCase());
            const recipientEmails = new Set<string>();
            recipientEmails.add(targetEmail.toLowerCase().trim());

            if (sub) {
                const partnerUsers = getPartnerEmails(sub.id, allSubs || [], distributionUsers);
                partnerUsers.forEach(e => recipientEmails.add(e));
            }

            const assignedToNames = item.assignedTo.map(email => distributionUsers.find(u => u.email === email)?.name || email);
            const pdf = await generateInformationRequestPDF(item, project, assignedToNames);
            const pdfBase64 = pdf.output('datauristring').split(',')[1];

            const result = await sendInformationRequestEmailAction({
                emails: Array.from(recipientEmails),
                projectName: project?.name || 'Project',
                reference: item.reference,
                description: item.description,
                raisedBy: distributionUsers.find(u => u.email === item.raisedBy)?.name || item.raisedBy,
                requestId: item.id,
                pdfBase64,
                fileName: `RFI-${item.reference}.pdf`,
                additionalFiles: item.files || []
            });

            if (result.success) {
                toast({ title: 'Success', description: 'Request notification, PDF and attachments resent.' });
            } else {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            }
        } catch (err) {
            console.error(err);
            toast({ title: 'Error', description: 'Failed to send notification.', variant: 'destructive' });
        }
    });
  };

  const handleIssue = (e: React.MouseEvent) => {
    e.stopPropagation();
    const hasText = item.description && item.description.trim().length >= 10;
    const hasRecipients = item.assignedTo && item.assignedTo.length > 0;

    if (!hasText || !hasRecipients) {
      toast({ 
        title: "Requirements Not Met", 
        description: "Please complete the enquiry details and assign recipients before issuing.", 
        variant: "destructive" 
      });
      setIsEditDialogOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        const docRef = doc(db, 'information-requests', item.id);
        await updateDoc(docRef, { status: 'open' });

        const targetEmail = item.assignedTo[0];
        const sub = allSubs?.find(s => s.email.toLowerCase() === targetEmail.toLowerCase());
        const recipientEmails = new Set<string>();
        recipientEmails.add(targetEmail.toLowerCase().trim());

        if (sub) {
            const partnerUsers = getPartnerEmails(sub.id, allSubs || [], distributionUsers);
            partnerUsers.forEach(e => recipientEmails.add(e));
        }

        const assignedToNames = item.assignedTo.map(email => distributionUsers.find(u => u.email === email)?.name || email);
        const pdf = await generateInformationRequestPDF(item, project, assignedToNames);
        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        await sendInformationRequestEmailAction({
            emails: Array.from(recipientEmails),
            projectName: project?.name || 'Project',
            reference: item.reference,
            description: item.description,
            raisedBy: distributionUsers.find(u => u.email === item.raisedBy)?.name || item.raisedBy,
            requestId: item.id,
            pdfBase64,
            fileName: `RFI-${item.reference}.pdf`,
            additionalFiles: item.files || []
        });

        toast({ title: 'Success', description: 'Request formally logged with PDF and file attachments.' });
      } catch (err) {
        console.error(err);
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'information-requests', item.id);
      await deleteDoc(docRef);
      toast({ title: 'Success', description: 'Request deleted.' });
    });
  };

  return (
    <TableRow 
      className={cn(
          "group cursor-pointer transition-all", 
          item.status === 'closed' && "opacity-60", 
          isDraft && "bg-orange-50/20",
          isAttentionRequired && "bg-primary/[0.03] ring-1 ring-inset ring-primary/20"
      )}
      href={`/information-requests/${item.id}`}
    >
      <TableCell className="font-mono text-[10px]">
          <div className="flex items-center gap-2">
              {isAttentionRequired && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
              {item.reference}
          </div>
      </TableCell>
      <TableCell className="font-medium truncate max-w-[150px]">{project?.name || 'Unknown'}</TableCell>
      <TableCell>
        <div className="max-w-[300px] truncate text-sm" title={item.description}>
          {item.description || <span className="italic text-muted-foreground">No description provided</span>}
        </div>
      </TableCell>
      <TableCell>
        {isDraft ? (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">DRAFT</Badge>
        ) : (
          <Badge variant={item.status === 'open' ? 'default' : 'secondary'} className="capitalize text-[10px]">
            {item.status}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {item.requiredBy ? (
          <div className={cn("flex items-center gap-1 text-xs font-medium", item.status === 'open' && new Date(item.requiredBy) < new Date() ? "text-destructive" : "text-muted-foreground")}>
            <CalendarClock className="h-3 w-3" />
            <ClientDate date={item.requiredBy} format="date" />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">None</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {item.messages?.length || 0}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isAttentionRequired && (
              <TooltipProvider>
                  <Tooltip>
                      <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8 hover:text-primary" onClick={handleDismissAlert}>
                              <EyeOff className="h-4 w-4" />
                          </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Dismiss Alert</p></TooltipContent>
                  </Tooltip>
              </TooltipProvider>
          )}

          {isDraft && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-orange-600" onClick={handleIssue} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span className="sr-only">Issue Request</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Issue Request</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            {!isDraft && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-primary" onClick={handleDistribute} disabled={isPending}>
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span className="sr-only">Distribute/Resend Notification & Attachments</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Distribute/Resend Notification & Attachments</p></TooltipContent>
                </Tooltip>

                <RespondToRequest item={item} currentUser={currentUser} />
                
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          {item.status === 'open' ? <XCircle className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>{item.status === 'open' ? 'Close' : 'Reopen'} Request</p></TooltipContent>
                  </Tooltip>
                  <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{item.status === 'open' ? 'Close RFI?' : 'Reopen RFI?'}</AlertDialogTitle>
                      <AlertDialogDescription>
                          {item.status === 'open' 
                              ? "Are you sure you want to mark this technical enquiry as resolved?" 
                              : "This will move the request back to 'Open' status for further updates."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleUpdateStatus(item.status === 'open' ? 'closed' : 'open')} disabled={isPending}>
                          Confirm
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            
            <EditInformationRequest 
              item={item} 
              projects={projects} 
              distributionUsers={distributionUsers} 
              open={isEditDialogOpen}
              onOpenChange={setIsEditDialogOpen}
            />
            
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent><p>Delete Request</p></TooltipContent>
              </Tooltip>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>Permanently delete this information request.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                    {isPending ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
  );
}
