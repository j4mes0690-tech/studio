
'use client';

import type { SubContractor } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Trash2, HardHat, Ruler, Truck, Construction, Phone, MapPin } from 'lucide-react';
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
import { EditSubcontractorForm } from './edit-subcontractor-form';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

type SubcontractorsListProps = {
  subContractors: SubContractor[];
};

export function SubcontractorsList({ subContractors }: SubcontractorsListProps) {
  const [isPending, startTransition] = useTransition();
  const db = useFirestore();
  const { toast } = useToast();

  const handleRemove = (id: string) => {
    startTransition(async () => {
      const docRef = doc(db, 'sub-contractors', id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Contact removed from system.' }))
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
    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
      {subContractors.map((contact) => (
        <div key={contact.id} className="flex items-start justify-between p-3 rounded-lg border bg-muted/5">
          <div className="space-y-3 flex-1 overflow-hidden">
            <div>
              <p className="font-semibold text-sm">{contact.name}</p>
              <div className="flex flex-col gap-0.5 mt-1">
                <p className="text-[10px] text-muted-foreground truncate">{contact.email}</p>
                {contact.phone && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Phone className="h-2 w-2" /> {contact.phone}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-1">
              {contact.isSubContractor && (
                <Badge variant="secondary" className="text-[9px] h-4 gap-1">
                  <HardHat className="h-2 w-2" /> Sub-contractor
                </Badge>
              )}
              {contact.isDesigner && (
                <Badge variant="outline" className="text-[9px] h-4 gap-1 border-primary/30 text-primary">
                  <Ruler className="h-2 w-2" /> Designer
                </Badge>
              )}
              {contact.isSupplier && (
                <Badge variant="outline" className="text-[9px] h-4 gap-1 border-accent/50 text-accent">
                  <Truck className="h-2 w-2" /> Supplier
                </Badge>
              )}
              {contact.isPlantSupplier && (
                <Badge variant="default" className="text-[9px] h-4 gap-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                  <Construction className="h-2 w-2" /> Plant Supplier
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center">
            <EditSubcontractorForm subContractor={contact} />
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Remove Contact?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove {contact.name} from the system. They will no longer appear in project distribution lists.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleRemove(contact.id)} className="bg-destructive hover:bg-destructive/90">
                        {isPending ? 'Removing...' : 'Delete'}
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
      {subContractors.length === 0 && (
          <p className="text-muted-foreground text-center py-8 text-sm italic">No external contacts listed.</p>
      )}
    </div>
  );
}
