'use server';

import { Resend } from 'resend';

/**
 * sendInformationRequestEmailAction - Uses the Resend API to notify stakeholders
 * about new or issued Information Requests (RFIs / CRFIs).
 * Now supports PDF attachments.
 */
export async function sendInformationRequestEmailAction({
  emails,
  projectName,
  reference,
  description,
  raisedBy,
  requestId,
  pdfBase64,
  fileName
}: {
  emails: string[];
  projectName: string;
  reference: string;
  description: string;
  raisedBy: string;
  requestId: string;
  pdfBase64?: string;
  fileName?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === 'your_resend_api_key_here' || apiKey === '') {
    console.warn('RESEND_API_KEY is not set. Email notification skipped.');
    return { 
      success: false, 
      message: 'Email service not configured.' 
    };
  }

  const resend = new Resend(apiKey);
  const host = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://site-command.com');
  const directLink = `${host}/information-requests/${requestId}`;

  const attachments = [];
  if (pdfBase64 && fileName) {
    attachments.push({
      filename: fileName,
      content: pdfBase64,
    });
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'notifications@site-command.com',
      to: emails,
      subject: `Action Required: ${reference} - ${projectName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
          <div style="background: #1e40af; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.5px;">Information Request</h1>
          </div>
          <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hello,</p>
            <p>A formal technical inquiry has been assigned to you regarding works at <strong>${projectName}</strong>.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Reference</p>
              <p style="margin: 2px 0 15px 0; font-size: 18px; font-weight: bold; color: #1e40af;">${reference}</p>
              
              <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Inquiry Details</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #334155;">"${description}"</p>
            </div>

            <p>A formal PDF copy of this request is attached to this email for your records.</p>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${directLink}" style="background: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                View RFI & Respond Online
              </a>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              Raised by: ${raisedBy}<br/>
              This is an automated notification via <strong>SiteCommand</strong>.
            </p>
          </div>
        </div>
      `,
      attachments,
    });

    if (error) {
      console.error('Resend RFI Error:', error);
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Server Side Email Error:', err);
    return { success: false, message: err.message || 'An unexpected server error occurred.' };
  }
}

export type FormState = {
  message: string;
  success: boolean;
};

export async function createInformationRequestAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function updateInformationRequestAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function addChatMessageAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
