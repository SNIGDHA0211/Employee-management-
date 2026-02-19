import React, { useState, useEffect, useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, ComposedChart, Line
} from 'recharts';
import { Sparkles, Filter, Download, BrainCircuit, History, X, User as UserIcon, Check, Calendar } from 'lucide-react';
import StatCard from './components/StatCard';
import { AIInsight, ProjectData, WorkforceData } from './types';
import { KPI_DATA, REVENUE_CHART_DATA, WORKFORCE_DATA, PROJECTS, ASSETS_DATA } from './constants';
import { getDashboardInsights } from './services/geminiService';
import type { User } from '../../types';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface MDDashboardPageProps {
  userName?: string;
  userAvatar?: string;
  employees?: User[];
}

const MDDashboardPage: React.FC<MDDashboardPageProps> = ({ userName = 'MD User', userAvatar, employees: employeesProp = [] }) => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  // Use shared employees from App (mapped to API-like shape for workforce charts)
  const employees = employeesProp.map((u) => ({
    Designation: u.designation,
    Role: u.role,
    Branch: u.branch,
    Function: (u as any).function,
  }));
  const workforceLoading = false; // Data comes from App, no local fetch
  const [workforceView, setWorkforceView] = useState<'designation' | 'role' | 'branch' | 'function'>('designation');

  // Workforce distribution by designation (from API employees)
  const workforceByDesignation: WorkforceData[] = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp: any) => {
      const designation = emp['Designation'] || emp['designation'] || emp.designation || 'Unassigned';
      const label = String(designation).trim() || 'Unassigned';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  // Workforce distribution by role (from API employees)
  const workforceByRole: WorkforceData[] = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp: any) => {
      const role = emp['Role'] || emp['role'] || emp.role || 'Unassigned';
      const label = String(role).trim() || 'Unassigned';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  // Workforce distribution by branch (from API employees)
  const workforceByBranch: WorkforceData[] = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp: any) => {
      const branch = emp['Branch'] || emp['branch'] || emp.branch || 'Unassigned';
      const label = String(branch).trim() || 'Unassigned';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  // Workforce distribution by function (from API employees)
  const workforceByFunction: WorkforceData[] = useMemo(() => {
    const counts: Record<string, number> = {};
    employees.forEach((emp: any) => {
      const fn = emp['Function'] || emp['function'] || emp.function || 'Unassigned';
      const label = String(fn).trim() || 'Unassigned';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [employees]);

  const workforceChartData =
    workforceView === 'role'
      ? workforceByRole
      : workforceView === 'branch'
        ? workforceByBranch
        : workforceView === 'function'
          ? workforceByFunction
          : workforceByDesignation;
  const totalStaffCount = useMemo(() => workforceByDesignation.reduce((s, w) => s + w.value, 0), [workforceByDesignation]);


  // Consolidated data for all sections
  const allKpis = [
    ...KPI_DATA.Overview,
    ...KPI_DATA.Sales,
    ...KPI_DATA.Marketing
  ];

  const fetchInsights = async () => {
    setLoadingInsights(true);
    const result = await getDashboardInsights({
      kpis: allKpis,
      projects: PROJECTS,
      workforce: workforceByDesignation.length > 0 ? workforceByDesignation : WORKFORCE_DATA,
      assets: ASSETS_DATA
    });
    setInsights(result);
    setLoadingInsights(false);
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  // Helper to get the most recent non-upcoming milestone
  const getRecentTrack = (project: ProjectData) => {
    if (!project.trackingHistory) return 'No data';
    const recent = [...project.trackingHistory]
      .reverse()
      .find(h => h.status === 'active' || h.status === 'completed');
    return recent ? recent.label : 'Pending';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-700">
      <main className="max-w-[1600px] mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 pb-16 sm:pb-20 space-y-6 sm:space-y-8 md:space-y-10">
        
        {/* Row 1: Global KPIs */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Executive Summary</h2>
              <p className="text-slate-500 font-medium text-sm sm:text-base">Real-time performance metrics across all departments</p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                <Filter size={14} className="sm:w-4 sm:h-4" /> Filters
              </button>
              <button className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 rounded-xl text-xs sm:text-sm font-semibold text-white hover:bg-indigo-700 transition-shadow shadow-lg shadow-indigo-200">
                <Download size={14} className="sm:w-4 sm:h-4" /> Export Data
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
            {allKpis.slice(0, 4).map((kpi, idx) => (
              <StatCard key={idx} {...kpi} />
            ))}
          </div>
        </section>

        {/* Row 2: Strategic Insights & Main Revenue Chart */}
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          <div className="xl:col-span-2 bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
              <div>
                <h3 className="text-lg sm:text-xl font-bold">Revenue & Market Share</h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">Monthly trend analysis vs. forecast</p>
              </div>
              <div className="p-1 bg-slate-100 rounded-xl flex w-fit">
                <button className="px-3 sm:px-4 py-1.5 text-xs font-bold text-slate-500">QTD</button>
                <button className="px-3 sm:px-4 py-1.5 bg-white shadow-sm rounded-lg text-xs font-bold text-indigo-600">YTD</button>
              </div>
            </div>
            <div className="h-[240px] sm:h-[320px] md:h-[360px] lg:h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={REVENUE_CHART_DATA}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="value" fill="url(#colorRev)" stroke="#6366f1" strokeWidth={4} dot={{ r: 4, fill: '#6366f1' }} />
                  <Bar dataKey="secondaryValue" barSize={10} fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="secondaryValue" stroke="#10b981" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-slate-900 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-2xl shadow-slate-200 text-white flex flex-col relative overflow-hidden min-h-[280px] sm:min-h-[320px]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full"></div>
            <div className="relative z-10 flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <div className="p-2 bg-indigo-500/20 rounded-xl">
                  <Sparkles className="text-indigo-400" size={20} />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold">Strategic AI Insights</h3>
                  <p className="text-xs text-indigo-300 font-medium">Analyzed by AI</p>
                </div>
              </div>

              <div className="flex-1 space-y-3 sm:space-y-5 overflow-y-auto max-h-[200px] sm:max-h-none">
                {loadingInsights ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="space-y-2 py-2">
                      <div className="h-3 bg-white/5 rounded-full animate-pulse w-1/3"></div>
                      <div className="h-2 bg-white/5 rounded-full animate-pulse w-full"></div>
                      <div className="h-2 bg-white/5 rounded-full animate-pulse w-5/6"></div>
                    </div>
                  ))
                ) : insights.length > 0 ? (
                  insights.map((insight, idx) => (
                    <div key={idx} className="group p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all hover:-translate-y-1">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{insight.category}</span>
                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${insight.impact === 'High' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {insight.impact}
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed font-medium">{insight.message}</p>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center opacity-40">
                    <BrainCircuit size={48} className="mb-4" />
                    <p className="text-sm">Run analysis to generate insights</p>
                  </div>
                )}
              </div>

              <button 
                onClick={fetchInsights}
                disabled={loadingInsights}
                className="w-full mt-4 sm:mt-8 py-3 sm:py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-2"
              >
                {loadingInsights ? 'Analyzing Data...' : <><Sparkles size={16} /> Generate New Insights</>}
              </button>
            </div>
          </div>
        </section>

        {/* Row 3: Workforce, Quality Metrics */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          
          {/* Workforce Distribution - wider */}
          <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-bold">Workforce Distribution</h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  {workforceView === 'designation' && 'By employee designation'}
                  {workforceView === 'role' && 'By employee role'}
                  {workforceView === 'branch' && 'By branch'}
                  {workforceView === 'function' && 'By function'}
                </p>
              </div>
              <div className="p-1 bg-slate-100 rounded-xl flex flex-wrap gap-1 w-full sm:w-auto">
                <button
                  onClick={() => setWorkforceView('designation')}
                  className={`px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${
                    workforceView === 'designation'
                      ? 'bg-white shadow-sm text-indigo-600'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Designation
                </button>
                <button
                  onClick={() => setWorkforceView('role')}
                  className={`px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${
                    workforceView === 'role'
                      ? 'bg-white shadow-sm text-indigo-600'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Role
                </button>
                <button
                  onClick={() => setWorkforceView('branch')}
                  className={`px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${
                    workforceView === 'branch'
                      ? 'bg-white shadow-sm text-indigo-600'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Branch
                </button>
                <button
                  onClick={() => setWorkforceView('function')}
                  className={`px-2.5 sm:px-3 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-colors ${
                    workforceView === 'function'
                      ? 'bg-white shadow-sm text-indigo-600'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Function
                </button>
              </div>
            </div>
            <div className="h-[220px] sm:h-[260px] md:h-[300px] min-h-[180px] sm:min-h-[200px]">
              {workforceLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : workforceChartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <UserIcon size={40} className="mb-2 opacity-50" />
                  <p className="text-sm font-medium">No employee data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={workforceChartData}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 500}} width={100} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={24} name="Employees">
                      {workforceChartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Total Staff Count</span>
              <span className="font-bold text-slate-900">{totalStaffCount} Employees</span>
            </div>
          </div>

          {/* Quality Metrics (Single Score Representation) */}
          <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-bold mb-2">Quality & Operations</h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">Compliance and efficiency rating</p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center py-2 sm:py-4">
              <div className="relative w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="#f1f5f9"
                    strokeWidth="12"
                    fill="transparent"
                  />
                  <circle
                    cx="80"
                    cy="80"
                    r="70"
                    stroke="#10b981"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={440}
                    strokeDashoffset={440 - (440 * 98.2) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">98.2</span>
                  <span className="text-xs font-bold text-slate-400 uppercase">Excellent</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6">
              <div className="bg-slate-50 p-3 rounded-2xl">
                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Downtime</p>
                <p className="text-lg font-bold text-slate-900">0.04%</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl">
                <p className="text-xs text-slate-500 font-bold uppercase mb-1">Audits</p>
                <p className="text-lg font-bold text-slate-900">Passed</p>
              </div>
            </div>
          </div>

        </section>

        {/* Row 4: Project Roadmap & Deadlines (List Format) */}
        <section className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6 md:mb-8">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">Project Roadmap & Deadlines</h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">Tracking delivery and milestone status</p>
            </div>
            <button className="px-4 sm:px-5 py-2 sm:py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-indigo-100 transition-all shadow-sm w-fit">
              Management Portal
            </button>
          </div>
          
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em]">
                  <th className="pb-4 sm:pb-6 pl-2 sm:pl-4">Priority Project</th>
                  <th className="pb-4 sm:pb-6">Progress</th>
                  <th className="pb-4 sm:pb-6">Deadline</th>
                  <th className="pb-4 sm:pb-6 hidden md:table-cell">Health</th>
                  <th className="pb-4 sm:pb-6 text-right pr-2 sm:pr-4">Track</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {PROJECTS.map((project) => (
                  <tr key={project.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 sm:py-6 pl-2 sm:pl-4">
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${
                          project.status === 'Critical' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' :
                          project.status === 'Delayed' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}></div>
                        <span className="font-bold text-slate-800 text-sm sm:text-base truncate max-w-[120px] sm:max-w-none">{project.name}</span>
                      </div>
                    </td>
                    <td className="py-4 sm:py-6">
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="flex-1 max-w-[80px] sm:max-w-[120px] h-1.5 sm:h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                              project.status === 'Critical' ? 'bg-rose-500' : 
                              project.status === 'Delayed' ? 'bg-amber-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] sm:text-xs font-black text-slate-500 shrink-0">{project.progress}%</span>
                      </div>
                    </td>
                    <td className="py-4 sm:py-6">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold text-slate-600">
                        <Calendar size={12} className="text-slate-400 shrink-0" />
                        {new Date(project.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </td>
                    <td className="py-4 sm:py-6 hidden md:table-cell">
                      <span className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${
                        project.status === 'Critical' ? 'bg-rose-50 text-rose-600 border border-rose-100' :
                        project.status === 'Delayed' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                        {getRecentTrack(project)}
                      </span>
                    </td>
                    <td className="py-4 sm:py-6 text-right pr-2 sm:pr-4">
                      <button 
                        onClick={() => setSelectedProject(project)}
                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all ml-auto"
                      >
                        <History size={12} className="sm:w-3.5 sm:h-3.5" />
                        View Track
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      {/* Tracking Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSelectedProject(null)}
          ></div>
          <div className="relative bg-white w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col">
            <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 border-b border-slate-100 flex items-start sm:items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{selectedProject.name} Tracking</h3>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">Lifecycle & Continuous Milestone Progress</p>
              </div>
              <button 
                onClick={() => setSelectedProject(null)}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 sm:p-6 md:p-8 max-h-[60vh] sm:max-h-[65vh] overflow-y-auto bg-slate-50/30 flex-1 min-h-0">
              {selectedProject.trackingHistory && selectedProject.trackingHistory.length > 0 ? (
                <div className="space-y-0 relative">
                  {selectedProject.trackingHistory.map((update, i) => {
                    const isLast = i === selectedProject.trackingHistory!.length - 1;
                    const isCompleted = update.status === 'completed';
                    const isActive = update.status === 'active';
                    const isUpcoming = update.status === 'upcoming';
                    
                    return (
                      <div key={i} className={`flex group min-h-[80px] ${isUpcoming ? 'opacity-30' : ''}`}>
                        <div className="flex flex-col items-center mr-8">
                          <div className={`relative flex items-center justify-center w-10 h-10 rounded-full z-10 transition-all duration-300
                            ${isCompleted ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-50' : 
                              isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50' : 
                              'bg-slate-100 text-slate-400 border-2 border-slate-200'}
                          `}>
                            {isCompleted ? (
                              <Check size={18} className="font-bold" />
                            ) : (
                              <span className="text-sm font-black">{i + 1}</span>
                            )}
                          </div>
                          {!isLast && (
                            <div className={`w-0.5 flex-1 my-1 transition-colors duration-500 ${isCompleted ? 'bg-emerald-200' : 'bg-slate-100'}`}></div>
                          )}
                        </div>

                        <div className="pb-6 flex-1">
                          <div className="flex items-center justify-between mb-1.5">
                            <h4 className={`text-sm font-bold transition-colors ${isActive ? 'text-indigo-600 underline decoration-indigo-200 decoration-2 underline-offset-4' : isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                              {update.label}
                            </h4>
                            {!isUpcoming && (
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{update.date}</span>
                            )}
                          </div>
                          
                          {!isUpcoming && (
                            <div className={`text-[13px] leading-relaxed p-3 rounded-xl border transition-all duration-300
                              ${isActive ? 'bg-white border-indigo-100 shadow-sm translate-x-1' : 'bg-slate-50/50 border-slate-100'}
                            `}>
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-4 h-4 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center">
                                  <UserIcon size={10} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{update.person}</span>
                              </div>
                              <p className="text-slate-600 font-medium leading-tight">
                                {update.description}
                              </p>
                            </div>
                          )}
                          
                          {isUpcoming && (
                             <p className="text-[11px] text-slate-400 italic">Scheduled milestone following completion of current stage.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 opacity-50">
                  <History size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-sm">No tracking history found for this project.</p>
                </div>
              )}
            </div>
            <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-slate-50 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedProject(null)}
                className="px-4 sm:px-6 py-2 sm:py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Close Tracking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MDDashboardPage;
