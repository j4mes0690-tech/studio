
'use server';

import { Resend } from 'resend';

// System settings are now managed directly via the Firestore client SDK in the UI.
// Server actions are used for external integrations like email distribution.

/**
 * sendInvitationEmailAction - Sends an onboarding link to a new collaborator via Resend.
 * Using onboarding@resend.dev as the default sender to ensure delivery in environments
 * where site-command.com is not a verified domain.
 */
export async function sendInvitationEmailAction({
  email,
  name,
  inviteLink,
  inviterName,
  userType
}: {
  email: string;
  name: string;
  inviteLink: string;
  inviterName: string;
  userType: 'internal' | 'partner';
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === 'your_resend_api_key_here' || apiKey === '') {
    console.warn('RESEND_API_KEY is not set. Invitation email skipped.');
    return { 
      success: false, 
      isConfigError: true,
      message: 'Email service not configured. Please add RESEND_API_KEY to system settings.' 
    };
  }

  const resend = new Resend(apiKey);
  const isPartner = userType === 'partner';

  try {
    const { data, error } = await resend.emails.send({
      // Fallback to onboarding@resend.dev for prototype delivery
      from: 'onboarding@resend.dev',
      to: [email],
      subject: `Collaborate on SiteCommand: ${name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
          <div style="background: #1e40af; padding: 25px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -0.5px;">Invitation to SiteCommand</h1>
          </div>
          <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hello <strong>${name}</strong>,</p>
            <p><strong>${inviterName}</strong> has invited you to join the SiteCommand platform as a <strong>${isPartner ? 'Trade Partner' : 'Project Staff Member'}</strong>.</p>
            
            <p>SiteCommand allows you to review site instructions, manage snagging lists, and collaborate on project documentation in real-time.</p>

            <div style="text-align: center; margin: 35px 0;">
              <a href="${inviteLink}" style="background: #1e40af; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                Accept Invitation & Set Password
              </a>
            </div>

            <p style="font-size: 13px; color: #64748b;">
              This link is unique to you and will expire in 7 days. You will be prompted to set your secure password upon joining.
            </p>
            
            <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              This is an automated invitation from <strong>SiteCommand</strong>.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Invite Error:', error);
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Server Side Invite Error:', err);
    return { success: false, message: err.message || 'An unexpected server error occurred.' };
  }
}

export type FormState = {
  message: string;
  success: boolean;
};

export async function addSubContractorAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function removeSubContractorAction(userId: string) {
  // Deprecated
}

export async function updateSubContractorAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function addProjectAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}

export async function removeProjectAction(projectId: string) {
  // Deprecated
}

export async function updateProjectAction(formData: FormData): Promise<FormState> {
  return { success: false, message: 'This action is deprecated. Updates are handled client-side.' };
}
