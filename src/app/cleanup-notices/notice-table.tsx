'use client';

import { useState, useMemo, useTransition } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { CleanUpNotice, Project, SubContractor, Photo } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash2, CheckCircle2, Loader2, Camera, Users, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EditCleanUpNotice } from './edit-notice';
import { sendCleanUpNoticeEmailAction } from './actions';

type SortKey = 'reference' | 'project' | 'description' | 'date' | 'status';
type SortOrder = 'asc' | 'desc';

type TableProps = {
  items: CleanUpNotice[];
  projects: Project[];
  subContractors: SubContractor[];
};

export function NoticeTable({ items, projects, subContractors }: TableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortKey) {
        case 'reference':
          valA = a.reference || '';
          valB = b.reference || '';
          break;
        case 'project':
          valA = projects.find(p => p.id === a.projectId)?.name || '';
          valB = projects.find(p => p.id === b.projectId)?.name || '';
          break;
        case 'description':
          valA = a.description || '';
          valB = b.description || '';
          break;
        case 'date':
          valA = new Date(a.createdAt).getTime();
          valB = new Date(b.createdAt).getTime();
          break;
        case 'status':
          valA = a.status || 'draft';
          valB = b.status || 'draft';
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortKey, sortOrder, projects]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="ml-2 h-3 w-3 text-muted-foreground/50" />;
    return sortOrder === 'asc' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('reference')}>
              <div className="flex items-center">Ref <SortIcon column="reference" /></div>
            </TableHead>
            <TableHead className="w-[150px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('project')}>
              <div className="flex items-center">Project <SortIcon column="project" /></div>
            </TableHead>
            <TableHead className="cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('description')}>
              <div className="flex items-center">Description <SortIcon column="description" /></div>
            </TableHead>
            <TableHead className="w-[100px] cursor-pointer hover:text-foreground transition-colors text-center" onClick={() => handleSort('status')}>
              <div className="flex items-center justify-center">Status <SortIcon column="status" /></div>
            </TableHead>
            <TableHead className="w-[120px] cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('date')}>
              <div className="flex items-center">Logged <SortIcon column="date" /></div>
            </TableHead>
            <TableHead className="w-[80px] text-center">Media</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => (
            <NoticeRow 
              key={item.id} 
              item={item} 
              projects={projects} 
              subContractors={subContractors}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function NoticeRow({ item, projects, subContractors }: { item: CleanUpNotice, projects: Project[], subContractors: SubContractor[] }) {
  const project = projects.find((p) => p.id === item.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isDraft = item.status === 'draft';

  const handleIssue = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const hasText = item.description && item.description.trim().length >= 10;
    const hasRecipients = item.recipients && item.recipients.length > 0;

    if (!hasText || !hasRecipients) {
      toast({ 
        title: "Requirements Not Met", 
        description: "A full description (min 10 chars) and assigned recipients are required to formally issue this notice.", 
        variant: "destructive" 
      });
      setIsEditDialogOpen(true);
      return;
    }

    startTransition(async () => {
      try {
        toast({ title: 'Processing', description: 'Generating report and distributing...' });

        // 1. Generate PDF & Distribute
        const { jsPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;

        const reportElement = document.createElement('div');
        reportElement.style.position = 'absolute';
        reportElement.style.left = '-9999px';
        reportElement.style.padding = '40px';
        reportElement.style.width = '800px';
        reportElement.style.background = 'white';
        reportElement.style.color = 'black';
        reportElement.style.fontFamily = 'sans-serif';

        reportElement.innerHTML = `
          <div style="border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="margin: 0; color: #1e40af; font-size: 28px;">Clean Up Notice</h1>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Reference: ${item.reference}</p>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
            <div><p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Project</p><p style="margin: 2px 0 0 0; font-size: 16px;">${project?.name || 'Project'}</p></div>
            <div><p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Date Issued</p><p style="margin: 2px 0 0 0; font-size: 16px;">${new Date().toLocaleDateString()}</p></div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 40px;">
            <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e293b;">Issue Description</h2>
            <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${item.description}</p>
          </div>
          ${item.photos && item.photos.length > 0 ? `
            <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Site Documentation</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
              ${item.photos.map(p => `<div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; padding: 10px;"><img src="${p.url}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 4px;" /></div>`).join('')}
            </div>
          ` : ''}
        `;

        document.body.appendChild(reportElement);
        const canvas = await html2canvas(reportElement, { scale: 3, useCORS: true, logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        document.body.removeChild(reportElement);

        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        if (subContractors && item.recipients) {
          const contacts = subContractors.filter(s => item.recipients?.includes(s.email));
          for (const sub of contacts) {
            await sendCleanUpNoticeEmailAction({
              email: sub.email,
              name: sub.name,
              projectName: project?.name || 'Project',
              reference: item.reference,
              pdfBase64,
              fileName: `CleanUpNotice-${item.reference}.pdf`
            });
          }
        }

        // 2. Update Status in Firestore
        const docRef = doc(db, 'cleanup-notices', item.id);
        await updateDoc(docRef, { status: 'issued' });
        
        toast({ title: 'Success', description: 'Notice issued and distributed.' });
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to issue notice.', variant: 'destructive' });
      }
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'cleanup-notices', item.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Deleted', description: 'Notice removed.' }))
        .catch((err) => {
          const permissionError = new FirestorePermissionError({
            path: `cleanup-notices/${item.id}`,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <TableRow 
      className={cn("group cursor-pointer", isDraft && "bg-orange-50/20")}
      onClick={() => setIsEditDialogOpen(true)}
    >
      <TableCell className="font-mono text-[10px]">{item.reference}</TableCell>
      <TableCell className="font-medium truncate max-w-[150px]">{project?.name || 'Unknown'}</TableCell>
      <TableCell>
        <div className="max-w-[300px] truncate text-sm" title={item.description}>
          {item.description || <span className="italic text-muted-foreground">No description</span>}
        </div>
      </TableCell>
      <TableCell className="text-center">
        {isDraft ? (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200 text-[10px]">DRAFT</Badge>
        ) : (
          <Badge variant="destructive" className="text-[10px] uppercase font-bold">ISSUED</Badge>
        )}
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">
          <ClientDate date={item.createdAt} format="date" />
        </span>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          {item.photos && item.photos.length > 0 && (
              <div className="flex items-center gap-1">
                  <Camera className="h-3 w-3" />
                  <span className="text-[10px] font-bold">{item.photos.length}</span>
              </div>
          )}
          {item.recipients && item.recipients.length > 0 && (
              <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span className="text-[10px] font-bold">{item.recipients.length}</span>
              </div>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <TooltipProvider>
            {isDraft && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-orange-600 h-8 w-8" onClick={handleIssue} disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    <span className="sr-only">Issue Notice</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Issue & Distribute Notice</p></TooltipContent>
              </Tooltip>
            )}

            <EditCleanUpNotice 
              notice={item} 
              projects={projects} 
              subContractors={subContractors} 
              open={isEditDialogOpen} 
              onOpenChange={setIsEditDialogOpen} 
            />
            
            <AlertDialog>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent><p>Delete Notice</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <AlertDialogContent onClick={e => e.stopPropagation()}>
                <AlertDialogHeader><AlertDialogTitle>Delete Notice?</AlertDialogTitle><AlertDialogDescription>Permanently remove this clean up notice from the log.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TooltipProvider>
        </div>
      </TableCell>
    </TableRow>
  );
}