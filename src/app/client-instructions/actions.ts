'use server';

import { Resend } from 'resend';

/**
 * sendClientInstructionEmailAction - Uses the Resend API to notify all assigned project staff
 * about new or accepted client directives.
 */
export async function sendClientInstructionEmailAction({
  emails,
  projectName,
  reference,
  status,
  text,
  summary
}: {
  emails: string[];
  projectName: string;
  reference: string;
  status: 'open' | 'accepted';
  text: string;
  summary: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === 'your_resend_api_key_here') {
    console.warn('RESEND_API_KEY is not set. Email notification skipped.');
    return { 
      success: false, 
      message: 'Email service not configured.' 
    };
  }

  const resend = new Resend(apiKey);
  const isAccepted = status === 'accepted';

  try {
    const { data, error } = await resend.emails.send({
      from: 'directives@site-command.com',
      to: emails,
      subject: `${isAccepted ? 'Directive Accepted' : 'New Client Directive'}: ${reference} - ${projectName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
          <div style="background: ${isAccepted ? '#16a34a' : '#1e40af'}; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.5px;">Client Directive ${isAccepted ? 'Accepted' : 'Recorded'}</h1>
          </div>
          <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hello Team,</p>
            <p>A client directive has been <strong>${isAccepted ? 'formally accepted for implementation' : 'recorded in the system'}</strong> for <strong>${projectName}</strong>.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Reference</p>
              <p style="margin: 2px 0 15px 0; font-size: 18px; font-weight: bold; color: ${isAccepted ? '#16a34a' : '#1e40af'};">${reference}</p>
              
              <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Instruction Summary</p>
              <p style="margin: 2px 0 0 0; font-size: 14px; color: #334155; font-style: italic;">"${summary || text.substring(0, 100) + '...'}"</p>
            </div>

            <p>${isAccepted ? 'The directive has been converted into actionable work items. Please check the Information Request and Site Instruction logs for specific assignments.' : 'Please review the full directive in SiteCommand to begin coordination.'}</p>
            
            <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              This is an automated notification via <strong>SiteCommand</strong>.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Directive Error:', error);
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

export async function createClientInstructionAction(): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
