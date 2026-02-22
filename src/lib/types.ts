export type Area = {
  id: string;
  name: string;
};

export type Project = {
  id: string;
  name:string;
  areas?: Area[];
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

export type SnaggingListItem = {
  id: string;
  description: string;
  status: 'open' | 'closed';
  photos?: Photo[];
};

export type SnaggingItem = {
  id: string;
  projectId: string;
  areaId?: string;
  title: string;
  description?: string;
  createdAt: string;
  photos?: Photo[];
  items: SnaggingListItem[];
};

export type ChatMessage = {
  id: string;
  sender: string;
  senderEmail: string;
  message: string;
  createdAt: string;
};

export type InformationRequest = {
  id: string;
  projectId: string;
  description: string;
  assignedTo: string[];
  raisedBy: string;
  createdAt: string;
  photos?: Photo[];
  requiredBy?: string;
  status: 'open' | 'closed';
  messages: ChatMessage[];
  dismissedBy?: string[];
};

export type UserPermissions = {
  canManageUsers: boolean;
  canManageSubcontractors: boolean;
  canManageProjects: boolean;
  canManageChecklists: boolean;
};

export type DistributionUser = {
  id: string;
  name: string;
  email: string;
  password?: string;
  permissions?: UserPermissions;
};

export type SubContractor = {
  id: string;
  name: string;
  email: string;
};

export type ChecklistItemStatus = 'pending' | 'yes' | 'no' | 'na';

export type ChecklistItem = {
  id: string;
  text: string;
  status: ChecklistItemStatus;
  comment?: string;
};

export type QualityChecklist = {
  id: string;
  projectId?: string;
  title: string;
  trade: string;
  createdAt: string;
  items: ChecklistItem[];
  areaId?: string;
  recipients?: string[];
  isTemplate?: boolean;
};
