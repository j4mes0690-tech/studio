
'use server';

import type { Project, Instruction, DistributionUser, CleanUpNotice, SubContractor, SnaggingItem, InformationRequest, QualityChecklist, Area } from './types';
import { unstable_noStore as noStore } from 'next/cache';

// NOTE: User management has been migrated to Firestore.
// The functions below now handle the remaining mock data for Projects, Instructions, etc.

declare global {
  var projects: Project[];
  var instructions: Instruction[];
  var cleanUpNotices: CleanUpNotice[];
  var snaggingLists: SnaggingItem[];
  var informationRequests: InformationRequest[];
  var subContractors: SubContractor[];
  var qualityChecklists: QualityChecklist[];
}

const g: {
  projects: Project[];
  instructions: Instruction[];
  cleanUpNotices: CleanUpNotice[];
  snaggingLists: SnaggingItem[];
  informationRequests: InformationRequest[];
  subContractors: SubContractor[];
  qualityChecklists: QualityChecklist[];
} = globalThis as any;

if (!g.projects) {
    g.projects = [
        { id: '101', name: 'Downtown Tower', areas: [{id: 'area-101-1', name: 'Externals'}, {id: 'area-101-2', name: 'Level 1'}, {id: 'area-101-3', name: 'Level 2'}] },
        { id: '102', name: 'Suburban Mall', areas: [] },
        { id: '201', name: 'Riverside Bridge', areas: [] },
        { id: '301', name: 'Hilltop Estates', areas: [{id: 'area-301-1', name: 'Plot 1'}, {id: 'area-301-2', name: 'Plot 2'}, {id: 'area-301-3', name: 'Plot 3'}] },
        { id: '302', name: 'Oceanview Villas', areas: [{id: 'area-302-1', name: 'Villa A'}, {id: 'area-302-2', name: 'Villa B'}] },
    ];
}

if (!g.instructions) {
    g.instructions = [
        {
        id: '1',
        projectId: '101',
        originalText:
            'Please ensure that all exterior windows on the south side of the Downtown Tower are fitted with the new energy-efficient glass by the end of the month. Also, check the HVAC system on the top three floors and report any issues by Friday.',
        summary:
            'Install energy-efficient glass on all south-facing exterior windows of the Downtown Tower by month-end. Inspect the HVAC system on the top three floors and report any problems by this Friday.',
        actionItems: [
            'Fit all exterior windows on the south side of the Downtown Tower with new energy-efficient glass.',
            'Complete the window installation by the end of the month.',
            'Check the HVAC system on the top three floors.',
            'Report any HVAC issues by Friday.',
        ],
        createdAt: new Date('2023-10-15T09:00:00Z').toISOString(),
        recipients: ['pm@example.com', 'supervisor@example.com'],
        photos: [{
            url: 'https://picsum.photos/seed/instruction1/600/400',
            takenAt: new Date('2023-10-15T09:02:15Z').toISOString(),
        }],
        },
    ];
}

if (!g.cleanUpNotices) {
    g.cleanUpNotices = [
        {
            id: 'cl1',
            projectId: '101',
            description: 'Debris from drywall installation on floor 12 needs to be cleared by end of day.',
            createdAt: new Date('2023-10-22T16:00:00Z').toISOString(),
            recipients: ['cleanup-crew@example.com'],
        }
    ];
}

if (!g.subContractors) {
    g.subContractors = [
        { id: 'sub-1', name: 'General Cleaners LLC', email: 'contact@generalcleaners.com' },
        { id: 'sub-2', name: 'Site-Ready Services', email: 'ops@siteready.com' },
    ];
}

if (!g.qualityChecklists) {
    g.qualityChecklists = [
        {
            id: 'qc1',
            projectId: '101',
            title: 'Pre-Pour Concrete Inspection',
            trade: 'Concrete',
            areaId: 'area-101-2',
            createdAt: new Date('2023-11-01T09:00:00Z').toISOString(),
            items: [
                { id: 'qc1-1', text: 'Formwork is clean and properly oiled.', status: 'yes' },
                { id: 'qc1-2', text: 'Reinforcement is correctly placed and secured.', status: 'yes' },
            ],
        }
    ];
}

export async function getProjects(): Promise<Project[]> {
  noStore();
  return g.projects;
}

export async function addProject(projectData: Omit<Project, 'id'>): Promise<Project> {
    const newProject: Project = { ...projectData, id: `proj-${Date.now()}` };
    g.projects.push(newProject);
    return newProject;
}

export async function removeProject(projectId: string): Promise<{ success: boolean }> {
    const initialLength = g.projects.length;
    g.projects = g.projects.filter((project) => project.id !== projectId);
    return { success: g.projects.length < initialLength };
}

export async function updateProject(projectData: Project): Promise<Project> {
    const index = g.projects.findIndex(p => p.id === projectData.id);
    if (index !== -1) {
        g.projects[index] = projectData;
        return projectData;
    }
    throw new Error('Project not found.');
}

