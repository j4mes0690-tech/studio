
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { addDistributionUser, removeDistributionUser, addSubContractor, removeSubContractor, updateDistributionUser, updateSubContractor } from '@/lib/data';
import type { DistributionUser, SubContractor } from '@/lib/types';


const UserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
});

const UpdateUserSchema = UserSchema.extend({
    id: z.string().min(1, 'User ID is required.'),
});


export type FormState = {
  message: string;
  success: boolean;
};

export async function addUserAction(
  formData: FormData
): Promise<FormState> {
  const validatedFields = UserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    return {
      success: false,
      message: errors.name?.[0] || errors.email?.[0] || 'Invalid data.',
    };
  }

  try {
    await addDistributionUser(validatedFields.data);
    revalidatePath('/settings');
    revalidatePath('/instructions');
    revalidatePath('/information-requests');
    revalidatePath('/', 'layout');
    return { success: true, message: 'User added successfully.' };
  } catch (error) {
    return { success: false, message: 'Failed to add user.' };
  }
}

export async function removeUserAction(userId: string) {
  try {
    await removeDistributionUser(userId);
    revalidatePath('/settings');
    revalidatePath('/instructions');
    revalidatePath('/information-requests');
    revalidatePath('/', 'layout');
  } catch (error) {
    // In a real app, you'd handle this more gracefully
    console.error('Failed to remove user:', error);
  }
}

export async function updateUserAction(
    formData: FormData
  ): Promise<FormState> {
    const validatedFields = UpdateUserSchema.safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
      email: formData.get('email'),
    });
  
    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      return {
        success: false,
        message: errors.name?.[0] || errors.email?.[0] || 'Invalid data.',
      };
    }
  
    try {
      await updateDistributionUser(validatedFields.data as DistributionUser);
      revalidatePath('/settings');
      revalidatePath('/instructions');
      revalidatePath('/information-requests');
      revalidatePath('/', 'layout');
      return { success: true, message: 'User updated successfully.' };
    } catch (error) {
      return { success: false, message: 'Failed to update user.' };
    }
  }


export async function addSubContractorAction(
  formData: FormData
): Promise<FormState> {
  const validatedFields = UserSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
  });

  if (!validatedFields.success) {
    const errors = validatedFields.error.flatten().fieldErrors;
    return {
      success: false,
      message: errors.name?.[0] || errors.email?.[0] || 'Invalid data.',
    };
  }

  try {
    await addSubContractor(validatedFields.data);
    revalidatePath('/settings');
    revalidatePath('/cleanup-notices');
    revalidatePath('/', 'layout');
    return { success: true, message: 'Sub-contractor added successfully.' };
  } catch (error) {
    return { success: false, message: 'Failed to add sub-contractor.' };
  }
}

export async function removeSubContractorAction(userId: string) {
  try {
    await removeSubContractor(userId);
    revalidatePath('/settings');
    revalidatePath('/cleanup-notices');
    revalidatePath('/', 'layout');
  } catch (error) {
    console.error('Failed to remove sub-contractor:', error);
  }
}


export async function updateSubContractorAction(
    formData: FormData
  ): Promise<FormState> {
    const validatedFields = UpdateUserSchema.safeParse({
      id: formData.get('id'),
      name: formData.get('name'),
      email: formData.get('email'),
    });
  
    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      return {
        success: false,
        message: errors.name?.[0] || errors.email?.[0] || 'Invalid data.',
      };
    }
  
    try {
      await updateSubContractor(validatedFields.data as SubContractor);
      revalidatePath('/settings');
      revalidatePath('/cleanup-notices');
      revalidatePath('/', 'layout');
      return { success: true, message: 'Sub-contractor updated successfully.' };
    } catch (error) {
      return { success: false, message: 'Failed to update sub-contractor.' };
    }
  }
