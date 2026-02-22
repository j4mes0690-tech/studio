'use server';
/**
 * @fileOverview This file implements a Genkit flow for summarizing instructions.
 *
 * - summarizeInstructions - A function that provides an AI-generated summary of instructions.
 * - SummarizeInstructionsInput - The input type for the summarizeInstructions function.
 * - SummarizeInstructionsOutput - The return type for the summarizeInstructions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeInstructionsInputSchema = z
  .object({
    instructions: z.string().describe('The instructions to summarize.'),
  })
  .describe('Input for summarizing instructions.');
export type SummarizeInstructionsInput = z.infer<
  typeof SummarizeInstructionsInputSchema
>;

const SummarizeInstructionsOutputSchema = z
  .object({
    summary: z.string().describe('The AI-generated summary of the instructions.'),
  })
  .describe('Output for summarizing instructions.');
export type SummarizeInstructionsOutput = z.infer<
  typeof SummarizeInstructionsOutputSchema
>;

export async function summarizeInstructions(
  input: SummarizeInstructionsInput
): Promise<SummarizeInstructionsOutput> {
  return summarizeInstructionsFlow(input);
}

const summarizeInstructionsPrompt = ai.definePrompt({
  name: 'summarizeInstructionsPrompt',
  input: {schema: SummarizeInstructionsInputSchema},
  output: {schema: SummarizeInstructionsOutputSchema},
  prompt: `You are an expert assistant for construction managers. Your task is to concisely summarize instructions.

Instructions to summarize:

{{{instructions}}}

Provide a summary that captures the main points and key directives from the instructions.`,
});

const summarizeInstructionsFlow = ai.defineFlow(
  {
    name: 'summarizeInstructionsFlow',
    inputSchema: SummarizeInstructionsInputSchema,
    outputSchema: SummarizeInstructionsOutputSchema,
  },
  async (input) => {
    const {output} = await summarizeInstructionsPrompt(input);
    return output!;
  }
);
