'use client';

import { useState, useEffect, useTransition } from 'react';
import type { QualityChecklist, Project, ChecklistItem, ChecklistItemStatus, SubContractor } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { ClientDate } from '../../components/client-date';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Users, Trash2, Loader2 } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
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

type ChecklistCardProps = {
  checklist: QualityChecklist;
  projects: Project[];
  subContractors: SubContractor[];
};

export function ChecklistCard({
  checklist,
  projects,
  subContractors,
}: ChecklistCardProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<ChecklistItem[]>(checklist.items);

  useEffect(() => {
    setItems(checklist.items);
  }, [checklist.items]);

  const updateItemsOnServer = (newItems: ChecklistItem[]) => {
    startTransition(async () => {
        const docRef = doc(db, 'quality-checklists', checklist.id);
        const updates = { items: newItems };
        
        updateDoc(docRef, updates)
          .catch((error) => {
            const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: updates,
            });
            errorEmitter.emit('permission-error', permissionError);
            setItems(checklist.items); // Revert UI
          });
    });
  }

  const handleDelete = () => {
    startTransition(async () => {
      const docRef = doc(db, 'quality-checklists', checklist.id);
      deleteDoc(docRef)
        .then(() => toast({ title: 'Success', description: 'Checklist removed from area.' }))
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  const handleStatusChange = (itemId: string, status: ChecklistItemStatus) => {
    const newItems = items.map((item) =>
      item.id === itemId ? { ...item, status } : item
    );
    setItems(newItems);
    updateItemsOnServer(newItems);
  };
  
  const handleCommentChange = (itemId: string, comment: string) => {
    const newItems = items.map((item) =>
      item.id === itemId ? { ...item, comment } : item
    );
    setItems(newItems);
  }

  const handleCommentBlur = (itemId: string) => {
    const currentItem = items.find(i => i.id === itemId);
    const originalItem = checklist.items.find(i => i.id === itemId);

    if (currentItem?.comment !== originalItem?.comment) {
      updateItemsOnServer(items);
    }
  }

  const project = projects.find((p) => p.id === checklist.projectId);
  const area = project?.areas?.find(a => a.id === checklist.areaId);

  const completedItems = items.filter((item) => item.status !== 'pending').length;
  const progress = items.length > 0 ? (completedItems / items.length) * 100 : 0;
  const hasFailure = items.some((item) => item.status === 'no');
  
  return (
    <Card className={cn(hasFailure && 'border-destructive')}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <CardTitle>{checklist.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 pt-1 flex-wrap">
              {project && (
                <>
                  <span>{project.name}</span>
                  {area && (
                    <>
                      <span className="text-muted-foreground">&gt;</span>
                      <span>{area.name}</span>
                    </>
                  )}
                  <span className="hidden sm:inline-block">-</span>
                </>
              )}
              <span className="text-xs text-muted-foreground/80">
                <ClientDate date={checklist.createdAt} />
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={hasFailure ? 'destructive' : 'secondary'}>{checklist.trade}</Badge>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Delete Checklist</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Assigned Checklist?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the "{checklist.title}" checklist and all its recorded answers for this plot. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isPending}>
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
            <div className='flex justify-between items-center text-sm'>
                <p className="text-muted-foreground">Progress</p>
                <p className="font-medium">{completedItems} / {items.length} Completed</p>
            </div>
          <Progress value={progress} indicatorClassName={hasFailure ? 'bg-destructive' : ''} />
        </div>
        <Accordion type="single" collapsible className="w-full mt-4">
          <AccordionItem value="items">
            <AccordionTrigger className="text-sm font-semibold">
              View Checklist Items
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <div className="space-y-6">
                {items.map((item) => (
                  <div key={item.id} className={cn("space-y-3 p-2 rounded-md border transition-colors", item.status === 'no' ? 'border-destructive' : 'border-transparent hover:border-border')}>
                    <Label className="font-medium text-foreground">{item.text}</Label>
                    <RadioGroup
                        value={item.status}
                        onValueChange={(status) => handleStatusChange(item.id, status as ChecklistItemStatus)}
                        className="flex items-center space-x-6"
                        disabled={isPending}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id={`${item.id}-yes`} />
                            <Label htmlFor={`${item.id}-yes`}>Yes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id={`${item.id}-no`} />
                            <Label htmlFor={`${item.id}-no`}>No</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="na" id={`${item.id}-na`} />
                            <Label htmlFor={`${item.id}-na`}>N/A</Label>
                        </div>
                    </RadioGroup>
                    <Input 
                        placeholder="Add a comment..."
                        value={item.comment || ''}
                        onChange={(e) => handleCommentChange(item.id, e.target.value)}
                        onBlur={() => handleCommentBlur(item.id)}
                        disabled={isPending}
                        className="text-sm"
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
          {checklist.recipients && checklist.recipients.length > 0 && (
             <AccordionItem value="recipients">
             <AccordionTrigger className="text-sm font-semibold">
               <div className="flex items-center gap-2">
                 <Users className="h-4 w-4" />
                 <span>
                   Distribution List ({checklist.recipients.length})
                 </span>
               </div>
             </AccordionTrigger>
             <AccordionContent>
              <div className="flex flex-wrap gap-1">
                {checklist.recipients.map((email, index) => (
                  <Badge key={index} variant="outline" className="bg-background">{email}</Badge>
                ))}
              </div>
             </AccordionContent>
           </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}