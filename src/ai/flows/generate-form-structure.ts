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

export async function generateFormStructure(
  input: z.infer<typeof GenerateFormStructureInputSchema>
): Promise<any> {
  return generateFormStructureFlow(input);
}

const generateFormStructureFlow = ai.defineFlow(
  {
    name: 'generateFormStructureFlow',
    inputSchema: GenerateFormStructureInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    let systemPrompt = '';
    
    if (input.type === 'permit') {
      systemPrompt = `You are an expert site safety manager. Based on the user's description, generate a structured Permit to Work template.
      Return a JSON object with:
      - "title": A professional permit title.
      - "description": A standard work description.
      - "sections": An array of sections, each with a "title" and "fields" array.
      - Each field should have a "label" and "type" (checkbox, text, or textarea).
      Focus on critical safety controls, PPE, and isolation requirements.`;
    } else if (input.type === 'qc') {
      systemPrompt = `You are a quality assurance inspector. Generate a trade-specific quality checklist.
      Return a JSON object with:
      - "title": A professional checklist title.
      - "items": An array of items, each with "text" (the verification point).
      Focus on common defects, tolerances, and compliance standards for the trade described.`;
    } else {
      systemPrompt = `You are a safety training coordinator. Generate a Toolbox Talk briefing.
      Return a JSON object with:
      - "title": The briefing title.
      - "topic": The high-level topic.
      - "content": A professional, bulleted educational briefing (Markdown supported).
      - "verificationItems": An array of confirmation questions (items with "text") to verify staff understanding.`;
    }

    const { output } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      system: systemPrompt,
      prompt: input.prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    return output;
  }
);
