import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { AppProgress, PointProgress, StrategyCategory } from './types';
import { STRATEGY_CATEGORIES, getNMRHIAllowedCategories } from './constants';
import StrategyDetail from './components/StrategyDetail';
import { getActionableEntries, createActionableEntry, updateActionableEntry, deleteActionableEntry } from '../../services/api';

function entryToDailyLog(entry: any): { id: string; date: string; note: string; status: 'pending' | 'in-progress' | 'completed' } {
  const d = entry.date || '';
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const displayDate = m ? `${m[3]} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m[2], 10) - 1]} ${m[1]}` : d;
  const s = String(entry.status || 'PENDING').toUpperCase();
  const status = s === 'COMPLETED' ? 'completed' : s === 'IN_PROGRESS' ? 'in-progress' : 'pending';
  return {
    id: String(entry.id ?? entry.Id ?? Math.random().toString(36).slice(2)),
    date: displayDate,
    note: String(entry.note ?? ''),
    status,
  };
}

interface NMRHIPageProps {
  currentUserName?: string;
  currentUserId?: string;
  isMD?: boolean;
  users?: User[];
  categoryId?: string;
  /** Category IDs employee can access (from department/function). Empty = all. */
  allowedCategoryIds?: string[];
}

interface User {
  id: string;
  name: string;
  [key: string]: any;
}

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const NMRHIPage: React.FC<NMRHIPageProps> = ({ currentUserName, currentUserId, isMD, users = [], categoryId, allowedCategoryIds }) => {
  const [categories, setCategories] = useState<StrategyCategory[]>(STRATEGY_CATEGORIES);
  const visibleCategories = (allowedCategoryIds && allowedCategoryIds.length > 0)
    ? categories.filter((c) => allowedCategoryIds.includes(c.id))
    : [];
  const [activeCategory, setActiveCategory] = useState<StrategyCategory | null>(null);
  const [progress, setProgress] = useState<AppProgress>({});
  const [loading, setLoading] = useState(true);
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<number>(currentMonth);
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('');
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);

  // Use static data - STRATEGY_CATEGORIES already has sections; no API fetch needed
  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (categoryId) {
      const hasAccess = !allowedCategoryIds || allowedCategoryIds.length === 0 || allowedCategoryIds.includes(categoryId);
      const cat = hasAccess ? categories.find((c) => c.id === categoryId) : null;
      if (cat) setActiveCategory(cat);
      else if (!hasAccess) setActiveCategory(null); // No access - stay on overview
    } else {
      setActiveCategory(null);
    }
  }, [categoryId, categories, allowedCategoryIds]);

  useEffect(() => {
    if (activeCategory) {
      const updated = categories.find((c) => c.id === activeCategory.id);
      if (updated) setActiveCategory(updated);
    }
  }, [categories]);

  // Reset selected employee when category changes if they don't have access to the new category
  useEffect(() => {
    if (!selectedEmployeeId || !categoryId) return;
    const validUsers = users.filter((u) => !/^u\d+$/.test(u.id) && getNMRHIAllowedCategories(u).includes(categoryId));
    const empIds = validUsers.map((u) => (u as any).Employee_id || u.id);
    if (!empIds.includes(selectedEmployeeId)) setSelectedEmployeeId('');
  }, [categoryId, selectedEmployeeId, users]);

  // Reset filter when category changes - user must click Filter to fetch
  useEffect(() => {
    setHasAppliedFilter(false);
  }, [activeCategory?.id]);

  const handleApplyFilter = () => {
    setFilterMonth(selectedMonth);
    setFilterEmployeeId(selectedEmployeeId);
    setHasAppliedFilter(true);
  };

  // Fetch actionable entries only when Filter button is clicked (never on initial load)
  useEffect(() => {
    if (!activeCategory || !hasAppliedFilter) return;
    setIsLoadingEntries(true);
    const params: { username?: string; month?: number } = { username: '', month: filterMonth };
    if (isMD && filterEmployeeId) {
      params.username = filterEmployeeId;
    }
    getActionableEntries(params)
      .then((entries) => {
        const goalIdToKey: Record<number, string> = {};
        activeCategory.sections.forEach((section, sIdx) => {
          section.points.forEach((point, pIdx) => {
            if (point.id > 0) goalIdToKey[point.id] = `${activeCategory.id}-${sIdx}-${pIdx}`;
          });
        });
        const newProgress: AppProgress = {};
        entries.forEach((entry) => {
          const goal = entry.goal ?? entry.Goal;
          const key = goalIdToKey[goal];
          if (!key) return;
          const log = entryToDailyLog(entry);
          if (!newProgress[key]) newProgress[key] = { unlocked: true, logs: [] };
          if (!newProgress[key].logs.some((l) => l.id === log.id)) {
            newProgress[key].logs.push(log);
          }
        });
        setProgress((prev) => {
          const merged = { ...prev };
          // Clear old progress for this category (filter changed - remove previous employee/month data)
          Object.keys(merged).forEach((k) => {
            if (k.startsWith(activeCategory.id + '-')) delete merged[k];
          });
          // Apply new data from API
          Object.keys(newProgress).forEach((k) => {
            merged[k] = newProgress[k];
          });
          return merged;
        });
      })
      .catch((err) => console.warn('[NMRHI] Failed to fetch actionable entries:', err))
      .finally(() => setIsLoadingEntries(false));
  }, [activeCategory?.id, filterMonth, filterEmployeeId, hasAppliedFilter]);

  const handleUpdateProgress = (key: string, updates: Partial<PointProgress>) => {
    setProgress(prev => ({
      ...prev,
      [key]: { ...prev[key], ...updates }
    }));
  };

  const handleAddEntry = async (key: string, goalId: number, date: string, note: string, status: string, tempId?: string) => {
    if (!activeCategory) return;
    if (!goalId) {
      console.warn('[NMRHI] Cannot add entry: goalId is required');
      return;
    }
    const apiDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split('T')[0];
    try {
      const created = await createActionableEntry({
        goal: goalId,
        status: status === 'pending' ? 'PENDING' : status === 'in-progress' ? 'IN_PROGRESS' : 'COMPLETED',
        date: apiDate,
        note: note || '',
      });
      const createdEntry = Array.isArray(created) ? created[0] : created;
      const log = entryToDailyLog(createdEntry || { date: apiDate, status: 'PENDING', note });
      setProgress(prev => {
        const curr = prev[key] || { unlocked: true, logs: [] };
        const withoutTemp = tempId ? curr.logs.filter(l => l.id !== tempId) : curr.logs;
        const exists = withoutTemp.some(l => l.id === log.id);
        return {
          ...prev,
          [key]: { ...curr, logs: exists ? withoutTemp : [log, ...withoutTemp] }
        };
      });
    } catch (err: any) {
      console.warn('[NMRHI] Failed to create actionable entry:', err);
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Please try again.';
      alert(`Could not save entry: ${typeof msg === 'string' ? msg : 'Check console for details.'}`);
    }
  };

  const handleUpdateEntry = async (id: string, updates: { status?: string; note?: string }) => {
    if (id.startsWith('temp-')) return;
    try {
      const payload: Record<string, string> = {};
      if (updates.status != null) payload.status = updates.status === 'pending' ? 'PENDING' : updates.status === 'in-progress' ? 'IN_PROGRESS' : 'COMPLETED';
      if (updates.note != null) payload.note = updates.note;
      await updateActionableEntry(id, payload);
    } catch (err: any) {
      console.warn('[NMRHI] Failed to update entry:', err);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (id.startsWith('temp-')) return;
    try {
      await deleteActionableEntry(id);
    } catch (err: any) {
      console.warn('[NMRHI] Failed to delete entry:', err);
      const msg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Please try again.';
      alert(`Could not delete entry: ${typeof msg === 'string' ? msg : 'Check console for details.'}`);
    }
  };

  const getCategoryProgress = (category: StrategyCategory) => {
    let total = 0;
    let completed = 0;
    
    category.sections.forEach((section, sIdx) => {
      section.points.forEach((_, pIdx) => {
        total++;
        const key = `${category.id}-${sIdx}-${pIdx}`;
        if (progress[key]?.status === 'completed') {
          completed++;
        }
      });
    });
    
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  if (activeCategory) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Back Navigation */}
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={() => setActiveCategory(null)}
              className="flex items-center gap-2 text-slate-600 hover:text-blue-600 font-semibold transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to NMRHI Overview
            </button>

            {/* Month & Employee filters */}
            <div className="flex items-center gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              {isMD && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Employee</label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    className="text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none min-w-[160px]"
                  >
                    <option value="">My entries</option>
                    {users
                      .filter((u) => !/^u\d+$/.test(u.id) && getNMRHIAllowedCategories(u).includes(categoryId || ''))
                      .map((u) => ({ id: u.id, empId: (u as any).Employee_id || u.id, name: u.name }))
                      .map((u) => (
                        <option key={u.id} value={u.empId}>{u.name}</option>
                      ))}
                  </select>
                </div>
              )}
              <div className="self-end">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1 invisible">Apply</label>
                <button
                  onClick={handleApplyFilter}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Filter
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer')}
                className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                ChatGPT
              </button>
              <button
                onClick={() => window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer')}
                className="px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Gemini
              </button>
            </div>
          </div>
        </div>
        
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 relative">
          {isLoadingEntries && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 z-10 rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={40} className="animate-spin text-blue-600" />
                <p className="text-sm font-medium text-slate-600">Loading entries...</p>
              </div>
            </div>
          )}
          <div className="min-w-0">
            <StrategyDetail
              category={activeCategory}
              progress={progress}
              onUpdateProgress={handleUpdateProgress}
              onAddEntry={!isMD ? handleAddEntry : undefined}
              onUpdateEntry={!isMD ? handleUpdateEntry : undefined}
              onDeleteEntry={!isMD ? handleDeleteEntry : undefined}
              readOnly={isMD}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      {/* Header */}
      <header className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 shadow-lg shadow-blue-200">
          Strategic Framework
        </div>
        <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">
          NMRHI Strategy System
        </h1>
        <p className="text-slate-500 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
          A comprehensive framework for New business development, Market expansion, Resource optimization, 
          Human capital development, and Innovation & Improvement.
        </p>
        {currentUserName && (
          <p className="text-slate-400 text-sm mt-4">
            Welcome, <span className="font-semibold text-slate-600">{currentUserName}</span>
          </p>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            onClick={() => window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer')}
            className="px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            ChatGPT
          </button>
          <button
            onClick={() => window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer')}
            className="px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Gemini
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto">
        {/* Strategy Cards Grid - filtered by employee department/function */}
        {visibleCategories.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white rounded-2xl border-2 border-slate-100">
            <p className="text-slate-500 font-semibold mb-2">No NMRHI pages assigned to your function.</p>
            <p className="text-slate-400 text-sm">Contact your admin to get access to NPD, MMR, RG, HC, or IP.</p>
          </div>
        ) : (
        <div className="min-w-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {visibleCategories.map((category, idx) => {
            const progressPercent = getCategoryProgress(category);
            const isLoading = loading;
            
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category)}
                className="group relative bg-white rounded-3xl border-2 border-slate-100 p-6 text-left hover:border-blue-500 hover:shadow-xl hover:shadow-blue-100 transition-all duration-300 hover:-translate-y-2"
              >
                {/* Progress Ring */}
                <div className="absolute top-4 right-4">
                  <div className="relative w-12 h-12">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="#f1f5f9"
                        strokeWidth="4"
                        fill="transparent"
                      />
                      <circle
                        cx="24"
                        cy="24"
                        r="20"
                        stroke="#3b82f6"
                        strokeWidth="4"
                        fill="transparent"
                        strokeDasharray={125.6}
                        strokeDashoffset={125.6 - (125.6 * progressPercent) / 100}
                        strokeLinecap="round"
                        className="transition-all duration-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] font-black text-slate-600">{progressPercent}%</span>
                    </div>
                  </div>
                </div>

                {/* Letter Badge */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-3xl font-black mb-4 shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                  {category.name}
                </div>

                {/* Category Info */}
                <h3 className="text-lg font-black text-slate-900 mb-2 leading-tight">
                  {category.fullName}
                </h3>
                <p className="text-slate-400 text-xs font-medium leading-relaxed mb-4">
                  {category.description.substring(0, 80)}...
                </p>

                {/* Sections Preview */}
                <div className="flex flex-wrap gap-1.5">
                  {isLoading ? (
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold">Loading...</span>
                  ) : category.sections.length === 0 ? (
                    <span className="text-[9px] bg-slate-100 text-slate-400 px-2 py-1 rounded-full font-bold">—</span>
                  ) : (
                    <>
                      {category.sections.slice(0, 3).map((section, sIdx) => (
                        <span key={sIdx} className="text-[9px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold uppercase tracking-wider">
                          {section.title.substring(0, 10)}
                        </span>
                      ))}
                      {category.sections.length > 3 && (
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-bold">+{category.sections.length - 3}</span>
                      )}
                    </>
                  )}
                </div>

                {/* Hover Indicator */}
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center text-slate-400 text-[10px] uppercase font-bold tracking-widest">
        NMRHI Strategic Framework &bull; Internal Use Only
      </footer>
    </div>
  );
};

export default NMRHIPage;
