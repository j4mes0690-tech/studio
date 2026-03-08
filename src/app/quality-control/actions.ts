'use server';

import { Resend } from 'resend';

/**
 * sendChecklistEmailAction - Uses the Resend API to send a Quality Checklist PDF to recipients.
 */
export async function sendChecklistEmailAction({
  emails,
  projectName,
  areaName,
  checklistTitle,
  pdfBase64,
  fileName
}: {
  emails: string[];
  projectName: string;
  areaName: string;
  checklistTitle: string;
  pdfBase64: string;
  fileName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error('RESEND_API_KEY is not set in environment variables.');
    return { 
      success: false, 
      message: 'Email service not configured. Please add RESEND_API_KEY to your system settings.' 
    };
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: emails,
      subject: `Quality Verification: ${projectName} - ${areaName} - ${checklistTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
          <h1 style="color: #1e40af; border-bottom: 2px solid #f97316; padding-bottom: 10px;">Quality Inspection Report</h1>
          <p>Hello,</p>
          <p>Please find the attached PDF report for the <strong>${checklistTitle}</strong> verification at <strong>${projectName} (${areaName})</strong>.</p>
          <p>This report documents the current status of quality compliance for the specified trade works.</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;"><strong>Project:</strong> ${projectName}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Area:</strong> ${areaName}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Inspection:</strong> ${checklistTitle}</p>
          </div>
          <p style="font-size: 12px; color: #64748b; margin-top: 30px;">
            This was an automated distribution via SiteCommand.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
        },
      ],
    });

    if (error) {
      console.error('Resend Transmission Error:', error);
      return { success: false, message: error.message };
    }

    return { success: true, message: `Checklist distributed to ${emails.length} recipients.` };
  } catch (err: any) {
    console.error('Server Side Email Error:', err);
    return { success: false, message: err.message || 'An unexpected server error occurred.' };
  }
}

export type FormState = {
  message: string;
  success: boolean;
};

export async function createChecklistAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function updateChecklistItemsAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function updateChecklistTemplateAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function deleteChecklistTemplateAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
