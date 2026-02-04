import React, { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import { Holiday } from './types';

interface HolidayDetailModalProps {
  holiday: Holiday;
  onClose: () => void;
  onEdit: (holiday: Holiday) => void;
  onDelete: (id: string) => Promise<void>;
  canEdit: boolean; // Admin and MD only
}

export const HolidayDetailModal: React.FC<HolidayDetailModalProps> = ({
  holiday,
  onClose,
  onEdit,
  onDelete,
  canEdit,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm(`Delete "${holiday.name}"?`)) return;
    setError(null);
    setDeleting(true);
    try {
      await onDelete(holiday.id);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const isEvent = holiday.type === 'event';
  const headerBg = isEvent ? 'bg-indigo-600' : 'bg-red-600';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className={`p-6 flex justify-between items-start ${headerBg}`}>
          <div>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20">
              {isEvent ? 'Event' : 'Holiday'}
            </span>
            <h2 className="text-xl font-bold text-white mt-2">{holiday.name}</h2>
            <p className="text-white/90 text-sm mt-1">
              {format(new Date(holiday.date), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-all text-white/80 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-slate-600 text-sm">
            <span className="font-medium">Date:</span>
            <span>{holiday.date}</span>
          </div>
          {isEvent && holiday.motive && (
            <div className="flex items-start gap-2 text-slate-600 text-sm">
              <span className="font-medium">Motive:</span>
              <span>{holiday.motive}</span>
            </div>
          )}
          {isEvent && holiday.time && (
            <div className="flex items-center gap-2 text-slate-600 text-sm">
              <span className="font-medium">Time:</span>
              <span>{String(holiday.time).substring(0, 5)}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {canEdit && (
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  onClose();
                  onEdit(holiday);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
