
'use server';

import { Resend } from 'resend';

/**
 * sendCleanUpNoticeEmailAction - Uses the Resend API to send a Clean Up Notice PDF to subcontractors.
 */
export async function sendCleanUpNoticeEmailAction({
  email,
  name,
  projectName,
  reference,
  pdfBase64,
  fileName
}: {
  email: string;
  name: string;
  projectName: string;
  reference: string;
  pdfBase64: string;
  fileName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === 'your_resend_api_key_here' || apiKey === '') {
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
      to: [email],
      subject: `Clean Up Notice: ${projectName} - ${reference}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
          <h1 style="color: #1e40af; border-bottom: 2px solid #f97316; padding-bottom: 10px;">Clean Up Notice</h1>
          <p>Hello <strong>${name}</strong>,</p>
          <p>Please find the attached PDF report regarding a cleaning requirement at <strong>${projectName}</strong>.</p>
          <p>Reference: <strong>${reference}</strong></p>
          <p>Please ensure the area is cleared as requested to avoid project delays or backcharges.</p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;"><strong>Project:</strong> ${projectName}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Notice Ref:</strong> ${reference}</p>
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

    return { success: true, message: `Notice sent to ${email}.` };
  } catch (err: any) {
    console.error('Server Side Email Error:', err);
    return { success: false, message: err.message || 'An unexpected server error occurred.' };
  }
}

export type FormState = {
  message: string;
  success: boolean;
};

export async function createCleanUpNoticeAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
