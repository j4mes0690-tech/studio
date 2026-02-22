
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Loader2 } from 'lucide-react';
import type { SnaggingItem, Project, SubContractor } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { sendSubcontractorReportAction } from './actions';

/**
 * DistributeReportsButton - Handles generating individual PDFs and 
 * calling the Server Action to send them via Resend.
 */
export function DistributeReportsButton({
  item,
  project,
  subContractors,
}: {
  item: SnaggingItem;
  project?: Project;
  subContractors: SubContractor[];
}) {
  const [isDistributing, setIsDistributing] = useState(false);
  const { toast } = useToast();

  const handleDistribute = async () => {
    const assignedSubIds = Array.from(new Set(
      item.items
        .map(i => i.subContractorId)
        .filter(id => !!id)
    )) as string[];

    if (assignedSubIds.length === 0) {
      toast({
        title: "Distribution Cancelled",
        description: "No subcontractors are assigned to any items in this list.",
        variant: "destructive",
      });
      return;
    }

    setIsDistributing(true);

    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      for (const subId of assignedSubIds) {
        const sub = subContractors.find(s => s.id === subId);
        if (!sub) continue;

        const filteredItems = item.items.filter(i => i.subContractorId === subId);
        const area = project?.areas?.find(a => a.id === item.areaId);
        const formattedDate = new Date(item.createdAt).toLocaleDateString();
        const fileName = `SnagReport-${sub.name.replace(/\s+/g, '-')}-${item.title.replace(/\s+/g, '-')}.pdf`;

        // Create Report Layout
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
            <h1 style="margin: 0; color: #1e40af; font-size: 28px;">Individual Snagging Report</h1>
            <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">Recipient: ${sub.name} (${sub.email})</p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
            <div>
              <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Project</p>
              <p style="margin: 2px 0 0 0; font-size: 16px;">${project?.name || 'Unknown Project'}</p>
            </div>
            <div>
              <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Area</p>
              <p style="margin: 2px 0 0 0; font-size: 16px;">${area?.name || 'General Site'}</p>
            </div>
          </div>

          <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Assigned Items</h2>
          
          <div style="margin-bottom: 40px;">
            ${filteredItems.map(listItem => {
              const hasPhotos = listItem.photos && listItem.photos.length > 0;
              return `
                <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid;">
                  <div style="background: #f8fafc; padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                    <p style="margin: 0; font-size: 14px; font-weight: bold; color: #1e293b;">${listItem.description}</p>
                    <div style="background: ${listItem.status === 'closed' ? '#dcfce7' : '#fef3c7'}; color: ${listItem.status === 'closed' ? '#166534' : '#92400e'}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                      ${listItem.status}
                    </div>
                  </div>
                  ${hasPhotos ? `
                    <div style="padding: 12px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                      ${listItem.photos!.map(p => `
                        <div style="border: 1px solid #f1f5f9; border-radius: 4px; overflow: hidden;">
                          <img src="${p.url}" style="width: 100%; height: 120px; object-fit: cover; display: block;" />
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="font-size: 12px; color: #64748b;">Report generated on ${formattedDate} via SiteCommand.</p>
          </div>
        `;

        document.body.appendChild(reportElement);
        
        const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false });
        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        
        document.body.removeChild(reportElement);

        // Convert to Base64 for the Server Action
        const pdfBase64 = pdf.output('datauristring').split(',')[1];

        // Call Server Action to actually send the email
        const result = await sendSubcontractorReportAction({
          email: sub.email,
          name: sub.name,
          projectName: project?.name || 'Project',
          areaName: area?.name || 'General Area',
          pdfBase64,
          fileName
        });

        if (result.success) {
          toast({
            title: "Report Sent",
            description: result.message,
          });
        } else {
          toast({
            title: "Transmission Failed",
            description: `${sub.name}: ${result.message}`,
            variant: "destructive"
          });
        }
      }

      toast({
        title: "Process Complete",
        description: "Finished processing all assigned subcontractor reports.",
      });

    } catch (err) {
      console.error('Distribution Error:', err);
      toast({
        title: "Critical Error",
        description: "An unexpected error occurred while distributing reports.",
        variant: "destructive"
      });
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
            <span className="sr-only">Email filtered reports to subcontractors</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Email filtered tasks to all assigned subcontractors</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
