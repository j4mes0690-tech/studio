import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Genkit Instance Configuration
 * 
 * We explicitly use 'gemini-1.5-flash' as it provides the best balance 
 * of reasoning capability and speed for structured data generation tasks.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
