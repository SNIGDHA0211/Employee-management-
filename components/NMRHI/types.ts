export type ProgressStatus = 'pending' | 'in-progress' | 'completed';

export interface DailyLog {
  id: string;
  date: string;
  note: string;
  status: ProgressStatus;
}

export interface PointProgress {
  unlocked: boolean;
  logs: DailyLog[];
  status?: ProgressStatus;
  notes?: string;
}

export interface ActionablePoint {
  id: number;
  purpose: string;
  grp_id?: 'D1' | 'D2' | 'D3';
}

export interface StrategySection {
  title: string;
  points: ActionablePoint[];
}

export interface StrategyCategory {
  id: string;
  name: string;
  fullName: string;
  description: string;
  sections: StrategySection[];
}

export interface AppProgress {
  [key: string]: PointProgress;
}
