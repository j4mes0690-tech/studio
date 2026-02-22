
'use client';

import { useState, useEffect, useTransition } from 'react';
import type { QualityChecklist, Project, ChecklistItem, ChecklistItemStatus } from '@/lib/types';
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
import { updateChecklistItemsAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';

type ChecklistCardProps = {
  checklist: QualityChecklist;
  projects: Project[];
};

export function ChecklistCard({
  checklist,
  projects,
}: ChecklistCardProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState<ChecklistItem[]>(checklist.items);

  useEffect(() => {
    setItems(checklist.items);
  }, [checklist.items]);

  const updateItemsOnServer = (newItems: ChecklistItem[]) => {
    startTransition(async () => {
        const formData = new FormData();
        formData.append('checklistId', checklist.id);
        formData.append('items', JSON.stringify(newItems));
        
        const result = await updateChecklistItemsAction(formData);

        if (!result.success) {
            toast({
                title: 'Error',
                description: result.message,
                variant: 'destructive',
            });
            // Revert state on failure
            setItems(items);
        }
    });
  }

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

  const project = checklist.projectId ? projects.find((p) => p.id === checklist.projectId) : undefined;
  const area = project?.areas?.find(a => a.id === checklist.areaId);

  const completedItems = items.filter((item) => item.status !== 'pending').length;
  const progress = items.length > 0 ? (completedItems / items.length) * 100 : 0;
  
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
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
          <Badge variant="secondary">{checklist.trade}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
            <div className='flex justify-between items-center text-sm'>
                <p className="text-muted-foreground">Progress</p>
                <p className="font-medium">{completedItems} / {items.length} Completed</p>
            </div>
          <Progress value={progress} />
        </div>
        <Accordion type="single" collapsible className="w-full mt-4">
          <AccordionItem value="items">
            <AccordionTrigger className="text-sm font-semibold">
              View Checklist Items
            </AccordionTrigger>
            <AccordionContent className="pt-2">
              <div className="space-y-6">
                {items.map((item) => (
                  <div key={item.id} className="space-y-3 p-2 rounded-md border border-transparent hover:border-border transition-colors">
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
                        placeholder="Add a comment (optional)..."
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
        </Accordion>
      </CardContent>
    </Card>
  );
}
