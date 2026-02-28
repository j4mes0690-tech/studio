'use server';
/**
 * @fileOverview This file implements a Genkit flow for replicating existing permit documents into digital templates.
 * 
 * - replicatePermitTemplate - Analyzes a document and returns a structured layout of sections and fields.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import type { ReplicatePermitTemplateOutput } from '@/lib/types';

// The schema used for AI generation is flattened to avoid "maximum nesting depth" errors in the Gemini API.
const FlattenedFieldSchema = z.object({
  sectionTitle: z.string().describe('The name of the header or grouping this field belongs to.'),
  label: z.string().describe('The label for the input field.'),
  type: z.enum(['text', 'textarea', 'checkbox']).describe('The type of input required.'),
});

const ReplicatePermitTemplateAISchema = z.object({
  title: z.string().describe('The identified title of the permit template.'),
  type: z.enum(['Hot Work', 'Confined Space', 'Excavation', 'Lifting', 'General']),
  description: z.string().describe('A brief description of what this template covers.'),
  fields: z.array(FlattenedFieldSchema).describe('A flat list of all data points and checkboxes identified, grouped by their section title.'),
});

const ReplicatePermitTemplateInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "A photo or PDF of a permit document, as a data URI that must include a MIME type and use Base64 encoding."
    ),
});

export async function replicatePermitTemplate(
  input: z.infer<typeof ReplicatePermitTemplateInputSchema>
): Promise<ReplicatePermitTemplateOutput> {
  return replicatePermitTemplateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'replicatePermitTemplatePrompt',
  input: { schema: ReplicatePermitTemplateInputSchema },
  output: { schema: ReplicatePermitTemplateAISchema },
  prompt: `You are an expert safety systems analyst. Your task is to look at the provided permit document and REPLICATE its structure into a digital template.

Identify all major headers, labels, and specific safety controls (like checkboxes for PPE or atmospheric testing).

Format your response as a flat list of fields. For each field, specify the 'sectionTitle' it belongs to (e.g., "Personal Protective Equipment", "Site Safety Checks").

Mapping to field types:
- "checkbox": for yes/no, presence/absence, or specific safety controls.
- "text": for short entries like names, times, or equipment IDs.
- "textarea": for larger descriptive areas like specific hazard details or remarks.

Maintain the original document's terminology and grouping.

Document: {{media url=fileDataUri}}`,
});

const replicatePermitTemplateFlow = ai.defineFlow(
  {
    name: 'replicatePermitTemplateFlow',
    inputSchema: ReplicatePermitTemplateInputSchema,
    outputSchema: z.any(), 
  },
  async (input) => {
    const { output } = await prompt(input);
    
    if (!output) {
      throw new Error("AI failed to generate a response for permit replication.");
    }

    // Reconstruct the nested structure (sections containing fields) from the flat AI output.
    // This circumvents API nesting depth limits during generation.
    const sectionsMap = new Map<string, { title: string; fields: any[] }>();

    output.fields.forEach((f, idx) => {
      const title = f.sectionTitle || 'General Information';
      if (!sectionsMap.has(title)) {
        sectionsMap.set(title, {
          title: title,
          fields: []
        });
      }
      
      sectionsMap.get(title)!.fields.push({
        id: `field-${Date.now()}-${idx}`,
        label: f.label,
        type: f.type
      });
    });

    const result: ReplicatePermitTemplateOutput = {
      title: output.title,
      type: output.type,
      description: output.description,
      sections: Array.from(sectionsMap.entries()).map(([_, section], sIdx) => ({
        id: `section-${Date.now()}-${sIdx}`,
        title: section.title,
        fields: section.fields
      }))
    };

    return result;
  }
);
