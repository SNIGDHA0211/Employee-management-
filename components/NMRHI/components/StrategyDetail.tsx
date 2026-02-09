import React, { useState } from 'react';
import { StrategyCategory, AppProgress, PointProgress } from '../types';
import PointExecutionCard from './PointExecutionCard';

interface StrategyDetailProps {
  category: StrategyCategory;
  progress: AppProgress;
  onUpdateProgress: (key: string, updates: Partial<PointProgress>) => void;
}

const StrategyDetail: React.FC<StrategyDetailProps> = ({ category, progress, onUpdateProgress }) => {
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const activeSection = category.sections[activeSectionIdx];
  const hasSections = category.sections.length > 0;

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
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
            {activeSection.title} Objectives
          </h3>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Focused Execution Mode
          </div>
        </div>

        <div className="space-y-4">
          {activeSection.points.map((point, pIdx) => {
            const key = `${category.id}-${activeSectionIdx}-${pIdx}`;
            const pointProgress = progress[key] || { unlocked: pIdx === 0, logs: [] };
            
            // Point 1 is always unlocked for a new section. 
            // Others depend on user manual unlocking or previous completion logic.
            const isActuallyUnlocked = pIdx === 0 ? true : pointProgress.unlocked;

            return (
              <PointExecutionCard
                key={pIdx}
                index={pIdx}
                point={point}
                progress={pointProgress}
                isUnlocked={isActuallyUnlocked}
                onUpdate={(updates) => onUpdateProgress(key, updates)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StrategyDetail;
