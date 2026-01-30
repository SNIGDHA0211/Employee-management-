import React, { useState } from 'react';
import { format } from 'date-fns';
import { Holiday } from './types';

interface HolidayModalProps {
  date: Date;
  onClose: () => void;
  onSave: (holiday: Holiday) => void;
}

export const HolidayModal: React.FC<HolidayModalProps> = ({
  date,
  onClose,
  onSave,
}) => {
  const [type, setType] = useState<'holiday' | 'event'>('holiday');
  const [name, setName] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [motive, setMotive] = useState('');
  const [time, setTime] = useState('09:00');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: Math.random().toString(36).substr(2, 9),
      name,
      date: format(date, 'yyyy-MM-dd'),
      isUrgent,
      type,
      motive: type === 'event' ? motive : undefined,
      time: type === 'event' ? time : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div
          className={`p-6 flex justify-between items-center ${type === 'holiday' ? 'bg-red-600' : 'bg-indigo-600'}`}
        >
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {type === 'holiday' ? 'Create Holiday' : 'Create Event'}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('holiday')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'holiday' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500'}`}
            >
              Holiday
            </button>
            <button
              type="button"
              onClick={() => setType('event')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${type === 'event' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Event
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-widest text-[10px]">
                {type === 'holiday' ? 'Holiday Name' : 'Event Title'}
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  type === 'holiday'
                    ? 'e.g. Annual Bank Holiday'
                    : 'e.g. Design Sync'
                }
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              />
            </div>

            {type === 'holiday' ? (
              <label className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl cursor-pointer hover:bg-red-100/50 transition-colors">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-5 h-5 rounded border-red-300 text-red-600 focus:ring-red-500"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-black text-red-700 uppercase tracking-tighter">
                    Urgent Status
                  </span>
                  <span className="text-[10px] text-red-600 opacity-80">
                    Mark this as a high-priority day
                  </span>
                </div>
              </label>
            ) : (
              <div className="space-y-4 animate-in slide-in-from-top duration-300">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-widest text-[10px]">
                    Event Motive
                  </label>
                  <input
                    required
                    value={motive}
                    onChange={(e) => setMotive(e.target.value)}
                    placeholder="What is the goal of this event?"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-widest text-[10px]">
                    Event Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <p className="text-[10px] text-indigo-700 font-bold italic text-center">
                    Scheduled for {format(date, 'EEEE, MMM do')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
            >
              Discard
            </button>
            <button
              type="submit"
              className={`flex-[2] px-4 py-3 text-sm font-bold text-white rounded-xl transition-all shadow-lg ${type === 'holiday' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'}`}
            >
              Create {type === 'holiday' ? 'Holiday' : 'Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
