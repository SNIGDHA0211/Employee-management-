import React, { useState } from 'react';
import { StrategyCategory, AppProgress, PointProgress } from '../types';
import { getD3LabelForMonth } from '../constants';
import PointExecutionCard from './PointExecutionCard';

interface StrategyDetailProps {
  category: StrategyCategory;
  progress: AppProgress;
  onUpdateProgress: (key: string, updates: Partial<PointProgress>) => void;
  onAddEntry?: (key: string, goalId: number, date: string, note: string, status: string, tempId?: string) => Promise<void>;
  onUpdateEntry?: (id: string, updates: { status?: string; note?: string }) => Promise<void>;
  onDeleteEntry?: (id: string) => Promise<void>;
  readOnly?: boolean;
  filterMonth?: number;
}

const StrategyDetail: React.FC<StrategyDetailProps> = ({ category, progress, onUpdateProgress, onAddEntry, onUpdateEntry, onDeleteEntry, readOnly, filterMonth }) => {
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const activeSection = category.sections[activeSectionIdx];
  const hasSections = category.sections.length > 0;
  const firstD1Idx = activeSection?.points.findIndex((p: any) => p?.grp_id === 'D1') ?? -1;
  const firstD2Idx = activeSection?.points.findIndex((p: any) => p?.grp_id === 'D2') ?? -1;
  const firstD3Idx = activeSection?.points.findIndex((p: any) => p?.grp_id === 'D3') ?? -1;
  const scrollToGrp = (grp: 'D1' | 'D2' | 'D3') => {
    document.getElementById(`grp-${grp}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (!hasSections) {
    return (
      <div className="p-4 md:p-8">
        <header className="mb-10">
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{category.fullName}</h2>
          <p className="text-slate-500 max-w-2xl text-lg font-medium leading-snug mt-2">{category.description}</p>
        </header>
        <div className="text-slate-500 font-medium py-8">No objectives available yet.</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-200">
            {category.name} Frame
          </span>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">{category.fullName}</h2>
        </div>
        <p className="text-slate-500 max-w-2xl text-lg font-medium leading-snug">
          {category.description}
        </p>
      </header>

      {/* Section Switcher - Headers styled as blue buttons when active */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
        {category.sections.map((section, idx) => (
          <button
            key={idx}
            onClick={() => setActiveSectionIdx(idx)}
            className={`text-left p-4 rounded-2xl border-2 transition-all duration-300 ${
              activeSectionIdx === idx 
                ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-200 -translate-y-1' 
                : 'bg-white border-slate-100 text-slate-400 hover:border-blue-300'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className={`w-2 h-2 rounded-full ${activeSectionIdx === idx ? 'bg-white opacity-80' : 'bg-slate-200'}`}></div>
              <span className={`text-[9px] font-black uppercase tracking-widest ${activeSectionIdx === idx ? 'text-blue-100' : 'opacity-50'}`}>S-{idx+1}</span>
            </div>
            <h3 className={`font-black text-xs uppercase tracking-wider leading-tight ${activeSectionIdx === idx ? 'text-white' : 'text-slate-400'}`}>
              {section.title}
            </h3>
          </button>
        ))}
      </div>

      <div className="max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
            {activeSection.title} Objectives
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">Jump:</span>
            {(['D1', 'D2', 'D3'] as const).map((grp) => (
              <button
                key={grp}
                onClick={() => scrollToGrp(grp)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all bg-slate-100 text-slate-600 hover:bg-slate-200"
                title={`Jump to ${grp} (${grp === 'D1' ? 'Days 1-10' : grp === 'D2' ? 'Days 11-20' : getD3LabelForMonth(filterMonth ?? new Date().getMonth() + 1)})`}
              >
                {grp}
              </button>
            ))}
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">
              · Add during current period
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {activeSection.points.map((point, pIdx) => {
            const key = `${category.id}-${activeSectionIdx}-${pIdx}`;
            const pointProgress = progress[key] || { unlocked: true, logs: [] };
            
            // All D1, D2, D3 visible and unlocked by default
            const isActuallyUnlocked = pointProgress.unlocked !== false;
            const grpId = (point as { grp_id?: string }).grp_id;

            const grpScrollId = pIdx === firstD1Idx ? 'grp-D1' : pIdx === firstD2Idx ? 'grp-D2' : pIdx === firstD3Idx ? 'grp-D3' : undefined;
            return (
              <div key={point.id} id={grpScrollId} className="scroll-mt-24">
              <PointExecutionCard
                index={pIdx}
                point={typeof point === 'string' ? point : point.purpose}
                goalId={typeof point === 'object' && point?.id ? point.id : 0}
                progress={pointProgress}
                isUnlocked={isActuallyUnlocked}
                onUpdate={(updates) => onUpdateProgress(key, updates)}
                onAddEntry={onAddEntry ? (goalId, date, note, status, tempId) => onAddEntry(key, goalId, date, note, status, tempId) : undefined}
                onUpdateEntry={onUpdateEntry}
                onDeleteEntry={onDeleteEntry}
                readOnly={readOnly}
                grpId={grpId}
                filterMonth={filterMonth}
              />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StrategyDetail;
