import type { Instruction, Project, SubContractor, SnaggingItem, SnaggingListItem, Photo } from '@/lib/types';

/**
 * safeLoadImage - The most robust way to get an external URL into a PDF.
 * Uses a Canvas pipeline to convert images to Base64 while respecting CORS.
 */
async function safeLoadImage(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;

  return new Promise((resolve) => {
    const img = new Image();
    // CRITICAL: Request CORS access. Requires "Access-Control-Allow-Origin" on the server.
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        // Use PNG as it's more stable for varying source formats
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error("PDF: Canvas conversion failed (CORS issue)", url, e);
        resolve(null);
      }
    };

    img.onerror = () => {
      console.warn("PDF: Image failed to load", url);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * generateInstructionPDF - Robust utility to create a Site Instruction PDF.
 */
export async function generateInstructionPDF(
  instruction: Instruction,
  project?: Project,
  recipient?: SubContractor
) {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  const reportElement = document.createElement('div');
  reportElement.style.position = 'absolute';
  reportElement.style.left = '-9999px';
  reportElement.style.padding = '40px';
  reportElement.style.width = '800px';
  reportElement.style.background = 'white';
  reportElement.style.color = 'black';
  reportElement.style.fontFamily = 'sans-serif';

  reportElement.innerHTML = `
    <div style="border-bottom: 3px solid #f97316; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="margin: 0; color: #1e40af; font-size: 32px;">Site Instruction</h1>
      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold;">Reference: ${instruction.reference}</p>
    </div>

    <div style="margin-bottom: 40px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 20px;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; height: 120px;">
              <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px; margin-bottom: 5px;">Project Location</p>
              <p style="margin: 0; font-size: 16px; font-weight: bold; color: #1e293b;">${project?.name || 'Unknown'}</p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #475569; line-height: 1.4;">${project?.address || 'No address provided'}</p>
            </div>
          </td>
          <td style="width: 50%; vertical-align: top;">
            <div style="background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0; height: 120px;">
              <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px; margin-bottom: 5px;">Issued To</p>
              <p style="margin: 0; font-size: 16px; font-weight: bold;">${recipient?.name || 'Assigned Partner'}</p>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #475569;">${recipient?.email || ''}</p>
              <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 11px;"><strong>Date Issued:</strong> ${new Date(instruction.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; min-height: 150px; margin-bottom: 40px;">
      <h2 style="margin: 0 0 15px 0; font-size: 18px; color: #1e293b; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">Instruction Details</h2>
      <p style="margin: 0; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #334155;">${instruction.originalText}</p>
    </div>
  `;

  document.body.appendChild(reportElement);
  const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
  document.body.removeChild(reportElement);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const canvasHeightInPdf = (canvas.height * pdfWidth) / canvas.width;
  
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, canvasHeightInPdf);

  let currentY = canvasHeightInPdf + 15;

  const photos = instruction.photos || [];
  if (photos.length > 0) {
    if (currentY + 30 > pdfHeight) { pdf.addPage(); currentY = 20; }
    pdf.setFontSize(14);
    pdf.setTextColor(30, 41, 59);
    pdf.text("Appendix A: Visual Evidence", 10, currentY);
    currentY += 10;

    for (const p of photos) {
      const dataUri = await safeLoadImage(p.url);
      
      if (currentY + 130 > pdfHeight) { pdf.addPage(); currentY = 20; }
      
      if (dataUri) {
        pdf.addImage(dataUri, 'PNG', 10, currentY, 190, 120, undefined, 'FAST');
      } else {
        // Draw Placeholder for failed image
        pdf.setFillColor(241, 245, 249);
        pdf.rect(10, currentY, 190, 120, 'F');
        pdf.setFontSize(10);
        pdf.setTextColor(148, 163, 184);
        pdf.text("Image failed to load (Security Restriction)", 105, currentY + 60, { align: 'center' });
      }
      currentY += 130;
    }
  }

  return pdf;
}

/**
 * generateSnaggingPDF - Specialized engine for comprehensive snagging reports.
 * Features Pagination, Trade grouping, and reliable image embedding via Canvas pipeline.
 */
export async function generateSnaggingPDF(
  params: {
    title: string;
    project?: Project;
    subContractors: SubContractor[];
    aggregatedEntries: { listTitle: string, areaName: string, snag: SnaggingListItem }[];
    generalPhotos: Photo[];
    scopeLabel?: string;
  }
) {
  const { title, project, subContractors, aggregatedEntries, generalPhotos, scopeLabel } = params;
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  // 1. Create Header via html2canvas for consistent styling
  const headerElement = document.createElement('div');
  headerElement.style.position = 'absolute';
  headerElement.style.left = '-9999px';
  headerElement.style.padding = '40px';
  headerElement.style.width = '800px';
  headerElement.style.background = 'white';
  headerElement.style.color = 'black';
  headerElement.style.fontFamily = 'sans-serif';

  headerElement.innerHTML = `
    <div style="border-bottom: 3px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="margin: 0; color: #1e40af; font-size: 28px; text-transform: uppercase;">${title}</h1>
      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold;">Project: ${project?.name || 'Unknown'}</p>
      ${scopeLabel ? `<p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Scope: ${scopeLabel}</p>` : ''}
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div>
        <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Contract Authority</p>
        <p style="margin: 2px 0 0 0; font-size: 14px; font-weight: bold;">${project?.siteManager || '---'}</p>
      </div>
      <div>
        <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Report Date</p>
        <p style="margin: 2px 0 0 0; font-size: 14px;">${new Date().toLocaleDateString()}</p>
      </div>
    </div>
  `;

  document.body.appendChild(headerElement);
  const headerCanvas = await html2canvas(headerElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  document.body.removeChild(headerElement);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const headerHeightInPdf = (headerCanvas.height * pdfWidth) / headerCanvas.width;
  
  pdf.addImage(headerCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, headerHeightInPdf);

  let currentY = headerHeightInPdf + 10;

  // 2. Loop through entries and add to PDF
  for (const entry of aggregatedEntries) {
    const sub = subContractors.find(s => s.id === entry.snag.subContractorId);
    const photos = [...(entry.snag.photos || []), ...(entry.snag.completionPhotos || [])];
    
    // Check for page break before new item header
    if (currentY + 25 > pdfHeight) { pdf.addPage(); currentY = 20; }

    // Item Header
    pdf.setFillColor(248, 250, 252);
    pdf.rect(10, currentY, 190, 15, 'F');
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(10, currentY, 190, 15, 'S');
    
    pdf.setFontSize(11);
    pdf.setTextColor(30, 41, 59);
    pdf.setFont("helvetica", "bold");
    pdf.text(entry.snag.description, 15, currentY + 7);
    
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Trade: ${sub?.name || 'Unassigned'} | Location: ${entry.areaName} | ${entry.listTitle}`, 15, currentY + 12);
    
    const statusLabel = entry.snag.status.toUpperCase().replace('-', ' ');
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    if (entry.snag.status === 'closed') pdf.setTextColor(22, 101, 52);
    else if (entry.snag.status === 'provisionally-complete') pdf.setTextColor(146, 64, 14);
    else pdf.setTextColor(153, 27, 27);
    pdf.text(statusLabel, 195 - pdf.getTextWidth(statusLabel), currentY + 9);

    currentY += 20;

    // Photos Processing
    if (photos.length > 0) {
      const imgWidth = 60;
      const imgHeight = 45;
      let imgX = 15;

      for (const p of photos) {
        // Prevent layout overflow
        if (imgX + imgWidth > 195) {
          imgX = 15;
          currentY += imgHeight + 5;
        }

        // Check for page break before image
        if (currentY + imgHeight > pdfHeight - 20) {
          pdf.addPage();
          currentY = 20;
          imgX = 15;
        }

        const dataUri = await safeLoadImage(p.url);
        if (dataUri) {
          pdf.addImage(dataUri, 'PNG', imgX, currentY, imgWidth, imgHeight, undefined, 'FAST');
        } else {
          // Draw Missing Image Placeholder
          pdf.setFillColor(241, 245, 249);
          pdf.rect(imgX, currentY, imgWidth, imgHeight, 'F');
          pdf.setDrawColor(226, 232, 240);
          pdf.rect(imgX, currentY, imgWidth, imgHeight, 'S');
          pdf.setFontSize(7);
          pdf.setTextColor(148, 163, 184);
          pdf.text("Photo Not Available", imgX + (imgWidth/2), currentY + (imgHeight/2), { align: 'center' });
        }
        imgX += imgWidth + 5;
      }
      currentY += imgHeight + 10;
    } else {
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.setFont("helvetica", "italic");
      pdf.text("No visual evidence recorded for this item.", 15, currentY);
      currentY += 10;
    }
    
    // Separator line
    pdf.setDrawColor(241, 245, 249);
    pdf.line(10, currentY, 200, currentY);
    currentY += 5;
  }

  // 3. General Site Documentation (Last Page)
  if (generalPhotos.length > 0) {
    if (currentY + 40 > pdfHeight) { pdf.addPage(); currentY = 20; }
    else { currentY += 10; }

    pdf.setFontSize(14);
    pdf.setTextColor(30, 41, 59);
    pdf.setFont("helvetica", "bold");
    pdf.text("General Site Documentation", 10, currentY);
    currentY += 10;

    for (const p of generalPhotos) {
      if (currentY + 125 > pdfHeight) { pdf.addPage(); currentY = 20; }
      
      const dataUri = await safeLoadImage(p.url);
      if (dataUri) {
        pdf.addImage(dataUri, 'PNG', 10, currentY, 190, 120, undefined, 'FAST');
      } else {
        pdf.setFillColor(241, 245, 249);
        pdf.rect(10, currentY, 190, 120, 'F');
        pdf.setFontSize(10);
        pdf.setTextColor(148, 163, 184);
        pdf.text("Full-size image load failed.", 105, currentY + 60, { align: 'center' });
      }
      currentY += 130;
    }
  }

  return pdf;
}
