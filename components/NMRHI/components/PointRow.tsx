import React from 'react';
import { ProgressStatus, PointProgress } from '../types';

interface PointRowProps {
  point: string;
  index: number;
  progress: PointProgress;
  onChange: (updates: Partial<PointProgress>) => void;
}

const PointRow: React.FC<PointRowProps> = ({ point, index, progress, onChange }) => {
  const getStatusColor = (status: ProgressStatus) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500 text-white border-emerald-600';
      case 'in-progress': return 'bg-amber-400 text-white border-amber-500';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className="group border-b border-slate-100 last:border-0 py-4 px-2 hover:bg-slate-50/50 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-[10px] flex items-center justify-center font-bold mt-0.5">
              {index + 1}
            </span>
            <p className="text-slate-900 font-medium text-sm leading-tight pt-1">{point}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {(['pending', 'in-progress', 'completed'] as ProgressStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ status: s })}
              className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider border transition-all duration-200 ${
                progress.status === s ? getStatusColor(s) : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
              }`}
            >
              {s.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 pl-9 pr-2">
        <label className="text-[10px] text-slate-400 font-bold uppercase mb-1 block">Execution Plan / Notes</label>
        <textarea
          value={progress.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Describe how to solve this problem..."
          className="w-full text-xs bg-white border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none min-h-[60px]"
        />
      </div>
    </div>
  );
};

export default PointRow;
