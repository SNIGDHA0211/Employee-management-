
export enum UserRole {
  MD = 'MD',
  ADMIN = 'ADMIN',
  HR = 'HR',
  TEAM_LEADER = 'TEAM_LEADER',
  EMPLOYEE = 'EMPLOYEE',
  INTERN = 'INTERN',
}

// ===== Admin Ops (Assets / Bills / Expenses / Vendors) =====
export type StatusType = 'Pending' | 'Inprocess' | 'Completed';

export type BillCategory =
  | 'Light Bills'
  | 'Rent'
  | 'Housekeeping'
  | 'Tea Bills'
  | 'WiFi Bills';

export interface Bill {
  id: string;
  category: BillCategory;
  amount: number;
  recipient: string;
  date: string;
  status: StatusType;
}

export type AssetType = 'Hardware' | 'Software';

export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  author: string;
  code: string;
  status: StatusType;
  createdAt: string; // YYYY-MM-DD
}



export interface Expense {
  id: string;
  title: string;
  amount: number;
  note: string;
  paidDate: string; // YYYY-MM-DD
  status: StatusType;
}

export interface Vendor {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  altPhone?: string;
  gstNumber: string;
  status: StatusType;
}

// Helper function to format role for display - uses backend case (HR, MD, TeamLead, Employee, Intern)
export const formatRoleForDisplay = (role: UserRole | string): string => {
  const roleStr = String(role).trim();
  const upper = roleStr.toUpperCase().replace(/[_\s]/g, '');
  switch (upper) {
    case 'MD':
      return 'MD';
    case 'ADMIN':
      return 'Admin';
    case 'HR':
      return 'HR';
    case 'TEAMLEAD':
    case 'TEAMLEADER':
      return 'TeamLead';
    case 'EMPLOYEE':
      return 'Employee';
    case 'INTERN':
      return 'Intern';
    default:
      return roleStr;
  }
};

export enum TaskType {
  SOS = 'SOS',
  ONE_DAY = '1_DAY',
  TEN_DAYS = '10_DAYS',
  MONTHLY = 'MONTHLY',
  Quaterly = 'Quaterly',
  GROUP = 'GROUP',
  INDIVIDUAL = 'INDIVIDUAL',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}

export interface User {
  id: string;
  Employee_id?: string; // Backend employee ID (may differ from id, preserves leading zeros)
  name: string;
  avatar: string;
  role: UserRole;
  designation: string;
  joinDate: string;
  birthDate: string; // ISO date string YYYY-MM-DD
  teamId?: string;
  email: string;
  status: 'PRESENT' | 'ABSENT' | 'ON_LEAVE' | 'ON_TOUR';
  leaveBalance: number;
  score: number; // Gamification score
  password?: string; // New field for authentication
  branch?: 'TECH' | 'FARM_CORE' | 'FARM_TECH' | 'INFRA_CORE' | 'INFRA_TECH'; // Granular branches
  // Human-readable tenure label from backend, e.g. "1 years 27 days"
  numberOfDaysFromJoining?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  assigneeId: string; // Primary owner
  assigneeIds?: string[]; // For Group tasks
  reporterId: string; // Who assigned it
  createdByName?: string; // Name from API created_by (e.g. viewAssignedTasks), shown for MD
  projectId?: string;
  dueDate: string;
  createdAt: string;
  comments: Comment[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface Comment {
  id: string;
  userId: string;
  text: string;
  timestamp: string;
  attachments?: string[];
}

export interface Project {
  id: string;
  title: string;
  branch: string;
  description: string;
  managerId: string; // Usually MD or TL
  memberIds: string[];
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
  progress: number; // 0-100
}

export interface Message {
  id: string;
  senderId: string;
  channelId: string; // Could be 'general', group ID, or dm-ID
  content: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'EMOJI';
  timestamp: string;
}

export interface ChatGroup {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  isPrivate: boolean;
  totalParticipant?: number; // From API loadChats Group_info
  groupId?: string | number; // From API, used as chat_id for messaging
}

export interface AttendanceRecord {
  userId: string;
  date: string; // YYYY-MM-DD
  inTime: string; // HH:MM
  outTime?: string; // HH:MM
  totalHours?: string; // HH:mm
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'WEEKEND';
}

export interface Tour {
  id: string;
  userId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  purpose: string;
  location: string;
}
