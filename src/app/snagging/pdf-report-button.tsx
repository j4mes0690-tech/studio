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
      // Dynamic imports to prevent SSR issues in NextJS 15
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Create a temporary element for the report layout
      const reportElement = document.createElement('div');
      reportElement.style.padding = '40px';
      reportElement.style.width = '800px';
      reportElement.style.background = 'white';
      reportElement.style.color = 'black';
      reportElement.style.fontFamily = 'sans-serif';
      reportElement.className = 'pdf-report-container';

      const area = project?.areas?.find(a => a.id === item.areaId);
      const formattedDate = new Date(item.createdAt).toLocaleDateString();

      // HTML Content for PDF
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

        <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Defect Items</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
          <thead>
            <tr style="background: #f8fafc; text-align: left;">
              <th style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px;">Description</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px;">Assigned To</th>
              <th style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px; width: 80px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${item.items.map(listItem => {
              const sub = subContractors.find(s => s.id === listItem.subContractorId);
              return `
                <tr>
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 13px;">${listItem.description}</td>
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 13px;">${sub?.name || 'Unassigned'}</td>
                  <td style="padding: 12px; border: 1px solid #e2e8f0; font-size: 12px; font-weight: bold; color: ${listItem.status === 'closed' ? '#10b981' : '#f59e0b'};">
                    ${listItem.status.toUpperCase()}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        ${item.items.some(i => i.photos && i.photos.length > 0) ? `
          <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Item Photos</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px;">
            ${item.items.flatMap(listItem => 
              (listItem.photos || []).map(p => `
                <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
                  <img src="${p.url}" style="width: 100%; border-radius: 4px; object-fit: cover; aspect-ratio: 4/3;" />
                  <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">${listItem.description}</p>
                </div>
              `)
            ).join('')}
          </div>
        ` : ''}

        ${item.photos && item.photos.length > 0 ? `
          <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">General Site Photos</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
            ${item.photos.map(p => `
              <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
                <img src="${p.url}" style="width: 100%; border-radius: 4px; object-fit: cover; aspect-ratio: 4/3;" />
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b;">Captured: ${new Date(p.takenAt).toLocaleString()}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;

      // Append to body temporarily to capture
      document.body.appendChild(reportElement);
      
      // Use html2canvas to render the content
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      
      // Cleanup
      document.body.removeChild(reportElement);
      
      // Download
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
