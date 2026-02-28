
'use server';

import { Resend } from 'resend';

/**
 * sendPermitEmailAction - Uses the Resend API to send a Permit to Work PDF to contractors.
 */
export async function sendPermitEmailAction({
  email,
  name,
  projectName,
  permitRef,
  permitType,
  pdfBase64,
  fileName
}: {
  email: string;
  name: string;
  projectName: string;
  permitRef: string;
  permitType: string;
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
      from: 'SiteCommand Permits <permits@sitecommand.internal>',
      to: [email],
      subject: `Permit to Work Issued: ${permitRef} (${permitType}) - ${projectName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
          <div style="background: #1e40af; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Permit to Work Issued</h1>
          </div>
          <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hello <strong>${name}</strong>,</p>
            <p>An electronic <strong>${permitType}</strong> permit has been formally issued for your works at <strong>${projectName}</strong>.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="margin: 0; font-size: 14px;"><strong>Reference:</strong> ${permitRef}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Project:</strong> ${projectName}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Type:</strong> ${permitType}</p>
            </div>

            <p>Please find the formal permit document attached as a PDF. You must ensure all personnel involved in the task are briefed on the specific controls and precautions outlined in this document before work commences.</p>
            
            <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; pt: 20px;">
              This is an automated distribution via SiteCommand.
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

    return { success: true, message: `Permit distributed to ${email}.` };
  } catch (err: any) {
    console.error('Server Side Email Error:', err);
    return { success: false, message: err.message || 'An unexpected server error occurred.' };
  }
}
