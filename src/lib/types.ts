
export type Area = {
  id: string;
  name: string;
};

export type Project = {
  id: string;
  name: string;
  areas?: Area[];
  assignedUsers?: string[];
  assignedSubContractors?: string[];
};

export type Photo = {
  url: string;
  takenAt: string;
};

export type FileAttachment = {
  name: string;
  url: string;
  type: string;
  size: number;
};

export type Instruction = {
  id: string;
  reference: string;
  projectId: string;
  clientInstructionId?: string;
  originalText: string;
  summary: string;
  actionItems: string[];
  createdAt: string;
  photos?: Photo[];
  files?: FileAttachment[];
  recipients?: string[];
  status?: 'draft' | 'issued';
};

export type ClientInstruction = {
  id: string;
  reference: string;
  projectId: string;
  originalText: string;
  summary: string;
  actionItems: string[];
  createdAt: string;
  photos?: Photo[];
  files?: FileAttachment[];
  recipients?: string[];
  messages?: ChatMessage[];
  status?: 'open' | 'accepted';
};

export type CleanUpNotice = {
  id: string;
  reference: string;
  projectId: string;
  description: string;
  createdAt: string;
  photos?: Photo[];
  recipients?: string[];
  status?: 'draft' | 'issued';
};

export type SnaggingListItem = {
  id: string;
  description: string;
  status: 'open' | 'closed';
  photos?: Photo[];
  completionPhotos?: Photo[];
  subContractorId?: string;
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
  photos?: Photo[];
  files?: FileAttachment[];
};

export type InformationRequest = {
  id: string;
  reference: string;
  projectId: string;
  clientInstructionId?: string;
  description: string;
  assignedTo: string[];
  raisedBy: string;
  createdAt: string;
  photos?: Photo[];
  files?: FileAttachment[];
  requiredBy?: string;
  status: 'draft' | 'open' | 'closed';
  messages: ChatMessage[];
  dismissedBy?: string[];
};

export type UserPermissions = {
  canManageUsers: boolean;
  canManageSubcontractors: boolean;
  canManageProjects: boolean;
  canManageChecklists: boolean;
  canManageMaterials: boolean;
  canManagePermitTemplates: boolean;
  hasFullVisibility: boolean;
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
  isSubContractor?: boolean;
  isDesigner?: boolean;
  isSupplier?: boolean;
};

export type ChecklistItemStatus = 'pending' | 'yes' | 'no' | 'na';

export type ChecklistItem = {
  id: string;
  text: string;
  status: ChecklistItemStatus;
  comment?: string;
  photos?: Photo[];
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
  photos?: Photo[];
};

// --- PROCUREMENT MODULE TYPES ---

export type Supplier = {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone?: string;
  address?: string;
};

export type Material = {
  id: string;
  name: string;
  unit: string;
  defaultPrice?: number;
};

export type PurchaseOrderItem = {
  id: string;
  materialId?: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  deliveryDate?: string | null;
  total: number;
};

export type PurchaseOrder = {
  id: string;
  orderNumber: string;
  projectId: string;
  supplierId: string;
  supplierName: string;
  description: string;
  orderDate: string;
  deliveryDate?: string | null;
  items: PurchaseOrderItem[];
  totalAmount: number;
  status: 'draft' | 'issued' | 'received' | 'cancelled';
  notes?: string;
  createdAt: string;
  createdByEmail: string;
};

// --- PERMITS MODULE TYPES ---

export type PermitType = 'Hot Work' | 'Confined Space' | 'Excavation' | 'Lifting' | 'General';
export type PermitStatus = 'draft' | 'issued' | 'closed' | 'cancelled';

export type TemplateField = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'checkbox';
  value?: string | boolean;
};

export type TemplateSection = {
  id: string;
  title: string;
  fields: TemplateField[];
};

export type Permit = {
  id: string;
  reference: string;
  projectId: string;
  areaId?: string | null;
  type: PermitType;
  contractorId: string;
  contractorName: string;
  description: string;
  // AI-generated dynamic content
  sections: TemplateSection[];
  // Standard hazard/precaution fallbacks for non-templated permits
  hazards?: string;
  precautions?: string;
  validFrom: string;
  validTo: string;
  status: PermitStatus;
  createdAt: string;
  createdByEmail: string;
  photos?: Photo[];
  files?: FileAttachment[];
  closedAt?: string | null;
  closedByEmail?: string | null;
  closureNotes?: string | null;
};

export type PermitTemplate = {
  id: string;
  title: string;
  type: PermitType;
  description: string;
  sections: TemplateSection[];
  createdAt: string;
};
