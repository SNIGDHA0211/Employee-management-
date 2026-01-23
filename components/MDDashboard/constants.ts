import { KPIData, ProjectData, WorkforceData, AssetData, RevenueChartData } from './types';

export const KPI_DATA: { Overview: KPIData[]; Sales: KPIData[]; Marketing: KPIData[] } = {
  Overview: [
    { title: 'Total Revenue', value: '₹24.5Cr', change: '+12.5%', trend: 'up' },
    { title: 'Active Projects', value: '18', change: '+3', trend: 'up' },
    { title: 'Team Efficiency', value: '94.2%', change: '+2.1%', trend: 'up' },
    { title: 'Customer Satisfaction', value: '4.8/5', change: '+0.3', trend: 'up' },
  ],
  Sales: [
    { title: 'Monthly Sales', value: '₹4.2Cr', change: '+8.3%', trend: 'up' },
    { title: 'New Clients', value: '47', change: '+12', trend: 'up' },
    { title: 'Conversion Rate', value: '32%', change: '+5%', trend: 'up' },
    { title: 'Avg Deal Size', value: '₹8.9L', change: '+15%', trend: 'up' },
  ],
  Marketing: [
    { title: 'Lead Generation', value: '1,247', change: '+18%', trend: 'up' },
    { title: 'Campaign ROI', value: '340%', change: '+45%', trend: 'up' },
    { title: 'Brand Reach', value: '2.4M', change: '+22%', trend: 'up' },
    { title: 'Engagement Rate', value: '6.8%', change: '+1.2%', trend: 'up' },
  ],
};

export const REVENUE_CHART_DATA: RevenueChartData[] = [
  { name: 'Jan', value: 18, secondaryValue: 15 },
  { name: 'Feb', value: 22, secondaryValue: 18 },
  { name: 'Mar', value: 19, secondaryValue: 20 },
  { name: 'Apr', value: 28, secondaryValue: 22 },
  { name: 'May', value: 32, secondaryValue: 25 },
  { name: 'Jun', value: 35, secondaryValue: 28 },
  { name: 'Jul', value: 30, secondaryValue: 30 },
  { name: 'Aug', value: 38, secondaryValue: 32 },
  { name: 'Sep', value: 42, secondaryValue: 35 },
  { name: 'Oct', value: 45, secondaryValue: 38 },
  { name: 'Nov', value: 48, secondaryValue: 40 },
  { name: 'Dec', value: 52, secondaryValue: 45 },
];

export const WORKFORCE_DATA: WorkforceData[] = [
  { name: 'Engineering', value: 145 },
  { name: 'Sales', value: 89 },
  { name: 'Marketing', value: 56 },
  { name: 'Operations', value: 78 },
  { name: 'HR & Admin', value: 42 },
];

export const ASSETS_DATA: AssetData[] = [
  { name: 'Real Estate', value: 45 },
  { name: 'Equipment', value: 25 },
  { name: 'Vehicles', value: 15 },
  { name: 'Technology', value: 15 },
];

export const PROJECTS: ProjectData[] = [
  {
    id: '1',
    name: 'Product Launch Q1',
    progress: 85,
    status: 'On Track',
    deadline: '2026-03-15',
    trackingHistory: [
      { label: 'Project Initiated', date: 'Jan 5', person: 'Rahul Sharma', description: 'Project kickoff meeting completed. Team assembled and initial requirements gathered.', status: 'completed' },
      { label: 'Design Phase', date: 'Jan 20', person: 'Priya Patel', description: 'UI/UX designs finalized. Stakeholder approval received.', status: 'completed' },
      { label: 'Development Sprint 1', date: 'Feb 10', person: 'Amit Kumar', description: 'Core features implemented. 60% of backend completed.', status: 'completed' },
      { label: 'Testing & QA', date: 'Feb 25', person: 'Sneha Reddy', description: 'Currently in testing phase. Bug fixes in progress.', status: 'active' },
      { label: 'Final Review', date: 'Mar 10', person: 'Management', description: 'Pending final stakeholder review and approval.', status: 'upcoming' },
    ],
  },
  {
    id: '2',
    name: 'Infrastructure Upgrade',
    progress: 45,
    status: 'Delayed',
    deadline: '2026-02-28',
    trackingHistory: [
      { label: 'Planning', date: 'Dec 15', person: 'Vikram Singh', description: 'Infrastructure audit completed. Upgrade plan approved.', status: 'completed' },
      { label: 'Vendor Selection', date: 'Jan 8', person: 'Finance Team', description: 'Vendor contracts finalized after evaluation.', status: 'completed' },
      { label: 'Hardware Installation', date: 'Jan 25', person: 'IT Team', description: 'Server installation delayed due to supply chain issues.', status: 'active' },
      { label: 'Migration', date: 'Feb 15', person: 'DevOps', description: 'Data migration scheduled.', status: 'upcoming' },
    ],
  },
  {
    id: '3',
    name: 'Market Expansion',
    progress: 20,
    status: 'Critical',
    deadline: '2026-04-30',
    trackingHistory: [
      { label: 'Market Research', date: 'Jan 10', person: 'Strategy Team', description: 'Initial market analysis completed for target regions.', status: 'completed' },
      { label: 'Regulatory Compliance', date: 'Feb 1', person: 'Legal Team', description: 'Compliance review in progress. Multiple blockers identified.', status: 'active' },
      { label: 'Partnership Development', date: 'Mar 1', person: 'BD Team', description: 'Partner identification pending.', status: 'upcoming' },
    ],
  },
  {
    id: '4',
    name: 'Digital Transformation',
    progress: 70,
    status: 'On Track',
    deadline: '2026-05-15',
    trackingHistory: [
      { label: 'Assessment', date: 'Nov 20', person: 'Consulting Team', description: 'Digital maturity assessment completed.', status: 'completed' },
      { label: 'Tool Selection', date: 'Dec 10', person: 'IT Committee', description: 'Technology stack finalized.', status: 'completed' },
      { label: 'Implementation', date: 'Jan 15', person: 'Project Team', description: 'Phase 1 implementation completed. Phase 2 in progress.', status: 'active' },
      { label: 'Training', date: 'Apr 1', person: 'HR Team', description: 'Employee training scheduled.', status: 'upcoming' },
    ],
  },
];
