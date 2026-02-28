'use server';
/**
 * @fileOverview This file implements a Genkit flow for extracting permit-to-work details from documents or images.
 *
 * - extractPermitDetails - A function that handles the extraction process using AI.
 * - ExtractPermitDetailsInput - The input type (data URI of the document/image).
 * - ExtractPermitDetailsOutput - The structured permit data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractPermitDetailsInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "A photo or document scan, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractPermitDetailsInput = z.infer<typeof ExtractPermitDetailsInputSchema>;

const ExtractPermitDetailsOutputSchema = z.object({
  type: z.enum(['Hot Work', 'Confined Space', 'Excavation', 'Lifting', 'General']).optional(),
  description: z.string().describe('The description of the work being performed.'),
  hazards: z.string().describe('The identified hazards from the document.'),
  precautions: z.string().describe('The required safety controls or precautions.'),
});
export type ExtractPermitDetailsOutput = z.infer<typeof ExtractPermitDetailsOutputSchema>;

export async function extractPermitDetails(
  input: ExtractPermitDetailsInput
): Promise<ExtractPermitDetailsOutput> {
  return extractPermitDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractPermitDetailsPrompt',
  input: { schema: ExtractPermitDetailsInputSchema },
  output: { schema: ExtractPermitDetailsOutputSchema },
  prompt: `You are an expert site safety assistant. Your task is to analyze the provided document or image, which is a template or an existing Permit to Work.

Extract the following information:
1. The type of permit (Hot Work, Confined Space, Excavation, Lifting, or General).
2. A clear description of the work.
3. The specific hazards mentioned.
4. The required safety precautions or controls.

If a field is missing, provide a best-guess based on the context of the work described.

Document: {{media url=fileDataUri}}`,
});

const extractPermitDetailsFlow = ai.defineFlow(
  {
    name: 'extractPermitDetailsFlow',
    inputSchema: ExtractPermitDetailsInputSchema,
    outputSchema: ExtractPermitDetailsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
