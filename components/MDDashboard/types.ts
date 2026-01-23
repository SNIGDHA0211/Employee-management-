export interface AIInsight {
  category: string;
  message: string;
  impact: 'High' | 'Medium' | 'Low';
}

export interface KPIData {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
  icon?: React.ReactNode;
}

export interface ProjectData {
  id: string;
  name: string;
  progress: number;
  status: 'On Track' | 'Delayed' | 'Critical';
  deadline: string;
  trackingHistory?: TrackingUpdate[];
}

export interface TrackingUpdate {
  label: string;
  date: string;
  person: string;
  description: string;
  status: 'completed' | 'active' | 'upcoming';
}

export interface WorkforceData {
  name: string;
  value: number;
}

export interface AssetData {
  name: string;
  value: number;
}

export interface RevenueChartData {
  name: string;
  value: number;
  secondaryValue: number;
}

export interface DashboardData {
  kpis: KPIData[];
  projects: ProjectData[];
  workforce: WorkforceData[];
  assets: AssetData[];
}
