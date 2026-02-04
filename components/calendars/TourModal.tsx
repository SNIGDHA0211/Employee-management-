import React, { useState, useEffect } from 'react';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { Tour } from './types';
import { createTour, updateTour, getEmployees } from '../../services/api';

interface TourModalProps {
  date: Date;
  onClose: () => void;
  onSave: (tour: Tour) => void;
  initialTour?: Tour | null;
}

export const TourModal: React.FC<TourModalProps> = ({
  date,
  onClose,
  onSave,
  initialTour,
}) => {
  const isEdit = !!initialTour;
  const [name, setName] = useState(initialTour?.name ?? '');
  const [location, setLocation] = useState(initialTour?.location ?? '');
  const [description, setDescription] = useState(initialTour?.description ?? '');
  const [duration, setDuration] = useState(
    initialTour ? Math.max(1, differenceInDays(parseISO(initialTour.endDate), parseISO(initialTour.startDate)) + 1) : 3
  );
  const [selectedUsers, setSelectedUsers] = useState<string[]>(initialTour?.attendees ?? []);
  const [tourDate, setTourDate] = useState(initialTour?.startDate ?? format(date, 'yyyy-MM-dd'));
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEmployees()
      .then((list) => {
        const mapped = list.map((emp: any) => {
          const id = String(emp['Employee_id'] ?? emp['Employee ID'] ?? emp.id ?? '');
          const name = emp['Name'] ?? emp['Full Name'] ?? emp.name ?? 'Unknown';
          return { id, name };
        });
        setEmployees(mapped);
      })
      .catch(() => setEmployees([]))
      .finally(() => setEmployeesLoading(false));
  }, []);

  useEffect(() => {
    if (initialTour) {
      setName(initialTour.name);
      setLocation(initialTour.location);
      setDescription(initialTour.description ?? '');
      setTourDate(initialTour.startDate);
      setDuration(Math.max(1, differenceInDays(parseISO(initialTour.endDate), parseISO(initialTour.startDate)) + 1));
      setSelectedUsers(initialTour.attendees ?? []);
    }
  }, [initialTour]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0) {
      setError('Please select at least one member.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload = {
        tour_name: name,
        starting_date: tourDate,
        location,
        duration_days: duration,
        description: description || null,
        members: selectedUsers,
      };
      const res = isEdit && initialTour
        ? await updateTour(initialTour.id, payload)
        : await createTour(payload);
      const memberDetails = res.member_details || [];
      const attendees = memberDetails.map((m: any) => String(m.username ?? m.id ?? ''));
      const attendeeNames: Record<string, string> = {};
      memberDetails.forEach((m: any) => {
        const id = String(m.username ?? m.id ?? m.Employee_id ?? '');
        const fullName = m.full_name ?? m['full_name'] ?? m['Full Name'] ?? m.name ?? m.Name ?? 'Unknown';
        if (id) attendeeNames[id] = fullName;
      });
      const tour: Tour = {
        id: String(res.id),
        name: res.tour_name || name,
        location: res.location || location,
        description: res.description ?? undefined,
        startDate: res.starting_date || tourDate,
        endDate: format(addDays(new Date(res.starting_date || tourDate), (res.duration_days ?? duration) - 1), 'yyyy-MM-dd'),
        attendees,
        attendeeNames,
      };
      onSave(tour);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || (isEdit ? 'Failed to update tour' : 'Failed to create tour');
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (id: string) => {
    setSelectedUsers((prev) =>
      prev.includes(id) ? prev.filter((u) => u !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-1">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-amber-500 px-5 py-4 flex justify-between items-center text-white">
          <h2 className="text-lg font-bold flex items-center gap-1">
            {isEdit ? 'Edit Tour' : 'Plan New Tour'}
          </h2>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Tour Name */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-widest">
                Tour Name
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Summer Retreat 2024"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            </div>

            {/* Location */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-widest">
                Location
              </label>
              <input
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bali, Indonesia"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            </div>

            {/* Tour Date */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-widest">
                Tour Date
              </label>
              <input
                type="date"
                required
                value={tourDate}
                onChange={(e) => setTourDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
            </div>

            {/* Duration */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-widest">
                Duration (Days)
              </label>
              <input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
              />
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">
                Ends on:{' '}
                {format(
                  addDays(new Date(tourDate), duration - 1),
                  'MMM do'
                )}
              </p>
            </div>

            {/* Members */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-widest">
                Select Members (required)
              </label>
              <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto p-2 border rounded-xl bg-slate-50">
                {employeesLoading ? (
                  <span className="col-span-2 text-xs text-slate-500">Loading...</span>
                ) : (
                  employees.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 p-1 rounded-lg hover:bg-white cursor-pointer"
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
                  ))
                )}
              </div>
            </div>

            {error && (
              <div className="col-span-2 p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                {error}
              </div>
            )}

            {/* Description */}
            <div className="col-span-2">
              <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-widest">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Planned activities and itinerary..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-1 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] px-4 py-2.5 text-sm font-bold text-white bg-amber-500 rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-500/20 disabled:opacity-60"
            >
              {loading ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save' : 'Create Tour')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
