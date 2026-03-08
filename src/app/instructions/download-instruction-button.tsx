'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import type { Instruction, Project, SubContractor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { generateInstructionPDF } from '@/lib/pdf-utils';

/**
 * DownloadInstructionButton - Generates and saves the professional PDF report
 * locally for the user.
 */
export function DownloadInstructionButton({
  instruction,
  project,
  subContractors,
}: {
  instruction: Instruction;
  project?: Project;
  subContractors: SubContractor[];
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      // Find the primary sub for branding the PDF if possible
      const sub = subContractors.find(s => instruction.recipients?.includes(s.email));

      // Generate the high-fidelity PDF
      const pdf = await generateInstructionPDF(instruction, project, sub);
      
      // Save locally
      pdf.save(`SiteInstruction-${instruction.reference}.pdf`);
      
      toast({ title: "Success", description: "PDF generated and downloaded." });
    } catch (err) {
      console.error('PDF Generation Error:', err);
      toast({ title: "Error", description: "Failed to generate PDF document.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleDownload} 
            disabled={isGenerating}
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            <span className="sr-only">Download PDF</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Download PDF Report</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
