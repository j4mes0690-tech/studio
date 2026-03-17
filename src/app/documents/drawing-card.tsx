
'use client';

import { useState, useTransition } from 'react';
import type { DrawingDocument, Project, DistributionUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  FileText, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  Clock,
  HardHat
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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
import { syncDrawingToSharePointAction } from './actions';

export function DrawingCard({ 
  drawing, 
  project,
  currentUser 
}: { 
  drawing: DrawingDocument; 
  project?: Project;
  currentUser: DistributionUser;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);

  const isSynced = !!drawing.sharepointUrl;

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'drawings', drawing.id));
      toast({ title: 'Removed', description: 'Drawing removed from register.' });
    });
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncDrawingToSharePointAction({
        projectId: drawing.projectId,
        projectName: project?.name || 'Unknown Project',
        drawingTitle: drawing.title,
        drawingRef: drawing.reference,
        revision: drawing.revision,
        fileUrl: drawing.file.url,
        fileName: drawing.file.name
      });

      if (result.success) {
        await updateDoc(doc(db, 'drawings', drawing.id), {
          sharepointUrl: result.sharepointUrl,
          lastSyncedAt: result.timestamp
        });
        toast({ title: 'Backup Complete', description: 'Drawing successfully synced to SharePoint.' });
      } else {
        toast({ title: 'Sync Error', description: result.message, variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Connection Error', description: 'Failed to communicate with backup server.', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card className={cn(
        "transition-all hover:border-primary border-l-4 shadow-sm group",
        drawing.status === 'superseded' ? 'border-l-muted opacity-60 grayscale' : 'border-l-primary'
    )}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px] bg-background text-primary shrink-0">
                {drawing.reference}
              </Badge>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-black">
                REV {drawing.revision}
              </Badge>
              <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                {drawing.title}
              </CardTitle>
            </div>
            <CardDescription className="flex items-center gap-2 font-bold text-foreground text-xs uppercase tracking-tight">
              {project?.name || 'Unknown Project'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge className={cn(
                "text-[9px] uppercase font-bold tracking-tight h-5",
                drawing.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
            )}>
                {drawing.status}
            </Badge>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove from Register?</AlertDialogTitle>
                        <AlertDialogDescription>Permanently remove this document record and its SharePoint link.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-dashed text-[11px]">
            <div className="flex items-center gap-3">
                <div className="bg-background p-2 rounded border shadow-sm">
                    <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                    <p className="font-bold truncate max-w-[150px]">{drawing.file.name}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
                        {(drawing.file.size / 1024 / 1024).toFixed(2)} MB • {drawing.file.type.split('/')[1]}
                    </p>
                </div>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-2 font-bold" asChild>
                <a href={drawing.file.url} download={drawing.file.name}>
                    <Download className="h-3.5 w-3.5" />
                    Open
                </a>
            </Button>
        </div>

        <div className={cn(
            "px-3 py-2 rounded-md border flex items-center justify-between transition-all",
            isSynced ? "bg-green-50/50 border-green-100" : "bg-amber-50/50 border-amber-100"
        )}>
            <div className="flex items-center gap-3">
                <div className={cn(
                    "p-1.5 rounded-full",
                    isSynced ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600"
                )}>
                    {isSynced ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                </div>
                <div>
                    <p className={cn("text-[9px] font-black uppercase tracking-widest", isSynced ? "text-green-700" : "text-amber-700")}>
                        SharePoint Sync
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                        {isSynced ? `Last backed up: ${new Date(drawing.lastSyncedAt!).toLocaleDateString()}` : 'Backup pending...'}
                    </p>
                </div>
            </div>
            {isSynced ? (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" asChild>
                    <a href={drawing.sharepointUrl!} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </Button>
            ) : (
                <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-primary hover:bg-primary/5 gap-1.5" onClick={handleSync} disabled={isSyncing}>
                    {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Sync Now
                </Button>
            )}
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pt-1">
            <span className="flex items-center gap-1.5">
                <HardHat className="h-3 w-3" />
                Uploaded by {drawing.createdByEmail}
            </span>
            <span className="font-bold">
                <ClientDate date={drawing.createdAt} format="date" />
            </span>
        </div>
      </CardContent>
    </Card>
  );
}
