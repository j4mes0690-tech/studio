
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createQualityChecklist, getQualityChecklists, updateQualityChecklist } from '@/lib/data';
import type { QualityChecklist, ChecklistItem } from '@/lib/types';

const NewChecklistSchema = z.object({
  projectId: z.string().min(1, 'Project is required.'),
  title: z.string().min(1, 'Title is required.'),
  trade: z.string().min(1, 'Trade is required.'),
  items: z.string().min(3, 'Checklist must have at least one item.'), // JSON string of string[]
});

const UpdateChecklistItemsSchema = z.object({
    checklistId: z.string(),
    items: z.string(), // JSON string of ChecklistItem[]
});


export type FormState = {
  message: string;
  success: boolean;
};

export async function createChecklistAction(formData: FormData): Promise<FormState> {
  const validatedFields = NewChecklistSchema.safeParse({
    projectId: formData.get('projectId'),
    title: formData.get('title'),
    trade: formData.get('trade'),
    items: formData.get('items'),
  });

  if (!validatedFields.success) {
    const fieldErrors = validatedFields.error.flatten().fieldErrors;
    const message = fieldErrors.title?.[0] || fieldErrors.projectId?.[0] || fieldErrors.trade?.[0] || fieldErrors.items?.[0] || 'Invalid data provided.';
    return { success: false, message };
  }

  try {
    const itemTexts: string[] = JSON.parse(validatedFields.data.items);
    if (!Array.isArray(itemTexts) || itemTexts.length === 0) {
        return { success: false, message: 'Checklist must have at least one item.' };
    }

    const newItems: Omit<ChecklistItem, 'id'>[] = itemTexts.map((text) => ({
        text,
        isCompleted: false,
    }));

    const newChecklistData: Omit<QualityChecklist, 'id' | 'createdAt'> = {
      projectId: validatedFields.data.projectId,
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
