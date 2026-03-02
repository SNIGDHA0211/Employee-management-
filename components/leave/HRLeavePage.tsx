import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Clock, CheckCircle2, XCircle, AlertCircle, Search,
  ChevronDown, Loader2, RefreshCw, X, FileText, BarChart2, Edit2, CheckCheck, Ban,
  ArrowUpDown, Siren, Plus, Info, UserCircle2,
} from 'lucide-react';
import { format, parseISO, addDays, isWeekend } from 'date-fns';
import type { User } from '../../types';
import type { LeaveRequest, LeaveBalance, ReviewLeavePayload, LeaveDay, HalfDaySlot, EmergencyLeavePayload } from '../../types';
// API calls disabled — panel is under development
// import { getAllLeaveRequests, getAllLeaveBalances, reviewLeaveRequest, adjustLeaveBalance, addEmergencyLeave } from '../../services/api';
import { useEmployeesQuery } from '../../hooks/useEmployees';
import { EmployeeLeavePage } from './EmployeeLeavePage';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'dd MMM yyyy'); } catch { return dateStr; }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  try { return format(new Date(dateStr), 'dd MMM yyyy, hh:mm a'); } catch { return dateStr; }
}

function today(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function calcEndDate(startDate: string, durationDays: number): string {
  if (!startDate || durationDays < 1) return startDate;
  let d = parseISO(startDate);
  let counted = 0;
  while (counted < durationDays) {
    if (!isWeekend(d)) counted++;
    if (counted < durationDays) d = addDays(d, 1);
  }
  return format(d, 'yyyy-MM-dd');
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: LeaveRequest['status'] }> = ({ status }) => {
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {icons[status]}
      {status}
    </span>
  );
};

