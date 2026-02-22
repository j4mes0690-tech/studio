
'use client';

import type { QualityChecklist } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
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
import { EditChecklistTemplateForm } from './edit-checklist-template-form';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type ChecklistTemplatesListProps = {
  checklistTemplates: QualityChecklist[];
};

export function ChecklistTemplatesList({ checklistTemplates }: ChecklistTemplatesListProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const db = useFirestore();

  const handleRemove = (checklistId: string) => {
    startTransition(async () => {
      const docRef = doc(db, 'quality-checklists', checklistId);
      deleteDoc(docRef)
        .then(() => {
          toast({ title: 'Success', description: 'Template removed.' });
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };
  
  return (
    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
      {checklistTemplates.map((checklist) => (
        <div key={checklist.id} className="flex items-start justify-between p-3 rounded-lg border">
          <div>
            <p className="font-medium">{checklist.title}</p>
            <p className="text-sm text-muted-foreground">{checklist.trade}</p>
            <div className="flex flex-wrap gap-1 mt-2">
                <Badge variant="secondary">{checklist.items.length} items</Badge>
            </div>
          </div>
          <div className="flex items-center flex-shrink-0">
            <EditChecklistTemplateForm checklist={checklist} />
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently remove the template "{checklist.title}". This action cannot be undone.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleRemove(checklist.id)} className="bg-destructive hover:bg-destructive/90">
                        {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
      {checklistTemplates.length === 0 && (
          <p className="text-muted-foreground text-center py-4">No checklist templates found.</p>
      )}
    </div>
  );
}
