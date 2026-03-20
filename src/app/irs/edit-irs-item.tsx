
'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pencil, Loader2, Save, ShieldCheck, Users2 } from 'lucide-react';
import type { Project, DistributionUser, SubContractor, IRSItem } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { VoiceInput } from '@/components/voice-input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const EditIRSItemSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  title: z.string().min(3, 'Description of information is required.'),
  description: z.string().optional(),
  assignedToEmail: z.string().email('Assignee email is required.'),
  requiredByDate: z.string().min(1, 'Target date is required.'),
  notificationLeadDays: z.coerce.number().min(0).default(7),
});

type EditIRSItemFormValues = z.infer<typeof EditIRSItemSchema>;

export function EditIRSItemDialog({ 
  item,
  projects, 
  users, 
  subContractors,
  open: externalOpen,
  onOpenChange: setExternalOpen
}: { 
  item: IRSItem;
  projects: Project[]; 
  users: DistributionUser[]; 
  subContractors: SubContractor[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = setExternalOpen !== undefined ? setExternalOpen : setInternalOpen;

  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<EditIRSItemFormValues>({
    resolver: zodResolver(EditIRSItemSchema),
    defaultValues: {
      projectId: item.projectId,
      title: item.title,
      description: item.description,
      assignedToEmail: item.assignedToEmail,
      requiredByDate: item.requiredByDate,
      notificationLeadDays: item.notificationLeadDays,
    },
  });

  useEffect(() => {
    if (open && item) {
      form.reset({
        projectId: item.projectId,
        title: item.title,
        description: item.description,
        assignedToEmail: item.assignedToEmail,
        requiredByDate: item.requiredByDate,
        notificationLeadDays: item.notificationLeadDays,
      });
    }
  }, [open, item, form]);

  const selectedProjectId = form.watch('projectId');
  const selectedProject = useMemo(() => projects.find(p => p.id === selectedProjectId), [projects, selectedProjectId]);

  const availableStaff = useMemo(() => {
    if (!selectedProject) return [];
    const assignedEmails = selectedProject.assignedUsers || [];
    return users.filter(u => assignedEmails.some(e => e.toLowerCase() === u.email.toLowerCase()));
  }, [selectedProject, users]);

  const availablePartners = useMemo(() => {
    if (!selectedProject) return [];
    const assignedSubIds = selectedProject.assignedSubContractors || [];
    return subContractors.filter(s => assignedSubIds.includes(s.id));
  }, [selectedProject, subContractors]);

  const onSubmit = (values: EditIRSItemFormValues) => {
    startTransition(async () => {
      try {
        const docRef = doc(db, 'irs-items', item.id);
        const updates = {
          projectId: values.projectId,
          title: values.title,
          description: values.description || '',
          assignedToEmail: values.assignedToEmail.toLowerCase().trim(),
          requiredByDate: values.requiredByDate,
          notificationLeadDays: values.notificationLeadDays,
        };

        await updateDoc(docRef, updates);
        toast({ title: 'Success', description: 'IRS item updated.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to update record.', variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit Item</span>
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent><p>Edit Item</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-4 border-b shrink-0">
          <DialogTitle>Edit Information Requirement</DialogTitle>
          <DialogDescription>Modify target dates or assignments for this schedule item.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6 pb-10">
              <FormField 
                control={form.control} 
                name="projectId" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} 
              />

              <FormField 
                control={form.control} 
                name="title" 
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Information Required</FormLabel>
                      <VoiceInput onResult={field.onChange} />
                    </div>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} 
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField 
                    control={form.control} 
                    name="assignedToEmail" 
                    render={({ field }) => (
                      <FormItem>
                          <FormLabel>Required From</FormLabel>
                          <Select onValueChange={(val) => field.onChange(val.split(':')[1])} value={field.value ? (availableStaff.some(u => u.email === field.value) ? `staff:${field.value}` : `partner:${field.value}`) : ""} disabled={!selectedProjectId}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Assignee" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  <SelectGroup>
                                    <SelectLabel className="flex items-center gap-2 text-primary">
                                      <ShieldCheck className="h-3 w-3" /> Project Staff
                                    </SelectLabel>
                                    {availableStaff.map(u => (
                                      <SelectItem key={`staff-${u.id}`} value={`staff:${u.email}`}>{u.name}</SelectItem>
                                    ))}
                                  </SelectGroup>
                                  <Separator className="my-1" />
                                  <SelectGroup>
                                    <SelectLabel className="flex items-center gap-2 text-accent">
                                      <Users2 className="h-3 w-3" /> Trade Partners
                                    </SelectLabel>
                                    {availablePartners.map(s => (
                                      <SelectItem key={`partner-${s.id}`} value={`partner:${s.email}`}>{s.name}</SelectItem>
                                    ))}
                                  </SelectGroup>
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                  )} />
                  <FormField 
                    control={form.control} 
                    name="requiredByDate" 
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Target Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                  )} />
              </div>

              <FormField 
                control={form.control} 
                name="notificationLeadDays" 
                render={({ field }) => (
                  <FormItem>
                      <FormLabel>Warning Period (Days)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription className="text-[10px]">
                        Days before target date to flag as a priority warning.
                      </FormDescription>
                      <FormMessage />
                  </FormItem>
              )} />

              <div className="pt-6 border-t">
                <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Update Requirement
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
