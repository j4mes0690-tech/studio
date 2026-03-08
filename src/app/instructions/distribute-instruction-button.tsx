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

/**
 * DistributeInstructionButton - Generates a high-resolution PDF of the site instruction
 * and sends it to the primary recipient via the Resend server action.
 * Tracks distribution status in Firestore to prevent duplicate issuance.
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

  // Identify the primary external recipient (Subcontractor/Designer) at component level
  const sub = subContractors.find(s => instruction.recipients?.includes(s.email));
  const isDistributed = !!instruction.distributedAt;

  const handleDistribute = async () => {
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

      // 1. Pre-convert photos to base64 to ensure they render in canvas correctly (CORS bypass)
      // Added robust error handling to prevent "Failed to fetch" from crashing the flow
      const photoBase64s = await Promise.all((instruction.photos || []).map(async (p) => {
        if (p.url.startsWith('data:')) return p.url;
        try {
          const resp = await fetch(p.url);
          const blob = await resp.blob();
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.warn("CORS block or network error for photo, falling back to direct URL", e);
          return p.url;
        }
      }));

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

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px;">
          <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px; margin-bottom: 5px;">Project Location</p>
            <p style="margin: 0; font-size: 16px; font-weight: bold; color: #1e293b;">${project?.name || 'Unknown Project'}</p>
            ${project?.address ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #475569; white-space: pre-wrap; line-height: 1.4;">${project.address}</p>` : ''}
          </div>
          <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px; margin-bottom: 5px;">Contract Authority</p>
            ${project?.siteManager ? `<p style="margin: 0; font-size: 14px; font-weight: bold;">${project.siteManager}</p>` : ''}
            ${project?.siteManagerPhone ? `<p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">Tel: ${project.siteManagerPhone}</p>` : ''}
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Date Issued</p>
                <p style="margin: 2px 0 0 0; font-size: 14px;">${new Date(instruction.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 40px;">
            <div style="background: #f1f5f9; padding: 15px; border-radius: 6px;">
                <p style="margin: 0 0 5px 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Issued To</p>
                <p style="margin: 0; font-size: 16px; font-weight: bold;">${sub.name}</p>
                <p style="margin: 2px 0 0 0; font-size: 12px; color: #475569;">${sub.email}</p>
            </div>
        </div>

        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 40px; min-height: 200px;">
          <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">Instruction Details</h2>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #334155;">${instruction.originalText}</p>
        </div>

        ${photoBase64s.length > 0 ? `
          <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Site Documentation</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            ${photoBase64s.map(url => `
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; padding: 10px;">
                <img src="${url}" crossorigin="anonymous" style="width: 100%; height: 200px; object-fit: cover; border-radius: 4px;" />
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="font-size: 12px; color: #64748b;">This instruction was distributed via SiteCommand.</p>
        </div>
      `;

      document.body.appendChild(reportElement);
      
      // Wait for any rendered content to be ready
      const images = reportElement.getElementsByTagName('img');
      const loadPromises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(loadPromises);

      const canvas = await html2canvas(reportElement, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(reportElement);

      const pdfBase64 = pdf.output('datauristring').split(',')[1];

      const result = await sendSiteInstructionEmailAction({
        email: sub.email,
        name: sub.name,
        projectName: project?.name || 'Project',
        reference: instruction.reference,
        pdfBase64,
        fileName
      });

      if (result.success) {
        // Track distribution success in Firestore
        const docRef = doc(db, 'instructions', instruction.id);
        await updateDoc(docRef, { 
          distributedAt: new Date().toISOString() 
        });
        
        toast({ title: "Distribution Complete", description: `Instruction ${instruction.reference} emailed to ${sub.name}.` });
      } else {
        toast({ title: "Email Error", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      console.error('Site Instruction Distribution Error:', err);
      toast({ title: "Generation Error", description: "Failed to create or send instruction PDF.", variant: "destructive" });
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
            className={cn(
                "transition-all",
                isDistributed ? "text-green-600 hover:text-green-700 hover:bg-green-50" : "text-muted-foreground"
            )}
          >
            {isDistributing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isDistributed ? (
                <CheckCircle2 className="h-4 w-4" />
            ) : (
                <Send className="h-4 w-4" />
            )}
            <span className="sr-only">
                {isDistributed ? 'Resend distributed instruction' : 'Distribute PDF to partner'}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isDistributed 
                ? `Emailed on ${new Date(instruction.distributedAt!).toLocaleString()}. Click to resend.` 
                : `Email PDF to ${sub?.name || 'Partner'}`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
