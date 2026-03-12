
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Loader2 } from 'lucide-react';
import type { SnaggingItem, Project, SubContractor, Photo } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * toDataUri - Robust helper to convert external URLs to Data URIs for reliable PDF embedding.
 * Falls back to original URL if conversion fails (e.g. CORS).
 */
const toDataUri = (url: string): Promise<string> => {
  if (!url) return Promise.resolve('');
  if (url.startsWith('data:')) return Promise.resolve(url);
  
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        // If this fails due to tainted canvas, catch block handles it
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (e) {
        // Server doesn't support CORS for this file
        console.warn("PDF Generation: Using fallback URL for", url);
        resolve(url);
      }
    };
    img.onerror = () => {
      console.warn("PDF Generation: Image load failed", url);
      resolve(url); // Return original URL as fallback
    };
    img.src = url;
  });
};

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

      // 1. Pre-convert all images
      const generalPhotoData = await Promise.all((item.photos || []).map(async p => ({
        ...p,
        dataUrl: await toDataUri(p.url)
      })));

      const itemsWithProcessedUrls = await Promise.all(item.items.map(async i => {
        const photos = await Promise.all((i.photos || []).map(async p => await toDataUri(p.url)));
        const completionPhotos = await Promise.all((i.completionPhotos || []).map(async p => await toDataUri(p.url)));
        return { 
          ...i, 
          processedPhotos: photos, 
          processedCompletion: completionPhotos 
        };
      }));

      const reportElement = document.createElement('div');
      reportElement.style.position = 'absolute';
      reportElement.style.left = '-9999px';
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
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Project Location</p>
            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: bold;">${project?.name || 'Unknown Project'}</p>
            ${project?.address ? `<p style="margin: 5px 0 0 0; font-size: 11px; color: #475569; white-space: pre-wrap;">${project.address}</p>` : ''}
          </div>
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Area / Plot</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${area?.name || 'General Site'}</p>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">List Identifier</p>
            <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: bold;">${item.title}</p>
          </div>
          <div>
            <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Report Date</p>
            <p style="margin: 2px 0 0 0; font-size: 16px;">${formattedDate}</p>
          </div>
        </div>

        <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">Defect Log</h2>
        
        <div style="margin-bottom: 40px;">
          ${itemsWithProcessedUrls.map(listItem => {
            const sub = subContractors.find(s => s.id === listItem.subContractorId);
            const originalHasPhotos = (listItem.photos?.length || 0) > 0;
            const originalHasCompletion = (listItem.completionPhotos?.length || 0) > 0;
            
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
                  ${originalHasPhotos ? `
                    <p style="margin: 0; font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 8px;">Issue Photos</p>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
                      ${listItem.processedPhotos.map(url => `
                        <div style="border: 1px solid #f1f5f9; border-radius: 4px; overflow: hidden;">
                          <img src="${url}" style="width: 100%; height: 120px; object-fit: cover; display: block;" />
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}

                  ${originalHasCompletion ? `
                    <p style="margin: 0; font-size: 9px; font-weight: bold; color: #16a34a; text-transform: uppercase; margin-bottom: 8px;">Completion Evidence</p>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
                      ${listItem.processedCompletion.map(url => `
                        <div style="border: 2px solid #dcfce7; border-radius: 4px; overflow: hidden;">
                          <img src="${url}" style="width: 100%; height: 120px; object-fit: cover; display: block;" />
                        </div>
                      `).join('')}
                    </div>
                  ` : ''}

                  ${(!originalHasPhotos && !originalHasCompletion) ? `
                    <p style="margin: 0; font-size: 10px; color: #94a3b8; font-style: italic;">No specific visual evidence provided for this point.</p>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${generalPhotoData.length > 0 ? `
          <h2 style="font-size: 18px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px;">General Site Photos</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; page-break-inside: avoid;">
            ${generalPhotoData.map(p => `
              <div style="border: 1px solid #e2e8f0; padding: 10px; border-radius: 8px;">
                <img src="${p.dataUrl}" style="width: 100%; border-radius: 4px; object-fit: cover; aspect-ratio: 4/3; display: block;" />
                <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b; text-align: center;">Captured: ${new Date(p.takenAt).toLocaleString()}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;

      document.body.appendChild(reportElement);
      const canvas = await html2canvas(reportElement, { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        allowTaint: true
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      document.body.removeChild(reportElement);
      pdf.save(`snagging-report-${item.title.replace(/\s+/g, '-').toLowerCase()}-${formattedDate}.pdf`);
    } catch (err) {
      console.error('Snagging PDF Generation Error:', err);
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
