import React from 'react';
import { PointProgress, DailyLog } from '../types';
import DailyLogEntry from './DailyLogEntry';

interface PointExecutionCardProps {
  point: string;
  index: number;
  progress: PointProgress;
  onUpdate: (updates: Partial<PointProgress>) => void;
  isUnlocked: boolean;
}

const PointExecutionCard: React.FC<PointExecutionCardProps> = ({ point, index, progress, onUpdate, isUnlocked }) => {
  if (!isUnlocked) {
    return (
      <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center opacity-60 grayscale">
        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Locked: Point {index + 1}</p>
        <button 
          onClick={() => onUpdate({ unlocked: true })}
          className="mt-4 text-[10px] bg-white border border-slate-300 px-4 py-2 rounded-full font-bold text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
        >
          Unlock this Objective
        </button>
      </div>
    );
  }

  const addRow = () => {
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const newLog: DailyLog = {
      id: Math.random().toString(36).substr(2, 9),
      date: today,
      note: '',
      status: 'pending'
    };
    onUpdate({ logs: [newLog, ...progress.logs] });
  };

  const updateLog = (logId: string, updates: Partial<DailyLog>) => {
    const newLogs = progress.logs.map(l => l.id === logId ? { ...l, ...updates } : l);
    onUpdate({ logs: newLogs });
  };

  const deleteLog = (logId: string) => {
    const newLogs = progress.logs.filter(l => l.id !== logId);
    onUpdate({ logs: newLogs });
  };

  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden mb-8">
      <div className="bg-white border-b border-slate-100 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-blue-100">
            {index + 1}
          </div>
          <div>
            <h4 className="text-slate-900 font-black text-lg leading-tight">{point}</h4>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Actionable Goal</p>
          </div>
        </div>
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
      </div>

      <div className="p-6 bg-slate-50/30">
        <div className="flex items-center justify-between mb-6">
          <h5 className="text-slate-500 font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
            Execution History
            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-md text-[9px]">{progress.logs.length} entries</span>
          </h5>
          <button 
            onClick={addRow}
            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-lg shadow-blue-100 transition-all flex items-center gap-2 active:scale-95"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            Add Daily Log
          </button>
        </div>

        <div className="space-y-2">
          {progress.logs.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
              <p className="text-slate-400 text-xs font-medium">No logs recorded yet. Start by adding today's row.</p>
            </div>
          ) : (
            <div className="mt-4">
              {progress.logs.map((log) => (
                <DailyLogEntry 
                  key={log.id} 
                  log={log} 
                  isToday={log.date === todayStr}
                  onUpdate={(updates) => updateLog(log.id, updates)}
                  onDelete={() => deleteLog(log.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PointExecutionCard;
