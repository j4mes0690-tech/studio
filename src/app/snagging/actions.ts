
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSnaggingItem } from '@/lib/data';
import type { SnaggingItem } from '@/lib/types';

const NewSnaggingItemSchema = z.object({
  clientId: z.string().min(1, 'Client is required.'),
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  photoUrl: z.string().optional(),
  photoTimestamp: z.string().optional(),
});

export type FormState = {
  message: string;
  success: boolean;
};

export async function createSnaggingItemAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  
  const validatedFields = NewSnaggingItemSchema.safeParse({
    clientId: formData.get('clientId'),
    projectId: formData.get('projectId'),
    description: formData.get('description'),
    photoUrl: formData.get('photoUrl'),
    photoTimestamp: formData.get('photoTimestamp'),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: validatedFields.error.flatten().fieldErrors.description?.[0] || 'Invalid data provided.',
    };
  }

  const { description, clientId, projectId, photoUrl, photoTimestamp } = validatedFields.data;

  try {
    const newSnaggingItemData: Omit<SnaggingItem, 'id' | 'createdAt'> = {
      clientId,
      projectId,
      description,
    };

    if (photoUrl && photoTimestamp) {
        newSnaggingItemData.photo = {
            url: photoUrl,
            takenAt: photoTimestamp,
        }
    }
    
    await createSnaggingItem(newSnaggingItemData);

    revalidatePath('/snagging');
    return { success: true, message: 'Snagging item created successfully.' };

  } catch (error) {
    console.error('Failed to create snagging item:', error);
    return { success: false, message: 'Failed to create snagging item.' };
  }
}
