import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle, Plus, X,
  ChevronDown, Loader2, FileText, Trash2, RefreshCw, Info, Search, UserCircle2,
} from 'lucide-react';
import { addDays, format, parseISO, isWeekend, isBefore, startOfToday } from 'date-fns';
import type { User } from '../../types';
import type { LeaveRequest, LeaveBalance, LeaveDay, HalfDaySlot } from '../../types';
import { createLeaveApplication, getLeaveHistory } from '../../services/api';
import { useEmployeesQuery } from '../../hooks/useEmployees';
import { useLeaveHolidays } from '../../hooks/useLeaveHolidays';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = () => format(startOfToday(), 'yyyy-MM-dd');

function calcEndDate(startDate: string, durationDays: number, holidayDates?: Set<string>): string {
  if (!startDate || durationDays < 1) return startDate;
  const isNonWorking = (d: Date) => isWeekend(d) || (holidayDates?.has(format(d, 'yyyy-MM-dd')) ?? false);
  let d = parseISO(startDate);
  let counted = 0;
  while (counted < durationDays) {
    if (!isNonWorking(d)) counted++;
    if (counted < durationDays) d = addDays(d, 1);
  }
  return format(d, 'yyyy-MM-dd');
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'dd MMM yyyy'); } catch { return dateStr; }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  try { return format(new Date(dateStr), 'dd MMM yyyy, hh:mm a'); } catch { return dateStr; }
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
// Display status with exact spelling: "Approved", "Pending", "Rejected"
function normalizeLeaveStatus(s: string | undefined): 'Approved' | 'Pending' | 'Rejected' | 'Cancelled' {
  const t = (s || '').toLowerCase().trim();
  if (t === 'approved') return 'Approved';
  if (t === 'rejected') return 'Rejected';
  if (t === 'cancelled') return 'Cancelled';
  return 'Pending';
}

