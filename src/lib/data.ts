
'use server';

import type { Project, Instruction, DistributionUser, CleanUpNotice, SubContractor, SnaggingItem, InformationRequest, Photo } from './types';
import { unstable_noStore as noStore } from 'next/cache';

// Widen the global type to include our in-memory data
declare global {
  var projects: Project[];
  var instructions: Instruction[];
  var cleanUpNotices: CleanUpNotice[];
  var snaggingLists: SnaggingItem[];
  var informationRequests: InformationRequest[];
  var distributionUsers: DistributionUser[];
  var subContractors: SubContractor[];
}

const g: {
  projects: Project[];
  instructions: Instruction[];
  cleanUpNotices: CleanUpNotice[];
  snaggingLists: SnaggingItem[];
  informationRequests: InformationRequest[];
  distributionUsers: DistributionUser[];
  subContractors: SubContractor[];
} = global as any;


if (!g.projects) {
  g.projects = [
    { id: '101', name: 'Downtown Tower' },
    { id: '102', name: 'Suburban Mall' },
    { id: '201', name: 'Riverside Bridge' },
    { id: '301', name: 'Hilltop Estates' },
    { id: '302', name: 'Oceanview Villas' },
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
    {
      id: '2',
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
}

if (!g.cleanUpNotices) {
    g.cleanUpNotices = [
        {
            id: 'cl1',
            projectId: '101',
            description: 'Debris from drywall installation on floor 12 needs to be cleared by end of day. Please ensure all hallways are clear for inspection tomorrow morning.',
            createdAt: new Date('2023-10-22T16:00:00Z').toISOString(),
            recipients: ['cleanup-crew@example.com'],
            photos: [{
              url: 'https://picsum.photos/seed/cleanup1/600/400',
              takenAt: new Date('2023-10-22T16:01:30Z').toISOString(),
            }],
        }
    ];
}

if (!g.snaggingLists) {
    g.snaggingLists = [
        {
            id: 'snag1',
            projectId: '101',
            description: 'Paint on the west wall of apartment 1201 is chipped. Needs repainting.',
            createdAt: new Date('2023-10-25T10:00:00Z').toISOString(),
            photos: [{
              url: 'https://picsum.photos/seed/snag1/600/400',
              takenAt: new Date('2023-10-25T10:01:00Z').toISOString(),
            }],
        },
        {
            id: 'snag2',
            projectId: '302',
            description: 'Leaky faucet in the master bathroom of Villa #5.',
            createdAt: new Date('2023-10-26T11:30:00Z').toISOString(),
        }
    ];
}

if (!g.informationRequests) {
    g.informationRequests = [
        {
            id: 'ir1',
            projectId: '101',
            description: 'Client needs floor plans for level 5.',
            assignedTo: ['engineer@example.com'],
            createdAt: new Date('2023-10-28T10:00:00Z').toISOString(),
            requiredBy: new Date('2023-11-05T17:00:00Z').toISOString(),
            status: 'open',
            messages: [],
        }
    ];
}

if (!g.distributionUsers) {
  g.distributionUsers = [
    { id: 'user-1', name: 'Project Manager', email: 'pm@example.com' },
    { id: 'user-2', name: 'Site Supervisor', email: 'supervisor@example.com' },
    { id: 'user-3', name: 'Lead Engineer', email: 'engineer@example.com' },
  ];
}

if (!g.subContractors) {
  g.subContractors = [
      { id: 'sub-1', name: 'General Cleaners LLC', email: 'contact@generalcleaners.com' },
      { id: 'sub-2', name: 'Site-Ready Services', email: 'ops@siteready.com' },
  ];
}


// Simulate a database with async functions
export async function getProjects(): Promise<Project[]> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
        resolve(g.projects);
    }, 100);
  });
}

export async function getInstructions({
  projectId,
}: {
  projectId?: string;
}): Promise<Instruction[]> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      let filteredInstructions = [...g.instructions];
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
                id: (g.instructions.length + 1).toString(),
                createdAt: new Date().toISOString(),
            };
            g.instructions = [newInstruction, ...g.instructions];
            resolve(newInstruction);
        }, 500);
    });
}

export async function getDistributionUsers(): Promise<DistributionUser[]> {
  noStore();
  return new Promise((resolve) => setTimeout(() => resolve(g.distributionUsers), 100));
}

export async function addDistributionUser(userData: Omit<DistributionUser, 'id'>): Promise<DistributionUser> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      const newUser: DistributionUser = {
        ...userData,
        id: `user-${Date.now()}`,
      };
      g.distributionUsers.push(newUser);
      resolve(newUser);
    }, 100);
  });
}

export async function removeDistributionUser(userId: string): Promise<{ success: boolean }> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      const initialLength = g.distributionUsers.length;
      g.distributionUsers = g.distributionUsers.filter((user) => user.id !== userId);
      resolve({ success: g.distributionUsers.length < initialLength });
    }, 100);
  });
}

