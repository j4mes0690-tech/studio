
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createInformationRequest, getDistributionUsers, getInformationRequests, updateInformationRequest } from '@/lib/data';
import type { InformationRequest } from '@/lib/types';

const NewInformationRequestSchema = z.object({
  clientId: z.string().min(1, 'Client is required.'),
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  assignedTo: z.array(z.string()).min(1, 'Please assign this request to at least one user.'),
  photos: z.string().optional(),
  requiredBy: z.string().optional(),
});

const UpdateInformationRequestSchema = NewInformationRequestSchema.extend({
    id: z.string().min(1, 'Item ID is required.'),
});

const RespondToRequestSchema = z.object({
    id: z.string().min(1, 'Item ID is required.'),
    response: z.string().min(1, 'Response cannot be empty.'),
});

export type FormState = {
  message: string;
  success: boolean;
};

export async function createInformationRequestAction(
  formData: FormData
): Promise<FormState> {
  
  const validatedFields = NewInformationRequestSchema.safeParse({
    clientId: formData.get('clientId'),
    projectId: formData.get('projectId'),
    description: formData.get('description'),
    assignedTo: formData.getAll('assignedTo'),
    photos: formData.get('photos'),
    requiredBy: formData.get('requiredBy'),
  });

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    const message = fieldErrors.description?.[0] || fieldErrors.assignedTo?.[0] || 'Invalid data provided.';
    return {
      success: false,
      message,
    };
  }

  const { description, clientId, projectId, assignedTo: assignedToIds, photos: photosJson, requiredBy } = validatedFields.data;

  try {
    const users = await getDistributionUsers();
    const assignedUsers = users.filter(u => assignedToIds.includes(u.id));

    if (assignedUsers.length !== assignedToIds.length) {
        return { success: false, message: 'One or more assigned users were not found.' };
    }
    const assignedEmails = assignedUsers.map(u => u.email);


    const newRequestData: Omit<InformationRequest, 'id' | 'createdAt'> = {
      clientId,
      projectId,
      description,
      assignedTo: assignedEmails,
      status: 'open',
    };

    if (photosJson) {
        newRequestData.photos = JSON.parse(photosJson);
    }
    if (requiredBy) {
        newRequestData.requiredBy = requiredBy;
    }
    
    await createInformationRequest(newRequestData);

    revalidatePath('/information-requests');
    return { success: true, message: 'Information request created successfully.' };

  } catch (error) {
    console.error('Failed to create information request:', error);
    return { success: false, message: 'Failed to create information request. Please note, email sending is not yet implemented.' };
  }
}

export async function updateInformationRequestAction(
    formData: FormData
  ): Promise<FormState> {
    
    const validatedFields = UpdateInformationRequestSchema.safeParse({
      id: formData.get('id'),
      clientId: formData.get('clientId'),
      projectId: formData.get('projectId'),
      description: formData.get('description'),
      assignedTo: formData.getAll('assignedTo'),
      photos: formData.get('photos'),
      requiredBy: formData.get('requiredBy'),
    });
  
    if (!validatedFields.success) {
      const fieldErrors = validatedFields.error.flatten().fieldErrors;
      const message = fieldErrors.description?.[0] || fieldErrors.assignedTo?.[0] || 'Invalid data provided.';
      return {
        success: false,
        message,
      };
    }
  
    const { id, description, clientId, projectId, assignedTo: assignedToIds, photos: photosJson, requiredBy } = validatedFields.data;
  
    try {
      const [users, allItems] = await Promise.all([
          getDistributionUsers(),
          getInformationRequests({}),
      ]);
      
      const existingItem = allItems.find(i => i.id === id);
  
      if (!existingItem) {
        return { success: false, message: 'Information request not found.' };
      }
  
      const assignedUsers = users.filter(u => assignedToIds.includes(u.id));
  
      if (assignedUsers.length !== assignedToIds.length) {
          return { success: false, message: 'One or more assigned users not found.' };
      }
      const assignedEmails = assignedUsers.map(u => u.email);
  
      const updatedItem: InformationRequest = {
        ...existingItem,
        clientId,
        projectId,
        description,
        assignedTo: assignedEmails,
      };

      if (requiredBy) {
        updatedItem.requiredBy = requiredBy;
      } else {
        delete updatedItem.requiredBy;
      }
  
      if (photosJson) {
        updatedItem.photos = JSON.parse(photosJson);
      } else {
        delete updatedItem.photos;
      }
  
      await updateInformationRequest(updatedItem);
  
      revalidatePath('/information-requests');
      return { success: true, message: 'Information request updated successfully.' };
  
    } catch (error) {
      console.error('Failed to update information request:', error);
      return { success: false, message: 'Failed to update information request.' };
    }
  }

export async function addResponseToInformationRequestAction(
    formData: FormData
    ): Promise<FormState> {
    
    const validatedFields = RespondToRequestSchema.safeParse({
        id: formData.get('id'),
        response: formData.get('response'),
    });

    if (!validatedFields.success) {
        return {
        success: false,
        message: validatedFields.error.flatten().fieldErrors.response?.[0] || 'Invalid data provided.',
        };
    }

    const { id, response } = validatedFields.data;

    try {
        const allItems = await getInformationRequests({});
        const existingItem = allItems.find(i => i.id === id);

        if (!existingItem) {
        return { success: false, message: 'Information request not found.' };
        }

        const updatedItem: InformationRequest = {
        ...existingItem,
        response,
        status: 'closed',
        respondedAt: new Date().toISOString(),
        };

        await updateInformationRequest(updatedItem);

        revalidatePath('/information-requests');
        return { success: true, message: 'Response submitted successfully.' };
    } catch (error) {
        console.error('Failed to add response:', error);
        return { success: false, message: 'Failed to add response.' };
    }
}
