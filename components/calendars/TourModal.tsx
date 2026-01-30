import React, { useState } from 'react';
import { format , addDays} from 'date-fns';
import { Tour } from './types';
import { ALL_USERS } from './constants';

interface TourModalProps {
  date: Date;
  onClose: () => void;
  onSave: (tour: Tour) => void;
}

export const TourModal: React.FC<TourModalProps> = ({
  date,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(3);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: Math.random().toString(36).substr(2, 9),
      name,
      location,
      description,
      startDate: format(date, 'yyyy-MM-dd'),
      endDate: format(addDays(date, duration - 1), 'yyyy-MM-dd'),
      attendees: selectedUsers,
    });
  };

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-amber-500 p-6 flex justify-between items-center text-white">
          <h2 className="text-xl font-bold flex items-center gap-2">
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
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Plan New Tour
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

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-widest text-[10px]">
                Tour Name
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer Retreat 2024"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-widest text-[10px]">
                Location
              </label>
              <input
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bali, Indonesia"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-widest text-[10px]">
                Duration (Days)
              </label>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">
                Ends on: {format(addDays(date, duration - 1), 'MMM do')}
              </p>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-widest text-[10px]">
                Select Members
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-3 border rounded-xl bg-slate-50">
                {ALL_USERS.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUser(user.id)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs font-medium text-slate-700">
                      {user.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-widest text-[10px]">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Planned activities and itinerary..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none resize-none transition-all"
              />
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-[2] px-4 py-3 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-500/20 transition-all"
            >
              Create Tour
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
