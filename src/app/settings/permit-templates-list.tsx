'use client';

import type { PermitTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Trash2, FileCheck, Pencil } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';

type PermitTemplatesListProps = {
  templates: PermitTemplate[];
};

export function PermitTemplatesList({ templates }: PermitTemplatesListProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const db = useFirestore();

  const handleRemove = (id: string) => {
    startTransition(async () => {
      const docRef = doc(db, 'permit-templates', id);
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
      {templates.map((template) => (
        <div key={template.id} className="flex items-start justify-between p-3 rounded-lg border bg-muted/5 group">
          <div className="flex gap-3">
            <div className="mt-1 p-2 bg-background border rounded h-fit">
                <FileCheck className="h-4 w-4 text-primary" />
            </div>
            <div>
                <p className="font-bold text-sm">{template.title}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="secondary" className="text-[10px] h-4 font-black uppercase tracking-tighter bg-primary/5 text-primary border-primary/10">{template.type}</Badge>
                </div>
            </div>
          </div>
          <div className="flex items-center flex-shrink-0 gap-1">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary">
                <Link href={`/form-creator?type=permit&id=${template.id}`}>
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit in Studio</span>
                </Link>
            </Button>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending} className="h-8 w-8 text-destructive transition-opacity">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently remove the permit template "{template.title}".
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleRemove(template.id)} className="bg-destructive hover:bg-destructive/90">
                        {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
      {templates.length === 0 && (
          <p className="text-muted-foreground text-center py-12 text-sm italic border-2 border-dashed rounded-lg">
            No permit templates created yet.
          </p>
      )}
    </div>
  );
}
