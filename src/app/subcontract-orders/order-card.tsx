'use client';

import { useState, useTransition, useMemo } from 'react';
import type { SubContractOrder, Project, SubContractor, DistributionUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Calendar, 
  Loader2, 
  CheckCircle2, 
  FileSignature,
  Clock,
  Send,
  UserPlus,
  AlertTriangle,
  Pencil
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
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
import { cn } from '@/lib/utils';
import { EditSubContractOrderDialog } from './edit-order';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function OrderCard({ 
  order, 
  project, 
  projects,
  subContractors,
  currentUser
}: { 
  order: SubContractOrder; 
  project?: Project; 
  projects: Project[];
  subContractors: SubContractor[];
  currentUser: DistributionUser;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const isCompleted = order.status === 'completed';
  
  // Check if subcontractor is already assigned to project
  const isSubAssignedToProject = useMemo(() => {
    if (!project) return false;
    return project.assignedSubContractors?.includes(order.subcontractorId);
  }, [project, order.subcontractorId]);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const docRef = doc(db, 'subcontract-orders', order.id);
      await deleteDoc(docRef);
      toast({ title: 'Deleted', description: 'Order tracking removed.' });
    });
  };

  const handleAssignToProject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project) return;
    
    startTransition(async () => {
      try {
        const docRef = doc(db, 'projects', project.id);
        await updateDoc(docRef, {
          assignedSubContractors: arrayUnion(order.subcontractorId)
        });
        toast({ title: 'Team Updated', description: `${order.subcontractorName} assigned to project ${project.name}.` });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to update project team.', variant: 'destructive' });
      }
    });
  };

  const statusConfig = {
    'draft': { label: 'Draft', color: 'bg-slate-100 text-slate-800' },
    'pending-approval': { label: 'Awaiting Approval', color: 'bg-amber-100 text-amber-800' },
    'docusign': { label: 'On DocuSign', color: 'bg-blue-100 text-blue-800' },
    'completed': { label: 'Signed & Complete', color: 'bg-green-100 text-green-800' },
  };

  const currentStatus = statusConfig[order.status];

  return (
    <>
      <Card 
        className={cn(
          "hover:border-primary transition-all shadow-sm group cursor-pointer border-l-4",
          isCompleted ? "border-l-green-500 bg-green-50/5" : "border-l-primary"
        )}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px] bg-background text-primary border-primary/20">
                  {order.reference}
                </Badge>
                <CardTitle className="text-lg group-hover:text-primary transition-colors">
                  {order.subcontractorName}
                </CardTitle>
              </div>
              <CardDescription className="font-semibold text-foreground flex items-center gap-2">
                {project?.name || 'Unknown Project'} • {order.description}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
              <Badge className={cn("capitalize text-[10px]", currentStatus.color)}>
                {currentStatus.label}
              </Badge>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-primary" 
                      onClick={() => setIsEditDialogOpen(true)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Edit Tracking</p></TooltipContent>
                </Tooltip>

                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Remove Record</p></TooltipContent>
                  </Tooltip>
                  <AlertDialogContent onClick={e => e.stopPropagation()}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Tracking Record?</AlertDialogTitle>
                      <AlertDialogDescription>Permanently remove the agreement history for {order.subcontractorName}.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Drafted', date: order.draftedDate, icon: Clock },
              { label: 'Sent', date: order.sentForApprovalDate, icon: Send },
              { label: 'DocuSign', date: order.loadedOnDocuSignDate, icon: FileSignature },
              { label: 'Signed', date: order.signedDate, icon: CheckCircle2 },
            ].map((step, i) => (
              <div key={i} className={cn(
                "p-2 rounded-lg border flex flex-col items-center text-center gap-1",
                step.date ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-dashed opacity-50"
              )}>
                <step.icon className={cn("h-3 w-3", step.date ? "text-primary" : "text-muted-foreground")} />
                <span className="text-[9px] font-bold uppercase tracking-tighter">{step.label}</span>
                <span className="text-[10px] font-medium">
                  {step.date ? new Date(step.date).toLocaleDateString() : '---'}
                </span>
              </div>
            ))}
          </div>

          {isCompleted && !isSubAssignedToProject && (
            <Alert className="bg-amber-50 border-amber-200">
              <UserPlus className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 text-xs font-bold">Action Recommended</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4 mt-1">
                <p className="text-[10px] text-amber-700">Contract signed but partner not yet assigned to project team.</p>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-7 text-[10px] font-bold bg-white border-amber-200 hover:bg-amber-100 text-amber-700"
                  onClick={handleAssignToProject}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserPlus className="h-3 w-3 mr-1" />}
                  Assign Team
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <EditSubContractOrderDialog 
        order={order} 
        projects={projects} 
        subContractors={subContractors} 
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  );
}
