
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createInformationRequest, getDistributionUsers } from '@/lib/data';
import type { InformationRequest } from '@/lib/types';

const NewInformationRequestSchema = z.object({
  clientId: z.string().min(1, 'Client is required.'),
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  assignedTo: z.string().min(1, 'Please assign this request to a user.'),
  photoUrl: z.string().optional(),
  photoTimestamp: z.string().optional(),
});

export type FormState = {
  message: string;
  success: boolean;
};

export async function createInformationRequestAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  
  const validatedFields = NewInformationRequestSchema.safeParse({
    clientId: formData.get('clientId'),
    projectId: formData.get('projectId'),
    description: formData.get('description'),
    assignedTo: formData.get('assignedTo'),
    photoUrl: formData.get('photoUrl'),
    photoTimestamp: formData.get('photoTimestamp'),
  });

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    const message = fieldErrors.description?.[0] || fieldErrors.assignedTo?.[0] || 'Invalid data provided.';
    return {
      success: false,
      message,
    };
  }

  const { description, clientId, projectId, assignedTo: assignedToId, photoUrl, photoTimestamp } = validatedFields.data;

  try {
    const users = await getDistributionUsers();
    const assignedUser = users.find(u => u.id === assignedToId);

    if (!assignedUser) {
        return { success: false, message: 'Assigned user not found.' };
    }

    const newRequestData: Omit<InformationRequest, 'id' | 'createdAt'> = {
      clientId,
      projectId,
      description,
      assignedTo: assignedUser.email,
    };

    if (photoUrl && photoTimestamp) {
        newRequestData.photo = {
            url: photoUrl,
            takenAt: photoTimestamp,
        }
    }
    
    await createInformationRequest(newRequestData);

    revalidatePath('/information-requests');
    return { success: true, message: 'Information request created successfully.' };

  } catch (error) {
    console.error('Failed to create information request:', error);
    return { success: false, message: 'Failed to create information request. Please note, email sending is not yet implemented.' };
  }
}
