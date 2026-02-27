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
import { Pencil, X, Shield, Users2, Loader2, Save } from 'lucide-react';
import type { Project, Area, DistributionUser, SubContractor } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore, useCollection } from '@/firebase';
import { doc, updateDoc, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const EditProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Project name is required.'),
  areas: z.string().optional(),
  assignedUsers: z.array(z.string()).optional(),
  assignedSubContractors: z.array(z.string()).optional(),
});

type EditProjectFormValues = z.infer<typeof EditProjectSchema>;

type EditProjectFormProps = {
  project: Project;
  users: DistributionUser[];
};

export function EditProjectForm({ project, users }: EditProjectFormProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [areas, setAreas] = useState<Area[]>(project.areas || []);
  const [currentArea, setCurrentArea] = useState('');

  const subsQuery = collection(db, 'sub-contractors');
  const { data: allSubContractors } = useCollection<SubContractor>(subsQuery);

  const form = useForm<EditProjectFormValues>({
    resolver: zodResolver(EditProjectSchema),
    defaultValues: {
      id: project.id,
      name: project.name,
      areas: JSON.stringify(project.areas || []),
      assignedUsers: project.assignedUsers || [],
      assignedSubContractors: project.assignedSubContractors || [],
    },
  });
  
  useEffect(() => {
    if (open) {
      const initialAreas = project.areas || [];
      form.reset({
        id: project.id,
        name: project.name,
        areas: JSON.stringify(initialAreas),
        assignedUsers: project.assignedUsers || [],
        assignedSubContractors: project.assignedSubContractors || [],
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

  const handleRemoveArea = (areaId: string) => setAreas(areas.filter(a => a.id !== areaId));

  const onSubmit = (values: EditProjectFormValues) => {
    startTransition(async () => {
      const docRef = doc(db, 'projects', values.id);
      const updates = {
        name: values.name,
        areas: JSON.parse(values.areas || '[]'),
        assignedUsers: values.assignedUsers || [],
        assignedSubContractors: values.assignedSubContractors || [],
      };

      updateDoc(docRef, updates)
        .then(() => {
          toast({ title: 'Success', description: 'Project configuration updated.' });
          setOpen(false);
        })
        .catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updates,
          }));
        });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Project Configuration</DialogTitle>
          <DialogDescription>Update project metadata and manage accessibility.</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1 px-6">
              <div className="space-y-6 py-4">
                <input type="hidden" {...form.register('id')} />
                
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Tabs defaultValue="areas" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="areas">Site Areas</TabsTrigger>
                        <TabsTrigger value="access">Internal Staff</TabsTrigger>
                        <TabsTrigger value="subs">External Partners</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="areas" className="space-y-4 py-4">
                        <div className="flex gap-2">
                            <Input
                                value={currentArea}
                                onChange={(e) => setCurrentArea(e.target.value)}
                                placeholder="Add site area (e.g. Level 1)"
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddArea(); }}}
                            />
                            <Button type="button" variant="secondary" onClick={handleAddArea}>Add</Button>
                        </div>
                        <ScrollArea className="h-[250px] rounded-md border p-4 bg-muted/5">
                            {areas.map((area) => (
                                <div key={area.id} className="flex items-center justify-between p-2 rounded-md border bg-background mb-2 group">
                                    <span className="text-sm font-medium">{area.name}</span>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveArea(area.id)}><X className="h-4 w-4 text-destructive"/></Button>
                                </div>
                            ))}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="access" className="space-y-4 py-4">
                        <ScrollArea className="h-[250px] rounded-md border p-4 bg-muted/5">
                            {users.map((user) => (
                                <FormField
                                    key={user.id}
                                    control={form.control}
                                    name="assignedUsers"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 border rounded-md mb-2 bg-background">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value?.includes(user.email)}
                                                    onCheckedChange={(checked) => {
                                                        return checked
                                                            ? field.onChange([...(field.value || []), user.email])
                                                            : field.onChange((field.value || []).filter((v) => v !== user.email));
                                                    }}
                                                />
                                            </FormControl>
                                            <div className="flex-1 overflow-hidden leading-tight">
                                                <FormLabel className="text-sm font-semibold truncate block">{user.name}</FormLabel>
                                                <span className="text-[10px] text-muted-foreground truncate block">{user.email}</span>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="subs" className="space-y-4 py-4">
                        <ScrollArea className="h-[250px] rounded-md border p-4 bg-muted/5">
                            {allSubContractors?.map((sub) => (
                                <FormField
                                    key={sub.id}
                                    control={form.control}
                                    name="assignedSubContractors"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-2 border rounded-md mb-2 bg-background">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value?.includes(sub.id)}
                                                    onCheckedChange={(checked) => {
                                                        return checked
                                                            ? field.onChange([...(field.value || []), sub.id])
                                                            : field.onChange((field.value || []).filter((v) => v !== sub.id));
                                                    }}
                                                />
                                            </FormControl>
                                            <div className="flex-1 overflow-hidden leading-tight">
                                                <FormLabel className="text-sm font-semibold truncate block">{sub.name}</FormLabel>
                                                <span className="text-[10px] text-muted-foreground truncate block">{sub.email}</span>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t bg-muted/10">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Configuration
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
