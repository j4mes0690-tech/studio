
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { addDistributionUser, removeDistributionUser } from '@/lib/data';

const AddUserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
});

export type AddUserFormState = {
  message: string;
  success: boolean;
};

export async function addUserAction(
  prevState: AddUserFormState,
  formData: FormData
): Promise<AddUserFormState> {
  const validatedFields = AddUserSchema.safeParse({
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
    revalidatePath('/instructions/new');
    return { success: true, message: 'User added successfully.' };
  } catch (error) {
    return { success: false, message: 'Failed to add user.' };
  }
}

export async function removeUserAction(userId: string) {
  try {
    await removeDistributionUser(userId);
    revalidatePath('/settings');
    revalidatePath('/instructions/new');
  } catch (error) {
    // In a real app, you'd handle this more gracefully
    console.error('Failed to remove user:', error);
  }
}