export async function updateDistributionUser(userData: DistributionUser): Promise<DistributionUser> {
    noStore();
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = g.distributionUsers.findIndex(u => u.id === userData.id);
        if (index !== -1) {
          g.distributionUsers[index] = userData;
          resolve(userData);
        } else {
          reject(new Error('User not found.'));
        }
      }, 100);
    });
  }


export async function getCleanUpNotices({
  projectId,
}: {
  projectId?: string;
}): Promise<CleanUpNotice[]> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      let filteredNotices = [...g.cleanUpNotices];
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
                id: `cl${g.cleanUpNotices.length + 1}`,
                createdAt: new Date().toISOString(),
            };
            g.cleanUpNotices = [newNotice, ...g.cleanUpNotices];
            resolve(newNotice);
        }, 500);
    });
}

export async function getSubContractors(): Promise<SubContractor[]> {
  noStore();
  return new Promise((resolve) => setTimeout(() => resolve(g.subContractors), 100));
}

export async function addSubContractor(userData: Omit<SubContractor, 'id'>): Promise<SubContractor> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      const newUser: SubContractor = {
        ...userData,
        id: `sub-${Date.now()}`,
      };
      g.subContractors.push(newUser);
      resolve(newUser);
    }, 100);
  });
}

export async function removeSubContractor(userId: string): Promise<{ success: boolean }> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      const initialLength = g.subContractors.length;
      g.subContractors = g.subContractors.filter((user) => user.id !== userId);
      resolve({ success: g.subContractors.length < initialLength });
    }, 100);
  });
}

export async function updateSubContractor(subContractorData: SubContractor): Promise<SubContractor> {
    noStore();
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const index = g.subContractors.findIndex(sc => sc.id === subContractorData.id);
        if (index !== -1) {
          g.subContractors[index] = subContractorData;
          resolve(subContractorData);
        } else {
          reject(new Error('Sub-contractor not found.'));
        }
      }, 100);
    });
  }

export async function getSnaggingLists({
  projectId,
}: {
  projectId?: string;
}): Promise<SnaggingItem[]> {
  noStore();
  return new Promise((resolve) => {
    setTimeout(() => {
      let filteredItems = [...g.snaggingLists];
      if (projectId) {
        filteredItems = filteredItems.filter(
          (i) => i.projectId === projectId
        );
      }
      resolve(filteredItems.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, 100);
  });
}

export async function createSnaggingItem(itemData: Omit<SnaggingItem, 'id' | 'createdAt'>): Promise<SnaggingItem> {
    noStore();
    return new Promise((resolve) => {
        setTimeout(() => {
            const newItem: SnaggingItem = {
                ...itemData,
                id: `snag${g.snaggingLists.length + 1}`,
                createdAt: new Date().toISOString(),
            };
            g.snaggingLists = [newItem, ...g.snaggingLists];
            resolve(newItem);
        }, 500);
    });
}

export async function updateSnaggingItem(itemData: SnaggingItem): Promise<SnaggingItem> {
    noStore();
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const index = g.snaggingLists.findIndex(item => item.id === itemData.id);
            if (index !== -1) {
                g.snaggingLists[index] = itemData;
                resolve(itemData);
            } else {
                reject(new Error('Snagging item not found'));
            }
        }, 500);
    });
}


export async function getInformationRequests({
    projectId,
  }: {
    projectId?: string;
  }): Promise<InformationRequest[]> {
    noStore();
    return new Promise((resolve) => {
      setTimeout(() => {
        let filteredItems = [...g.informationRequests];
        if (projectId) {
          filteredItems = filteredItems.filter(
            (i) => i.projectId === projectId
          );
        }
        resolve(filteredItems.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }, 100);
    });
  }
  
  export async function createInformationRequest(itemData: Omit<InformationRequest, 'id' | 'createdAt'>): Promise<InformationRequest> {
      noStore();
      return new Promise((resolve) => {
          setTimeout(() => {
              const newItem: InformationRequest = {
                  ...itemData,
                  id: `ir${g.informationRequests.length + 1}`,
                  createdAt: new Date().toISOString(),
              };
              g.informationRequests = [newItem, ...g.informationRequests];
              resolve(newItem);
          }, 500);
      });
  }

  export async function updateInformationRequest(itemData: InformationRequest): Promise<InformationRequest> {
    noStore();
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const index = g.informationRequests.findIndex(item => item.id === itemData.id);
            if (index !== -1) {
                g.informationRequests[index] = itemData;
                resolve(itemData);
            } else {
                reject(new Error('Information request not found'));
            }
        }, 500);
    });
}

export async function deleteInformationRequest(id: string): Promise<{ success: boolean }> {
    noStore();
    return new Promise((resolve) => {
        setTimeout(() => {
            const initialLength = g.informationRequests.length;
            g.informationRequests = g.informationRequests.filter(item => item.id !== id);
            resolve({ success: g.informationRequests.length < initialLength });
        }, 500);
    });
}