export async function getInstructions({ projectId }: { projectId?: string }): Promise<Instruction[]> {
  let filtered = [...g.instructions];
  if (projectId) filtered = filtered.filter(i => i.projectId === projectId);
  return filtered.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createInstruction(instructionData: Omit<Instruction, 'id' | 'createdAt'>): Promise<Instruction> {
    const newInstruction: Instruction = { ...instructionData, id: Date.now().toString(), createdAt: new Date().toISOString() };
    g.instructions = [newInstruction, ...g.instructions];
    return newInstruction;
}

export async function getCleanUpNotices({ projectId }: { projectId?: string }): Promise<CleanUpNotice[]> {
    let filtered = [...(g.cleanUpNotices || [])];
    if (projectId) filtered = filtered.filter(i => i.projectId === projectId);
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createCleanUpNotice(noticeData: Omit<CleanUpNotice, 'id' | 'createdAt'>): Promise<CleanUpNotice> {
    const newNotice: CleanUpNotice = { ...noticeData, id: `cl-${Date.now()}`, createdAt: new Date().toISOString() };
    g.cleanUpNotices = [newNotice, ...(g.cleanUpNotices || [])];
    return newNotice;
}

export async function getSubContractors(): Promise<SubContractor[]> {
  return g.subContractors;
}

export async function addSubContractor(userData: Omit<SubContractor, 'id'>): Promise<SubContractor> {
    const newUser: SubContractor = { ...userData, id: `sub-${Date.now()}` };
    g.subContractors.push(newUser);
    return newUser;
}

export async function removeSubContractor(userId: string): Promise<{ success: boolean }> {
    const initialLength = g.subContractors.length;
    g.subContractors = g.subContractors.filter((user) => user.id !== userId);
    return { success: g.subContractors.length < initialLength };
}

export async function updateSubContractor(subContractorData: SubContractor): Promise<SubContractor> {
    const index = g.subContractors.findIndex(sc => sc.id === subContractorData.id);
    if (index !== -1) {
        g.subContractors[index] = subContractorData;
        return subContractorData;
    }
    throw new Error('Sub-contractor not found.');
}

export async function getSnaggingLists({ projectId }: { projectId?: string }): Promise<SnaggingItem[]> {
    let filtered = [...(g.snaggingLists || [])];
    if (projectId) filtered = filtered.filter(i => i.projectId === projectId);
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createSnaggingItem(itemData: Omit<SnaggingItem, 'id' | 'createdAt'>): Promise<SnaggingItem> {
    const newItem: SnaggingItem = { ...itemData, id: `snag-${Date.now()}`, createdAt: new Date().toISOString() };
    g.snaggingLists = [newItem, ...(g.snaggingLists || [])];
    return newItem;
}

export async function updateSnaggingItem(itemData: SnaggingItem): Promise<SnaggingItem> {
    const index = g.snaggingLists.findIndex(item => item.id === itemData.id);
    if (index !== -1) {
        g.snaggingLists[index] = itemData;
        return itemData;
    }
    throw new Error('Snagging item not found');
}

export async function getInformationRequests({ projectId }: { projectId?: string }): Promise<InformationRequest[]> {
    let filtered = [...(g.informationRequests || [])];
    if (projectId) filtered = filtered.filter(i => i.projectId === projectId);
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createInformationRequest(itemData: Omit<InformationRequest, 'id' | 'createdAt'>): Promise<InformationRequest> {
    const newItem: InformationRequest = { ...itemData, id: `ir-${Date.now()}`, createdAt: new Date().toISOString() };
    g.informationRequests = [newItem, ...(g.informationRequests || [])];
    return newItem;
}

export async function updateInformationRequest(itemData: InformationRequest): Promise<InformationRequest> {
    const index = g.informationRequests.findIndex(item => item.id === itemData.id);
    if (index !== -1) {
        g.informationRequests[index] = itemData;
        return itemData;
    }
    throw new Error('Information request not found');
}

export async function deleteInformationRequest(id: string): Promise<{ success: boolean }> {
    const initialLength = g.informationRequests.length;
    g.informationRequests = g.informationRequests.filter(item => item.id !== id);
    return { success: g.informationRequests.length < initialLength };
}

export async function getQualityChecklists({ projectId, template }: { projectId?: string, template?: boolean }): Promise<QualityChecklist[]> {
    let filtered = [...(g.qualityChecklists || [])];
    if (template === true) filtered = filtered.filter(c => !c.projectId);
    else if (template === false) filtered = filtered.filter(c => !!c.projectId);
    if (projectId) filtered = filtered.filter(i => i.projectId === projectId);
    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createQualityChecklist(itemData: Omit<QualityChecklist, 'id' | 'createdAt'>): Promise<QualityChecklist> {
    const newItem: QualityChecklist = { ...itemData, id: `qc-${Date.now()}`, createdAt: new Date().toISOString() };
    g.qualityChecklists = [newItem, ...(g.qualityChecklists || [])];
    return newItem;
}

export async function updateQualityChecklist(itemData: QualityChecklist): Promise<QualityChecklist> {
    const index = g.qualityChecklists.findIndex(item => item.id === itemData.id);
    if (index !== -1) {
        g.qualityChecklists[index] = itemData;
        return itemData;
    }
    throw new Error('Quality checklist not found');
}

export async function assignChecklistToProject(templateId: string, projectId: string, areaId: string, recipients?: string[]): Promise<QualityChecklist> {
    const template = g.qualityChecklists.find(c => c.id === templateId && !c.projectId);
    if (!template) throw new Error('Checklist template not found.');
    const newInstance: QualityChecklist = {
        ...template,
        id: `qc-instance-${Date.now()}`,
        projectId,
        areaId,
        createdAt: new Date().toISOString(),
        recipients: recipients,
        items: template.items.map(item => ({ ...item, status: 'pending', comment: undefined })),
    };
    g.qualityChecklists.push(newInstance);
    return newInstance;
}

export async function deleteQualityChecklist(id: string): Promise<{ success: boolean }> {
    const initialLength = g.qualityChecklists.length;
    g.qualityChecklists = g.qualityChecklists.filter(item => item.id !== id);
    return { success: g.qualityChecklists.length < initialLength };
}
