import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Genkit Instance Configuration
 * 
 * Upgraded to 'gemini-1.5-pro' for superior instruction following and 
 * reliability in generating complex structured JSON data for forms.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-pro',
});
