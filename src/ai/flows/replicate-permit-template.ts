
'use server';
/**
 * @fileOverview This file implements a Genkit flow for replicating existing permit documents into digital templates.
 * 
 * - replicatePermitTemplate - Analyzes a document and returns a structured layout of sections and fields.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const TemplateFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['text', 'textarea', 'checkbox']),
});

const TemplateSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  fields: z.array(TemplateFieldSchema),
});

const ReplicatePermitTemplateInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "A photo or PDF of a permit document, as a data URI that must include a MIME type and use Base64 encoding."
    ),
});

const ReplicatePermitTemplateOutputSchema = z.object({
  title: z.string().describe('The identified title of the permit template.'),
  type: z.enum(['Hot Work', 'Confined Space', 'Excavation', 'Lifting', 'General']),
  description: z.string().describe('A brief description of what this template covers.'),
  sections: z.array(TemplateSectionSchema).describe('The structured layout of the permit, organized into sections like the original document.'),
});

export type ReplicatePermitTemplateOutput = z.infer<typeof ReplicatePermitTemplateOutputSchema>;

export async function replicatePermitTemplate(
  input: z.infer<typeof ReplicatePermitTemplateInputSchema>
): Promise<ReplicatePermitTemplateOutput> {
  return replicatePermitTemplateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'replicatePermitTemplatePrompt',
  input: { schema: ReplicatePermitTemplateInputSchema },
  output: { schema: ReplicatePermitTemplateOutputSchema },
  prompt: `You are an expert safety systems analyst. Your task is to look at the provided permit document and REPLICATE its structure into a digital template.

Do not just extract text. You must:
1. Identify major headers/sections (e.g., "Personal Protective Equipment", "Atmospheric Testing", "Fire Watch Details").
2. Identify individual data points or checkboxes under those sections.
3. Map these to field types:
   - "checkbox": for yes/no or specific safety controls.
   - "text": for short entries like names, times, or equipment IDs.
   - "textarea": for larger descriptive areas like specific hazard details.

Maintain the original document's terminology and grouping to ensure visual and structural similarity.

Document: {{media url=fileDataUri}}`,
});

const replicatePermitTemplateFlow = ai.defineFlow(
  {
    name: 'replicatePermitTemplateFlow',
    inputSchema: ReplicatePermitTemplateInputSchema,
    outputSchema: ReplicatePermitTemplateOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
