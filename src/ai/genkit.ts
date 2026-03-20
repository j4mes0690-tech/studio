import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Genkit Instance Configuration
 * 
 * We explicitly use 'gemini-1.5-flash' as the default model. 
 * This model is optimized for speed and high throughput, making it the 
 * quickest stable model for production-ready site documentation tasks.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
