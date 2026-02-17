
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createCleanUpNotice, getSubContractors } from '@/lib/data';
import type { CleanUpNotice } from '@/lib/types';

const NewNoticeSchema = z.object({
  clientId: z.string().min(1, 'Client is required.'),
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  photoUrl: z.string().optional(),
  photoTimestamp: z.string().optional(),
  recipients: z.array(z.string()).optional(),
});

export type FormState = {
  message: string;
  success: boolean;
};

export async function createCleanUpNoticeAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  
  const validatedFields = NewNoticeSchema.safeParse({
    clientId: formData.get('clientId'),
    projectId: formData.get('projectId'),
    description: formData.get('description'),
    photoUrl: formData.get('photoUrl'),
    photoTimestamp: formData.get('photoTimestamp'),
    recipients: formData.getAll('recipients'),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: validatedFields.error.flatten().fieldErrors.description?.[0] || 'Invalid data provided.',
    };
  }

  const { description, clientId, projectId, photoUrl, photoTimestamp, recipients: recipientIds } = validatedFields.data;

  try {
    const subContractors = await getSubContractors();

    const newNoticeData: Omit<CleanUpNotice, 'id' | 'createdAt'> = {
      clientId,
      projectId,
      description,
    };

    if (photoUrl && photoTimestamp) {
        newNoticeData.photo = {
            url: photoUrl,
            takenAt: photoTimestamp,
        }
    }

    if (recipientIds && recipientIds.length > 0) {
      const recipientEmails = subContractors
        .filter(user => recipientIds.includes(user.id))
        .map(user => user.email);
      newNoticeData.recipients = recipientEmails;
    }
    
    await createCleanUpNotice(newNoticeData);

    revalidatePath('/cleanup-notices');
    return { success: true, message: 'Clean up notice created successfully.' };

  } catch (error) {
    console.error('Failed to create notice:', error);
    return { success: false, message: 'Failed to create clean up notice. Please note, email sending is not yet implemented.' };
  }
}
