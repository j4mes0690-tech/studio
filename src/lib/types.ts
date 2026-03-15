export type Planner = {
  id: string;
  name: string;
  archived?: boolean;
};

export type Project = {
  id: string;
  name: string;
  address?: string;
  siteManager?: string;
  siteManagerPhone?: string;
  planners?: Planner[];
  areas?: Planner[]; // Keep for backward compatibility with existing data
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
  distributedAt?: string;
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
  dismissedBy?: string[];
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

export type SnaggingListItemStatus = 'open' | 'provisionally-complete' | 'closed';

export type SnaggingListItem = {
  id: string;
  description: string;
  status: SnaggingListItemStatus;
  photos?: Photo[];
  completionPhotos?: Photo[];
  subContractorId?: string;
  subContractorComment?: string;
  provisionallyCompletedAt?: string;
  closedAt?: string;
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

export type SnaggingHistoryRecord = {
  id: string;
  timestamp: string;
  updatedBy: string;
  items: SnaggingListItem[];
  totalCount: number;
  closedCount: number;
  summary: string;
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
  irsItemId?: string;
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
  canManageTraining: boolean;
  canManageIRS: boolean;
  hasFullVisibility: boolean;
  // Module Access
  accessMaterials: boolean;
  accessPlant: boolean;
  accessVariations: boolean;
  accessPermits: boolean;
  accessTraining: boolean;
  accessClientInstructions: boolean;
  accessSiteInstructions: boolean;
  accessCleanupNotices: boolean;
  accessSnagging: boolean;
  accessQualityControl: boolean;
  accessInfoRequests: boolean;
  accessPaymentNotices: boolean;
  accessSubContractOrders: boolean;
  accessIRS: boolean;
  accessPlanner: boolean;
  accessProcurement: boolean;
  // Read Only Flags
  materialsReadOnly?: boolean;
  plantReadOnly?: boolean;
  variationsReadOnly?: boolean;
  permitsReadOnly?: boolean;
  trainingReadOnly?: boolean;
  clientInstructionsReadOnly?: boolean;
  siteInstructionsReadOnly?: boolean;
  cleanupNoticesReadOnly?: boolean;
  snaggingReadOnly?: boolean;
  qualityControlReadOnly?: boolean;
  infoRequestsReadOnly?: boolean;
  paymentNoticesReadOnly?: boolean;
  subContractOrdersReadOnly?: boolean;
  irsReadOnly?: boolean;
  plannerReadOnly?: boolean;
  procurementReadOnly?: boolean;
};

export type DistributionUser = {
  id: string;
  name: string;
  email: string;
  password?: string;
  userType?: 'internal' | 'partner';
  subContractorId?: string;
  requirePasswordChange?: boolean;
  permissions?: UserPermissions;
};

export type Invitation = {
  id: string;
  email: string;
  name: string;
  userType: 'internal' | 'partner';
  projectId?: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: string;
  expiresAt: string;
  createdByEmail: string;
};

export type SubContractor = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  isSubContractor?: boolean;
  isDesigner?: boolean;
  isSupplier?: boolean;
  isPlantSupplier?: boolean;
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

export type Trade = {
  id: string;
  name: string;
};

export type SystemSettings = {
  id: string;
  logoUrl?: string;
  companyName?: string;
  companyAddress?: string;
};

// --- PLANNER MODULE TYPES ---

export type PlannerTaskStatus = 'pending' | 'in-progress' | 'completed';

export type PlannerTask = {
  id: string;
  projectId: string;
  plannerId: string;
  areaId?: string; // Keep for backward compatibility
  title: string;
  subcontractorId: string;
  customSubcontractorName?: string | null;
  tradeId?: string; // Keep for backward compatibility
  startDate: string; // Current Forecast ISO Date
  durationDays: number;
  originalStartDate: string; // Initial baseline
  originalDurationDays: number; // Initial baseline
  actualCompletionDate?: string | null; // Final actual date
  predecessorIds: string[];
  status: PlannerTaskStatus;
  createdAt: string;
  photos?: Photo[];
};

// --- IRS MODULE TYPES ---

export type IRSItemStatus = 'open' | 'provided' | 'overdue' | 'escalated';

export type IRSItem = {
  id: string;
  reference: string;
  projectId: string;
  title: string;
  description: string;
  assignedToEmail: string;
  requiredByDate: string;
  notificationLeadDays: number;
  status: IRSItemStatus;
  escalatedRfiId?: string | null;
  createdAt: string;
  createdByEmail: string;
};

// --- PROCUREMENT MODULE TYPES ---

export type ProcurementStatus = 'planned' | 'enquiry' | 'tender-returned' | 'complete' | 'on-site';

export type ProcurementItem = {
  id: string;
  reference: string;
  projectId: string;
  trade: string;
  subcontractorId: string | null;
  subcontractorName: string | null;
  warrantyRequired: boolean;
  targetEnquiryDate: string;
  tenderPeriodWeeks: number;
  actualEnquiryDate: string | null;
  tenderReturnDate: string | null;
  latestDateForOrder: string | null;
  leadInPeriodWeeks: number;
  startOnSiteDate: string | null;
  orderPlacedDate: string | null;
  comments: string;
  status: ProcurementStatus;
  createdAt: string;
};

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

export type TemplateFieldType = 'text' | 'textarea' | 'checkbox' | 'yes-no-na';

export type TemplateField = {
  id: string;
  label: string;
  type: TemplateFieldType;
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

// --- PLANT MODULE TYPES ---

export type PlantStatus = 'draft' | 'scheduled' | 'on-hire' | 'off-hired';
export type PlantRateUnit = 'daily' | 'weekly' | 'monthly' | 'item';

export type PlantOrderItem = {
  id: string;
  description: string;
  onHireDate: string;
  anticipatedOffHireDate: string;
  actualOffHireDate: string | null;
  rate: number;
  rateUnit: PlantRateUnit;
  status: PlantStatus;
  estimatedCost: number;
};

export type PlantOrder = {
  id: string;
  reference: string;
  projectId: string;
  supplierId: string;
  supplierName: string;
  description: string;
  items: PlantOrderItem[];
  totalAmount: number;
  status: PlantStatus; // Summary status (e.g. 'on-hire' if any item is on hire)
  createdAt: string;
  createdByEmail: string;
  notes?: string;
};

// --- VARIATIONS MODULE TYPES ---

export type VariationItemType = 'addition' | 'omission';

export type VariationItem = {
  id: string;
  description: string;
  type: VariationItemType;
  quantity: number;
  unit: string;
  rate: number;
  total: number;
};

export type VariationStatus = 'draft' | 'pending' | 'agreed' | 'rejected';

export type Variation = {
  id: string;
  reference: string;
  projectId: string;
  title: string;
  description: string;
  clientInstructionIds?: string[] | null;
  siteInstructionIds?: string[] | null;
  items: VariationItem[];
  ohpPercentage: number;
  totalAmount: number; // Final net value including OHP
  status: VariationStatus;
  createdAt: string;
  createdByEmail: string;
  notes?: string;
};

// --- TRAINING MODULE TYPES ---

export type TrainingRecordStatus = 'active' | 'expiring' | 'expired';

export type TrainingRecord = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseName: string;
  certificateNumber?: string;
  issueDate: string;
  expiryDate: string;
  photos?: Photo[];
  createdAt: string;
};

export type TrainingNeedStatus = 'requested' | 'booked' | 'completed';

export type TrainingNeed = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseName: string;
  priority: 'low' | 'medium' | 'high';
  status: TrainingNeedStatus;
  notes?: string;
  requestedDate: string;
  bookedDate?: string | null;
};

// --- PAYMENT NOTICE MODULE TYPES ---

export type PaymentNoticeStatus = 'pending' | 'certified' | 'invoiced' | 'processed';

export type PaymentNotice = {
  id: string;
  projectId: string;
  period: string; // Format: YYYY-MM
  subcontractorId: string;
  subcontractorName: string;
  isValuationDue: boolean;
  applicationReceivedDate: string | null;
  certificateIssuedDate: string | null;
  invoiceReceivedDate: string | null;
  invoiceUploadedDate: string | null;
  status: PaymentNoticeStatus;
  createdAt: string;
  updatedAt: string;
};

export type ValuationPeriod = {
  id: string;
  value: string; // YYYY-MM
  label: string; // Month Year
  createdAt: string;
};

// --- SUB CONTRACT ORDER MODULE TYPES ---

export type SubContractOrderStatus = 'draft' | 'pending-approval' | 'docusign' | 'completed';

export type SubContractOrder = {
  id: string;
  reference: string;
  projectId: string;
  subcontractorId: string;
  subcontractorName: string;
  description: string;
  draftedDate: string | null;
  sentForApprovalDate: string | null;
  loadedOnDocuSignDate: string | null;
  signedDate: string | null;
  status: SubContractOrderStatus;
  createdAt: string;
};
