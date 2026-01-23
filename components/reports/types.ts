export enum Department {
  SALES = 'Sales',
  MARKETING = 'Marketing',
  PRODUCTION = 'Production',
  VIGIL = 'Vigil',
  HR = 'HR',
  R_AND_D = 'R&D',
  NPC = 'NPC',
  BUSINESS_STRATEGY = 'Business Strategy',
  ACCOUNT_FINANCE = 'Account & Finance',
  PURCHASE = 'Purchase',
  LEGAL = 'Legal',
}

export type ViewType = 'Review' | 'Implementation' | 'SalesOps';

export interface MeetingConfig {
  head: string;
  subMeetingHead?: string;
  subHeads: {
    d1: string;
    d2: string;
    d3: string;
  };
}

export interface ReviewRow {
  id: string;
  col1: string; // Date
  col2: string; // D1 content
  col3: string; // D2 content
  col4: string; // D3 content
  status?: 'PENDING' | 'INPROCESS' | 'COMPLETED' | 'Completed'; // Support both formats
  entry_id?: number; // Backend entry ID
  tableType?: 'D1' | 'D2' | 'D3'; // Track which table this row belongs to
}

export interface ImplementationRow {
  id: string;
  no: string;
  action: string;
  deadline: string;
  assignedHelp: string;
  status: string;
  group: 'D1' | 'D2' | 'D3';
  entry_id?: number; // Backend entry ID for status changes
}

export interface SalesOpsRow {
  id: string;
  no: string;
  group: 'D1' | 'D2' | 'D3';
  sale: string;
  calls: string;
  trial: string;
  demand: string;
  oldTargeted: string;
  newAcquired: string;
  newPitching: string;
  cpRatio: string;
  leadIn: string;
  qualify: string;
  demo: string;
  quotation: string;
  closing: string;
  convRate: string;
  status?: 'PENDING' | 'INPROCESS' | 'Completed';
  entry_id?: number; // Backend entry ID for status changes
}
