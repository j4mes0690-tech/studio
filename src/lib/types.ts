
export type Client = {
  id: string;
  name: string;
  avatarUrl: string;
};

export type Project = {
  id: string;
  name:string;
  clientId: string;
};

export type Photo = {
  url: string;
  takenAt: string;
};

export type Instruction = {
  id: string;
  clientId: string;
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
  clientId: string;
  projectId: string;
  description: string;
  createdAt: string;
  photos?: Photo[];
  recipients?: string[];
};

export type SnaggingItem = {
  id: string;
  clientId: string;
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
  clientId: string;
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
