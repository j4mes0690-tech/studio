'use server';

import { Resend } from 'resend';

// Authentication is handled via the Firebase Client SDK in the LoginForm component.
// Server actions are used for auxiliary services like sending recovery emails.

export type LoginState = {
  error?: string;
  success?: boolean;
};

export async function loginAction(
  prevState: LoginState | undefined,
  formData: FormData
): Promise<LoginState> {
  return { error: 'This action is deprecated. Please use the client-side login form.' };
}

/**
 * sendPasswordResetEmailAction - Sends a temporary password to the user via Resend.
 * Returns a special flag if the API key is missing to allow prototype-mode fallback in the UI.
 */
export async function sendPasswordResetEmailAction({
  email,
  name,
  tempPassword
}: {
  email: string;
  name: string;
  tempPassword: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || apiKey === 'your_resend_api_key_here') {
    console.warn('RESEND_API_KEY is not set. Falling back to prototype mode display.');
    return { 
      success: false, 
      isConfigError: true,
      message: 'Email service not configured. Please add RESEND_API_KEY to system settings.' 
    };
  }

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      // Resend Free Tier requires using their verified domain until you verify your own.
      from: 'password-reset@resend.dev',
      to: [email],
      subject: 'SiteCommand: Password Reset Request',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
          <div style="background: #1e40af; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
          </div>
          <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hello <strong>${name}</strong>,</p>
            <p>We received a request to reset your access to SiteCommand. A temporary password has been generated for you.</p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Temporary Password</p>
              <p style="margin: 0; font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 4px;">${tempPassword}</p>
            </div>

            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Log in to SiteCommand using this temporary password.</li>
              <li>Immediately navigate to <strong>My Account</strong> settings.</li>
              <li>Update your password to a permanent one of your choosing.</li>
            </ol>
            
            <p style="font-size: 12px; color: #64748b; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              If you did not request this reset, please notify your system administrator immediately.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Reset Error:', error);
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Server Side Reset Error:', err);
    return { success: false, message: err.message || 'An unexpected server error occurred.' };
  }
}
