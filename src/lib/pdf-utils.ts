'use client';

import type { Instruction, Project, SubContractor, SnaggingListItem, Photo, PlannerTask, Planner, PurchaseOrder } from '@/lib/types';
import { proxyImageAction } from '@/app/snagging/actions';

/**
 * safeLoadImage - Proxies an image via server action to bypass CORS.
 * Returns a base64 Data URI.
 */
async function safeLoadImage(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  return await proxyImageAction(url);
}

/**
 * generatePurchaseOrderPDF - Creates a professional PO document.
 */
export async function generatePurchaseOrderPDF(
  order: PurchaseOrder,
  project?: Project,
  supplier?: SubContractor
) {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  const reportElement = document.createElement('div');
  reportElement.style.position = 'absolute';
  reportElement.style.left = '-9999px';
  reportElement.style.padding = '50px';
  reportElement.style.width = '800px';
  reportElement.style.background = 'white';
  reportElement.style.color = 'black';
  reportElement.style.fontFamily = 'sans-serif';

  reportElement.innerHTML = `
    <div style="border-bottom: 3px solid #336AB6; padding-bottom: 20px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <h1 style="margin: 0; color: #336AB6; font-size: 28px; letter-spacing: -1px;">PURCHASE ORDER</h1>
        <p style="margin: 5px 0 0 0; color: #1e293b; font-size: 18px; font-weight: bold;">${order.description}</p>
        <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold;">Ref: ${order.orderNumber}</p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase;">Generated via SiteCommand</p>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 50px;">
      <div>
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #336AB6; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Supplier Information</p>
        <p style="margin: 0; font-size: 16px; font-weight: bold;">${order.supplierName}</p>
        <p style="margin: 5px 0 0 0; font-size: 12px; color: #475569;">${supplier?.email || ''}</p>
        ${supplier?.phone ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;">Tel: ${supplier.phone}</p>` : ''}
        ${supplier?.address ? `<p style="margin: 5px 0 0 0; font-size: 11px; color: #475569; white-space: pre-wrap;">${supplier.address}</p>` : ''}
      </div>
      <div>
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #336AB6; text-transform: uppercase; font-size: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">Project Details</p>
        <p style="margin: 0; font-size: 14px;"><strong>Project:</strong> ${project?.name || 'Project'}</p>
        ${project?.address ? `<p style="margin: 5px 0 0 0; font-size: 11px; color: #475569; white-space: pre-wrap;">${project.address}</p>` : ''}
        <p style="margin: 10px 0 0 0; font-size: 12px;"><strong>Order Date:</strong> ${new Date(order.orderDate).toLocaleDateString()}</p>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px;">
      <thead>
        <tr style="background: #f8fafc; border-bottom: 2px solid #336AB6;">
          <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b;">Description</th>
          <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b; width: 60px;">Qty</th>
          <th style="padding: 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #64748b; width: 60px;">Unit</th>
          <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b; width: 90px;">Rate</th>
          <th style="padding: 12px; text-align: center; font-size: 10px; text-transform: uppercase; color: #64748b; width: 100px;">Delivery</th>
          <th style="padding: 12px; text-align: right; font-size: 10px; text-transform: uppercase; color: #64748b; width: 100px;">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${order.items.map(item => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-size: 12px; font-weight: 500;">${item.description}</td>
            <td style="padding: 12px; text-align: right; font-size: 12px;">${item.quantity}</td>
            <td style="padding: 12px; text-align: left; font-size: 12px; color: #64748b;">${item.unit}</td>
            <td style="padding: 12px; text-align: right; font-size: 12px;">£${item.rate.toFixed(2)}</td>
            <td style="padding: 12px; text-align: center; font-size: 11px; color: #475569;">${item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : 'ASAP'}</td>
            <td style="padding: 12px; text-align: right; font-size: 12px; font-weight: bold;">£${item.total.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="background: #f8fafc;">
          <td colspan="5" style="padding: 15px; text-align: right; font-size: 14px; font-weight: bold; color: #336AB6;">ORDER TOTAL (GBP)</td>
          <td style="padding: 15px; text-align: right; font-size: 18px; font-weight: bold; color: #336AB6; border-top: 2px solid #336AB6;">£${order.totalAmount.toFixed(2)}</td>
        </tr>
      </tfoot>
    </table>

    ${order.notes ? `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin-bottom: 40px;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #92400e; text-transform: uppercase; font-size: 9px; letter-spacing: 1px;">Special Instructions</p>
        <p style="margin: 0; font-size: 12px; color: #78350f; line-height: 1.6; white-space: pre-wrap;">${order.notes}</p>
      </div>
    ` : ''}

    <div style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
      <p style="font-size: 10px; color: #94a3b8;">Issued by: ${order.createdByEmail}</p>
      <p style="font-size: 10px; color: #94a3b8;">Printed: ${new Date().toLocaleString()}</p>
    </div>
  `;

  document.body.appendChild(reportElement);
  const canvas = await html2canvas(reportElement, { scale: 3, useCORS: true, logging: false });
  document.body.removeChild(reportElement);

  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
  pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  
  return pdf;
}

/**
 * generateInstructionPDF - Creates a Site Instruction PDF with visual appendices.
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
  const headerCanvas = await html2canvas(reportElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
  document.body.removeChild(reportElement);

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const canvasHeightInPdf = (headerCanvas.height * pdfWidth) / headerCanvas.width;
  
  pdf.addImage(headerCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfWidth, canvasHeightInPdf);

  let currentY = canvasHeightInPdf + 15;

  const photos = instruction.photos || [];
  if (photos.length > 0) {
    pdf.setFontSize(14);
    pdf.setTextColor(30, 41, 59);
    pdf.text("Visual Evidence Appendix", 10, currentY);
    currentY += 10;

    for (const p of photos) {
      const dataUri = await safeLoadImage(p.url);
      if (currentY + 110 > pdfHeight) { pdf.addPage(); currentY = 20; }
      
      if (dataUri) {
        pdf.addImage(dataUri, 'JPEG', 10, currentY, 190, 100);
      } else {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(10, currentY, 190, 100, 'F');
        pdf.setFontSize(10);
        pdf.text("Photo failed to load.", 105, currentY + 50, { align: 'center' });
      }
      currentY += 110;
    }
  }

  return pdf;
}

/**
 * generateSnaggingPDF - Direct drawing engine for high-reliability photo embedding.
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

  // 1. Create Layout Header via html2canvas for rich styling
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
      <h1 style="margin: 0; color: #1e40af; font-size: 28px;">${title}</h1>
      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 14px; font-weight: bold;">Project: ${project?.name || 'Unknown'}</p>
      ${scopeLabel ? `<p style="margin: 2px 0 0 0; color: #64748b; font-size: 12px;">Scope: ${scopeLabel}</p>` : ''}
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div><p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Contract Authority</p><p style="margin: 2px 0 0 0; font-size: 14px; font-weight: bold;">${project?.siteManager || '---'}</p></div>
      <div><p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Report Date</p><p style="margin: 2px 0 0 0; font-size: 14px;">${new Date().toLocaleDateString()}</p></div>
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

  // 2. Iterate and draw snag items
  for (const entry of aggregatedEntries) {
    const sub = subContractors.find(s => s.id === entry.snag.subContractorId);
    const photos = [...(entry.snag.photos || []), ...(entry.snag.completionPhotos || [])];
    
    // Header block for snag
    if (currentY + 25 > pdfHeight) { pdf.addPage(); currentY = 20; }

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
    pdf.text(`Trade: ${sub?.name || 'Unassigned'} | Location: ${entry.areaName}`, 15, currentY + 12);
    
    const statusLabel = entry.snag.status.toUpperCase().replace('-', ' ');
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    if (entry.snag.status === 'closed') pdf.setTextColor(22, 101, 52);
    else pdf.setTextColor(153, 27, 27);
    pdf.text(statusLabel, 195 - pdf.getTextWidth(statusLabel), currentY + 9);

    currentY += 20;

    // Draw images for this snag
    if (photos.length > 0) {
      const imgWidth = 60;
      const imgHeight = 45;
      let imgX = 15;

      for (const p of photos) {
        if (imgX + imgWidth > 195) {
          imgX = 15;
          currentY += imgHeight + 5;
        }

        if (currentY + imgHeight > pdfHeight - 20) {
          pdf.addPage();
          currentY = 20;
          imgX = 15;
        }

        const dataUri = await safeLoadImage(p.url);
        if (dataUri) {
          pdf.addImage(dataUri, 'JPEG', imgX, currentY, imgWidth, imgHeight);
        } else {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(imgX, currentY, imgWidth, imgHeight, 'F');
        }
        imgX += imgWidth + 5;
      }
      currentY += imgHeight + 10;
    } else {
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.setFont("helvetica", "italic");
      pdf.text("No visual evidence for this item.", 15, currentY);
      currentY += 10;
    }
    
    currentY += 5;
  }

  // 3. Draw General Documentation
  if (generalPhotos.length > 0) {
    if (currentY + 30 > pdfHeight) { pdf.addPage(); currentY = 20; }
    else { currentY += 10; }

    pdf.setFontSize(14);
    pdf.setTextColor(30, 41, 59);
    pdf.setFont("helvetica", "bold");
    pdf.text("General Site Documentation", 10, currentY);
    currentY += 10;

    for (const p of generalPhotos) {
      if (currentY + 110 > pdfHeight) { pdf.addPage(); currentY = 20; }
      const dataUri = await safeLoadImage(p.url);
      if (dataUri) {
        pdf.addImage(dataUri, 'JPEG', 10, currentY, 190, 100);
      }
      currentY += 110;
    }
  }

  return pdf;
}

/**
 * generatePlannerPDF - Renders the Gantt chart and task directory to a professional PDF report.
 */
export async function generatePlannerPDF(
  tasks: PlannerTask[],
  project?: Project,
  planner?: Planner,
  subContractors: SubContractor[]
) {
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape for Gantt
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  // 1. Capture Header & Summary
  const headerElement = document.createElement('div');
  headerElement.style.padding = '40px';
  headerElement.style.width = '1000px';
  headerElement.style.background = 'white';
  headerElement.style.color = 'black';
  headerElement.style.fontFamily = 'sans-serif';

  headerElement.innerHTML = `
    <div style="border-bottom: 4px solid #1e40af; padding-bottom: 20px; margin-bottom: 30px;">
      <h1 style="margin: 0; color: #1e40af; font-size: 32px;">Project Schedule Update</h1>
      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 16px; font-weight: bold;">${project?.name || 'Project'} &rsaquo; ${planner?.name || 'Schedule'}</p>
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px;">
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Activities</p>
        <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold;">${tasks.length}</p>
      </div>
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Completed</p>
        <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #16a34a;">${tasks.filter(t => t.status === 'completed').length}</p>
      </div>
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
        <p style="margin: 0; font-weight: bold; color: #64748b; text-transform: uppercase; font-size: 10px;">Report Date</p>
        <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold;">${new Date().toLocaleDateString()}</p>
      </div>
    </div>
  `;

  document.body.appendChild(headerElement);
  const headerCanvas = await html2canvas(headerElement, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  document.body.removeChild(headerElement);

  const headerHeightInPdf = (headerCanvas.height * pdfWidth) / headerCanvas.width;
  pdf.addImage(headerCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pdfWidth, headerHeightInPdf);

  // 2. Capture Gantt Chart
  const ganttElement = document.getElementById('planner-gantt-capture');
  if (ganttElement) {
    const ganttCanvas = await html2canvas(ganttElement, { 
      scale: 2, 
      useCORS: true, 
      backgroundColor: '#ffffff',
      logging: false,
      width: ganttElement.scrollWidth,
      height: ganttElement.scrollHeight,
      windowWidth: ganttElement.scrollWidth
    });
    
    const ganttWidthInPdf = pdfWidth - 20;
    const ganttHeightInPdf = (ganttCanvas.height * ganttWidthInPdf) / ganttCanvas.width;
    
    if (headerHeightInPdf + ganttHeightInPdf + 10 > pdfHeight) {
      pdf.addPage();
      pdf.addImage(ganttCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', 10, 10, ganttWidthInPdf, ganttHeightInPdf);
    } else {
      pdf.addImage(ganttCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', 10, headerHeightInPdf + 5, ganttWidthInPdf, ganttHeightInPdf);
    }
  }

  // 3. Task Directory Appendix
  pdf.addPage();
  pdf.setFontSize(16);
  pdf.setTextColor(30, 41, 59);
  pdf.text("Activity Directory", 10, 20);
  
  let currentY = 30;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("Description", 15, currentY);
  pdf.text("Partner", 100, currentY);
  pdf.text("Start", 160, currentY);
  pdf.text("Days", 190, currentY);
  pdf.text("Status", 220, currentY);
  
  currentY += 5;
  pdf.setDrawColor(200);
  pdf.line(10, currentY, 280, currentY);
  currentY += 8;

  tasks.forEach((task, idx) => {
    if (currentY > pdfHeight - 20) { pdf.addPage(); currentY = 20; }
    
    const sub = subContractors.find(s => s.id === task.subcontractorId);
    const tradeName = task.subcontractorId === 'other' ? (task.customSubcontractorName || 'Other') : (sub?.name || 'Unassigned');
    
    pdf.setFont("helvetica", "normal");
    pdf.text(task.title, 15, currentY, { maxWidth: 80 });
    pdf.text(tradeName, 100, currentY, { maxWidth: 55 });
    pdf.text(new Date(task.startDate).toLocaleDateString(), 160, currentY);
    pdf.text(task.durationDays.toString(), 190, currentY);
    pdf.text(task.status.toUpperCase(), 220, currentY);
    
    currentY += 10;
  });

  return pdf;
}
