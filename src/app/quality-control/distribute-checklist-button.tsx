
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import type { QualityChecklist, Project } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sendChecklistEmailAction } from './actions';

/**
 * DistributeChecklistButton - Generates a comprehensive PDF of the QC checklist
 * and emails it to all recipients in the distribution list.
 */
export function DistributeChecklistButton({
  checklist,
  project,
}: {
  checklist: QualityChecklist;
  project?: Project;
}) {
  const [isDistributing, setIsDistributing] = useState(false);
  const { toast } = useToast();

  const handleDistribute = async () => {
    const emails = checklist.recipients || [];
    
    if (emails.length === 0) {
      toast({
        title: "Distribution Cancelled",
        description: "No recipients assigned to this checklist.",
        variant: "destructive",
      });
      return;
    }

    setIsDistributing(true);

    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const area = project?.areas?.find(a => a.id === checklist.areaId);
      const fileName = `QCReport-${checklist.title.replace(/\s+/g, '-')}-${area?.name.replace(/\s+/g, '-') || 'Site'}.pdf`;

      // Create temporary element for PDF rendering
      const reportElement = document.createElement('div');
      reportElement.style.position = 'absolute';
      reportElement.style.left = '-9999px';
      reportElement.style.padding = '40px';
      reportElement.style.width = '800px';
      reportElement.style.background = 'white';
      reportElement.style.color = 'black';
      reportElement.style.fontFamily = 'sans-serif';

      const completedCount = checklist.items.filter(i => i.status !== 'pending').length;
      const progress = checklist.items.length > 0 ? Math.round((completedCount / checklist.items.length) * 100) : 0;

      reportElement.innerHTML = `
        <div style="border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="margin: 0; color: #1e40af; font-size: 28px;">Quality Inspection</h1>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">${checklist.title}</p>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Project</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${project?.name || 'Unknown'}</p>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Area / Plot</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${area?.name || 'General Site'}</p>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Trade</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${checklist.trade}</p>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Progress</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${progress}% (${completedCount}/${checklist.items.length})</p>
          </div>
        </div>

        <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Compliance Points</h2>
        
        <div style="margin-bottom: 40px;">
          ${checklist.items.map(item => {
            const statusColors = {
              yes: { bg: '#dcfce7', text: '#166534', label: 'PASS' },
              no: { bg: '#fee2e2', text: '#991b1b', label: 'FAIL' },
              na: { bg: '#f1f5f9', text: '#475569', label: 'N/A' },
              pending: { bg: '#fef3c7', text: '#92400e', label: 'PENDING' }
            };
            const s = statusColors[item.status as keyof typeof statusColors];
            
            return `
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid;">
                <div style="background: #f8fafc; padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                  <p style="margin: 0; font-size: 13px; font-weight: bold; color: #1e293b; flex: 1;">${item.text}</p>
                  <div style="background: ${s.bg}; color: ${s.text}; padding: 4px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-left: 15px;">
                    ${s.label}
                  </div>
                </div>
                
                <div style="padding: 12px;">
                  ${item.comment ? `<p style="margin: 0 0 10px 0; font-size: 12px; color: #475569; font-style: italic;">"${item.comment}"</p>` : ''}
                  
                  ${item.photos && item.photos.length > 0 ? `
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                      ${item.photos.map(p => `
                        <img src="${p.url}" style="width: 100%; height: 100px; object-fit: cover; border-radius: 4px;" />
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
          <p style="font-size: 12px; color: #64748b;">This report was generated via SiteCommand.</p>
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

      const result = await sendChecklistEmailAction({
        emails,
        projectName: project?.name || 'Project',
        areaName: area?.name || 'Site',
        checklistTitle: checklist.title,
        pdfBase64,
        fileName
      });

      if (result.success) {
        toast({ title: "Distribution Complete", description: result.message });
      } else {
        toast({ title: "Email Error", description: result.message, variant: "destructive" });
      }
    } catch (err) {
      console.error('QC Distribution Error:', err);
      toast({ title: "Generation Error", description: "Failed to create or send inspection report.", variant: "destructive" });
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
            <span className="sr-only">Email report to trade partners</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Email PDF to Trade Partners</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
