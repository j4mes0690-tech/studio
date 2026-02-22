

export type Project = {
  id: string;
  name:string;
};

export type Photo = {
  url: string;
  takenAt: string;
};

export type Instruction = {
  id: string;
  projectId: string;
  originalText: string;
  summary: string;
  actionItems: string[];
  createdAt: string;
  photos?: Photo[];
  recipients?: string[];
};

export type CleanUpNotice = {
  id: string;
  projectId: string;
  description: string;
  createdAt: string;
  photos?: Photo[];
  recipients?: string[];
};

export type SnaggingItem = {
  id: string;
  projectId: string;
  description: string;
  createdAt: string;
  photos?: Photo[];
};

export type ChatMessage = {
  id: string;
  sender: string;
  message: string;
  createdAt: string;
};

export type InformationRequest = {
  id: string;
  projectId: string;
  description: string;
  assignedTo: string[];
  createdAt: string;
  photos?: Photo[];
  requiredBy?: string;
  status: 'open' | 'closed';
  messages: ChatMessage[];
};

export type DistributionUser = {
  id: string;
  name: string;
  email: string;
};

export type SubContractor = {
  id: string;
  name: string;
  email: string;
};

export type ChecklistItem = {
  id: string;
  text: string;
  isCompleted: boolean;
};

export type QualityChecklist = {
  id: string;
  projectId: string;
  title: string;
  trade: string;
  createdAt: string;
  items: ChecklistItem[];
};
