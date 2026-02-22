
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createInformationRequest, getInformationRequests, updateInformationRequest, deleteInformationRequest } from '@/lib/data';
import type { InformationRequest, ChatMessage } from '@/lib/types';

const NewInformationRequestSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  assignedTo: z.array(z.string()).min(1, 'Please assign this request to at least one user.'),
  photos: z.string().optional(),
  requiredBy: z.string().optional(),
});

const UpdateInformationRequestSchema = NewInformationRequestSchema.extend({
    id: z.string().min(1, 'Item ID is required.'),
});

const AddChatMessageSchema = z.object({
    id: z.string().min(1, 'Item ID is required.'),
    message: z.string().min(1, 'Message cannot be empty.'),
    senderId: z.string().min(1, 'Sender is required.'),
});

const CloseRequestSchema = z.object({
    id: z.string().min(1, 'Item ID is required.'),
});

const ReopenRequestSchema = z.object({
    id: z.string().min(1, 'Item ID is required.'),
});

const DeleteRequestSchema = z.object({
    id: z.string().min(1, 'Item ID is required.'),
});

export type FormState = {
  message: string;
  success: boolean;
};

export async function createInformationRequestAction(
  formData: FormData
): Promise<FormState> {
  
  const validatedFields = NewInformationRequestSchema.safeParse({
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

  const { description, projectId, assignedTo: assignedEmails, photos: photosJson, requiredBy } = validatedFields.data;

  try {
    const newRequestData: Omit<InformationRequest, 'id' | 'createdAt'> = {
      projectId,
      description,
      assignedTo: assignedEmails, // IDs are already emails in the new system
      status: 'open',
      messages: [],
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
    return { success: false, message: 'Failed to create information request.' };
  }
}

export async function updateInformationRequestAction(
    formData: FormData
  ): Promise<FormState> {
    
    const validatedFields = UpdateInformationRequestSchema.safeParse({
      id: formData.get('id'),
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
  
    const { id, description, projectId, assignedTo: assignedEmails, photos: photosJson, requiredBy } = validatedFields.data;
  
    try {
      const allItems = await getInformationRequests({});
      const existingItem = allItems.find(i => i.id === id);
  
      if (!existingItem) {
        return { success: false, message: 'Information request not found.' };
      }
  
      const updatedItem: InformationRequest = {
        ...existingItem,
        projectId,
        description,
        assignedTo: assignedEmails, // IDs are already emails
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

export async function addChatMessageAction(
    formData: FormData
    ): Promise<FormState> {
    
    const validatedFields = AddChatMessageSchema.safeParse({
        id: formData.get('id'),
        message: formData.get('message'),
        senderId: formData.get('senderId'), // This is currently passing the sender's name or email from UI
    });

    if (!validatedFields.success) {
        const fieldErrors = validatedFields.error.flatten().fieldErrors;
        const message = fieldErrors.message?.[0] || fieldErrors.senderId?.[0] || 'Invalid data provided.';
        return {
          success: false,
          message,
        };
    }

    const { id, message, senderId } = validatedFields.data;

    try {
        const allItems = await getInformationRequests({});
        const existingItem = allItems.find(i => i.id === id);

        if (!existingItem) {
            return { success: false, message: 'Information request not found.' };
        }
        
        // In the internal system, senderId from the UI is the sender's name for simplified chat display
        const newChatMessage: ChatMessage = {
            id: `msg-${Date.now()}`,
            sender: senderId, 
            message,
            createdAt: new Date().toISOString(),
        };
        
        const updatedItem: InformationRequest = {
            ...existingItem,
            messages: [...(existingItem.messages || []), newChatMessage],
        };

        await updateInformationRequest(updatedItem);

        revalidatePath('/information-requests');
        return { success: true, message: 'Message sent successfully.' };
    } catch (error) {
        console.error('Failed to add message:', error);
        return { success: false, message: 'Failed to add message.' };
    }
}

export async function closeInformationRequestAction(formData: FormData): Promise<FormState> {
    const validatedFields = CloseRequestSchema.safeParse({
        id: formData.get('id'),
    });

    if (!validatedFields.success) {
        return { success: false, message: 'Invalid Request ID.' };
    }

    const { id } = validatedFields.data;

    try {
        const allItems = await getInformationRequests({});
        const existingItem = allItems.find(i => i.id === id);

        if (!existingItem) {
            return { success: false, message: 'Information request not found.' };
        }

        const updatedItem: InformationRequest = {
            ...existingItem,
            status: 'closed',
        };

        await updateInformationRequest(updatedItem);

        revalidatePath('/information-requests');
        return { success: true, message: 'Request has been closed.' };
    } catch (error) {
        console.error('Failed to close request:', error);
        return { success: false, message: 'Failed to close request.' };
    }
}


export async function reopenInformationRequestAction(formData: FormData): Promise<FormState> {
    const validatedFields = ReopenRequestSchema.safeParse({
        id: formData.get('id'),
    });

    if (!validatedFields.success) {
        return { success: false, message: 'Invalid Request ID.' };
    }

    const { id } = validatedFields.data;

    try {
        const allItems = await getInformationRequests({});
        const existingItem = allItems.find(i => i.id === id);

        if (!existingItem) {
            return { success: false, message: 'Information request not found.' };
        }

        const updatedItem: InformationRequest = {
            ...existingItem,
            status: 'open',
        };

        await updateInformationRequest(updatedItem);

        revalidatePath('/information-requests');
        return { success: true, message: 'Request has been reopened.' };
    } catch (error) {
        console.error('Failed to reopen request:', error);
        return { success: false, message: 'Failed to reopen request.' };
    }
}

export async function deleteInformationRequestAction(formData: FormData): Promise<FormState> {
    const validatedFields = DeleteRequestSchema.safeParse({
        id: formData.get('id'),
    });

    if (!validatedFields.success) {
        return { success: false, message: 'Invalid Request ID.' };
    }

    const { id } = validatedFields.data;

    try {
        await deleteInformationRequest(id);
        revalidatePath('/information-requests');
        return { success: true, message: 'Request has been deleted.' };
    } catch (error) {
        console.error('Failed to delete request:', error);
        return { success: false, message: 'Failed to delete request.' };
    }
}
