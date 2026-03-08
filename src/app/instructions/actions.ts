'use server';

import { Resend } from 'resend';

/**
 * sendSiteInstructionEmailAction - Uses the Resend API to send a Site Instruction PDF to subcontractors.
 */
export async function sendSiteInstructionEmailAction({
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
      from: 'instructions@resend.dev',
      to: [email],
      subject: `Site Instruction Issued: ${reference} - ${projectName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
          <div style="background: #1e40af; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.5px;">Site Instruction Issued</h1>
          </div>
          <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hello <strong>${name}</strong>,</p>
            <p>A formal <strong>Site Instruction (SI)</strong> has been issued for your attention regarding works at <strong>${projectName}</strong>.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Instruction Reference</p>
              <p style="margin: 2px 0 15px 0; font-size: 18px; font-weight: bold; color: #1e40af;">${reference}</p>
              
              <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Project</p>
              <p style="margin: 2px 0 0 0; font-size: 16px; font-weight: bold;">${projectName}</p>
            </div>

            <p>Please find the formal instruction document attached as a PDF. You are required to review the specific requirements and ensure immediate compliance on-site.</p>
            
            <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              This is an automated distribution via <strong>SiteCommand</strong>.
            </p>
          </div>
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

    return { success: true, message: `Instruction sent to ${email}.` };
  } catch (err: any) {
    console.error('Server Side Email Error:', err);
    return { success: false, message: err.message || 'An unexpected server error occurred.' };
  }
}

export type FormState = {
  message: string;
  success: boolean;
};

export async function createInstructionAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
