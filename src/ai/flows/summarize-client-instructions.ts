'use server';
/**
 * @fileOverview This file implements a Genkit flow for summarizing client instructions.
 *
 * - summarizeClientInstructions - A function that provides an AI-generated summary of client instructions.
 * - SummarizeClientInstructionsInput - The input type for the summarizeClientInstructions function.
 * - SummarizeClientInstructionsOutput - The return type for the summarizeClientInstructions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeClientInstructionsInputSchema = z
  .object({
    instructions: z.string().describe('The client instructions to summarize.'),
  })
  .describe('Input for summarizing client instructions.');
export type SummarizeClientInstructionsInput = z.infer<
  typeof SummarizeClientInstructionsInputSchema
>;

const SummarizeClientInstructionsOutputSchema = z
  .object({
    summary: z.string().describe('The AI-generated summary of the instructions.'),
  })
  .describe('Output for summarizing client instructions.');
export type SummarizeClientInstructionsOutput = z.infer<
  typeof SummarizeClientInstructionsOutputSchema
>;

export async function summarizeClientInstructions(
  input: SummarizeClientInstructionsInput
): Promise<SummarizeClientInstructionsOutput> {
  return summarizeClientInstructionsFlow(input);
}

const summarizeClientInstructionsPrompt = ai.definePrompt({
  name: 'summarizeClientInstructionsPrompt',
  input: {schema: SummarizeClientInstructionsInputSchema},
  output: {schema: SummarizeClientInstructionsOutputSchema},
  prompt: `You are an expert assistant for construction managers. Your task is to concisely summarize client instructions.

Instructions to summarize:

{{{instructions}}}

Provide a summary that captures the main points and key directives from the instructions.`,
});

const summarizeClientInstructionsFlow = ai.defineFlow(
  {
    name: 'summarizeClientInstructionsFlow',
    inputSchema: SummarizeClientInstructionsInputSchema,
    outputSchema: SummarizeClientInstructionsOutputSchema,
  },
  async (input) => {
    const {output} = await summarizeClientInstructionsPrompt(input);
    return output!;
  }
);
