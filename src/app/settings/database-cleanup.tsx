'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { useFirestore } from '@/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Database, Loader2, AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react';

/**
 * DatabaseCleanup - Provides a one-click reset for project data.
 * Useful for clearing prototype data before production go-live.
 * Preserves the 'users' and 'system-settings' collections.
 */
export function DatabaseCleanup() {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const collectionsToClear = [
    'projects',
    'irs-items',
    'planner-tasks',
    'procurement-items',
    'holiday-requests',
    'site-diary',
    'drawings',
    'snagging-items',
    'toolbox-talk-templates',
    'permit-templates',
    'quality-checklists',
    'sub-contractors',
    'subcontract-orders',
    'client-instructions',
    'instructions',
    'cleanup-notices',
    'variations',
    'training-records',
    'training-needs',
    'payment-notices',
    'valuation-periods',
    'invitations'
  ];

  const handleWipeData = () => {
    startTransition(async () => {
      try {
        let totalDeleted = 0;
        
        for (const colName of collectionsToClear) {
          const querySnapshot = await getDocs(collection(db, colName));
          if (querySnapshot.empty) continue;

          // Process in batches of 500 (Firestore limit)
          const batchSize = 500;
          const docs = querySnapshot.docs;
          
          for (let i = 0; i < docs.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + batchSize);
            chunk.forEach((d) => {
              batch.delete(d.ref);
              totalDeleted++;
            });
            await batch.commit();
          }
        }

        toast({ 
          title: 'Database Wiped', 
          description: `Successfully removed ${totalDeleted} documents across ${collectionsToClear.length} collections. User profiles were preserved.` 
        });
      } catch (err) {
        console.error('Wipe error:', err);
        toast({ title: 'Error', description: 'Failed to clear some collections. Check permissions.', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="bg-destructive/5 border-2 border-destructive/20 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="bg-destructive/10 p-2.5 rounded-lg text-destructive">
          <Database className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-destructive">System Handover Tool</h3>
          <p className="text-xs text-muted-foreground">Wipe all project operational data while preserving system user profiles.</p>
        </div>
      </div>

      <div className="bg-white/50 p-4 rounded-lg border border-destructive/10 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase text-destructive tracking-widest leading-none">Caution: irreversible action</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This will delete all Projects, Tasks, RFIs, Permits, and Site Logs. This is intended for use prior to production go-live. <strong>This cannot be reversed.</strong>
          </p>
        </div>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full h-12 font-bold gap-2 shadow-lg shadow-destructive/20">
            <Trash2 className="h-4 w-4" />
            Wipe Project Data
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 text-destructive mb-2">
              <ShieldAlert className="h-8 w-8" />
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              This is a formal pre-deployment cleanup. It will remove every record in the system except for the <strong>Users</strong> registry and <strong>Company Branding</strong>.
              <br /><br />
              All site history, photos, and financial data will be permanently purged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleWipeData} 
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90 font-bold"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm & Wipe Database
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
