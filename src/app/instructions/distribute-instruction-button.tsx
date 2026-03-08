'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';
import type { Instruction, Project, SubContractor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sendSiteInstructionEmailAction } from './actions';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { generateInstructionPDF } from '@/lib/pdf-utils';

/**
 * DistributeInstructionButton - Generates a high-resolution PDF of the site instruction
 * and sends it to the primary recipient via the Resend server action.
 * Now includes all photos and files as individual email attachments.
 */
export function DistributeInstructionButton({
  instruction,
  project,
  subContractors,
}: {
  instruction: Instruction;
  project?: Project;
  subContractors: SubContractor[];
}) {
  const [isDistributing, setIsDistributing] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();

  const sub = subContractors.find(s => instruction.recipients?.includes(s.email));
  const isDistributed = !!instruction.distributedAt;

  const handleDistribute = async () => {
    if (!sub) {
      toast({
        title: "Distribution Cancelled",
        description: "No sub-contractor is formally assigned to this instruction.",
        variant: "destructive",
      });
      return;
    }

    setIsDistributing(true);

    try {
      const fileName = `SiteInstruction-${instruction.reference}.pdf`;

      // 1. Generate high-fidelity PDF with Appendices
      const pdf = await generateInstructionPDF(instruction, project, sub);
      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      // 2. Prepare additional attachments (Photos and Files)
      const additionalAttachments = [
        ...(instruction.photos || []).map((p, i) => ({
          name: `Appendix-Photo-${i + 1}.jpg`,
          url: p.url
        })),
        ...(instruction.files || []).map(f => ({
          name: f.name,
          url: f.url
        }))
      ];

      // 3. Send via Resend
      const result = await sendSiteInstructionEmailAction({
        email: sub.email,
        name: sub.name,
        projectName: project?.name || 'Project',
        reference: instruction.reference,
        pdfBase64,
        fileName,
        additionalAttachments
      });

      if (result.success) {
        const docRef = doc(db, 'instructions', instruction.id);
        await updateDoc(docRef, { distributedAt: new Date().toISOString() });
        toast({ title: "Distribution Complete", description: `Instruction and ${additionalAttachments.length} attachments emailed to ${sub.name}.` });
      } else {
        toast({ title: "Email Error", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      console.error('Distribution Error:', err);
      toast({ title: "Process Error", description: "Failed to generate or send instruction report.", variant: "destructive" });
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleDistribute} 
            disabled={isDistributing}
            className={cn("transition-all", isDistributed ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-muted-foreground")}
          >
            {isDistributing ? <Loader2 className="h-4 w-4 animate-spin" /> : isDistributed ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">{isDistributed ? 'Resend distributed instruction' : 'Distribute PDF to partner'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isDistributed ? `Emailed on ${new Date(instruction.distributedAt!).toLocaleString()}. Click to resend.` : `Email PDF to ${sub?.name || 'Partner'}`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
