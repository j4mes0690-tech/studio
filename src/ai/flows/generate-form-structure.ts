'use server';
/**
 * @fileOverview This file implements a Genkit flow for generating form structures.
 * 
 * - generateFormStructure - Takes a natural language description and generates
 *   a structured template for Permits, QC, or Toolbox Talks.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateFormStructureInputSchema = z.object({
  type: z.enum(['permit', 'qc', 'toolbox']),
  prompt: z.string().describe('The description of the form requirements.'),
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
      type: z.enum(['checkbox', 'text', 'textarea']),
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
  input: { schema: GenerateFormStructureInputSchema },
  output: { schema: FormStructureOutputSchema },
  prompt: `You are an expert site safety and quality manager. Based on the user's description, generate a structured template.

{{#if (eq type "permit")}}
Generate a Permit to Work. 
Provide a clear title, description, and multiple sections (e.g., "Personal Protective Equipment", "Safety Controls", "Authorisation").
Each section should have specific fields with appropriate types (checkbox for yes/no, text for names/times).
{{/if}}

{{#if (eq type "qc")}}
Generate a Trade Quality Checklist.
Provide a professional title and a list of specific "items" (verification points) that must be checked for compliance.
{{/if}}

{{#if (eq type "toolbox")}}
Generate a Toolbox Talk Briefing.
Provide a title, a high-level "topic", and a "content" field with a bulleted educational briefing in Markdown.
Also provide a list of "items" which are verification questions to check staff understanding.
{{/if}}

User Description:
---
{{{prompt}}}
---

Ensure the output is strictly structured according to the requested type.`,
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
