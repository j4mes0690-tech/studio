
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createInstruction, getDistributionUsers } from '@/lib/data';
import { summarizeClientInstructions } from '@/ai/flows/summarize-client-instructions';
import { extractInstructionActionItems } from '@/ai/flows/extract-instruction-action-items';
import type { Instruction } from '@/lib/types';

const NewInstructionSchema = z.object({
  clientId: z.string().min(1, 'Client is required.'),
  projectId: z.string().min(1, 'Project is required.'),
  originalText: z.string().min(10, 'Instructions must be at least 10 characters.'),
  photoUrl: z.string().optional(),
  photoTimestamp: z.string().optional(),
  recipients: z.array(z.string()).optional(),
});

export type FormState = {
  message: string;
  success: boolean;
};

export async function createInstructionAction(
  formData: FormData
): Promise<FormState> {
  
  const validatedFields = NewInstructionSchema.safeParse({
    clientId: formData.get('clientId'),
    projectId: formData.get('projectId'),
    originalText: formData.get('originalText'),
    photoUrl: formData.get('photoUrl'),
    photoTimestamp: formData.get('photoTimestamp'),
    recipients: formData.getAll('recipients'),
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: validatedFields.error.flatten().fieldErrors.originalText?.[0] || 'Invalid data provided.',
    };
  }

  const { originalText, clientId, projectId, photoUrl, photoTimestamp, recipients: recipientIds } = validatedFields.data;

  try {
    const [summaryResult, actionItemsResult, distributionUsers] = await Promise.all([
      summarizeClientInstructions({ instructions: originalText }),
      extractInstructionActionItems({ instructionText: originalText }),
      getDistributionUsers(),
    ]);

    const newInstructionData: Omit<Instruction, 'id' | 'createdAt'> = {
      clientId,
      projectId,
      originalText,
      summary: summaryResult.summary,
      actionItems: actionItemsResult.actionItems,
    };

    if (photoUrl && photoTimestamp) {
        newInstructionData.photo = {
            url: photoUrl,
            takenAt: photoTimestamp,
        }
    }

    if (recipientIds && recipientIds.length > 0) {
      const recipientEmails = distributionUsers
        .filter(user => recipientIds.includes(user.id))
        .map(user => user.email);
      newInstructionData.recipients = recipientEmails;
    }
    
    await createInstruction(newInstructionData);

    revalidatePath('/instructions');
    revalidatePath('/');
    return { success: true, message: 'Instruction created successfully.' };

  } catch (error) {
    console.error('Failed to create instruction:', error);
    return { success: false, message: 'Failed to process and create instruction. Please note, email sending is not yet implemented.' };
  }
}
