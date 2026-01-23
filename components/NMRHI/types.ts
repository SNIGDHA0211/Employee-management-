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

export interface StrategySection {
  title: string;
  points: string[];
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
