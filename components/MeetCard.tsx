import React, { useState, useEffect, useMemo } from 'react';
import { X, Video, Users, MapPin, Clock, Search } from 'lucide-react';
import { meetingPush } from '../services/api';
import type { User } from '../types';
import { useRequestLock } from '../hooks/useRequestLock';

interface MeetCardProps {
  onClose: () => void;
  onMeetingCreated?: () => void;
  currentUser?: User | null;
  rooms?: Array<{ id: number; name: string }>;
  employees?: Array<{ id: string; name: string }>;
}

const CALL_IN_OPTIONS = [
  { label: '1 min', value: 1 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '1 hr', value: 60 },
];

export const MeetCard: React.FC<MeetCardProps> = ({ onClose, onMeetingCreated, currentUser, rooms = [], employees = [] }) => {
  const [selectedRoom, setSelectedRoom] = useState('');
  const [callInMinutes, setCallInMinutes] = useState(10);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { withLock, isPending } = useRequestLock();

  const filteredEmployees = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((emp) => emp.name.toLowerCase().includes(q));
  }, [employees, memberSearch]);

  useEffect(() => {
    if (rooms.length > 0 && !selectedRoom) setSelectedRoom(rooms[0].name);
  }, [rooms, selectedRoom]);

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedMembers.length === 0 && !currentUser?.id) {
      setError('Please select at least one member.');
      return;
    }
    const members = selectedMembers.length > 0 ? selectedMembers : currentUser?.id ? [currentUser.id] : [];
    if (members.length === 0) {
      setError('Please select at least one member.');
      return;
    }

    await withLock(async () => {
      try {
        await meetingPush({
          users: members,
          meeting_type: members.length > 1 ? 'group' : 'individual',
          time: callInMinutes,
          meeting_room: selectedRoom,
        });
        onMeetingCreated?.();
        onClose();
      } catch (err: any) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.detail ||
          err?.message ||
          'Failed to create meeting';
        setError(typeof msg === 'string' ? msg : String(err));
        throw err;
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-brand-600 px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Video size={22} />
            Schedule Meeting
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Meeting Room */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin size={14} className="inline mr-1" />
              Meeting Room
            </label>
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              {rooms.length === 0 && <option value="">Loading rooms...</option>}
              {rooms.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Call in time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock size={14} className="inline mr-1" />
              Call in time
            </label>
            <select
              value={callInMinutes}
              onChange={(e) => setCallInMinutes(Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
            >
              {CALL_IN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Select Members */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Users size={14} className="inline mr-1" />
              Select Members
            </label>
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 text-sm"
              />
            </div>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-1.5">
              {employees.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">Loading members...</p>
              ) : filteredEmployees.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No matching members</p>
              ) : (
                filteredEmployees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(emp.id)}
                      onChange={() => toggleMember(emp.id)}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                    <span className="text-sm">{emp.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
