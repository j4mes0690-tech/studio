'use server';
/**
 * @fileOverview This file implements a Genkit flow for extracting action items from instructions.
 *
 * - extractInstructionActionItems - A function that handles the extraction of action items.
 * - ExtractInstructionActionItemsInput - The input type for the extractInstructionActionItems function.
 * - ExtractInstructionActionItemsOutput - The return type for the extractInstructionActionItems function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const ExtractInstructionActionItemsInputSchema = z.object({
  instructionText: z
    .string()
    .describe('The instruction text from which to extract action items.'),
});
export type ExtractInstructionActionItemsInput = z.infer<
  typeof ExtractInstructionActionItemsInputSchema
>;

const ExtractInstructionActionItemsOutputSchema = z.object({
  actionItems: z
    .array(z.string())
    .describe('A list of extracted actionable tasks from the instructions.'),
});
export type ExtractInstructionActionItemsOutput = z.infer<
  typeof ExtractInstructionActionItemsOutputSchema
>;

export async function extractInstructionActionItems(
  input: ExtractInstructionActionItemsInput
): Promise<ExtractInstructionActionItemsOutput> {
  return extractInstructionActionItemsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInstructionActionItemsPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: ExtractInstructionActionItemsInputSchema },
  output: { schema: ExtractInstructionActionItemsOutputSchema },
  prompt: `You are an AI assistant for a construction manager. Your task is to carefully read the instructions provided and extract all distinct, actionable tasks from the text.
Each extracted action item should be concise and clearly state a task that needs to be performed.

Instructions:
---
{{{instructionText}}}
---

Extract the action items and present them as a JSON array of strings.
`,
});

const extractInstructionActionItemsFlow = ai.defineFlow(
  {
    name: 'extractInstructionActionItemsFlow',
    inputSchema: ExtractInstructionActionItemsInputSchema,
    outputSchema: ExtractInstructionActionItemsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
