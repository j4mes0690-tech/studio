
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

export type Instruction = {
  id: string;
  clientId: string;
  projectId: string;
  originalText: string;
  summary: string;
  actionItems: string[];
  createdAt: string;
  photo?: {
    url: string;
    takenAt: string;
  };
};
