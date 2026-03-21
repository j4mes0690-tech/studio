
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
 * and sends it to the primary sub (To) and project staff (CC) via Resend.
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

  const isDistributed = !!instruction.distributedAt;
  const recipientCount = instruction.recipients?.length || 0;

  const handleDistribute = async () => {
    if (recipientCount === 0) {
      toast({
        title: "Distribution Cancelled",
        description: "No recipients are defined for this instruction.",
        variant: "destructive",
      });
      return;
    }

    setIsDistributing(true);

    try {
      const fileName = `SiteInstruction-${instruction.reference}.pdf`;

      // 1. Find the primary sub for branding the PDF if possible
      const sub = subContractors.find(s => instruction.recipients?.includes(s.email));

      // 2. Generate high-fidelity PDF with Appendices
      const pdf = await generateInstructionPDF(instruction, project, sub);
      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      // 3. Prepare additional attachments (Photos and Files)
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

      // 4. Split recipients: Primary sub goes To, others go CC
      const recipients = instruction.recipients || [];
      const to = recipients.length > 0 ? [recipients[0]] : [];
      const cc = recipients.slice(1);

      // 5. Send via Resend
      const result = await sendSiteInstructionEmailAction({
        to,
        cc,
        projectName: project?.name || 'Project',
        reference: instruction.reference,
        pdfBase64,
        fileName,
        additionalAttachments
      });

      if (result.success) {
        const docRef = doc(db, 'instructions', instruction.id);
        await updateDoc(docRef, { distributedAt: new Date().toISOString(), status: 'issued' });
        toast({ title: "Distribution Complete", description: `Instruction emailed to ${recipientCount} recipients.` });
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
            <span className="sr-only">{isDistributed ? 'Resend distributed instruction' : 'Distribute PDF to all recipients'}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isDistributed ? `Last sent: ${new Date(instruction.distributedAt!).toLocaleString()}. Click to resend to all.` : `Email PDF to ${recipientCount} personnel`}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
