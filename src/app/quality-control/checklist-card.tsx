
'use client';

import { useState, useEffect, useTransition } from 'react';
import type { QualityChecklist, Project, ChecklistItem } from '@/lib/types';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ClientDate } from '../../components/client-date';
import { updateChecklistItemsAction } from './actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

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

  const project = projects.find((p) => p.id === checklist.projectId);

  const completedItems = items.filter((item) => item.isCompleted).length;
  const progress = items.length > 0 ? (completedItems / items.length) * 100 : 0;
  
  const handleItemToggle = (itemId: string) => {
    const newItems = items.map((item) =>
      item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
    );
    setItems(newItems);
    
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
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{checklist.title}</CardTitle>
            <CardDescription className="flex items-center gap-2 pt-1">
              <span>{project?.name || 'Unknown Project'}</span>
              <span className="hidden sm:inline-block">-</span>
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
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={item.id}
                      checked={item.isCompleted}
                      onCheckedChange={() => handleItemToggle(item.id)}
                      disabled={isPending}
                    />
                    <Label
                      htmlFor={item.id}
                      className={`flex-1 text-sm ${item.isCompleted ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                    >
                      {item.text}
                    </Label>
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
