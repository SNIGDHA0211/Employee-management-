import { AIInsight, DashboardData, KPIData, ProjectData, WorkforceData, AssetData } from '../types';

// Simulated AI insights generation
// In production, this would call the actual Gemini API
export const getDashboardInsights = async (data: {
  kpis: KPIData[];
  projects: ProjectData[];
  workforce: WorkforceData[];
  assets: AssetData[];
}): Promise<AIInsight[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Generate insights based on the data
  const insights: AIInsight[] = [];

  // Revenue insight
  const revenueKpi = data.kpis.find(k => k.title.toLowerCase().includes('revenue'));
  if (revenueKpi) {
    insights.push({
      category: 'Revenue',
      message: `Strong revenue performance at ${revenueKpi.value} with ${revenueKpi.change} growth. Consider reinvesting 15% into R&D for sustained growth.`,
      impact: 'High',
    });
  }

  // Project insight
  const criticalProjects = data.projects.filter(p => p.status === 'Critical' || p.status === 'Delayed');
  if (criticalProjects.length > 0) {
    insights.push({
      category: 'Projects',
      message: `${criticalProjects.length} project(s) require immediate attention. "${criticalProjects[0].name}" is at ${criticalProjects[0].progress}% - recommend resource reallocation.`,
      impact: 'High',
    });
  }

  // Workforce insight
  const totalWorkforce = data.workforce.reduce((sum, w) => sum + w.value, 0);
  const engineeringPercent = ((data.workforce.find(w => w.name === 'Engineering')?.value || 0) / totalWorkforce * 100).toFixed(1);
  insights.push({
    category: 'Workforce',
    message: `Engineering represents ${engineeringPercent}% of total workforce. Industry benchmark suggests 30-35% for tech companies. Current allocation is optimal.`,
    impact: 'Medium',
  });

  // Efficiency insight
  const efficiencyKpi = data.kpis.find(k => k.title.toLowerCase().includes('efficiency'));
  if (efficiencyKpi) {
    insights.push({
      category: 'Operations',
      message: `Team efficiency at ${efficiencyKpi.value} exceeds industry average by 12%. Recommend documenting best practices for scaling.`,
      impact: 'Medium',
    });
  }

  return insights;
};
