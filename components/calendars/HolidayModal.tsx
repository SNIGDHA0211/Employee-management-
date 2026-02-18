import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Holiday } from './types';
import { createHoliday, updateHoliday, createEvent, updateEvent } from '../../services/api';
import { useRequestLock } from '../../hooks/useRequestLock';

interface HolidayModalProps {
  date: Date;
  onClose: () => void;
  onSave: (holiday: Holiday) => void;
  initialHoliday?: Holiday | null;
  existingHolidays?: Holiday[];
}

export const HolidayModal: React.FC<HolidayModalProps> = ({
  date,
  onClose,
  onSave,
  initialHoliday,
  existingHolidays = [],
}) => {
  const isEdit = !!initialHoliday;
  const [type, setType] = useState<'holiday' | 'event'>(initialHoliday?.type ?? 'holiday');
  const [name, setName] = useState(initialHoliday?.name ?? '');
  const [isUrgent, setIsUrgent] = useState(false);
  const [motive, setMotive] = useState(initialHoliday?.motive ?? '');
  const [time, setTime] = useState(
    initialHoliday?.time ? String(initialHoliday.time).substring(0, 5) : '09:00'
  );
  const [selectedDate, setSelectedDate] = useState(
    initialHoliday?.date ?? format(date, 'yyyy-MM-dd')
  );
  const [error, setError] = useState<string | null>(null);
  const { withLock, isPending } = useRequestLock();

  useEffect(() => {
    if (initialHoliday) {
      setType(initialHoliday.type);
      setName(initialHoliday.name);
      setSelectedDate(initialHoliday.date);
      setMotive(initialHoliday.motive ?? '');
      setTime(initialHoliday.time ? String(initialHoliday.time).substring(0, 5) : '09:00');
    }
  }, [initialHoliday]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (type === 'holiday') {
      const duplicateHoliday = existingHolidays.some(
        (h) =>
          h.type === 'holiday' &&
          h.date === selectedDate &&
          (!isEdit || h.id !== initialHoliday?.id)
      );
      if (duplicateHoliday) {
        setError('A holiday already exists on this date.');
        return;
      }
    }
    await withLock(async () => {
      try {
        if (type === 'holiday') {
        // Holidays use eventsapi/holidays/ (date, name only - no fixed/unfixed)
        const payload = { date: selectedDate, name };
        if (isEdit && initialHoliday) {
          const res = await updateHoliday(initialHoliday.id, payload);
          onSave({
            id: String(res.id),
            name: res.name,
            date: res.date,
            type: 'holiday',
            isUrgent,
          });
        } else {
          const res = await createHoliday(payload);
          onSave({
            id: String(res.id),
            name: res.name,
            date: res.date,
            type: 'holiday',
            isUrgent,
          });
        }
      } else {
        // Events use eventsapi/events/
        const toTimeSec = (t: string) =>
          t && t.length >= 8 ? t.substring(0, 8) : `${t || '09:00'}:00`;
        const payload = {
          title: name,
          motive,
          date: selectedDate,
          time: toTimeSec(time),
        };
        if (isEdit && initialHoliday) {
          const res = await updateEvent(initialHoliday.id, payload);
          onSave({
            id: String(res.id),
            name: res.title,
            date: res.date,
            type: 'event',
            motive: res.motive,
            time: res.time,
          });
        } else {
          const res = await createEvent(payload);
          onSave({
            id: String(res.id),
            name: res.title,
            date: res.date,
            type: 'event',
            motive: res.motive,
            time: res.time,
          });
        }
      }
      onClose();
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || (isEdit ? 'Failed to update' : 'Failed to create');
        setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
        throw err;
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div
          className={`p-6 flex justify-between items-center ${
            type === 'holiday' ? 'bg-red-600' : 'bg-indigo-600'
          }`}
        >
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            {isEdit ? (type === 'holiday' ? 'Edit Holiday' : 'Edit Event') : (type === 'holiday' ? 'Create Holiday' : 'Create Event')}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Type Switch */}
          <div className="flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('holiday')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                type === 'holiday'
                  ? 'bg-white shadow-sm text-red-600'
                  : 'text-slate-500'
              }`}
            >
              Holiday
            </button>
            <button
              type="button"
              onClick={() => setType('event')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                type === 'event'
                  ? 'bg-white shadow-sm text-indigo-600'
                  : 'text-slate-500'
              }`}
            >
              Event
            </button>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-slate-700 mb-1.5 uppercase tracking-widest text-[10px] font-bold">
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

            {/* ✅ Date Picker */}
            <div>
              <label className="block text-slate-700 mb-1.5 uppercase tracking-widest text-[10px] font-bold">
                Select Date
              </label>
              <input
                type="date"
                required
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500/20"
              />
            </div>

            {/* Event fields (holiday has no extra fields) */}
            {type === 'event' && (
              <div className="space-y-4 animate-in slide-in-from-top duration-300">
                <div>
                  <label className="block text-slate-700 mb-1.5 uppercase tracking-widest text-[10px] font-bold">
                    Event Motive
                  </label>
                  <input
                    required
                    value={motive}
                    onChange={(e) => setMotive(e.target.value)}
                    placeholder="What is the goal of this event?"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 mb-1.5 uppercase tracking-widest text-[10px] font-bold">
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
                    Scheduled for{' '}
                    {format(new Date(selectedDate), 'EEEE, MMM do')}
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
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
              disabled={isPending}
              className={`flex-[2] px-4 py-3 text-sm font-bold text-white rounded-xl shadow-lg disabled:opacity-60 ${
                type === 'holiday'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isPending ? 'Saving...' : (isEdit ? 'Save' : `Create ${type === 'holiday' ? 'Holiday' : 'Event'}`)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
