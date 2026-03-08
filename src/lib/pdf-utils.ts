import type { Instruction, Project, SubContractor } from '@/lib/types';

/**
 * generateInstructionPDF - Robust utility to create a Site Instruction PDF.
 * Uses a hybrid approach: html2canvas for layout and jsPDF for reliable image embedding.
 * Now includes a formal Appendices section listing all file names.
 */
export async function generateInstructionPDF(
  instruction: Instruction,
  project?: Project,
  recipient?: SubContractor
) {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  // 1. Robust Image Pre-conversion with Cache Busting
  const photoDataUrls = await Promise.all((instruction.photos || []).map(async (p) => {
    if (p.url.startsWith('data:')) return p.url;
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => {
        console.warn("PDF Generation: Image load failed", p.url);
        resolve(''); // Skip failed images
      };
      // Append cache buster to ensure fresh CORS response
      img.src = p.url + (p.url.includes('?') ? '&' : '?') + 't=' + Date.now();
    });
  }));

  // 2. Prepare the high-fidelity layout element
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

    <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="font-size: 12px; color: #64748b;">This instruction was generated via SiteCommand.</p>
    </div>
  `;

  document.body.appendChild(reportElement);
  
  const canvas = await html2canvas(reportElement, { 
    scale: 2, 
    useCORS: true, 
    backgroundColor: '#ffffff',
    logging: false 
  });
  
  document.body.removeChild(reportElement);

  // 3. Assemble PDF using Hybrid Method
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const canvasHeightInPdf = (canvas.height * pdfWidth) / canvas.width;
  
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, canvasHeightInPdf);

  let currentY = canvasHeightInPdf + 15;

  // 4. Appendix A: Visual Evidence (Photos)
  const filteredPhotos = photoDataUrls.filter(url => !!url);
  if (filteredPhotos.length > 0) {
    if (currentY + 30 > pdfHeight) {
      pdf.addPage();
      currentY = 20;
    }
    
    pdf.setFontSize(14);
    pdf.setTextColor(30, 41, 59);
    pdf.text("Appendix A: Visual Evidence", 10, currentY);
    currentY += 8;

    filteredPhotos.forEach((url, idx) => {
      // Check for page overflow (standard photo height ~120mm + buffer)
      if (currentY + 130 > pdfHeight) {
        pdf.addPage();
        currentY = 20;
      }
      
      pdf.addImage(url, 'JPEG', 10, currentY, 190, 120, undefined, 'FAST');
      pdf.setFontSize(8);
      pdf.setTextColor(100, 116, 139);
      pdf.text(`Figure ${idx + 1}: Site-Photo-${(idx + 1).toString().padStart(2, '0')}.jpg`, 10, currentY + 125);
      currentY += 135;
    });
  }

  // 5. Appendix B: Linked Documentation (Files)
  if (instruction.files && instruction.files.length > 0) {
    if (currentY + 30 > pdfHeight) {
      pdf.addPage();
      currentY = 20;
    }

    pdf.setFontSize(14);
    pdf.setTextColor(30, 41, 59);
    pdf.text("Appendix B: Linked Documentation", 10, currentY);
    currentY += 10;

    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    instruction.files.forEach(f => {
      if (currentY + 10 > pdfHeight) {
        pdf.addPage();
        currentY = 20;
      }
      pdf.text(`• ${f.name} (${(f.size / 1024).toFixed(1)} KB)`, 15, currentY);
      currentY += 7;
    });
  }

  // 6. Final Section: Schedule of Attachments (Filenames)
  if (currentY + 40 > pdfHeight) {
    pdf.addPage();
    currentY = 20;
  } else {
    currentY += 10;
  }

  pdf.setDrawColor(226, 232, 240);
  pdf.line(10, currentY, 200, currentY);
  currentY += 10;

  pdf.setFontSize(14);
  pdf.setTextColor(30, 41, 59);
  pdf.text("Schedule of Attachments", 10, currentY);
  currentY += 8;

  pdf.setFontSize(9);
  pdf.setTextColor(100, 116, 139);
  pdf.text("The following files are attached to the distribution email corresponding to this report:", 10, currentY);
  currentY += 8;

  pdf.setFontSize(10);
  pdf.setTextColor(30, 41, 59);
  
  // List Photos by generated name
  if (instruction.photos && instruction.photos.length > 0) {
    instruction.photos.forEach((_, idx) => {
      if (currentY + 8 > pdfHeight) {
        pdf.addPage();
        currentY = 20;
      }
      pdf.text(`• Appendix-Photo-${idx + 1}.jpg`, 15, currentY);
      currentY += 6;
    });
  }

  // List Files by original name
  if (instruction.files && instruction.files.length > 0) {
    instruction.files.forEach(f => {
      if (currentY + 8 > pdfHeight) {
        pdf.addPage();
        currentY = 20;
      }
      pdf.text(`• ${f.name}`, 15, currentY);
      currentY += 6;
    });
  }

  return pdf;
}
