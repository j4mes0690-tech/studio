
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { addSubContractor, removeSubContractor, updateSubContractor, addProject, removeProject, getProjects, updateProject } from '@/lib/data';
import type { SubContractor, Project } from '@/lib/types';

const UserSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
});

const UpdateUserSchema = z.object({
    id: z.string().min(1, 'User ID is required.'),
    name: z.string().min(1, 'Name is required.'),
    email: z.string().email('Invalid email address.'),
});

const ProjectSchema = z.object({
    name: z.string().min(1, 'Project name is required.'),
});

const UpdateProjectSchema = ProjectSchema.extend({
    id: z.string().min(1, 'Project ID is required.'),
    areas: z.string().optional(), // JSON string of Area[]
});


export type FormState = {
  message: string;
  success: boolean;
};

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

export async function addProjectAction(
    formData: FormData
    ): Promise<FormState> {
    const validatedFields = ProjectSchema.safeParse({
        name: formData.get('name'),
    });

    if (!validatedFields.success) {
        const errors = validatedFields.error.flatten().fieldErrors;
        return {
        success: false,
        message: errors.name?.[0] || 'Invalid data.',
        };
    }

    try {
        await addProject({ name: validatedFields.data.name, areas: [] });
        revalidatePath('/settings');
        revalidatePath('/projects');
        revalidatePath('/', 'layout');
        return { success: true, message: 'Project added successfully.' };
    } catch (error) {
        return { success: false, message: 'Failed to add project.' };
    }
}

export async function removeProjectAction(projectId: string) {
    try {
        await removeProject(projectId);
        revalidatePath('/settings');
        revalidatePath('/projects');
        revalidatePath('/', 'layout');
    } catch (error) {
        console.error('Failed to remove project:', error);
    }
}

export async function updateProjectAction(formData: FormData): Promise<FormState> {
    const validatedFields = UpdateProjectSchema.safeParse({
        id: formData.get('id'),
        name: formData.get('name'),
        areas: formData.get('areas'),
    });

    if (!validatedFields.success) {
        const errors = validatedFields.error.flatten().fieldErrors;
        return { success: false, message: errors.name?.[0] || 'Invalid data.' };
    }

    try {
        const existingProjects = await getProjects();
        const projectToUpdate = existingProjects.find(p => p.id === validatedFields.data.id);

        if (!projectToUpdate) {
            return { success: false, message: 'Project not found.' };
        }

        const updatedProject: Project = {
            ...projectToUpdate,
            name: validatedFields.data.name,
            areas: validatedFields.data.areas ? JSON.parse(validatedFields.data.areas) : projectToUpdate.areas,
        };

        await updateProject(updatedProject);
        
        revalidatePath('/settings');
        revalidatePath('/projects');
        revalidatePath('/quality-control');
        revalidatePath('/', 'layout');
        return { success: true, message: 'Project updated successfully.' };
    } catch (error) {
        console.error(error);
        return { success: false, message: 'Failed to update project.' };
    }
}