// ─── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string; value: number | string; color: string; icon: React.ReactNode; sub?: string;
}> = ({ label, value, color, icon, sub }) => (
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

// ─── Review Modal ─────────────────────────────────────────────────────────────

interface ReviewModalProps {
  request: LeaveRequest;
  action: 'Approved' | 'Rejected';
  onConfirm: (comment: string) => Promise<void>;
  onClose: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ request, action, onConfirm, onClose }) => {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isReject = action === 'Rejected';

  const handleConfirm = async () => {
    if (isReject && !comment.trim()) { setError('A reason is required when rejecting a request.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(comment.trim());
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Action failed.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className={`px-6 py-4 border-b border-gray-100 flex items-center gap-3 rounded-t-2xl ${isReject ? 'bg-red-50' : 'bg-emerald-50'}`}>
          {isReject
            ? <Ban size={20} className="text-red-600" />
            : <CheckCheck size={20} className="text-emerald-600" />}
          <h3 className={`font-semibold text-base ${isReject ? 'text-red-700' : 'text-emerald-700'}`}>
            {isReject ? 'Reject Leave Request' : 'Approve Leave Request'}
          </h3>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-white/60 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Request Summary */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5 border border-gray-100">
            <div className="flex justify-between">
              <span className="text-gray-500">Employee</span>
              <span className="font-medium text-gray-800">{request.employee_name}</span>
            </div>
            {request.leave_title && (
              <div className="flex justify-between">
                <span className="text-gray-500">Title</span>
                <span className="font-medium text-gray-800">{request.leave_title}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-medium text-gray-800">{request.leave_day}{request.half_day_slot ? ` — ${request.half_day_slot}` : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Duration</span>
              <span className="font-medium text-gray-800">{formatDateDisplay(request.start_date)}{request.start_date !== request.end_date ? ` → ${formatDateDisplay(request.end_date)}` : ''} ({request.duration} day{request.duration !== 1 ? 's' : ''})</span>
            </div>
            {request.description && (
              <div className="flex justify-between gap-4">
                <span className="text-gray-500 shrink-0">Reason</span>
                <span className="text-gray-700 text-right">{request.description}</span>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isReject ? 'Rejection Reason' : 'Comment (optional)'}
              {isReject && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              value={comment} rows={3}
              onChange={(e) => { setComment(e.target.value); setError(null); }}
              placeholder={isReject ? 'Provide a reason for rejection...' : 'Add an optional comment for the employee...'}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose} disabled={submitting}
              className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm} disabled={submitting}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2 ${
                isReject
                  ? 'bg-red-600 hover:bg-red-700 disabled:opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60'
              }`}
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : (isReject ? <Ban size={15} /> : <CheckCheck size={15} />)}
              {submitting ? 'Processing...' : (isReject ? 'Reject' : 'Approve')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Adjust Balance Modal ─────────────────────────────────────────────────────

interface AdjustModalProps {
  balance: LeaveBalance;
  onConfirm: (totalCredit: number) => Promise<void>;
  onClose: () => void;
}

const AdjustBalanceModal: React.FC<AdjustModalProps> = ({ balance, onConfirm, onClose }) => {
  const [credit, setCredit] = useState(balance.total_credit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (credit < 0) { setError('Credit must be 0 or greater.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(credit);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to adjust balance.');
      setSubmitting(false);
    }
  };

  const newRemaining = Math.max(0, credit - balance.used_leaves);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <Edit2 size={18} className="text-brand-600" />
          <h3 className="font-semibold text-gray-800">Adjust Leave Balance</h3>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1.5 border border-gray-100">
            <div className="flex justify-between">
              <span className="text-gray-500">Employee</span>
              <span className="font-medium text-gray-800">{balance.employee_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Current Credit</span>
              <span className="font-medium">{balance.total_credit} days</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Used</span>
              <span className="font-medium">{balance.used_leaves} days</span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Total Credit (days)</label>
            <input
              type="number" value={credit} min={0} step={0.5}
              onChange={(e) => { setCredit(parseFloat(e.target.value) || 0); setError(null); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            New remaining balance after adjustment: <strong>{newRemaining} days</strong>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={submitting} className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleConfirm} disabled={submitting}
              className="flex-1 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-semibold hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Edit2 size={14} />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Emergency Leave Modal ────────────────────────────────────────────────────

interface EmergencyLeaveModalProps {
  balances: LeaveBalance[];
  onSuccess: (req: LeaveRequest) => void;
  onClose: () => void;
}

const LEAVE_TITLE_PRESETS = ['Casual Leave', 'Medical Leave', 'Sick Leave'] as const;

const EmergencyLeaveModal: React.FC<EmergencyLeaveModalProps> = ({ balances, onSuccess, onClose }) => {
  const [employeeId, setEmployeeId]     = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [leaveTitle, setLeaveTitle]     = useState<string>('Casual Leave');
  const [customTitle, setCustomTitle]   = useState('');
  const [isCustomTitle, setIsCustomTitle] = useState(false);
  const [leaveDay, setLeaveDay]         = useState<LeaveDay>('Full Day');
  const [startDate, setStartDate]       = useState('');
  const [duration, setDuration]         = useState(1);
  const [halfDaySlot, setHalfDaySlot]   = useState<HalfDaySlot>('First Half');
  const [description, setDescription]   = useState('');
  const [hrNote, setHrNote]             = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [empSearch, setEmpSearch]       = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const finalLeaveTitle = isCustomTitle ? customTitle.trim() : leaveTitle;

  // Fetch employees using the shared hook — same source as rest of the app
  const { data: employees = [], isLoading: loadingEmployees } = useEmployeesQuery(true);

  const endDate   = leaveDay === 'Full Day' ? calcEndDate(startDate, duration) : startDate;
  const deduction = leaveDay === 'Half Day' ? 0.5 : duration;

  // Try to find the balance for the selected employee (optional — balance overview may not be loaded)
  const selectedBalance = balances.find(
    (b) => b.employee_id === employeeId || b.employee_name === employeeName
  );

  const q = empSearch.trim().toLowerCase();
  const filteredEmployees = q
    ? employees.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          (u.Employee_id ?? '').toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      )
    : employees;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectEmployee = (u: User) => {
    const empId = u.Employee_id || u.id;
    setEmployeeId(empId);
    setEmployeeName(u.name);
    setEmpSearch(u.name);
    setShowDropdown(false);
    setError(null);
  };

  const validate = (): string | null => {
    if (!employeeId) return 'Please select an employee.';
    if (isCustomTitle && !customTitle.trim()) return 'Please enter a leave title.';
    if (!startDate)  return 'Please select a start date.';
    if (!description.trim()) return 'Please provide a reason / description.';
    if (leaveDay === 'Full Day' && duration < 1) return 'Duration must be at least 1 day.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const err = validate();
    if (err) { setError(err); return; }

    const payload: EmergencyLeavePayload = {
      employee_id: employeeId,
      leave_title: finalLeaveTitle || undefined,
      leave_day: leaveDay,
      start_date: startDate,
      end_date: endDate,
      duration: deduction,
      description: description.trim(),
      hr_note: hrNote.trim() || undefined,
      ...(leaveDay === 'Half Day' ? { half_day_slot: halfDaySlot } : {}),
    };

    setSubmitting(true);
    try {
      // API disabled — panel is under development
      void payload;
      setError('This panel is under development. No data has been submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 bg-orange-50 rounded-t-2xl">
          <Siren size={20} className="text-orange-600" />
          <div>
            <h3 className="font-semibold text-orange-800 text-base leading-tight">Add Emergency Leave</h3>
            <p className="text-xs text-orange-600 mt-0.5">HR-initiated leave entry — auto-approved immediately</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-orange-100 rounded-lg text-orange-400 hover:text-orange-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Notice banner */}
          <div className="flex items-start gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2.5">
            <Info size={13} className="mt-0.5 shrink-0" />
            This entry will be recorded as <strong>Approved</strong> immediately and will deduct from the employee's leave balance.
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          {/* Employee selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Employee <span className="text-red-500">*</span>
            </label>
            <div className="relative" ref={dropdownRef}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder={loadingEmployees ? 'Loading employees…' : 'Search by name or ID…'}
                disabled={loadingEmployees}
                value={empSearch}
                onChange={(e) => {
                  setEmpSearch(e.target.value);
                  setShowDropdown(true);
                  setEmployeeId('');
                  setEmployeeName('');
                  setError(null);
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              />
              {loadingEmployees && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 animate-spin" />
              )}

              {/* Dropdown list */}
              {showDropdown && !loadingEmployees && (filteredEmployees.length > 0 || empSearch.trim()) && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((u) => {
                      const empId = u.Employee_id || u.id;
                      const bal = balances.find((b) => b.employee_id === empId || b.employee_name === u.name);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => selectEmployee(u)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-orange-50 transition-colors text-left"
                        >
                          <img
                            src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                            alt={u.name}
                            className="w-7 h-7 rounded-full object-cover border border-gray-200 shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`; }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-800 truncate">{u.name}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {u.designation || u.role}{empId ? ` · ${empId}` : ''}
                            </p>
                          </div>
                          {bal && (
                            <span className={`text-xs font-semibold shrink-0 ${bal.remaining_balance <= 2 ? 'text-red-500' : 'text-emerald-600'}`}>
                              {bal.remaining_balance} left
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-400">No employees found for "{empSearch}".</div>
                  )}
                </div>
              )}
            </div>
            {selectedBalance && (
              <div className="mt-2 flex items-center gap-3 text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-gray-500">Balance:</span>
                <span className={`font-semibold ${selectedBalance.remaining_balance <= 2 ? 'text-red-600' : 'text-gray-700'}`}>
                  {selectedBalance.remaining_balance} remaining
                </span>
                <span className="text-gray-400">/ {selectedBalance.total_credit} total</span>
              </div>
            )}
          </div>

          {/* Leave Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Leave Title</label>
            <div className="flex flex-wrap gap-2">
              {LEAVE_TITLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => { setLeaveTitle(preset); setIsCustomTitle(false); setCustomTitle(''); setError(null); }}
                  className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                    !isCustomTitle && leaveTitle === preset
                      ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 hover:text-orange-600'
                  }`}
                >
                  {preset}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setIsCustomTitle(true); setError(null); }}
                className={`px-3.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  isCustomTitle
                    ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 hover:text-orange-600'
                }`}
              >
                Custom…
              </button>
            </div>
            {isCustomTitle && (
              <input
                type="text"
                value={customTitle}
                onChange={(e) => { setCustomTitle(e.target.value); setError(null); }}
                placeholder="e.g. Maternity Leave, Bereavement Leave..."
                maxLength={80}
                className="mt-2 w-full px-3 py-2.5 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                autoFocus
              />
            )}
          </div>

          {/* Leave Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Leave Duration</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Full Day', 'Half Day'] as LeaveDay[]).map((type) => (
                <button
                  key={type} type="button"
                  onClick={() => { setLeaveDay(type); setError(null); }}
                  className={`py-2.5 px-4 rounded-lg border text-sm font-medium transition-all ${
                    leaveDay === type
                      ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-orange-400 hover:text-orange-600'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {leaveDay === 'Full Day' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Start Date <span className="text-red-500">*</span></label>
                  <input
                    type="date" value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setError(null); }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (days)</label>
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent">
                    <button
                      type="button"
                      onClick={() => { setDuration((d) => Math.max(1, d - 1)); setError(null); }}
                      className="px-3 py-2.5 text-gray-500 hover:bg-gray-100 hover:text-orange-600 transition-colors text-lg font-medium select-none"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={duration}
                      min={1}
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
                      className="px-3 py-2.5 text-gray-500 hover:bg-gray-100 hover:text-orange-600 transition-colors text-lg font-medium select-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              {startDate && (
                <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  <Info size={12} />
                  End Date (weekends excluded):&nbsp;
                  <span className="font-semibold text-gray-700">{formatDateDisplay(endDate)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Date <span className="text-red-500">*</span></label>
                <input
                  type="date" value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setError(null); }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Half Day Slot</label>
                <div className="flex flex-col gap-2">
                  {(['First Half', 'Second Half'] as HalfDaySlot[]).map((slot) => (
                    <label
                      key={slot}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all select-none ${
                        halfDaySlot === slot
                          ? 'border-orange-400 bg-orange-50 text-orange-800'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="emergencyHalfDaySlot"
                        value={slot}
                        checked={halfDaySlot === slot}
                        onChange={() => setHalfDaySlot(slot)}
                        className="accent-orange-600 w-4 h-4 shrink-0"
                      />
                      <span className="text-sm font-medium">{slot}</span>
                      <span className="ml-auto text-xs text-gray-400">
                        {slot === 'First Half' ? '9:00 AM – 1:00 PM' : '2:00 PM – 6:00 PM'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Deduction preview */}
          {startDate && selectedBalance && (
            <div className={`text-xs rounded-lg px-3 py-2 border ${
              deduction > selectedBalance.remaining_balance
                ? 'bg-red-50 border-red-200 text-red-600'
                : 'bg-orange-50 border-orange-200 text-orange-700'
            }`}>
              This will deduct <strong>{deduction}</strong> day(s).
              {deduction > selectedBalance.remaining_balance
                ? ' ⚠ Exceeds available balance — leave will go negative.'
                : ` Remaining after entry: ${(selectedBalance.remaining_balance - deduction).toFixed(1)} days.`}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Reason / Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description} rows={2}
              onChange={(e) => { setDescription(e.target.value); setError(null); }}
              placeholder="e.g. Medical emergency, family bereavement..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              required
            />
          </div>

          {/* HR Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">HR Note (internal, optional)</label>
            <textarea
              value={hrNote} rows={2}
              onChange={(e) => setHrNote(e.target.value)}
              placeholder="Internal note visible only to HR..."
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={submitting}
              className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={submitting}
              className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Siren size={15} />}
              {submitting ? 'Adding Entry...' : 'Add Emergency Leave'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface FiltersState {
  search: string;
  status: string;
  leaveDay: string;
  startDate: string;
  endDate: string;
}

const INITIAL_FILTERS: FiltersState = { search: '', status: '', leaveDay: '', startDate: '', endDate: '' };

interface FilterBarProps {
  filters: FiltersState;
  onChange: (f: FiltersState) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ filters, onChange }) => {
  const set = (key: keyof FiltersState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...filters, [key]: e.target.value });
  const hasAny = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[160px]">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" placeholder="Search employee..." value={filters.search}
          onChange={set('search')}
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>

      <div className="relative">
        <select value={filters.status} onChange={set('status')}
          className="pl-2.5 pr-7 py-2 text-sm border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Status</option>
          <option>Pending</option>
          <option>Approved</option>
          <option>Rejected</option>
          <option>Cancelled</option>
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      <div className="relative">
        <select value={filters.leaveDay} onChange={set('leaveDay')}
          className="pl-2.5 pr-7 py-2 text-sm border border-gray-200 rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="">All Types</option>
          <option>Full Day</option>
          <option>Half Day</option>
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      <input type="date" value={filters.startDate} onChange={set('startDate')}
        className="px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-[150px]"
        title="Filter from date"
      />
      <input type="date" value={filters.endDate} onChange={set('endDate')}
        className="px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 max-w-[150px]"
        title="Filter to date"
      />

      {hasAny && (
        <button
          onClick={() => onChange(INITIAL_FILTERS)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2.5 py-2 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
        >
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );
};

// ─── Requests Table ───────────────────────────────────────────────────────────

interface RequestsTableProps {
  requests: LeaveRequest[];
  balances: LeaveBalance[];
  loading: boolean;
  onReview: (req: LeaveRequest, action: 'Approved' | 'Rejected') => void;
}

const RequestsTable: React.FC<RequestsTableProps> = ({ requests, balances, loading, onReview }) => {
  const [sortKey, setSortKey] = useState<keyof LeaveRequest>('applied_on');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: keyof LeaveRequest) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...requests].sort((a, b) => {
    const av = String(a[sortKey] ?? '');
    const bv = String(b[sortKey] ?? '');
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const getBalance = (empId: string) => balances.find((b) => b.employee_id === empId);

  const SortBtn: React.FC<{ col: keyof LeaveRequest; label: string }> = ({ col, label }) => (
    <button
      onClick={() => toggleSort(col)}
      className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 transition-colors"
    >
      {label}
      <ArrowUpDown size={11} className={sortKey === col ? 'text-brand-500' : 'text-gray-300'} />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-14 text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading requests...
      </div>
    );
  }
  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-gray-400">
        <FileText size={36} className="mb-2 opacity-40" />
        <p className="text-sm">No leave requests match your filters.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="py-3 px-3 text-left"><SortBtn col="employee_name" label="Employee" /></th>
            <th className="py-3 px-3 text-left"><SortBtn col="leave_day" label="Type" /></th>
            <th className="py-3 px-3 text-left"><SortBtn col="start_date" label="Date / Dur." /></th>
            <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Description</th>
            <th className="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Balance</th>
            <th className="py-3 px-3 text-left hidden lg:table-cell"><SortBtn col="applied_on" label="Applied" /></th>
            <th className="py-3 px-3 text-left"><SortBtn col="status" label="Status" /></th>
            <th className="py-3 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {sorted.map((req) => {
            const bal = getBalance(req.employee_id);
            return (
              <tr key={req.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {(req.employee_name || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 whitespace-nowrap text-sm">{req.employee_name}</p>
                      <p className="text-xs text-gray-400 truncate">{req.employee_id}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-3">
                  {req.leave_title && (
                    <div className="font-semibold text-gray-800 text-sm leading-tight">{req.leave_title}</div>
                  )}
                  <span className={`${req.leave_title ? 'text-xs text-gray-400' : 'font-medium text-gray-700 text-sm'}`}>{req.leave_day}</span>
                  {req.half_day_slot && (
                    <div className="text-xs text-gray-400 mt-0.5">{req.half_day_slot}</div>
                  )}
                </td>
                <td className="py-3 px-3 whitespace-nowrap">
                  <div className="text-gray-800 text-sm">{formatDateDisplay(req.start_date)}</div>
                  {req.end_date !== req.start_date && (
                    <div className="text-xs text-gray-400">→ {formatDateDisplay(req.end_date)}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-0.5">{req.duration} day{req.duration !== 1 ? 's' : ''}</div>
                </td>
                <td className="py-3 px-3 max-w-[160px] hidden lg:table-cell">
                  <p className="text-gray-600 text-xs truncate" title={req.description}>{req.description || '—'}</p>
                </td>
                <td className="py-3 px-3 text-center hidden xl:table-cell">
                  {bal ? (
                    <div>
                      <span className={`font-semibold text-sm ${bal.remaining_balance <= 2 ? 'text-red-600' : 'text-gray-800'}`}>
                        {bal.remaining_balance}
                      </span>
                      <span className="text-gray-400 text-xs"> / {bal.total_credit}</span>
                    </div>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="py-3 px-3 text-gray-500 text-xs whitespace-nowrap hidden lg:table-cell">{formatDateTime(req.applied_on)}</td>
                <td className="py-3 px-3">
                  <div className="flex flex-col gap-1">
                    <StatusBadge status={req.status} />
                    {req.hr_comment && (
                      <p className="text-xs text-gray-400 italic truncate max-w-[100px]" title={req.hr_comment}>{req.hr_comment}</p>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3">
                  {req.status === 'Pending' ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onReview(req, 'Approved')}
                        className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                        title="Approve"
                      >
                        <CheckCheck size={12} /> <span className="hidden sm:inline">Approve</span>
                      </button>
                      <button
                        onClick={() => onReview(req, 'Rejected')}
                        className="flex items-center gap-1 text-xs bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-2 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                        title="Reject"
                      >
                        <Ban size={12} /> <span className="hidden sm:inline">Reject</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400 block text-right pr-1">
                      {req.reviewed_by ? `By ${req.reviewed_by}` : ''}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Balance Overview ─────────────────────────────────────────────────────────

interface BalanceOverviewProps {
  balances: LeaveBalance[];
  loading: boolean;
  onAdjust: (bal: LeaveBalance) => void;
}

const BalanceOverview: React.FC<BalanceOverviewProps> = ({ balances, loading, onAdjust }) => {
  const [search, setSearch] = useState('');
  const filtered = balances.filter((b) =>
    !search || b.employee_name.toLowerCase().includes(search.toLowerCase()) || b.employee_id.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading balances...
      </div>
    );
  }
  if (balances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Users size={36} className="mb-2 opacity-40" />
        <p className="text-sm">No employee balance data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text" placeholder="Search employee..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Employee</th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Total Credit</th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Used</th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Remaining</th>
              <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Usage</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((bal) => {
              const usagePct = bal.total_credit > 0 ? Math.min(100, (bal.used_leaves / bal.total_credit) * 100) : 0;
              const isLow = bal.remaining_balance <= 2;
              return (
                <tr key={bal.employee_id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {(bal.employee_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{bal.employee_name}</p>
                        <p className="text-xs text-gray-400">{bal.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-gray-700">{bal.total_credit}</td>
                  <td className="py-3 px-4 text-center text-gray-600">{bal.used_leaves}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-emerald-600'}`}>
                      {bal.remaining_balance}
                    </span>
                    {isLow && bal.remaining_balance > 0 && (
                      <span className="ml-1 text-xs text-red-400">(Low)</span>
                    )}
                    {bal.remaining_balance === 0 && (
                      <span className="ml-1 text-xs text-red-500">(Exhausted)</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2 justify-center">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${usagePct >= 80 ? 'bg-red-500' : usagePct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{Math.round(usagePct)}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onAdjust(bal)}
                      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 hover:bg-brand-50 px-2.5 py-1.5 rounded-lg transition-colors border border-brand-200"
                    >
                      <Edit2 size={11} /> Adjust
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && search && (
          <p className="text-center text-sm text-gray-400 py-6">No employees match "{search}".</p>
        )}
      </div>
    </div>
  );
};

// ─── Emergency Records View ───────────────────────────────────────────────────

interface EmergencyRecordsViewProps {
  requests: LeaveRequest[];
  balances: LeaveBalance[];
  onAddNew: () => void;
}

const EmergencyRecordsView: React.FC<EmergencyRecordsViewProps> = ({ requests, balances, onAddNew }) => {
  // Emergency leaves are those with status Approved and have hr_comment or reviewed_by set
  // In practice the backend will mark them — we filter by is_emergency flag if present, else show all Approved
  const emergencyLeaves = requests.filter(
    (r) => (r as any).is_emergency === true || ((r as any).source === 'hr_emergency')
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm text-gray-600">
            HR-initiated emergency leave entries that were recorded and approved directly.
          </p>
        </div>
        <button
          onClick={onAddNew}
          className="flex items-center gap-2 text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700 px-4 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={15} /> New Emergency Entry
        </button>
      </div>

      {emergencyLeaves.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-gray-400 bg-orange-50/40 rounded-xl border border-orange-100">
          <Siren size={36} className="mb-2 text-orange-200" />
          <p className="text-sm font-medium text-gray-500">No emergency leave entries recorded.</p>
          <p className="text-xs text-gray-400 mt-1">Use the button above to add one when needed.</p>
          <button
            onClick={onAddNew}
            className="mt-4 flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-800 px-4 py-2 rounded-lg border border-orange-200 hover:bg-orange-50 transition-colors"
          >
            <Plus size={14} /> Add Emergency Leave
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[750px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Employee</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Type</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Date / Duration</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Reason</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">HR Note</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Recorded On</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {emergencyLeaves.map((req) => (
                <tr key={req.id} className="hover:bg-orange-50/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {(req.employee_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 whitespace-nowrap">{req.employee_name}</p>
                        <p className="text-xs text-gray-400">{req.employee_id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {req.leave_title && (
                      <div className="font-semibold text-gray-800 text-sm">{req.leave_title}</div>
                    )}
                    <span className={`${req.leave_title ? 'text-xs text-gray-400' : 'font-medium text-gray-700'}`}>{req.leave_day}</span>
                    {req.half_day_slot && <div className="text-xs text-gray-400">{req.half_day_slot}</div>}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="text-gray-800">{formatDateDisplay(req.start_date)}</div>
                    {req.end_date !== req.start_date && (
                      <div className="text-xs text-gray-400">→ {formatDateDisplay(req.end_date)}</div>
                    )}
                    <div className="text-xs text-gray-400">{req.duration} day{req.duration !== 1 ? 's' : ''}</div>
                  </td>
                  <td className="py-3 px-4 max-w-[180px]">
                    <p className="text-xs text-gray-600 truncate" title={req.description}>{req.description || '—'}</p>
                  </td>
                  <td className="py-3 px-4 max-w-[160px]">
                    <p className="text-xs text-gray-500 italic truncate" title={(req as any).hr_note}>{(req as any).hr_note || <span className="text-gray-300">—</span>}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(req.applied_on)}</td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                      <Siren size={10} /> Emergency
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface HRLeavePageProps {
  currentUser: User;
}

type ActiveView = 'requests' | 'balances' | 'emergency' | 'myleave';

export const HRLeavePage: React.FC<HRLeavePageProps> = ({ currentUser }) => {
  const [view, setView] = useState<ActiveView>('requests');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingBalances, setLoadingBalances] = useState(true);
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [reviewTarget, setReviewTarget] = useState<{ req: LeaveRequest; action: 'Approved' | 'Rejected' } | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<LeaveBalance | null>(null);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencySuccess, setEmergencySuccess] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    // API disabled — panel is under development
    setLoadingRequests(false);
    setRequests([]);
  }, []);

  const fetchBalances = useCallback(async () => {
    // API disabled — panel is under development
    setLoadingBalances(false);
    setBalances([]);
  }, []);

  useEffect(() => { fetchRequests(); fetchBalances(); }, [fetchRequests, fetchBalances]);

  // Client-side filtering
  const filteredRequests = requests.filter((r) => {
    const q = filters.search.toLowerCase();
    if (q && !r.employee_name.toLowerCase().includes(q) && !r.employee_id.includes(q)) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.leaveDay && r.leave_day !== filters.leaveDay) return false;
    if (filters.startDate && r.start_date < filters.startDate) return false;
    if (filters.endDate && r.end_date > filters.endDate) return false;
    return true;
  });

  const handleReview = async (_comment: string) => {
    // API disabled — panel is under development
    void _comment;
    setReviewTarget(null);
  };

  const handleAdjust = async (_totalCredit: number) => {
    // API disabled — panel is under development
    void _totalCredit;
    setAdjustTarget(null);
  };

  const handleEmergencySuccess = (_req: LeaveRequest) => {
    // API disabled — panel is under development
    void _req;
    setShowEmergencyModal(false);
  };

  const total     = requests.length;
  const pending   = requests.filter((r) => r.status === 'Pending').length;
  const approved  = requests.filter((r) => r.status === 'Approved').length;
  const rejected  = requests.filter((r) => r.status === 'Rejected').length;

  return (
    <div className="space-y-4 w-full">
      {/* Under Development Banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl shadow-sm">
        <span className="text-xl mt-0.5 shrink-0">🚧</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800">This panel is currently under development</p>
          <p className="text-xs text-amber-700 mt-0.5">Features may be incomplete or non-functional. Please do not use this panel for actual leave management until further notice.</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">HR Leave Management</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Review, approve and monitor employee leave requests</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { fetchRequests(); fetchBalances(); }}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors border border-gray-200"
          >
            <RefreshCw size={14} /> <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => setShowEmergencyModal(true)}
            className="flex items-center gap-2 text-sm font-semibold bg-orange-600 text-white hover:bg-orange-700 px-3 sm:px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Siren size={15} /> <span className="hidden sm:inline">Add Emergency Leave</span><span className="sm:hidden">Emergency</span>
          </button>
        </div>
      </div>

      {globalError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} className="shrink-0" /> {globalError}
          <button className="ml-auto" onClick={() => setGlobalError(null)}><X size={14} /></button>
        </div>
      )}

      {emergencySuccess && (
        <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-orange-800 text-sm">
          <CheckCircle2 size={16} className="text-orange-600 shrink-0" />
          {emergencySuccess}
          <button className="ml-auto text-orange-400 hover:text-orange-600" onClick={() => setEmergencySuccess(null)}><X size={14} /></button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Requests" value={loadingRequests ? '–' : total}
          color="bg-blue-50" icon={<FileText size={18} className="text-blue-600" />} sub="All time" />
        <StatCard label="Pending Review" value={loadingRequests ? '–' : pending}
          color="bg-amber-50" icon={<Clock size={18} className="text-amber-600" />} sub="Awaiting action" />
        <StatCard label="Approved" value={loadingRequests ? '–' : approved}
          color="bg-emerald-50" icon={<CheckCircle2 size={18} className="text-emerald-600" />} />
        <StatCard label="Rejected" value={loadingRequests ? '–' : rejected}
          color="bg-red-50" icon={<XCircle size={18} className="text-red-600" />} />
      </div>

      {/* Tab Switcher */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {([
            { id: 'requests',  label: 'Leave Requests',    icon: <FileText size={15} /> },
            { id: 'balances',  label: 'Balance Overview',  icon: <BarChart2 size={15} /> },
            { id: 'emergency', label: 'Emergency Records', icon: <Siren size={15} /> },
            { id: 'myleave',   label: 'My Leave',          icon: <UserCircle2 size={15} /> },
          ] as { id: ActiveView; label: string; icon: React.ReactNode }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                view === tab.id
                  ? tab.id === 'emergency'
                    ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                    : tab.id === 'myleave'
                      ? 'border-violet-500 text-violet-600 bg-violet-50/50'
                      : 'border-brand-600 text-brand-600 bg-brand-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.icon} {tab.label}
              {tab.id === 'requests' && pending > 0 && (
                <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-semibold">
                  {pending > 99 ? '99+' : pending}
                </span>
              )}
              {tab.id === 'emergency' && (
                <span className="ml-1 text-xs text-orange-500 font-normal">HR only</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 sm:p-4 md:p-5">
          {view === 'requests' && (
            <div className="space-y-4">
              <FilterBar filters={filters} onChange={setFilters} />
              <RequestsTable
                requests={filteredRequests}
                balances={balances}
                loading={loadingRequests}
                onReview={(req, action) => setReviewTarget({ req, action })}
              />
            </div>
          )}
          {view === 'balances' && (
            <BalanceOverview
              balances={balances}
              loading={loadingBalances}
              onAdjust={setAdjustTarget}
            />
          )}
          {view === 'emergency' && (
            <EmergencyRecordsView
              requests={requests}
              balances={balances}
              onAddNew={() => setShowEmergencyModal(true)}
            />
          )}
          {view === 'myleave' && (
            <EmployeeLeavePage currentUser={currentUser} />
          )}
        </div>
      </div>

      {/* Modals */}
      {reviewTarget && (
        <ReviewModal
          request={reviewTarget.req}
          action={reviewTarget.action}
          onConfirm={handleReview}
          onClose={() => setReviewTarget(null)}
        />
      )}
      {adjustTarget && (
        <AdjustBalanceModal
          balance={adjustTarget}
          onConfirm={handleAdjust}
          onClose={() => setAdjustTarget(null)}
        />
      )}
      {showEmergencyModal && (
        <EmergencyLeaveModal
          balances={balances}
          onSuccess={handleEmergencySuccess}
          onClose={() => setShowEmergencyModal(false)}
        />
      )}
    </div>
  );
};

export default HRLeavePage;
