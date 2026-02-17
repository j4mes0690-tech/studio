
'use server';

import type { Client, Project, Instruction, DistributionUser, CleanUpNotice, SubContractor } from './types';
import { unstable_noStore as noStore } from 'next/cache';

let clients: Client[] = [
  { id: '1', name: 'Global Construct Inc.', avatarUrl: 'https://picsum.photos/seed/1/40/40' },
  { id: '2', name: 'Pioneer Builders', avatarUrl: 'https://picsum.photos/seed/2/40/40' },
  { id: '3', name: 'Apex Developments', avatarUrl: 'https://picsum.photos/seed/3/40/40' },
];

let projects: Project[] = [
  { id: '101', name: 'Downtown Tower', clientId: '1' },
  { id: '102', name: 'Suburban Mall', clientId: '1' },
  { id: '201', name: 'Riverside Bridge', clientId: '2' },
  { id: '301', name: 'Hilltop Estates', clientId: '3' },
  { id: '302', name: 'Oceanview Villas', clientId: '3' },
];

let instructions: Instruction[] = [
  {
    id: '1',
    clientId: '1',
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
    photo: {
      url: 'https://picsum.photos/seed/instruction1/600/400',
      takenAt: new Date('2023-10-15T09:02:15Z').toISOString(),
    },
  },
  {
    id: '2',
    clientId: '2',
    projectId: '201',
    originalText:
      'The structural steel for the Riverside Bridge needs to be inspected for any signs of corrosion. This needs to be done before the concrete pouring next week. Also, arrange for the delivery of the pre-cast concrete slabs for the pedestrian walkway.',
    summary:
      'Before next week\'s concrete pour, inspect the Riverside Bridge\'s structural steel for corrosion. Additionally, schedule the delivery of pre-cast concrete slabs for the pedestrian walkway.',
    actionItems: [
      'Inspect structural steel of the Riverside Bridge for corrosion.',
      'Complete inspection before the concrete pouring next week.',
      'Arrange delivery of pre-cast concrete slabs for the pedestrian walkway.',
    ],
    createdAt: new Date('2023-10-18T14:30:00Z').toISOString(),
    recipients: ['engineer@example.com'],
  },
  {
    id: '3',
    clientId: '3',
    projectId: '301',
    originalText:
      'For Hilltop Estates, we need to finalize the landscaping plan for lots 10 through 15. The client wants more native plants included. Please submit a revised plan by Monday. Also, confirm the plumbing inspection schedule for Phase 2.',
    summary:
      'Revise the landscaping plan for lots 10-15 at Hilltop Estates to include more native plants, submitting the new plan by Monday. Also, confirm the Phase 2 plumbing inspection schedule.',
    actionItems: [
      'Finalize the landscaping plan for lots 10 through 15.',
      'Include more native plants in the revised plan.',
      'Submit the revised landscaping plan by Monday.',
      'Confirm the plumbing inspection schedule for Phase 2.',
    ],
    createdAt: new Date('2023-10-20T11:00:00Z').toISOString(),
  },
];

let cleanUpNotices: CleanUpNotice[] = [
    {
        id: 'cl1',
        clientId: '1',
        projectId: '101',
        description: 'Debris from drywall installation on floor 12 needs to be cleared by end of day. Please ensure all hallways are clear for inspection tomorrow morning.',
        createdAt: new Date('2023-10-22T16:00:00Z').toISOString(),
        recipients: ['cleanup-crew@example.com'],
        photo: {
          url: 'https://picsum.photos/seed/cleanup1/600/400',
          takenAt: new Date('2023-10-22T16:01:30Z').toISOString(),
        },
    }
];

let distributionUsers: DistributionUser[] = [
  { id: 'user-1', name: 'Project Manager', email: 'pm@example.com' },
  { id: 'user-2', name: 'Site Supervisor', email: 'supervisor@example.com' },
  { id: 'user-3', name: 'Lead Engineer', email: 'engineer@example.com' },
];

