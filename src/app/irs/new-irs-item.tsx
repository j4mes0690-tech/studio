
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
import { PlusCircle, Loader2, Save, ShieldCheck, Users2 } from 'lucide-react';
import type { Project, DistributionUser, SubContractor, IRSItem } from '@/lib/types';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getProjectInitials, getNextReference } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { VoiceInput } from '@/components/voice-input';

const NewIRSItemSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  title: z.string().min(3, 'Description of information is required.'),
  description: z.string().optional(),
  assignedToEmail: z.string().email('Assignee email is required.'),
  requiredByDate: z.string().min(1, 'Target date is required.'),
  notificationLeadDays: z.coerce.number().min(0).default(7),
});

type NewIRSItemFormValues = z.infer<typeof NewIRSItemSchema>;

export function NewIRSItemDialog({ 
  projects, 
  users, 
  subContractors, 
  allIRSItems, 
  currentUser 
}: { 
  projects: Project[]; 
  users: DistributionUser[]; 
  subContractors: SubContractor[];
  allIRSItems: IRSItem[];
  currentUser: DistributionUser;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();

  const form = useForm<NewIRSItemFormValues>({
    resolver: zodResolver(NewIRSItemSchema),
    defaultValues: {
      projectId: '',
      title: '',
      description: '',
      assignedToEmail: '',
      requiredByDate: '',
      notificationLeadDays: 7,
    },
  });

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

  const onSubmit = (values: NewIRSItemFormValues) => {
    startTransition(async () => {
      try {
        const initials = getProjectInitials(selectedProject?.name || 'PRJ');
        const existingRefs = allIRSItems.map(i => ({ reference: i.reference, projectId: i.projectId }));
        const reference = getNextReference(existingRefs, values.projectId, 'IRS', initials);

        const irsData: Omit<IRSItem, 'id'> = {
          reference,
          projectId: values.projectId,
          title: values.title,
          description: values.description || '',
          assignedToEmail: values.assignedToEmail.toLowerCase().trim(),
          requiredByDate: values.requiredByDate,
          notificationLeadDays: values.notificationLeadDays,
          status: 'open',
          createdAt: new Date().toISOString(),
          createdByEmail: currentUser.email.toLowerCase().trim()
        };

        await addDoc(collection(db, 'irs-items'), irsData);
        toast({ title: 'Success', description: 'IRS item logged.' });
        setOpen(false);
      } catch (err) {
        console.error(err);
        toast({ title: 'Error', description: 'Failed to save item.', variant: 'destructive' });
      }
    });
  };

  useEffect(() => {
    if (!open) form.reset();
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><PlusCircle className="h-4 w-4" />Add IRS Item</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record Information Requirement</DialogTitle>
          <DialogDescription>Add a deliverable to the project schedule. Automated RFIs trigger if overdue.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <FormMessage />
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
                    <Input placeholder="e.g. Kitchen finish choices or Lighting Layout" {...field} />
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
                        <Select onValueChange={field.onChange} value={field.value} disabled={!selectedProjectId}>
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
                                    <SelectItem key={`staff-${u.id}`} value={u.email}>{u.name}</SelectItem>
                                  ))}
                                </SelectGroup>
                                <Separator className="my-1" />
                                <SelectGroup>
                                  <SelectLabel className="flex items-center gap-2 text-accent">
                                    <Users2 className="h-3 w-3" /> Trade Partners
                                  </SelectLabel>
                                  {availablePartners.map(s => (
                                    <SelectItem key={`partner-${s.id}`} value={s.email}>{s.name}</SelectItem>
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

            <DialogFooter>
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4 mr-2" />}
                Save to Schedule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
