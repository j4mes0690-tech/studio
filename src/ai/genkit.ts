import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Genkit Instance Configuration
 * 
 * We use 'gemini-1.5-flash' as the default model. 
 * Stable models like 1.5 Flash have significantly higher rate limits (RPM/TPM) 
 * compared to preview models (like gemini-3-flash-preview), effectively 
 * preventing 429 "Resource Exhausted" errors during normal usage.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
