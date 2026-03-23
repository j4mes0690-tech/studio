'use server';
/**
 * @fileOverview This file implements a Genkit flow for generating and refining form structures.
 * 
 * - generateFormStructure - Uses Gemini 1.5 Flash to create or refine templates for Permits, QC, or Toolbox Talks.
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
  })).optional().describe('Dynamic sections and fields (primarily for Permits).'),
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
  system: `You are an expert site safety and quality manager. Your goal is to produce highly professional, structured JSON data for construction site templates. 
  
  CRITICAL: You must return ONLY valid JSON. Do not include conversational filler, explanations, or markdown code blocks.
  
  For 'permit' type: Focus on dynamic sections and varied field types (PPE, Isolation, Site Checks).
  For 'qc' type: Focus on granular verification points using the 'items' array.
  For 'toolbox' type: Provide educational 'content' in Markdown and verification questions in 'items'.
  
  Maintain a high standard of site safety and technical accuracy.`,
  prompt: `
{{#if currentStructure}}
REFINEMENT REQUEST:
I have an existing form structure and I need you to modify it based on these instructions:
{{{prompt}}}

CURRENT STRUCTURE:
{{{currentStructure}}}

Please update the structure while maintaining the existing professional tone.
{{else}}
GENERATION REQUEST:
Create a new digital template for a construction site based on this description:
{{{prompt}}}

Form Category: {{type}}
{{/if}}

Ensure the output adheres strictly to the requested schema.`,
});

const generateFormStructureFlow = ai.defineFlow(
  {
    name: 'generateFormStructureFlow',
    inputSchema: GenerateFormStructureInputSchema,
    outputSchema: FormStructureOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error("AI failed to generate a valid form structure.");
    return output;
  }
);
