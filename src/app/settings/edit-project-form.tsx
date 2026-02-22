
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Pencil, X } from 'lucide-react';
import type { Project, Area } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const EditProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Project name is required.'),
  areas: z.string().optional(),
});

type EditProjectFormValues = z.infer<typeof EditProjectSchema>;

type EditProjectFormProps = {
  project: Project;
};

export function EditProjectForm({ project }: EditProjectFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [areas, setAreas] = useState<Area[]>(project.areas || []);
  const [currentArea, setCurrentArea] = useState('');

  const form = useForm<EditProjectFormValues>({
    resolver: zodResolver(EditProjectSchema),
    defaultValues: {
      id: project.id,
      name: project.name,
      areas: JSON.stringify(project.areas || []),
    },
  });
  
  useEffect(() => {
    if (open) {
      const initialAreas = project.areas || [];
      form.reset({
        id: project.id,
        name: project.name,
        areas: JSON.stringify(initialAreas),
      });
      setAreas(initialAreas);
      setCurrentArea('');
    }
  }, [open, project, form]);

  useEffect(() => {
    form.setValue('areas', JSON.stringify(areas));
  }, [areas, form]);

  const handleAddArea = () => {
    if (currentArea.trim()) {
      const newArea: Area = {
        id: `area-${project.id}-${Date.now()}`,
        name: currentArea.trim(),
      };
      setAreas([...areas, newArea]);
      setCurrentArea('');
    }
  };

  const handleRemoveArea = (areaId: string) => {
    setAreas(areas.filter(a => a.id !== areaId));
  };

  const onSubmit = (values: EditProjectFormValues) => {
    startTransition(async () => {
      const docRef = doc(db, 'projects', values.id);
      const updates = {
        name: values.name,
        areas: JSON.parse(values.areas || '[]'),
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Project updated.' });
          setOpen(false);
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit Project</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>
            Update the project's name and manage its areas.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <input type="hidden" {...form.register('id')} />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormItem>
              <FormLabel>Project Areas</FormLabel>
              <div className="flex gap-2">
                  <Input
                      value={currentArea}
                      onChange={(e) => setCurrentArea(e.target.value)}
                      placeholder="Add a new area name"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddArea(); }}}
                  />
                  <Button type="button" onClick={handleAddArea}>Add</Button>
              </div>

              <ScrollArea className="h-40 rounded-md border mt-2">
                  <div className="p-4 space-y-2">
                      {areas.map((area) => (
                          <div key={area.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                              <span className="text-sm">{area.name}</span>
                              <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveArea(area.id)}>
                                  <X className="h-4 w-4 text-muted-foreground"/>
                              </Button>
                          </div>
                      ))}
                      {areas.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">No areas added yet.</p>}
                  </div>
              </ScrollArea>
               <FormField
                  control={form.control}
                  name="areas"
                  render={() => (
                      <FormMessage />
                  )}
              />
            </FormItem>

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
