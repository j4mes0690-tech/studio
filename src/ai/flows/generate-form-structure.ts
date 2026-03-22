'use server';
/**
 * @fileOverview This file implements a Genkit flow for generating and refining form structures.
 * 
 * - generateFormStructure - Takes a natural language prompt and optional current structure
 *   to create or refine templates for Permits, QC, or Toolbox Talks.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateFormStructureInputSchema = z.object({
  type: z.enum(['permit', 'qc', 'toolbox']),
  prompt: z.string().describe('The description of the form requirements or refinement instructions.'),
  currentStructure: z.string().optional().describe('The current structure in JSON format to be refined.'),
});

const FormStructureOutputSchema = z.object({
  title: z.string().describe('A professional title for the form.'),
  description: z.string().optional().describe('A brief overview of the form purpose.'),
  topic: z.string().optional().describe('The high-level safety topic (for Toolbox Talks).'),
  content: z.string().optional().describe('Detailed educational briefing content in Markdown (for Toolbox Talks).'),
  sections: z.array(z.object({
    title: z.string(),
    fields: z.array(z.object({
      label: z.string(),
      type: z.enum(['checkbox', 'text', 'textarea', 'yes-no-na']),
    }))
  })).optional().describe('Dynamic sections and fields (for Permits).'),
  items: z.array(z.object({
    text: z.string()
  })).optional().describe('Checklist verification points (for QC or Toolbox Talks).'),
});

export async function generateFormStructure(
  input: z.infer<typeof GenerateFormStructureInputSchema>
): Promise<z.infer<typeof FormStructureOutputSchema>> {
  return generateFormStructureFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateFormStructurePrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: GenerateFormStructureInputSchema },
  output: { schema: FormStructureOutputSchema },
  prompt: `You are an expert site safety and quality manager. 

{{#if currentStructure}}
You are REFINING an existing form structure based on the user's feedback.
Current Structure:
{{{currentStructure}}}

Refinement Instruction:
{{{prompt}}}
{{else}}
You are GENERATING a NEW structured template based on the following description:
Description:
{{{prompt}}}
{{/if}}

For a "permit": 
Generate a Permit to Work. 
Provide a clear title, description, and multiple sections (e.g., "Personal Protective Equipment", "Safety Controls", "Authorisation").
Each section should have specific fields with appropriate types (checkbox for yes/no, text for names/times, textarea for descriptions, or yes-no-na).

For a "qc":
Generate a Trade Quality Checklist.
Provide a professional title and a list of specific "items" (verification points) that must be checked for compliance.

For a "toolbox":
Generate a Toolbox Talk Briefing.
Provide a title, a high-level "topic", and a "content" field with a bulleted educational briefing in Markdown.
Also provide a list of "items" which are verification questions to check staff understanding.

Ensure the output is strictly structured according to the requested type and maintains high professional standards for construction site documentation.`,
});

const generateFormStructureFlow = ai.defineFlow(
  {
    name: 'generateFormStructureFlow',
    inputSchema: GenerateFormStructureInputSchema,
    outputSchema: FormStructureOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("AI failed to generate form structure.");
    return output;
  }
);
