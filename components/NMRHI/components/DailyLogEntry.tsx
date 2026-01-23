import React from 'react';
import { DailyLog, ProgressStatus } from '../types';

interface DailyLogEntryProps {
  log: DailyLog;
  onUpdate: (updates: Partial<DailyLog>) => void;
  onDelete: () => void;
  isToday: boolean;
}

const DailyLogEntry: React.FC<DailyLogEntryProps> = ({ log, onUpdate, onDelete, isToday }) => {
  const getStatusStyles = (status: ProgressStatus) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500 text-white border-emerald-600';
      case 'in-progress': return 'bg-amber-400 text-white border-amber-500';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  return (
    <div className={`relative pl-8 pb-6 border-l-2 ${isToday ? 'border-blue-400' : 'border-slate-200'} last:pb-0`}>
      <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-white ${isToday ? 'border-blue-500' : 'border-slate-300'}`}></div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${isToday ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
              {log.date} {isToday && '(Today)'}
            </span>
          </div>
          
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
            {(['pending', 'in-progress', 'completed'] as ProgressStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => onUpdate({ status: s })}
                className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase transition-all ${
                  log.status === s ? getStatusStyles(s) : 'text-slate-400 hover:bg-white'
                }`}
              >
                {s.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={log.note}
          onChange={(e) => onUpdate({ note: e.target.value })}
          placeholder="What did you do today regarding this objective?"
          className="w-full text-sm bg-slate-50 border-none rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none min-h-[80px] text-slate-700"
        />
        
        <div className="flex justify-end mt-2">
          <button 
            onClick={onDelete}
            className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-widest transition-colors"
          >
            Remove Log
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyLogEntry;
