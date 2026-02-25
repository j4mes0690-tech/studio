'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import type { Instruction, Project, SubContractor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sendSubcontractorReportAction } from '@/app/snagging/actions';

/**
 * DistributeInstructionButton - Generates a PDF of the site instruction
 * and sends it to the primary recipient via the Resend server action.
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

  const handleDistribute = async () => {
    // Identify the primary external recipient (Subcontractor/Designer)
    const sub = subContractors.find(s => instruction.recipients?.includes(s.email));

    if (!sub) {
      toast({
        title: "Distribution Cancelled",
        description: "No sub-contractor or designer is formally assigned to this instruction.",
        variant: "destructive",
      });
      return;
    }

    setIsDistributing(true);

    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const fileName = `SiteInstruction-${instruction.reference}-${sub.name.replace(/\s+/g, '-')}.pdf`;

      // Create a temporary off-screen element for PDF rendering
      const reportElement = document.createElement('div');
      reportElement.style.position = 'absolute';
      reportElement.style.left = '-9999px';
      reportElement.style.padding = '40px';
      reportElement.style.width = '800px';
      reportElement.style.background = 'white';
      reportElement.style.color = 'black';
      reportElement.style.fontFamily = 'sans-serif';

      reportElement.innerHTML = `
        <div style="border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="margin: 0; color: #1e40af; font-size: 28px;">Site Instruction</h1>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Reference: ${instruction.reference}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Project</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${project?.name || 'Unknown Project'}</p>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Issued To</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${sub.name}</p>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Date Issued</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${new Date(instruction.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 40px;">
          <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e293b;">Instruction Details</h2>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${instruction.originalText}</p>
        </div>

        ${instruction.photos && instruction.photos.length > 0 ? `
          <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Site Documentation</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            ${instruction.photos.map(p => `
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; padding: 10px;">
                <img src="${p.url}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 4px;" />
                <p style="margin: 8px 0 0 0; font-size: 10px; color: #64748b; text-align: center;">Captured: ${new Date(p.takenAt).toLocaleString()}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="font-size: 12px; color: #64748b;">This instruction was distributed via SiteCommand.</p>
        </div>
      `;

      document.body.appendChild(reportElement);
      const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(reportElement);

      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      const result = await sendSubcontractorReportAction({
        email: sub.email,
        name: sub.name,
        projectName: project?.name || 'Project',
        areaName: 'Site Instruction',
        pdfBase64,
        fileName
      });

      if (result.success) {
        toast({ title: "Distribution Complete", description: `Instruction ${instruction.reference} emailed to ${sub.name}.` });
      } else {
        toast({ title: "Email Error", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      console.error('Instruction Distribution Error:', err);
      toast({ title: "Generation Error", description: "Failed to create or send instruction PDF.", variant: "destructive" });
    } finally {
      setIsDistributing(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={handleDistribute} disabled={isDistributing}>
            {isDistributing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Distribute PDF to partner</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Email PDF to {sub?.name || 'Partner'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
