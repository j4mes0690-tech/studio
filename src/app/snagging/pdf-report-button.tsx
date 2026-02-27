
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import type { SnaggingItem, Project, SubContractor } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function PdfReportButton({
  item,
  project,
  subContractors,
}: {
  item: SnaggingItem;
  project?: Project;
  subContractors: SubContractor[];
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePdf = async () => {
    setIsGenerating(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const reportElement = document.createElement('div');
      reportElement.style.padding = '40px';
      reportElement.style.width = '800px';
      reportElement.style.background = 'white';
      reportElement.style.color = 'black';
      reportElement.style.fontFamily = 'sans-serif';

      const area = project?.areas?.find(a => a.id === item.areaId);
      const formattedDate = new Date(item.createdAt).toLocaleDateString();

      reportElement.innerHTML = `
        <div style="border-bottom: 2px solid #f97316; padding-bottom: 20px; margin-bottom: 30px;">
          <h1 style="margin: 0; color: #1e40af; font-size: 28px;">Snagging Report</h1>
          <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px;">SiteCommand Internal Documentation</p>
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
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Report Date</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${formattedDate}</p>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Title</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${item.title}</p>
          </div>
        </div>

        <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Defect Log</h2>
        
        <div style="margin-bottom: 40px;">
          ${item.items.map(listItem => {
            const sub = subContractors.find(s => s.id === listItem.subContractorId);
            const hasIssuePhotos = listItem.photos && listItem.photos.length > 0;
            const hasCompletionPhotos = listItem.completionPhotos && listItem.completionPhotos.length > 0;
            
            return `
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 25px; overflow: hidden; page-break-inside: avoid;">
                <div style="background: #f8fafc; padding: 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                  <div style="flex: 1;">
                    <p style="margin: 0; font-size: 14px; font-weight: bold; color: #1e293b;">${listItem.description}</p>
                    <p style="margin: 4px 0 0 0; font-size: 11px; color: #64748b;">Assigned to: ${sub?.name || 'Unassigned'}</p>
                  </div>
                  <div style="background: ${listItem.status === 'closed' ? '#dcfce7' : '#fef3c7'}; color: ${listItem.status === 'closed' ? '#166534' : '#92400e'}; padding: 4px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                    ${listItem.status}
                  </div>
                </div>
                
                <div style="padding: 12px;">
                  ${hasIssuePhotos ? `
                    <p style="margin: 0; font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Issue Photos</p>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
                      ${listItem.photos!.map(p => `
                        <div style="border: 1px solid #f1f5f9; border-radius: 4px; overflow: hidden;">
                          <img src="${p.url}" style="width: 100%; height: 120px; object-fit: cover; display: block;" />
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}

                  ${hasCompletionPhotos ? `
                    <p style="margin: 0; font-size: 9px; font-weight: bold; color: #16a34a; text-transform: uppercase; margin-bottom: 8px;">Completion Evidence</p>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                      ${listItem.completionPhotos!.map(p => `
                        <div style="border: 2px solid #dcfce7; border-radius: 4px; overflow: hidden;">
                          <img src="${p.url}" style="width: 100%; height: 120px; object-fit: cover; display: block;" />
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${item.photos && item.photos.length > 0 ? `
          <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">General Site Photos</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; page-break-inside: avoid;">
            ${item.photos.map(p => `
              <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
                <img src="${p.url}" style="width: 100%; border-radius: 4px; object-fit: cover; aspect-ratio: 4/3; display: block;" />
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">Captured: ${new Date(p.takenAt).toLocaleString()}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;

      document.body.appendChild(reportElement);
      const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(reportElement);
      pdf.save(`snagging-report-${item.title.replace(/\s+/g, '-').toLowerCase()}-${formattedDate}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" onClick={generatePdf} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span className="sr-only">Export PDF Report</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Export PDF Report</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
