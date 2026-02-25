
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
import { Pencil, X, Shield, HardHat, Ruler, Users2 } from 'lucide-react';
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

  // Fetch all external contacts (Subcontractors & Designers) for assignment
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

  const handleRemoveArea = (areaId: string) => {
    setAreas(areas.filter(a => a.id !== areaId));
  };

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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Project Configuration</DialogTitle>
          <DialogDescription>
            Update project metadata, manage site areas, and control user/partner access.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <input type="hidden" {...form.register('id')} />
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Waterfront Towers" />
                  </FormControl>
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

                    <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted/10">
                        <div className="space-y-2">
                            {areas.map((area) => (
                                <div key={area.id} className="flex items-center justify-between p-2 rounded-md border bg-background group">
                                    <span className="text-sm font-medium">{area.name}</span>
                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleRemoveArea(area.id)}>
                                        <X className="h-4 w-4 text-destructive"/>
                                    </Button>
                                </div>
                            ))}
                            {areas.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p className="text-sm">No areas defined for this project.</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="access" className="space-y-4 py-4">
                    <div className="bg-primary/5 p-3 rounded-lg border border-primary/10 mb-4 flex items-start gap-3">
                        <Shield className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-primary uppercase">Staff Visibility</p>
                            <p className="text-xs text-muted-foreground">Only users selected below will see this project in their logs. Unassigned users will have no access unless they have Administrative Visibility.</p>
                        </div>
                    </div>

                    <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted/10">
                        <div className="space-y-3">
                            {users.map((user) => (
                                <FormField
                                    key={user.id}
                                    control={form.control}
                                    name="assignedUsers"
                                    render={({ field }) => {
                                        return (
                                            <FormItem
                                                key={user.id}
                                                className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-md hover:bg-background transition-colors"
                                            >
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
                                                <div className="flex-1 overflow-hidden">
                                                    <FormLabel className="text-sm font-medium block truncate">
                                                        {user.name}
                                                    </FormLabel>
                                                    <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                                                </div>
                                            </FormItem>
                                        );
                                    }}
                                />
                            ))}
                        </div>
                    </ScrollArea>
                </TabsContent>

                <TabsContent value="subs" className="space-y-4 py-4">
                    <div className="bg-accent/5 p-3 rounded-lg border border-accent/10 mb-4 flex items-start gap-3">
                        <Users2 className="h-5 w-5 text-accent mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-accent uppercase">Site Distribution List</p>
                            <p className="text-xs text-muted-foreground">Assign Designers and Sub-contractors to enable their selection in RFIs, Site Instructions, and Snagging modules.</p>
                        </div>
                    </div>

                    <ScrollArea className="h-[200px] rounded-md border p-4 bg-muted/10">
                        <div className="space-y-3">
                            {allSubContractors?.map((sub) => (
                                <FormField
                                    key={sub.id}
                                    control={form.control}
                                    name="assignedSubContractors"
                                    render={({ field }) => {
                                        return (
                                            <FormItem
                                                key={sub.id}
                                                className="flex flex-row items-center space-x-3 space-y-0 p-2 rounded-md hover:bg-background transition-colors"
                                            >
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
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="flex items-center gap-2">
                                                        <FormLabel className="text-sm font-medium block truncate">
                                                            {sub.name}
                                                        </FormLabel>
                                                        <div className="flex gap-1">
                                                            {sub.isDesigner && <Badge variant="outline" className="text-[8px] h-3 px-1 border-primary/30 text-primary">Designer</Badge>}
                                                            {sub.isSubContractor && <Badge variant="secondary" className="text-[8px] h-3 px-1">Sub</Badge>}
                                                        </div>
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground truncate">{sub.email}</p>
                                                </div>
                                            </FormItem>
                                        );
                                    }}
                                />
                            ))}
                            {allSubContractors?.length === 0 && (
                                <p className="text-center py-8 text-xs text-muted-foreground">No external contacts registered in the system yet.</p>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4 border-t">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