const StatusBadge: React.FC<{ status: LeaveRequest['status'] }> = ({ status }) => {
  const norm = normalizeLeaveStatus(status);
  const map: Record<string, string> = {
    Pending:   'bg-amber-100 text-amber-700 border border-amber-200',
    Approved:  'bg-emerald-100 text-emerald-700 border border-emerald-200',
    Rejected:  'bg-red-100 text-red-700 border border-red-200',
    Cancelled: 'bg-gray-100 text-gray-500 border border-gray-200',
  };
  const icons: Record<string, React.ReactNode> = {
    Pending:   <Clock size={11} />,
    Approved:  <CheckCircle2 size={11} />,
    Rejected:  <XCircle size={11} />,
    Cancelled: <X size={11} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[norm] ?? 'bg-gray-100 text-gray-500'}`}>
      {icons[norm]}
      {norm}
    </span>
  );
};

// ─── Summary Card ─────────────────────────────────────────────────────────────

const SummaryCard: React.FC<{
  label: string; value: number | string; sub?: string;
  color: string; icon: React.ReactNode;
}> = ({ label, value, sub, color, icon }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 flex items-start gap-3">
    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">{value}</p>
      <p className="text-xs font-medium text-gray-500 mt-0.5 leading-tight">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{sub}</p>}
    </div>
  </div>
);

// ─── Apply Leave Form ─────────────────────────────────────────────────────────

interface ApplyFormProps {
  balance: LeaveBalance | null;
  existingRequests: LeaveRequest[];
  onSuccess: () => void;
  holidayDates: Set<string>;
}

const LEAVE_TITLE_PRESETS = ['Casual Leave', 'Medical Leave', 'Sick Leave'] as const;

const ApplyLeaveForm: React.FC<ApplyFormProps> = ({ balance, existingRequests, onSuccess, holidayDates }) => {
  const [leaveTitle, setLeaveTitle]       = useState<string>('Casual Leave');
  const [customTitle, setCustomTitle]     = useState('');
  const [isCustomTitle, setIsCustomTitle] = useState(false);
  const [leaveDay, setLeaveDay]           = useState<LeaveDay>('Full Day');
  const [startDate, setStartDate]         = useState('');
  const [duration, setDuration]           = useState(1);
  const [halfDaySlot, setHalfDaySlot]     = useState<HalfDaySlot>('First Half');
  const [description, setDescription]     = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [success, setSuccess]             = useState(false);

  const finalLeaveTitle = isCustomTitle ? customTitle.trim() : leaveTitle;
  const endDate   = leaveDay === 'Full Day' ? calcEndDate(startDate, duration, holidayDates) : startDate;
  const deduction = leaveDay === 'Half Day' ? 0.5 : duration;
  const remaining = balance ? balance.remaining_balance : 0;

  const validate = (): string | null => {
    if (isCustomTitle && !customTitle.trim()) return 'Please enter a leave title.';
    if (!startDate) return 'Please select a date.';
    const start = parseISO(startDate);
    if (isBefore(start, startOfToday())) return 'Cannot apply for a past date.';
    const isHolidayOrWeekend = isWeekend(start) || holidayDates.has(format(start, 'yyyy-MM-dd'));
    if (leaveDay === 'Half Day' && isHolidayOrWeekend) return 'Half-day leave cannot be on Saturday, Sunday, or a company holiday.';
    if (leaveDay === 'Full Day' && isHolidayOrWeekend) return 'Start date cannot be Saturday, Sunday, or a company holiday.';
    if (leaveDay === 'Full Day' && duration < 1) return 'Duration must be at least 1 day.';
    if (deduction > remaining) return `Insufficient leave balance. You have ${remaining} day(s) remaining.`;
    for (const req of existingRequests) {
      if (normalizeLeaveStatus(req.status) === 'Cancelled' || normalizeLeaveStatus(req.status) === 'Rejected') continue;
      const reqStart = parseISO(req.start_date);
      const reqEnd   = parseISO(req.end_date);
      const newStart = parseISO(startDate);
      const newEnd   = parseISO(endDate);
      if (newStart <= reqEnd && newEnd >= reqStart) {
        if (leaveDay === 'Half Day' && req.leave_day === 'Half Day' && req.half_day_slot !== halfDaySlot) continue;
        return `You already have a leave request overlapping ${formatDateDisplay(req.start_date)} – ${formatDateDisplay(req.end_date)}.`;
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) { setError(err); return; }

    const body = leaveDay === 'Full Day'
      ? {
          start_date: startDate,
          duration_of_days: duration,
          leave_subject: finalLeaveTitle || 'Leave',
          reason: description,
          leave_type: 'Full_day' as const,
        }
      : {
          start_date: startDate,
          leave_subject: finalLeaveTitle || 'Leave',
          reason: description,
          leave_type: 'Half_day' as const,
          half_day_slots: (halfDaySlot === 'First Half' ? 'First_Half' : 'Second_Half') as 'First_Half' | 'Second_Half',
        };

    setSubmitting(true);
    try {
      await createLeaveApplication(body);
      setSuccess(true);
      setLeaveTitle('Casual Leave');
      setCustomTitle('');
      setIsCustomTitle(false);
      setStartDate('');
      setDuration(1);
      setDescription('');
      setTimeout(() => { setSuccess(false); onSuccess(); }, 1500);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.detail || err?.message || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
          <CheckCircle2 size={16} /> Leave request submitted successfully!
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Leave Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Leave Title</label>
        <div className="flex flex-wrap gap-2">
          {LEAVE_TITLE_PRESETS.map((preset) => (
            <button
              key={preset} type="button"
              onClick={() => { setLeaveTitle(preset); setIsCustomTitle(false); setCustomTitle(''); setError(null); }}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                !isCustomTitle && leaveTitle === preset
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400 hover:text-brand-600'
              }`}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setIsCustomTitle(true); setError(null); }}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              isCustomTitle
                ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400 hover:text-brand-600'
            }`}
          >
            Custom…
          </button>
        </div>
        {isCustomTitle && (
          <input
            type="text" value={customTitle} maxLength={80} autoFocus
            onChange={(e) => { setCustomTitle(e.target.value); setError(null); }}
            placeholder="e.g. Maternity Leave, Bereavement Leave..."
            className="mt-2 w-full px-3 py-2.5 border border-brand-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        )}
      </div>

      {/* Leave Duration type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Leave Duration</label>
        <div className="grid grid-cols-2 gap-2">
          {(['Full Day', 'Half Day'] as LeaveDay[]).map((type) => (
            <button
              key={type} type="button"
              onClick={() => { setLeaveDay(type); setError(null); }}
              className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-all ${
                leaveDay === type
                  ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400 hover:text-brand-600'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {leaveDay === 'Full Day' ? (
        <>
          {/* Full Day: date + stepper side by side on md+, stacked on small */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date (working days only — Sat, Sun & holidays not allowed)</label>
              <input
                type="date" value={startDate} min={today()}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) { setStartDate(''); setError(null); return; }
                  const d = parseISO(val);
                  const isHolidayOrWeekend = isWeekend(d) || holidayDates.has(format(d, 'yyyy-MM-dd'));
                  if (isHolidayOrWeekend) {
                    setError('Saturday, Sunday and company holidays are not allowed. Please select a working day.');
                    return;
                  }
                  setStartDate(val);
                  setError(null);
                }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (working days — Sat, Sun & holidays excluded)</label>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-transparent">
                <button
                  type="button"
                  onClick={() => { setDuration((d) => Math.max(1, d - 1)); setError(null); }}
                  className="px-3 py-2.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600 transition-colors text-lg font-medium select-none"
                >−</button>
                <input
                  type="number" value={duration} min={1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1) { setDuration(val); setError(null); }
                    else if (e.target.value === '') { setDuration(1); setError(null); }
                  }}
                  className="flex-1 text-center py-2.5 text-sm font-semibold text-gray-800 bg-white focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => { setDuration((d) => d + 1); setError(null); }}
                  className="px-3 py-2.5 text-gray-500 hover:bg-gray-100 hover:text-brand-600 transition-colors text-lg font-medium select-none"
                >+</button>
              </div>
            </div>
          </div>
          {startDate && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <Info size={13} className="shrink-0" />
              <span>End Date (working days only — Sat, Sun & company holidays excluded):</span>
              <span className="font-semibold text-gray-700">{formatDateDisplay(endDate)}</span>
            </div>
          )}
        </>
      ) : (
        /* Half Day: date + slot stacked always (slot has 2 rows, no need for side-by-side on tiny screens) */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date (weekdays only — Sat, Sun & holidays not allowed)</label>
            <input
              type="date" value={startDate} min={today()}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) { setStartDate(''); setError(null); return; }
                const d = parseISO(val);
                const isHolidayOrWeekend = isWeekend(d) || holidayDates.has(format(d, 'yyyy-MM-dd'));
                if (isHolidayOrWeekend) {
                  setError('Saturday, Sunday and company holidays are not allowed. Please select a working day.');
                  return;
                }
                setStartDate(val);
                setError(null);
              }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Half Day Slot</label>
            <div className="flex flex-col gap-2">
              {(['First Half', 'Second Half'] as HalfDaySlot[]).map((slot) => (
                <label
                  key={slot}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all select-none ${
                    halfDaySlot === slot
                      ? 'border-brand-500 bg-brand-50 text-brand-800'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50/40'
                  }`}
                >
                  <input
                    type="radio" name="halfDaySlot" value={slot}
                    checked={halfDaySlot === slot}
                    onChange={() => { setHalfDaySlot(slot); setError(null); }}
                    className="accent-brand-600 w-4 h-4 shrink-0"
                  />
                  <span className="text-sm font-medium">{slot}</span>
                  <span className="ml-auto text-xs text-gray-400 hidden sm:inline">
                    {slot === 'First Half' ? '9 AM–1 PM' : '2–6 PM'}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason / Description</label>
        <textarea
          value={description} rows={3}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Briefly describe the reason for your leave..."
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
          required
        />
      </div>

      {balance && (
        <div className={`text-xs rounded-lg px-3 py-2 border ${
          deduction > remaining
            ? 'bg-red-50 border-red-200 text-red-600'
            : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          This request will deduct <strong>{deduction}</strong> day(s) from your balance.
          After approval: <strong>{Math.max(0, remaining - deduction)}</strong> days remaining.
        </div>
      )}

      <button
        type="submit" disabled={submitting}
        className="w-full py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting
          ? <><Loader2 size={16} className="animate-spin" /> Submitting...</>
          : <><Plus size={16} /> Submit Leave Request</>}
      </button>
    </form>
  );
};

// ─── Leave History Table ───────────────────────────────────────────────────────

interface HistoryTableProps {
  requests: LeaveRequest[];
  loading: boolean;
  onCancel: (id: string) => Promise<void>;
  cancellingId: string | null;
  readOnly?: boolean;
}

const LeaveHistoryTable: React.FC<HistoryTableProps> = ({ requests, loading, onCancel, cancellingId, readOnly = false }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading history...
      </div>
    );
  }
  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <FileText size={36} className="mb-2 opacity-40" />
        <p className="text-sm">No leave requests found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-sm min-w-[640px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3">Type</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3">Date / Duration</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3 hidden md:table-cell">Description</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3 hidden lg:table-cell">Applied On</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3">Status</th>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-3 hidden xl:table-cell">HR Comment</th>
            <th className="py-3 px-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {requests.map((req) => (
            <tr key={req.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 px-3">
                {req.leave_title && (
                  <div className="font-semibold text-gray-800 text-sm leading-tight">{req.leave_title}</div>
                )}
                <div className={`text-xs mt-0.5 ${req.leave_title ? 'text-gray-400' : 'font-medium text-gray-800 text-sm'}`}>{req.leave_day}</div>
                {req.leave_day === 'Half Day' && (
                  <div className="text-xs text-gray-400 mt-0.5">{req.half_day_slot}</div>
                )}
              </td>
              <td className="py-3 px-3 whitespace-nowrap">
                <div className="text-gray-800 text-sm">{formatDateDisplay(req.start_date)}</div>
                {req.leave_day === 'Full Day' && req.end_date !== req.start_date && (
                  <div className="text-xs text-gray-400 mt-0.5">→ {formatDateDisplay(req.end_date)}</div>
                )}
                <div className="text-xs text-gray-400 mt-0.5">
                  {req.duration} day{req.duration !== 1 ? 's' : ''}
                </div>
              </td>
              <td className="py-3 px-3 max-w-[160px] hidden md:table-cell">
                <p className="text-gray-600 text-xs truncate" title={req.description}>{req.description || '—'}</p>
              </td>
              <td className="py-3 px-3 text-gray-500 text-xs whitespace-nowrap hidden lg:table-cell">{formatDateTime(req.applied_on)}</td>
              <td className="py-3 px-3 whitespace-nowrap"><StatusBadge status={req.status} /></td>
              <td className="py-3 px-3 max-w-[140px] hidden xl:table-cell">
                {req.hr_comment
                  ? <p className="text-xs text-gray-500 italic truncate" title={req.hr_comment}>{req.hr_comment}</p>
                  : <span className="text-gray-300 text-xs">—</span>}
              </td>
              <td className="py-3 px-3 text-right whitespace-nowrap">
                {!readOnly && normalizeLeaveStatus(req.status) === 'Pending' && (
                  <button
                    onClick={() => onCancel(req.id)}
                    disabled={cancellingId === req.id}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {cancellingId === req.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Employee Selector ────────────────────────────────────────────────────────

interface EmployeeSelectorProps {
  users: User[];
  selectedId: string;
  onSelect: (user: User) => void;
  currentUser: User;
}

const EmployeeSelector: React.FC<EmployeeSelectorProps> = ({ users, selectedId, onSelect, currentUser }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);
  const dropRef             = useRef<HTMLDivElement>(null);

  const filtered = users
    .filter((u) => u.id !== currentUser.id)
    .filter((u) =>
      !search.trim() ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.Employee_id ?? '').includes(search) ||
      u.id.includes(search)
    );

  const selected = users.find((u) => u.id === selectedId);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={dropRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all shadow-sm ${
          selectedId
            ? 'bg-brand-50 border-brand-300 text-brand-800'
            : 'bg-white border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-600'
        }`}
      >
        <UserCircle2 size={15} className={selectedId ? 'text-brand-600' : 'text-gray-400'} />
        <span className="truncate max-w-[120px]">{selected ? selected.name : 'View employee'}</span>
        <ChevronDown size={13} className={`ml-1 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
        {selectedId && (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onSelect(currentUser); setSearch(''); }}
            className="ml-1 p-0.5 rounded-full hover:bg-brand-200 text-brand-500 hover:text-brand-700 shrink-0"
            title="Back to my data"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-30">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus type="text" placeholder="Search by name or ID..."
                value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onSelect(currentUser); setOpen(false); setSearch(''); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-brand-50 transition-colors text-left ${!selectedId ? 'bg-brand-50' : ''}`}
            >
              <img
                src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full object-cover border border-gray-200 shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=random`; }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{currentUser.name} <span className="text-xs text-brand-500 font-normal">(Me)</span></p>
                <p className="text-xs text-gray-400 truncate">{currentUser.designation || currentUser.role}</p>
              </div>
              {!selectedId && <CheckCircle2 size={14} className="text-brand-600 shrink-0" />}
            </button>

            {filtered.length > 0 && <div className="mx-3 my-1 border-t border-gray-100" />}

            {filtered.map((u) => (
              <button
                key={u.id} type="button"
                onClick={() => { onSelect(u); setOpen(false); setSearch(''); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors text-left ${selectedId === u.id ? 'bg-gray-50' : ''}`}
              >
                <img
                  src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                  alt={u.name}
                  className="w-7 h-7 rounded-full object-cover border border-gray-200 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.designation || u.role} {u.Employee_id ? `· ${u.Employee_id}` : ''}</p>
                </div>
                {selectedId === u.id && <CheckCircle2 size={14} className="text-brand-600 shrink-0" />}
              </button>
            ))}

            {filtered.length === 0 && search.trim() && (
              <p className="text-sm text-gray-400 text-center py-4">No employees match "{search}".</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface EmployeeLeavePageProps {
  currentUser: User;
}

export const EmployeeLeavePage: React.FC<EmployeeLeavePageProps> = ({ currentUser }) => {
  const isTL = (currentUser.role as string) === 'TEAM_LEADER';
  const { data: users = [], isLoading: loadingUsers } = useEmployeesQuery(isTL);
  const { holidayDates } = useLeaveHolidays();
  const canSwitchEmployee = isTL;

  const [viewingUser, setViewingUser]           = useState<User>(currentUser);
  const isViewingSelf = viewingUser.id === currentUser.id;

  const [balance, setBalance]                   = useState<LeaveBalance | null>(null);
  const [requests, setRequests]                 = useState<LeaveRequest[]>([]);
  const [loadingBalance, setLoadingBalance]     = useState(true);
  const [loadingRequests, setLoadingRequests]   = useState(true);
  const [showForm, setShowForm]                 = useState(false);
  const [cancellingId, setCancellingId]         = useState<string | null>(null);
  const [globalError, setGlobalError]           = useState<string | null>(null);

  const mapHistoryToRequest = useCallback((item: {
    id: number;
    start_date: string;
    duration_of_days: number;
    leave_subject: string;
    reason: string;
    leave_type_name: string;
    half_day_slots: string | null;
    hr_approval_status: string;
    md_approval_status: string;
    application_date: string;
    applicant_name: string;
  }): LeaveRequest => {
    const hr = (item.hr_approval_status || '').toLowerCase();
    const md = (item.md_approval_status || '').toLowerCase();
    let status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' = 'Pending';
    if (hr === 'approved' || md === 'approved') status = 'Approved';
    else if (hr === 'rejected' || md === 'rejected') status = 'Rejected';
    const leaveDay = item.leave_type_name === 'Full_day' ? 'Full Day' : 'Half Day';
    const endDate = leaveDay === 'Full Day' && item.duration_of_days > 1
      ? format(addDays(parseISO(item.start_date), item.duration_of_days - 1), 'yyyy-MM-dd')
      : item.start_date;
    const halfSlot = item.half_day_slots === 'First_Half' ? 'First Half' : item.half_day_slots === 'Second_Half' ? 'Second Half' : undefined;
    return {
      id: String(item.id),
      employee_id: '',
      employee_name: item.applicant_name,
      leave_title: item.leave_subject,
      leave_day: leaveDay,
      start_date: item.start_date,
      end_date: endDate,
      duration: item.duration_of_days,
      half_day_slot: halfSlot,
      description: item.reason,
      status,
      applied_on: item.application_date?.includes('T') ? item.application_date : `${item.application_date}T00:00:00`,
    };
  }, []);

  const fetchAll = useCallback(async () => {
    setGlobalError(null);
    setShowForm(false);
    setBalance(null);
    setRequests([]);
    setLoadingBalance(true);
    setLoadingRequests(true);
    try {
      if (isViewingSelf) {
        const history = await getLeaveHistory();
        const mapped = history.map(mapHistoryToRequest);
        setRequests(mapped);
      } else {
        setRequests([]);
      }
    } catch (err: any) {
      setGlobalError(err?.response?.data?.detail || err?.message || 'Failed to load leave history.');
      setRequests([]);
    } finally {
      setLoadingBalance(false);
      setLoadingRequests(false);
    }
  }, [isViewingSelf, mapHistoryToRequest]);

  useEffect(() => {
    setBalance(null);
    setRequests([]);
    setLoadingBalance(true);
    setLoadingRequests(true);
    fetchAll();
  }, [fetchAll]);

  const handleCancel = async (_id: string) => {
    // API calls disabled — panel is under development
    void _id;
    void setCancellingId;
  };

  const handleSelectEmployee = (user: User) => setViewingUser(user);

  const pending  = requests.filter((r) => normalizeLeaveStatus(r.status) === 'Pending').length;
  const approved = requests.filter((r) => normalizeLeaveStatus(r.status) === 'Approved').length;
  const rejected = requests.filter((r) => normalizeLeaveStatus(r.status) === 'Rejected').length;

  return (
    <div className="space-y-4 w-full">
      {/* Under Development Banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl shadow-sm">
        <span className="text-xl mt-0.5 shrink-0">🚧</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800">This panel is currently under development</p>
          <p className="text-xs text-amber-700 mt-0.5">Features may be incomplete or non-functional. Please do not use this panel for actual leave requests until further notice.</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Leave Management</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {isViewingSelf
              ? 'Manage your leave requests and track balances'
              : `Viewing leave data for ${viewingUser.name}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setLoadingBalance(true); setLoadingRequests(true); fetchAll(); }}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>

          {canSwitchEmployee && (
            loadingUsers ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-400 bg-white">
                <Loader2 size={13} className="animate-spin" /> Loading…
              </div>
            ) : (
              <EmployeeSelector
                users={users}
                selectedId={isViewingSelf ? '' : viewingUser.id}
                onSelect={handleSelectEmployee}
                currentUser={currentUser}
              />
            )
          )}

          {isViewingSelf && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 bg-brand-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm"
            >
              {showForm ? <X size={15} /> : <Plus size={15} />}
              {showForm ? 'Close' : 'Apply for Leave'}
            </button>
          )}
        </div>
      </div>

      {/* Viewing-other banner */}
      {!isViewingSelf && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-brand-50 border border-brand-200 rounded-xl text-sm text-brand-800">
          <UserCircle2 size={17} className="text-brand-600 shrink-0" />
          <div className="flex-1 min-w-0">
            Viewing <strong>{viewingUser.name}</strong>'s leave data
            {viewingUser.designation ? ` · ${viewingUser.designation}` : ''}.
            <span className="ml-1 text-brand-500">(Read-only)</span>
          </div>
          <button
            onClick={() => setViewingUser(currentUser)}
            className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-800 bg-white border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-100 transition-colors shrink-0"
          >
            <X size={12} /> Back to my data
          </button>
        </div>
      )}

      {globalError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {globalError}
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setGlobalError(null)}><X size={14} /></button>
        </div>
      )}

      {/* Summary Cards — 2 cols on small, 4 on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          label="Total Credit" icon={<CalendarDays size={18} className="text-blue-600" />}
          color="bg-blue-50"
          value={loadingBalance ? '–' : (balance?.total_credit ?? 0)}
          sub="Annual allocation"
        />
        <SummaryCard
          label="Used Leaves" icon={<CheckCircle2 size={18} className="text-emerald-600" />}
          color="bg-emerald-50"
          value={loadingBalance ? '–' : (balance?.used_leaves ?? 0)}
          sub="Approved + deducted"
        />
        <SummaryCard
          label="Remaining" icon={<Clock size={18} className="text-brand-600" />}
          color="bg-brand-50"
          value={loadingBalance ? '–' : (balance?.remaining_balance ?? 0)}
          sub="Available to use"
        />
        <SummaryCard
          label="Pending" icon={<AlertCircle size={18} className="text-amber-600" />}
          color="bg-amber-50"
          value={loadingRequests ? '–' : pending}
          sub="Awaiting HR review"
        />
      </div>

      {/* Apply Form */}
      {showForm && isViewingSelf && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 text-sm sm:text-base flex items-center gap-2">
              <Plus size={16} className="text-brand-600" /> Apply for Leave
            </h3>
            <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
              <X size={15} />
            </button>
          </div>
          {/* Two-column layout on xl: form left, info right */}
          <div className="p-4 sm:p-5">
            <ApplyLeaveForm
              balance={balance}
              existingRequests={requests}
              holidayDates={holidayDates}
              onSuccess={() => {
                setShowForm(false);
                setLoadingBalance(true);
                setLoadingRequests(true);
                fetchAll();
              }}
            />
          </div>
        </div>
      )}

      {/* Leave History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100 gap-2">
          <h3 className="font-semibold text-gray-800 text-sm sm:text-base flex items-center gap-2">
            <FileText size={16} className="text-gray-500" />
            {isViewingSelf ? 'Leave History' : `${viewingUser.name}'s Leave History`}
          </h3>
          <div className="flex items-center gap-2 sm:gap-3 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> {approved} Approved</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> {pending} Pending</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> {rejected} Rejected</span>
          </div>
        </div>
        <LeaveHistoryTable
          requests={[...requests].sort((a, b) => new Date(b.applied_on).getTime() - new Date(a.applied_on).getTime())}
          loading={loadingRequests}
          onCancel={handleCancel}
          cancellingId={cancellingId}
          readOnly={!isViewingSelf}
        />
      </div>
    </div>
  );
};

export default EmployeeLeavePage;
