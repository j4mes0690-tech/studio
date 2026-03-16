
'use server';

import { Resend } from 'resend';

/**
 * sendHolidayStatusEmailAction - Notifies staff member when their leave status changes.
 */
export async function sendHolidayStatusEmailAction({
  email,
  name,
  status,
  startDate,
  endDate,
  type,
  approvedBy
}: {
  email: string;
  name: string;
  status: 'approved' | 'rejected';
  startDate: string;
  endDate: string;
  type: string;
  approvedBy: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === 'your_resend_api_key_here' || apiKey === '') {
    console.warn('RESEND_API_KEY is not set. Email notification skipped.');
    return { success: false, message: 'Email service not configured.' };
  }

  const resend = new Resend(apiKey);
  const isApproved = status === 'approved';

  try {
    const { data, error } = await resend.emails.send({
      from: 'holidays@site-command.com',
      to: [email],
      subject: `Leave Request ${isApproved ? 'Approved' : 'Rejected'}: ${startDate}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
          <div style="background: ${isApproved ? '#16a34a' : '#dc2626'}; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Leave Request Update</h1>
          </div>
          <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hello <strong>${name}</strong>,</p>
            <p>Your request for <strong>${type}</strong> leave has been <strong>${status}</strong>.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; font-weight: bold;">Details</p>
              <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>From:</strong> ${new Date(startDate).toLocaleDateString()}</p>
              <p style="margin: 5px 0 0 0; font-size: 14px;"><strong>Until:</strong> ${new Date(endDate).toLocaleDateString()}</p>
              <p style="margin: 10px 0 0 0; font-size: 14px;"><strong>Decision By:</strong> ${approvedBy}</p>
            </div>

            <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              This is an automated update from <strong>SiteCommand</strong>.
            </p>
          </div>
        </div>
      `,
    });

    if (error) return { success: false, message: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
