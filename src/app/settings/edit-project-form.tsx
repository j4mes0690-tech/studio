
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransition, useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Pencil, X, Loader2, Save, Users2, MapPin, Plus, Trash2, CheckCircle2, Link as LinkIcon, ShieldCheck, UserPlus } from 'lucide-react';
import type { Project, Area, DistributionUser, SubContractor, QualityChecklist } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, where, addDoc, deleteDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AddSubcontractorForm } from './add-subcontractor-form';
import { AddUserDialog } from './add-user-dialog';

const EditProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Project name is required.'),
  address: z.string().optional(),
  siteManager: z.string().optional(),
  siteManagerPhone: z.string().optional(),
  areas: z.string().optional(),
  assignedUsers: z.array(z.string()).optional(),
  assignedSubContractors: z.array(z.string()).optional(),
  drawingApprovers: z.array(z.string()).optional(),
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

  // Assignment Local State
  const [assigningTemplateId, setAssignTemplateId] = useState<string>('');
  const [assigningAreaIds, setAssignAreaIds] = useState<string[]>([]);
  const [assigningRecipientIds, setAssignRecipientIds] = useState<string[]>([]);

  // DATA FETCHING
  const subsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'sub-contractors');
  }, [db]);
  const { data: allSubContractors } = useCollection<SubContractor>(subsQuery);

  const templatesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'quality-checklists'), where('isTemplate', '==', true));
  }, [db]);
  const { data: checklistTemplates } = useCollection<QualityChecklist>(templatesQuery);

  const instancesQuery = useMemoFirebase(() => {
    if (!db || !project.id) return null;
    return query(collection(db, 'quality-checklists'), where('projectId', '==', project.id), where('isTemplate', '==', false));
  }, [db, project.id]);
  const { data: projectChecklists } = useCollection<QualityChecklist>(instancesQuery);

  const form = useForm<EditProjectFormValues>({
    resolver: zodResolver(EditProjectSchema),
    defaultValues: {
      id: project.id,
      name: project.name,
      address: project.address || '',
      siteManager: project.siteManager || '',
      siteManagerPhone: project.siteManagerPhone || '',
      areas: JSON.stringify(project.areas || []),
      assignedUsers: project.assignedUsers || [],
      assignedSubContractors: project.assignedSubContractors || [],
      drawingApprovers: project.drawingApprovers || [],
    },
  });
  
  useEffect(() => {
    if (open) {
      const initialAreas = project.areas || [];
      form.reset({
        id: project.id,
        name: project.name,
        address: project.address || '',
        siteManager: project.siteManager || '',
        siteManagerPhone: project.siteManagerPhone || '',
        areas: JSON.stringify(initialAreas),
        assignedUsers: project.assignedUsers || [],
        assignedSubContractors: project.assignedSubContractors || [],
        drawingApprovers: project.drawingApprovers || [],
      });
      setAreas(initialAreas);
      setCurrentArea('');
      setAssignTemplateId('');
      setAssignAreaIds([]);
      setAssignRecipientIds([]);
    }
  }, [open, project, form]);

  useEffect(() => {
    form.setValue('areas', JSON.stringify(areas));
  }, [areas, form]);

  const selectedTemplate = useMemo(() => checklistTemplates?.find(t => t.id === assigningTemplateId), [checklistTemplates, assigningTemplateId]);
  
  const activeAssignedSubs = useMemo(() => {
    const currentAssignedIds = form.watch('assignedSubContractors') || [];
    if (!allSubContractors) return [];
    return allSubContractors.filter(sub => currentAssignedIds.includes(sub.id));
  }, [allSubContractors, form.watch('assignedSubContractors')]);

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

  const handleAssignChecklists = () => {
    if (!selectedTemplate || assigningAreaIds.length === 0) return;

    startTransition(async () => {
      try {
        const recipientEmails = activeAssignedSubs
          .filter(sub => assigningRecipientIds.includes(sub.id))
          .map(sub => sub.email);

        const promises = assigningAreaIds.map(areaId => {
          const data = {
            projectId: project.id,
            areaId,
            title: selectedTemplate.title,
            trade: selectedTemplate.trade,
            items: selectedTemplate.items.map(item => ({ ...item, status: 'pending', comment: '', photos: [] })),
            recipients: recipientEmails,
            isTemplate: false,
            createdAt: new Date().toISOString(),
            photos: []
          };
          return addDoc(collection(db, 'quality-checklists'), data);
        });

        await Promise.all(promises);
        toast({ title: 'Checklists Assigned', description: `Successfully added ${assigningAreaIds.length} checklists.` });
        setAssignTemplateId('');
        setAssignAreaIds([]);
        setAssignRecipientIds([]);
      } catch (err) {
        console.error("Assignment error:", err);
      }
    });
  };

  const handleRemoveChecklist = (id: string) => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'quality-checklists', id))
        .then(() => toast({ title: 'Removed', description: 'Checklist deleted.' }))
        .catch(err => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `quality-checklists/${id}`,
            operation: 'delete'
          }));
        });
    });
  };

  const onSubmit = (values: EditProjectFormValues) => {
    startTransition(async () => {
      const docRef = doc(db, 'projects', values.id);
      const updates = {
        name: values.name,
        address: values.address || '',
        siteManager: values.siteManager || '',
        siteManagerPhone: values.siteManagerPhone || '',
        areas: JSON.parse(values.areas || '[]'),
        assignedUsers: values.assignedUsers || [],
        assignedSubContractors: values.assignedSubContractors || [],
        drawingApprovers: values.drawingApprovers || [],
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
        <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Project Configuration</DialogTitle>
          <DialogDescription>Update metadata and manage assignments.</DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6 pb-10">
                <input type="hidden" {...form.register('id')} />
                
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Project Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full grid-cols-6 h-auto p-1 bg-muted/50 rounded-lg">
                        <TabsTrigger value="details" className="text-[10px] uppercase font-bold py-2">Details</TabsTrigger>
                        <TabsTrigger value="areas" className="text-[10px] uppercase font-bold py-2">Areas</TabsTrigger>
                        <TabsTrigger value="access" className="text-[10px] uppercase font-bold py-2">Staff</TabsTrigger>
                        <TabsTrigger value="approvers" className="text-[10px] uppercase font-bold py-2">Approvers</TabsTrigger>
                        <TabsTrigger value="subs" className="text-[10px] uppercase font-bold py-2">Partners</TabsTrigger>
                        <TabsTrigger value="checklists" className="text-[10px] uppercase font-bold py-2">Checklists</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="details" className="space-y-4 py-4">
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel>Site Address</FormLabel><FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl></FormItem>
                        )} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="siteManager" render={({ field }) => (
                                <FormItem><FormLabel>Site Manager</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                            )} />
                            <FormField control={form.control} name="siteManagerPhone" render={({ field }) => (
                                <FormItem><FormLabel>Manager Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                            )} />
                        </div>
                    </TabsContent>

                    <TabsContent value="areas" className="space-y-4 py-4">
                        <div className="flex gap-2">
                            <Input value={currentArea} onChange={(e) => setCurrentArea(e.target.value)} placeholder="Add site area (e.g. Level 1)" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddArea(); }}} />
                            <Button type="button" variant="secondary" onClick={handleAddArea}>Add</Button>
                        </div>
                        <div className="space-y-2">
                            {areas.map((area) => (
                                <div key={area.id} className="flex items-center justify-between p-2 rounded-md border bg-background group">
                                    <span className="text-sm font-medium">{area.name}</span>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveArea(area.id)}><X className="h-4 w-4 text-destructive"/></Button>
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    <TabsContent value="access" className="space-y-4 py-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Internal Project Staff</h4>
                            <AddUserDialog />
                        </div>
                        <ScrollArea className="h-64 rounded-md border p-4 bg-muted/5">
                            <div className="space-y-2">
                                {users.map((user) => (
                                    <FormField key={user.id} control={form.control} name="assignedUsers" render={({ field }) => (
                                        <FormItem className="flex items-center space-x-3 space-y-0 p-2.5 border rounded-md bg-background hover:border-primary/30 transition-colors">
                                            <FormControl><Checkbox checked={field.value?.includes(user.email)} onCheckedChange={(c) => c ? field.onChange([...(field.value || []), user.email]) : field.onChange((field.value || []).filter((v) => v !== user.email))} /></FormControl>
                                            <div className="flex-1 min-w-0"><FormLabel className="text-sm font-bold truncate block cursor-pointer">{user.name}</FormLabel><span className="text-[10px] text-muted-foreground block truncate">{user.email}</span></div>
                                        </FormItem>
                                    )} />
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="approvers" className="space-y-4 py-4">
                        <div className="bg-primary/5 p-4 rounded-lg border-2 border-primary/10 mb-4">
                            <p className="text-xs text-primary font-bold flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" />
                                Drawing Approval Hierarchy
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">Users selected below are authorised to apply formal Status A/B/C sign-offs to project drawings.</p>
                        </div>
                        <ScrollArea className="h-64 rounded-md border p-4 bg-muted/5">
                            <div className="space-y-2">
                                {users.filter(u => u.userType === 'internal').map((user) => (
                                    <FormField key={`appr-${user.id}`} control={form.control} name="drawingApprovers" render={({ field }) => (
                                        <FormItem className="flex items-center space-x-3 space-y-0 p-2.5 border rounded-md bg-background hover:border-primary/30 transition-colors">
                                            <FormControl><Checkbox checked={field.value?.includes(user.email)} onCheckedChange={(c) => c ? field.onChange([...(field.value || []), user.email]) : field.onChange((field.value || []).filter((v) => v !== user.email))} /></FormControl>
                                            <div className="flex-1 min-w-0"><FormLabel className="text-sm font-bold truncate block cursor-pointer">{user.name}</FormLabel><span className="text-[10px] text-muted-foreground block truncate">{user.email}</span></div>
                                        </FormItem>
                                    )} />
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="subs" className="space-y-4 py-4">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <h4 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest px-1">Trade Partner Access</h4>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 gap-1.5 font-bold border-primary/20 text-primary">
                                        <Plus className="h-3.5 w-3.5" />
                                        Register New Partner
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>Register Trade Partner</DialogTitle>
                                        <DialogDescription>Add a new company to the system to assign them to this project.</DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                        <AddSubcontractorForm />
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <ScrollArea className="h-64 rounded-md border p-4 bg-muted/5">
                            <div className="space-y-2">
                                {allSubContractors && allSubContractors.length > 0 ? allSubContractors.map((sub) => (
                                    <FormField key={sub.id} control={form.control} name="assignedSubContractors" render={({ field }) => (
                                        <FormItem className="flex items-center space-x-3 space-y-0 p-2.5 border rounded-md bg-background hover:border-primary/30 transition-colors">
                                            <FormControl><Checkbox checked={field.value?.includes(sub.id)} onCheckedChange={(c) => c ? field.onChange([...(field.value || []), sub.id]) : field.onChange((field.value || []).filter((v) => v !== sub.id))} /></FormControl>
                                            <div className="flex-1 min-w-0"><FormLabel className="text-sm font-bold truncate block cursor-pointer">{sub.name}</FormLabel><span className="text-[10px] text-muted-foreground block truncate">{sub.email}</span></div>
                                        </FormItem>
                                    )} />
                                )) : (
                                    <div className="py-10 text-center text-muted-foreground italic text-xs">No trade partners registered in the system.</div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="checklists" className="space-y-6 py-4">
                        <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                            <div className="flex items-center gap-2 text-primary font-bold"><Plus className="h-4 w-4" /><h4>Assign Trade Checklist</h4></div>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Select Template</Label>
                                    <Select value={assigningTemplateId} onValueChange={setAssignTemplateId}><SelectTrigger className="bg-background"><SelectValue placeholder="Choose template..." /></SelectTrigger><SelectContent>{checklistTemplates?.map(t => <SelectItem key={t.id} value={t.id}>{t.title} ({t.trade})</SelectItem>)}</SelectContent></Select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Areas / Plots</Label>
                                        <div className="border rounded bg-background p-2 max-h-40 overflow-y-auto">
                                            {areas.map(a => (
                                                <div key={a.id} className="flex items-center space-x-2 mb-1.5"><Checkbox id={`a-${a.id}`} checked={assigningAreaIds.includes(a.id)} onCheckedChange={c => setAssignAreaIds(c ? [...assigningAreaIds, a.id] : assigningAreaIds.filter(id => id !== a.id))} /><label htmlFor={`a-${a.id}`} className="text-xs font-medium cursor-pointer">{a.name}</label></div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">Partners</Label>
                                        <div className="border rounded bg-background p-2 max-h-40 overflow-y-auto">
                                            {activeAssignedSubs.map(s => (
                                                <div key={s.id} className="flex items-center space-x-2 mb-1.5"><Checkbox id={`s-${s.id}`} checked={assigningRecipientIds.includes(s.id)} onCheckedChange={c => setAssignRecipientIds(c ? [...assigningRecipientIds, s.id] : assigningRecipientIds.filter(id => id !== s.id))} /><label htmlFor={`s-${s.id}`} className="text-xs font-medium cursor-pointer">{s.name}</label></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <Button type="button" className="w-full font-bold gap-2" disabled={isPending || !selectedTemplate || assigningAreaIds.length === 0} onClick={handleAssignChecklists}>{isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Assign Checklists</Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">Active Checklists</h4>
                            <div className="rounded-md border bg-background overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/30">
                                        <TableRow><TableHead className="h-8 text-[10px] uppercase font-bold">Trade</TableHead><TableHead className="h-8 text-[10px] uppercase font-bold">Area</TableHead><TableHead className="h-8 text-[10px] uppercase font-bold">Checklist</TableHead><TableHead className="h-8 text-[10px] uppercase font-bold text-right">Action</TableHead></TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {projectChecklists?.map((cl) => (
                                            <TableRow key={cl.id}>
                                                <TableCell className="py-2 text-[11px] font-bold text-primary">{cl.trade}</TableCell>
                                                <TableCell className="py-2 text-[11px] font-medium">{areas.find(a => a.id === cl.areaId)?.name || '---'}</TableCell>
                                                <TableCell className="py-2 text-[11px] truncate max-w-[150px]">{cl.title}</TableCell>
                                                <TableCell className="py-2 text-right"><Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemoveChecklist(cl.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
              </div>
            </div>

            <DialogFooter className="p-6 border-t bg-muted/10 shrink-0">
              <Button type="submit" disabled={isPending} className="w-full h-12 font-bold">
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Save Project Configuration
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
