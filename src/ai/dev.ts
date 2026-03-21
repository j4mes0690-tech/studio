import { config } from 'dotenv';
config();

import '@/ai/flows/summarize-client-instructions.ts';
import '@/ai/flows/extract-instruction-action-items.ts';
import '@/ai/flows/extract-permit-details.ts';
import '@/ai/flows/replicate-permit-template.ts';
import '@/ai/flows/generate-form-structure.ts';
