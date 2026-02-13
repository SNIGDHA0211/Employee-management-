import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { DailyLog, ProgressStatus } from '../types';

interface DailyLogEntryProps {
  log: DailyLog;
  onUpdate: (updates: Partial<DailyLog>) => void | Promise<void>;
  onDelete: () => void;
  onSubmit?: () => void | Promise<void>;
  isDraft?: boolean;
  isSubmitting?: boolean;
  isToday: boolean;
  readOnly?: boolean;
}

const DailyLogEntry: React.FC<DailyLogEntryProps> = ({ log, onUpdate, onDelete, onSubmit, isDraft, isSubmitting, isToday, readOnly }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<ProgressStatus>(log.status);
  const [editNote, setEditNote] = useState(log.note);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditStatus(log.status);
      setEditNote(log.note);
    }
  }, [log.status, log.note, isEditing]);

  const isExistingEntry = !isDraft && !log.id.startsWith('temp-');
  const getStatusStyles = (status: ProgressStatus) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500 text-white border-emerald-600';
      case 'in-progress': return 'bg-amber-400 text-white border-amber-500';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const handleStartEdit = () => {
    setEditStatus(log.status);
    setEditNote(log.note);
    setIsEditing(true);
  };

  const handleSubmitEdit = async () => {
    const hasChanges = editStatus !== log.status || editNote !== log.note;
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }
    setIsSubmittingEdit(true);
    try {
      await Promise.resolve(onUpdate({ status: editStatus, note: editNote }));
      setIsEditing(false);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditStatus(log.status);
    setEditNote(log.note);
    setIsEditing(false);
  };

  const showReadOnly = readOnly || (isExistingEntry && !isEditing);
  const displayStatus = isExistingEntry && isEditing ? editStatus : log.status;
  const displayNote = isExistingEntry && isEditing ? editNote : log.note;

  return (
    <div className={`relative pl-8 pb-6 border-l-2 ${isToday ? 'border-blue-400' : 'border-slate-200'} last:pb-0`}>
      <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-white ${isToday ? 'border-blue-500' : 'border-slate-300'}`}></div>
      
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-shadow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${isToday ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
              {log.date} {isToday && '(Today)'}
            </span>
            {isExistingEntry && !readOnly && !isEditing && (
              <button
                onClick={handleStartEdit}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit entry"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
          
          {!showReadOnly && (
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
              {(['pending', 'in-progress', 'completed'] as ProgressStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => isExistingEntry && isEditing ? setEditStatus(s) : onUpdate({ status: s })}
                  className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase transition-all ${
                    displayStatus === s ? getStatusStyles(s) : 'text-slate-400 hover:bg-white'
                  }`}
                >
                  {s.replace('-', ' ')}
                </button>
              ))}
            </div>
          )}
          {showReadOnly && (
            <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase ${getStatusStyles(log.status)}`}>
              {log.status.replace('-', ' ')}
            </span>
          )}
        </div>

        <textarea
          value={displayNote}
          onChange={(e) => {
            if (showReadOnly) return;
            if (isExistingEntry && isEditing) setEditNote(e.target.value);
            else onUpdate({ note: e.target.value });
          }}
          placeholder="What did you do today regarding this objective?"
          readOnly={showReadOnly}
          className={`w-full text-sm bg-slate-50 border-none rounded-lg p-3 outline-none resize-none min-h-[80px] text-slate-700 ${showReadOnly ? '' : 'focus:ring-2 focus:ring-blue-500 transition-all'}`}
        />
        
        {!readOnly && (
          <div className="flex justify-end items-center gap-2 mt-2">
            {isDraft && onSubmit && (
              <button 
                onClick={onSubmit}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            )}
            {isExistingEntry && isEditing && (
              <>
                <button 
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitEdit}
                  disabled={isSubmittingEdit}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Submit'}
                </button>
              </>
            )}
            {(!isEditing || isDraft) && (
              <button 
                onClick={onDelete}
                className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-widest transition-colors"
              >
                Remove Log
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DailyLogEntry;
