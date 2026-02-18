
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createSnaggingItem, getSnaggingLists, updateSnaggingItem } from '@/lib/data';
import type { SnaggingItem } from '@/lib/types';

const SnaggingItemSchema = z.object({
  clientId: z.string().min(1, 'Client is required.'),
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  photoUrl: z.string().optional(),
  photoTimestamp: z.string().optional(),
});

const UpdateSnaggingItemSchema = SnaggingItemSchema.extend({
  id: z.string().min(1, 'Item ID is required.'),
});

export type FormState = {
  message: string;
  success: boolean;
};

export async function createSnaggingItemAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  
  const validatedFields = SnaggingItemSchema.safeParse({
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

export async function updateSnaggingItemAction(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  
  const validatedFields = UpdateSnaggingItemSchema.safeParse({
    id: formData.get('id'),
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

  const { id, description, clientId, projectId, photoUrl, photoTimestamp } = validatedFields.data;

  try {
    const allItems = await getSnaggingLists({});
    const existingItem = allItems.find(i => i.id === id);

    if (!existingItem) {
      return { success: false, message: 'Snagging item not found.' };
    }

    const updatedItem: SnaggingItem = {
      ...existingItem,
      clientId,
      projectId,
      description,
    };

    if (photoUrl && photoTimestamp) {
      updatedItem.photo = {
        url: photoUrl,
        takenAt: photoTimestamp,
      };
    } else {
      delete updatedItem.photo;
    }

    await updateSnaggingItem(updatedItem);

    revalidatePath('/snagging');
    return { success: true, message: 'Snagging item updated successfully.' };

  } catch (error) {
    console.error('Failed to update snagging item:', error);
    return { success: false, message: 'Failed to update snagging item.' };
  }
}