let subContractors: SubContractor[] = [
    { id: 'sub-1', name: 'General Cleaners LLC', email: 'contact@generalcleaners.com' },
    { id: 'sub-2', name: 'Site-Ready Services', email: 'ops@siteready.com' },
];

// Simulate a database with async functions
export async function getClients(): Promise<Client[]> {
  noStore();
  return new Promise((resolve) => setTimeout(() => resolve(clients), 100));
}

export async function getProjects(clientId?: string): Promise<Project[]> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      if (clientId) {
        resolve(projects.filter((p) => p.clientId === clientId));
      } else {
        resolve(projects);
      }
    }, 100);
  });
}

export async function getInstructions({
  clientId,
  projectId,
}: {
  clientId?: string;
  projectId?: string;
}): Promise<Instruction[]> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      let filteredInstructions = [...instructions];
      if (clientId) {
        filteredInstructions = filteredInstructions.filter(
          (i) => i.clientId === clientId
        );
      }
      if (projectId) {
        filteredInstructions = filteredInstructions.filter(
          (i) => i.projectId === projectId
        );
      }
      resolve(filteredInstructions.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, 100);
  });
}

export async function createInstruction(instructionData: Omit<Instruction, 'id' | 'createdAt'>): Promise<Instruction> {
    noStore();
    return new Promise((resolve) => {
        setTimeout(() => {
            const newInstruction: Instruction = {
                ...instructionData,
                id: (instructions.length + 1).toString(),
                createdAt: new Date().toISOString(),
            };
            instructions = [newInstruction, ...instructions];
            resolve(newInstruction);
        }, 500);
    });
}

export async function getDistributionUsers(): Promise<DistributionUser[]> {
  noStore();
  return new Promise((resolve) => setTimeout(() => resolve(distributionUsers), 100));
}

export async function addDistributionUser(userData: Omit<DistributionUser, 'id'>): Promise<DistributionUser> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      const newUser: DistributionUser = {
        ...userData,
        id: `user-${Date.now()}`,
      };
      distributionUsers.push(newUser);
      resolve(newUser);
    }, 100);
  });
}

export async function removeDistributionUser(userId: string): Promise<{ success: boolean }> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      const initialLength = distributionUsers.length;
      distributionUsers = distributionUsers.filter((user) => user.id !== userId);
      resolve({ success: distributionUsers.length < initialLength });
    }, 100);
  });
}


export async function getCleanUpNotices({
  clientId,
  projectId,
}: {
  clientId?: string;
  projectId?: string;
}): Promise<CleanUpNotice[]> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      let filteredNotices = [...cleanUpNotices];
      if (clientId) {
        filteredNotices = filteredNotices.filter(
          (i) => i.clientId === clientId
        );
      }
      if (projectId) {
        filteredNotices = filteredNotices.filter(
          (i) => i.projectId === projectId
        );
      }
      resolve(filteredNotices.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, 100);
  });
}

export async function createCleanUpNotice(noticeData: Omit<CleanUpNotice, 'id' | 'createdAt'>): Promise<CleanUpNotice> {
    noStore();
    return new Promise((resolve) => {
        setTimeout(() => {
            const newNotice: CleanUpNotice = {
                ...noticeData,
                id: `cl${cleanUpNotices.length + 1}`,
                createdAt: new Date().toISOString(),
            };
            cleanUpNotices = [newNotice, ...cleanUpNotices];
            resolve(newNotice);
        }, 500);
    });
}

export async function getSubContractors(): Promise<SubContractor[]> {
  noStore();
  return new Promise((resolve) => setTimeout(() => resolve(subContractors), 100));
}

export async function addSubContractor(userData: Omit<SubContractor, 'id'>): Promise<SubContractor> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      const newUser: SubContractor = {
        ...userData,
        id: `sub-${Date.now()}`,
      };
      subContractors.push(newUser);
      resolve(newUser);
    }, 100);
  });
}

export async function removeSubContractor(userId: string): Promise<{ success: boolean }> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      const initialLength = subContractors.length;
      subContractors = subContractors.filter((user) => user.id !== userId);
      resolve({ success: subContractors.length < initialLength });
    }, 100);
  });
}
