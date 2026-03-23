import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Genkit Instance Configuration
 * 
 * Switched to 'gemini-1.5-flash' to ensure high availability and prevent 
 * 429 rate limit errors while maintaining excellent performance for 
 * construction site documentation tasks.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
