'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getDistributionUsers, updateDistributionUser } from '@/lib/data';
import type { DistributionUser } from '@/lib/types';


const UpdateAccountSchema = z.object({
    id: z.string().min(1, 'User ID is required.'),
    name: z.string().min(1, 'Name is required.'),
    email: z.string().email('Invalid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters.').optional(),
});


export type FormState = {
  message: string;
  success: boolean;
};

export async function updateAccountAction(
    formData: FormData
  ): Promise<FormState> {
    const password = formData.get('password');
    const dataToValidate: any = {
      id: formData.get('id'),
      name: formData.get('name'),
      email: formData.get('email'),
    };
    if (password) {
      dataToValidate.password = password;
    }
  
    const validatedFields = UpdateAccountSchema.safeParse(dataToValidate);
  
    if (!validatedFields.success) {
      const errors = validatedFields.error.flatten().fieldErrors;
      return {
        success: false,
        message: errors.name?.[0] || errors.email?.[0] || errors.password?.[0] || 'Invalid data.',
      };
    }
  
    try {
        const users = await getDistributionUsers();
        const existingUser = users.find(u => u.id === validatedFields.data.id);
        if (!existingUser) {
            return { success: false, message: 'User not found.' };
        }
        
        const { id, name, email, password: newPassword } = validatedFields.data;

        const updatedUser: DistributionUser = {
            ...existingUser,
            name,
            email,
        };
        if (newPassword) {
            updatedUser.password = newPassword;
        }

      await updateDistributionUser(updatedUser);
      revalidatePath('/account');
      
      return { success: true, message: 'Account updated successfully.' };
    } catch (error) {
      return { success: false, message: 'Failed to update account.' };
    }
  }
