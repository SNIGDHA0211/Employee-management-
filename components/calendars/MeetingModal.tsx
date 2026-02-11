import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Meeting, MeetingType, MeetingStatus } from './types';
import { CURRENT_USER } from './constants';
import { getRooms, createBookSlot, updateBookSlot, type Room } from '../../services/api';
import type { User } from '../../types';

interface MeetingModalProps {
  date: Date;
  onClose: () => void;
  onSave: (meeting: Meeting) => void;
  currentUser?: User | null;
  initialMeeting?: Meeting | null;
  employees?: Array<{ id: string; name: string }>;
}

export const MeetingModal: React.FC<MeetingModalProps> = ({
  date,
  onClose,
  onSave,
  currentUser,
  initialMeeting,
  employees: employeesProp = [],
}) => {
  const isEdit = !!initialMeeting;
  const displayUser = currentUser || CURRENT_USER;
  const [title, setTitle] = useState(initialMeeting?.title ?? '');
  const [description, setDescription] = useState(initialMeeting?.description ?? '');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [hallName, setHallName] = useState(initialMeeting?.hallName ?? '');
  const [startTime, setStartTime] = useState(initialMeeting?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(initialMeeting?.endTime ?? '10:00');
  const [type, setType] = useState<MeetingType>(initialMeeting?.type ?? MeetingType.INDIVIDUAL);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(initialMeeting?.attendees ?? []);
  const employees = employeesProp;
  const employeesLoading = false;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRooms().then((list) => {
      setRooms(list);
      if (list.length > 0 && !initialMeeting) setHallName((prev) => prev || list[0].name);
    });
  }, [initialMeeting]);

  useEffect(() => {
    if (initialMeeting) {
      setTitle(initialMeeting.title);
      setDescription(initialMeeting.description ?? '');
      setHallName(initialMeeting.hallName);
      setStartTime(initialMeeting.startTime);
      setEndTime(initialMeeting.endTime);
      setType(initialMeeting.type);
      setSelectedUsers(initialMeeting.attendees ?? []);
    }
  }, [initialMeeting]);


  const toTimeSec = (t: string) => (t && t.length >= 8 ? t.substring(0, 8) : `${t || '09:00'}:00`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const members = type === MeetingType.INDIVIDUAL ? [displayUser.id] : selectedUsers;
    if (members.length === 0) {
      setError('Please select at least one participant for group meetings.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const payload = {
        meeting_title: title,
        date: isEdit && initialMeeting ? initialMeeting.date : format(date, 'yyyy-MM-dd'),
        start_time: toTimeSec(startTime),
        end_time: toTimeSec(endTime),
        room: hallName,
        description: description || null,
        meeting_type: type === MeetingType.INDIVIDUAL ? 'individual' : 'group',
        status: isEdit ? (initialMeeting?.status === MeetingStatus.DONE ? 'Done' : initialMeeting?.status === MeetingStatus.EXCEEDED ? 'Exceeded' : initialMeeting?.status === MeetingStatus.CANCELLED ? 'Cancelled' : 'Pending') : 'Pending',
        members,
      };
      const res = isEdit && initialMeeting
        ? await updateBookSlot(initialMeeting.id, payload)
        : await createBookSlot(payload as any);
      const memberDetails = res.member_details || [];
      const attendees = memberDetails.map((m: any) => String(m.username ?? m.id ?? ''));
      const attendeeNames: Record<string, string> = {};
      memberDetails.forEach((m: any) => {
        attendeeNames[String(m.username ?? m.id ?? '')] = m.full_name ?? m.name ?? 'Unknown';
      });
      const statusStr = (res.status || '').toLowerCase();
      const status =
        statusStr === 'done' ? MeetingStatus.DONE :
        statusStr === 'cancelled' ? MeetingStatus.CANCELLED :
        statusStr === 'exceeded' ? MeetingStatus.EXCEEDED :
        MeetingStatus.PENDING;
      const meeting: Meeting = {
        id: String(res.id),
        title: res.meeting_title || title,
        description: res.description ?? undefined,
        hallName: res.room || hallName,
        startTime: res.start_time ? String(res.start_time).substring(0, 5) : startTime,
        endTime: res.end_time ? String(res.end_time).substring(0, 5) : endTime,
        date: res.date || format(date, 'yyyy-MM-dd'),
        type: res.meeting_type === 'group' ? MeetingType.GROUP : MeetingType.INDIVIDUAL,
        attendees,
        status,
        attendeeNames,
        createdByName: res.creater_details?.full_name,
      };
      onSave(meeting);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || err?.message || (isEdit ? 'Failed to update book slot' : 'Failed to create book slot');
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

  const isDatePast = format(date, 'yyyy-MM-dd') < format(new Date(), 'yyyy-MM-dd');
  const isCreateDisabled = !isEdit && isDatePast;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-indigo-600 p-6 flex justify-between items-center">
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
            {isEdit ? 'Edit' : 'Book'} Meeting Slot
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
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Meeting Title
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Quarterly Review"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Select Hall
              </label>
              <select
                value={hallName}
                onChange={(e) => setHallName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {rooms.length === 0 && (
                  <option value="">Loading rooms…</option>
                )}
                {rooms.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Description
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details of the discussion..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-1.5">
                Meeting Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={type === MeetingType.INDIVIDUAL}
                    onChange={() => setType(MeetingType.INDIVIDUAL)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium">Individual</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={type === MeetingType.GROUP}
                    onChange={() => setType(MeetingType.GROUP)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-sm font-medium">Group Meeting</span>
                </label>
              </div>
            </div>

            {type === MeetingType.GROUP ? (
              <div className="col-span-2">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Select Participants
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-xl bg-slate-50">
                  {employeesLoading ? (
                    <span className="col-span-2 text-sm text-slate-500 p-2">Loading employees…</span>
                  ) : (
                  employees.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 p-1 hover:bg-white rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      <span className="text-xs">{user.name}</span>
                    </label>
                  )))}
                </div>
              </div>
            ) : (
              <div className="col-span-2 p-4 bg-indigo-50 rounded-xl">
                <p className="text-sm font-semibold text-indigo-800 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Individual Booking for: {displayUser.name}
                </p>
              </div>
            )}
            {error && (
              <div className="col-span-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}
            {isCreateDisabled && (
              <div className="col-span-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                Cannot create a meeting for a past date.
              </div>
            )}
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
              disabled={loading || isCreateDisabled}
              className="flex-[2] px-4 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (isEdit ? 'Saving...' : 'Booking...') : (isEdit ? 'Save' : 'Book Slot')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
