import React, { useState, useRef, useEffect } from 'react';
import { X, AlertTriangle, Search } from 'lucide-react';
import { createAlert } from '../services/api';

interface Employee {
  id: string;
  name: string;
  Employee_id?: string;
  [key: string]: any;
}

interface CreateAlertModalProps {
  onClose: () => void;
  employees: Employee[];
  defaultResolvedBy?: string;
  onSuccess?: () => void;
}

const SEVERITY_OPTIONS = ['high', 'medium', 'low'] as const;
const STATUS_OPTIONS = ['PENDING', 'INPROCESS', 'COMPLETED'] as const;

const getEmployeeId = (u: Employee) => String(u.Employee_id ?? u.id ?? '');

export const CreateAlertModal: React.FC<CreateAlertModalProps> = ({
  onClose,
  employees = [],
  defaultResolvedBy = '',
  onSuccess,
}) => {
  const [alertTitle, setAlertTitle] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'high' | 'medium' | 'low'>('high');
  const [resolvedBy, setResolvedBy] = useState(defaultResolvedBy);
  const [resolvedBySearch, setResolvedBySearch] = useState('');
  const [showResolvedByDropdown, setShowResolvedByDropdown] = useState(false);
  const [closedBy, setClosedBy] = useState('');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'PENDING' | 'INPROCESS' | 'COMPLETED'>('PENDING');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resolvedByRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (resolvedByRef.current && !resolvedByRef.current.contains(e.target as Node)) {
        setShowResolvedByDropdown(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectedEmployee = employees.find((u) => getEmployeeId(u) === resolvedBy);
  const filteredEmployees = employees.filter((u) => {
    const q = resolvedBySearch.trim().toLowerCase();
    if (!q) return true;
    const name = (u.name ?? '').toLowerCase();
    const id = getEmployeeId(u).toLowerCase();
    return name.includes(q) || id.includes(q);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!alertTitle.trim()) {
      setError('Alert title is required');
      return;
    }
    if (!resolvedBy) {
      setError('Please select an employee for Resolved by');
      return;
    }
    setIsSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        alert_title: alertTitle.trim(),
        alert_type: 'System',
        alert_severity: alertSeverity,
        resolved_by: resolvedBy,
      };
      if (closedBy.trim()) {
        const dt = new Date(closedBy.trim());
        if (!isNaN(dt.getTime())) {
          body.closed_by = dt.toISOString().slice(0, 19);
        }
      }
      if (details.trim()) body.details = details.trim();
      if (status) body.status = status;
      await createAlert(body as any);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to create alert';
      setError(typeof msg === 'string' ? msg : 'Failed to create alert');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99998] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-base">Create Alert</h3>
                <p className="text-[10px] text-gray-500">Add a new system alert</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="p-2 rounded bg-red-50 text-red-700 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Alert title *</label>
              <input
                type="text"
                value={alertTitle}
                onChange={(e) => setAlertTitle(e.target.value)}
                placeholder="e.g. Server maintenance scheduled"
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Alert type</label>
              <input
                type="text"
                value="System"
                readOnly
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded bg-gray-50 text-gray-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Resolved by *</label>
              <div ref={resolvedByRef} className="relative">
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={showResolvedByDropdown ? resolvedBySearch : (selectedEmployee?.name ?? '')}
                    onChange={(e) => {
                      setResolvedBySearch(e.target.value);
                      setShowResolvedByDropdown(true);
                      if (!e.target.value) setResolvedBy('');
                    }}
                    onFocus={() => setShowResolvedByDropdown(true)}
                    placeholder="Search employee..."
                    className="w-full pl-8 pr-2.5 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-xs"
                  />
                </div>
                {showResolvedByDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-0.5 max-h-36 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg z-10 py-0.5">
                    {filteredEmployees.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-gray-500">No employees found</p>
                    ) : (
                      filteredEmployees.map((u) => {
                        const eid = getEmployeeId(u);
                        const isSelected = eid === resolvedBy;
                        return (
                          <button
                            key={eid}
                            type="button"
                            onClick={() => {
                              setResolvedBy(eid);
                              setResolvedBySearch('');
                              setShowResolvedByDropdown(false);
                            }}
                            className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 ${isSelected ? 'bg-brand-50 text-brand-700' : 'text-gray-800'}`}
                          >
                            {u.name || eid}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Severity</label>
              <select
                value={alertSeverity}
                onChange={(e) => setAlertSeverity(e.target.value as 'high' | 'medium' | 'low')}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-xs"
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Closed by (optional)</label>
              <input
                type="datetime-local"
                value={closedBy}
                onChange={(e) => setClosedBy(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Details (optional)</label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. Maintenance window 2–4 AM IST."
                rows={2}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-xs resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Status (optional)</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'PENDING' | 'INPROCESS' | 'COMPLETED')}
                className="w-full px-2.5 py-1.5 border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-xs"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-1.5 rounded text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-3 py-1.5 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Creating...' : 'Create Alert'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
