'use server';
/**
 * @fileOverview General purpose Site Intelligence Agent.
 * 
 * - siteAgentChat - Handles multi-turn conversations with access to live project data tools.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

// Tool to fetch live project data for the agent
const getProjectsTool = ai.defineTool(
  {
    name: 'getProjects',
    description: 'Returns a list of all construction projects in the system that the agent can see.',
    inputSchema: z.void(),
    outputSchema: z.array(z.object({
      id: z.string(),
      name: z.string(),
      siteManager: z.string().optional().nullable(),
    })),
  },
  async () => {
    const { firestore } = initializeFirebase();
    const snap = await getDocs(collection(firestore, 'projects'));
    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            name: data.name,
            siteManager: data.siteManager || null
        };
    });
  }
);

// Tool to fetch live partner data for the agent
const getSubContractorsTool = ai.defineTool(
  {
    name: 'getSubContractors',
    description: 'Returns a list of all registered trade partners, designers, and suppliers.',
    inputSchema: z.void(),
    outputSchema: z.array(z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      isSubContractor: z.boolean().optional(),
      isDesigner: z.boolean().optional(),
      isSupplier: z.boolean().optional(),
    })),
  },
  async () => {
    const { firestore } = initializeFirebase();
    const snap = await getDocs(collection(firestore, 'sub-contractors'));
    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            name: data.name,
            email: data.email,
            isSubContractor: !!data.isSubContractor,
            isDesigner: !!data.isDesigner,
            isSupplier: !!data.isSupplier
        };
    });
  }
);

const ChatMessageSchema = z.object({
  role: z.enum(['user', 'model', 'system']),
  content: z.string(),
});

const SiteAgentInputSchema = z.object({
  messages: z.array(ChatMessageSchema),
  userEmail: z.string().optional(),
});

export type SiteAgentInput = z.infer<typeof SiteAgentInputSchema>;

export async function siteAgentChat(input: SiteAgentInput) {
  return siteAgentFlow(input);
}

const siteAgentFlow = ai.defineFlow(
  {
    name: 'siteAgentFlow',
    inputSchema: SiteAgentInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    const response = await ai.generate({
      model: 'googleai/gemini-1.5-pro',
      system: `You are the SiteCommand Intelligence Agent (SIA). 
      You are an expert in construction project management, site coordination, and commercial compliance.
      
      User context: ${input.userEmail || 'Unknown User'}
      
      Your goal is to help users navigate the platform and understand their project data.
      You have access to live tools to lookup Projects and Subcontractors.
      
      Guidelines:
      1. Always check your tools if the user asks about specific projects, partners, or general "who" or "what" data questions.
      2. Be professional, direct, and helpful.
      3. If a user asks for a summary of their work, refer them to the relevant modules like 'Planner' or 'Snagging'.
      4. Use Markdown for formatting lists or highlighting key information.`,
      messages: input.messages.map(m => ({
          role: m.role,
          content: [{ text: m.content }]
      })),
      tools: [getProjectsTool, getSubContractorsTool],
    });

    return response.text;
  }
);
