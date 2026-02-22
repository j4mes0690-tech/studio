
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createQualityChecklist, getQualityChecklists, updateQualityChecklist, assignChecklistToProject, getSubContractors } from '@/lib/data';
import type { QualityChecklist, ChecklistItem } from '@/lib/types';

const NewChecklistSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  trade: z.string().min(1, 'Trade is required.'),
  items: z.string().min(3, 'Checklist must have at least one item.'), // JSON string of string[]
});

const UpdateChecklistItemsSchema = z.object({
    checklistId: z.string(),
    items: z.string(), // JSON string of ChecklistItem[]
});

const AssignChecklistSchema = z.object({
    templateId: z.string().min(1, 'A checklist template is required.'),
    projectId: z.string().min(1, 'A project is required.'),
    areaId: z.string().min(1, 'A project area is required.'),
    recipients: z.array(z.string()).optional(),
});


export type FormState = {
  message: string;
  success: boolean;
};

export async function createChecklistAction(formData: FormData): Promise<FormState> {
  const validatedFields = NewChecklistSchema.safeParse({
    title: formData.get('title'),
    trade: formData.get('trade'),
    items: formData.get('items'),
  });

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    const message = fieldErrors.title?.[0] || fieldErrors.trade?.[0] || fieldErrors.items?.[0] || 'Invalid data provided.';
    return { success: false, message };
  }

  try {
    const itemTexts: string[] = JSON.parse(validatedFields.data.items);
    if (!Array.isArray(itemTexts) || itemTexts.length === 0) {
        return { success: false, message: 'Checklist must have at least one item.' };
    }

    const newItems: Omit<ChecklistItem, 'id'>[] = itemTexts.map((text) => ({
        text,
        status: 'pending',
    }));

    const newChecklistData: Omit<QualityChecklist, 'id' | 'createdAt'> = {
      title: validatedFields.data.title,
      trade: validatedFields.data.trade,
      items: newItems.map((item, index) => ({ ...item, id: `item-${Date.now()}-${index}`})),
    };
    
    await createQualityChecklist(newChecklistData);

    revalidatePath('/quality-control');
    return { success: true, message: 'Checklist created successfully.' };

  } catch (error) {
    console.error('Failed to create checklist:', error);
    return { success: false, message: 'Failed to create checklist.' };
  }
}

export async function updateChecklistItemsAction(formData: FormData): Promise<FormState> {
    const validatedFields = UpdateChecklistItemsSchema.safeParse({
        checklistId: formData.get('checklistId'),
        items: formData.get('items'),
    });

    if (!validatedFields.success) {
        return { success: false, message: 'Invalid data.' };
    }

    try {
        const { checklistId, items: itemsJson } = validatedFields.data;
        const allChecklists = await getQualityChecklists({});
        const existingChecklist = allChecklists.find(c => c.id === checklistId);

        if (!existingChecklist) {
            return { success: false, message: 'Checklist not found.' };
        }

        const updatedItems: ChecklistItem[] = JSON.parse(itemsJson);

        const updatedChecklist: QualityChecklist = {
            ...existingChecklist,
            items: updatedItems,
        };

        await updateQualityChecklist(updatedChecklist);

        revalidatePath('/quality-control');
        return { success: true, message: 'Checklist updated.' };

    } catch (error) {
        console.error('Failed to update checklist:', error);
        return { success: false, message: 'Failed to update checklist.' };
    }
}


export async function assignChecklistAction(formData: FormData): Promise<FormState> {
  const validatedFields = AssignChecklistSchema.safeParse({
    templateId: formData.get('templateId'),
    projectId: formData.get('projectId'),
    areaId: formData.get('areaId'),
    recipients: formData.getAll('recipients'),
  });

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    const message = fieldErrors.templateId?.[0] || fieldErrors.projectId?.[0] || fieldErrors.areaId?.[0] || 'Invalid data provided.';
    return { success: false, message };
  }

  try {
    const { templateId, projectId, areaId, recipients: recipientIds } = validatedFields.data;
    
    let recipientEmails: string[] | undefined;
    if (recipientIds && recipientIds.length > 0) {
      const subContractors = await getSubContractors();
      recipientEmails = subContractors
        .filter(user => recipientIds.includes(user.id))
        .map(user => user.email);
    }
    
    await assignChecklistToProject(templateId, projectId, areaId, recipientEmails);

    revalidatePath('/quality-control');
    return { success: true, message: 'Checklist assigned to project successfully.' };

  } catch (error: any) {
    console.error('Failed to assign checklist:', error);
    return { success: false, message: error.message || 'Failed to assign checklist.' };
  }
}
