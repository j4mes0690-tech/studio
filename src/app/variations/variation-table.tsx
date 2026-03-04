'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { Variation, Project, ClientInstruction, Instruction, DistributionUser } from '@/lib/types';
import { ClientDate } from '@/components/client-date';
import { useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Trash2, FileDown, Loader2, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { EditVariationDialog } from './edit-variation';

export function VariationTable({ 
  variations, 
  projects,
  clientInstructions,
  siteInstructions,
  allVariations,
  currentUser
}: { 
  variations: Variation[]; 
  projects: Project[];
  clientInstructions: ClientInstruction[];
  siteInstructions: Instruction[];
  allVariations: Variation[];
  currentUser: DistributionUser;
}) {
  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Ref</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-[150px]">Project</TableHead>
            <TableHead className="w-[120px] text-right">Net Value</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variations.map((v) => (
            <VariationTableRow 
              key={v.id} 
              variation={v} 
              projects={projects}
              clientInstructions={clientInstructions}
              siteInstructions={siteInstructions}
              allVariations={allVariations}
              currentUser={currentUser}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function VariationTableRow({ 
  variation, 
  projects,
  clientInstructions,
  siteInstructions,
  allVariations,
  currentUser
}: { 
  variation: Variation; 
  projects: Project[];
  clientInstructions: ClientInstruction[];
  siteInstructions: Instruction[];
  allVariations: Variation[];
  currentUser: DistributionUser;
}) {
  const project = projects.find(p => p.id === variation.projectId);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      await deleteDoc(doc(db, 'variations', variation.id));
      toast({ title: 'Success', description: 'Variation deleted.' });
    });
  };

  return (
    <>
      <TableRow 
        className={cn("group cursor-pointer", variation.status === 'draft' && "bg-orange-50/20")}
        onClick={() => setIsEditDialogOpen(true)}
      >
        <TableCell className="font-mono text-[10px]">{variation.reference}</TableCell>
        <TableCell className="font-medium truncate max-w-[250px]">{variation.title}</TableCell>
        <TableCell className="truncate max-w-[150px] text-muted-foreground text-xs">{project?.name || 'Unknown'}</TableCell>
        <TableCell className={cn(
            "text-right font-bold",
            variation.totalAmount >= 0 ? "text-green-600" : "text-red-600"
        )}>
            {variation.totalAmount < 0 ? '-' : ''}£{Math.abs(variation.totalAmount).toFixed(2)}
        </TableCell>
        <TableCell>
          <Badge className={cn(
            "capitalize text-[10px]",
            variation.status === 'agreed' ? 'bg-green-100 text-green-800' :
            variation.status === 'pending' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
          )}>
            {variation.status === 'pending' ? 'Submitted' : variation.status}
          </Badge>
        </TableCell>
        <TableCell>
          <span className="text-xs text-muted-foreground">
            <ClientDate date={variation.createdAt} format="date" />
          </span>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
            <TooltipProvider>
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent><p>Delete Variation</p></TooltipContent>
                </Tooltip>
                <AlertDialogContent onClick={e => e.stopPropagation()}>
                  <AlertDialogHeader><AlertDialogTitle>Delete Variation?</AlertDialogTitle><AlertDialogDescription>This will permanently remove this financial record.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive" disabled={isPending}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TooltipProvider>
          </div>
        </TableCell>
      </TableRow>

      <EditVariationDialog 
        variation={variation}
        projects={projects}
        allVariations={allVariations}
        clientInstructions={clientInstructions}
        siteInstructions={siteInstructions}
        currentUser={currentUser}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />
    </>
  );
}
