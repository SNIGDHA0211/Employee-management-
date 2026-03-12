import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { updateAlert, deleteAlert } from '../services/api';
import type { AlertItem } from '../services/api';

interface AlertDetailModalProps {
  alert: AlertItem;
  currentUserName: string;
  currentUserNames?: string[];
  onClose: () => void;
  onSuccess?: () => void;
}

const Field: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div className="py-2 border-b border-gray-100 last:border-0">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">{label}</p>
    <p className="text-sm text-gray-800">{value ?? '—'}</p>
  </div>
);

const STATUS_OPTIONS = ['PENDING', 'INPROCESS', 'COMPLETED'] as const;

export const AlertDetailModal: React.FC<AlertDetailModalProps> = ({ alert, currentUserName, currentUserNames, onClose, onSuccess }) => {
  const [status, setStatus] = useState(alert.status ?? 'PENDING');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const normalize = (s: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const allNames = [currentUserName, ...(currentUserNames ?? [])].filter(Boolean).map(normalize);
  const creator = normalize(alert.creator_name ?? '');
  const resolvedBy = normalize(alert.resolved_by_name ?? '');
  const canEdit = allNames.some((curr) => {
    if (!curr) return false;
    const isCreator = curr === creator || creator.startsWith(curr + ' ') || curr.startsWith(creator + ' ');
    const isResolvedBy = curr === resolvedBy || resolvedBy.startsWith(curr + ' ') || curr.startsWith(resolvedBy + ' ');
    return isCreator || isResolvedBy;
  });

  const handleStatusChange = async (newStatus: string) => {
    if (!canEdit) return;
    setError('');
    setIsUpdating(true);
    try {
      await updateAlert(alert.id, { status: newStatus as 'PENDING' | 'INPROCESS' | 'COMPLETED' });
      setStatus(newStatus);
      onSuccess?.();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    if (!window.confirm('Are you sure you want to delete this alert?')) return;
    setError('');
    setIsDeleting(true);
    try {
      await deleteAlert(alert.id);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[99998] p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-600" />
              </div>
              <h3 className="font-semibold text-gray-900 text-base">Alert Details</h3>
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
          {error && (
            <div className="mb-3 p-2 rounded bg-red-50 text-red-700 text-xs">{error}</div>
          )}
          <div className="space-y-0">
            <Field label="Alert Title" value={alert.alert_title} />
            <Field label="Alert Type" value={alert.alert_type} />
            <Field label="Severity" value={alert.alert_severity} />
            {canEdit ? (
              <div className="py-2 border-b border-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Status</p>
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isUpdating}
                  className="w-full mt-1 px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-brand-500"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {isUpdating && <p className="text-[10px] text-gray-500 mt-0.5">Updating...</p>}
              </div>
            ) : (
              <Field label="Status" value={alert.status} />
            )}
            <Field label="Creator" value={alert.creator_name} />
            <Field label="Resolved By" value={alert.resolved_by_name} />
            <Field label="Details" value={alert.details} />
            <Field label="Created At" value={alert.created_at} />
            <Field label="Closed By (Date)" value={alert.closed_by} />
            <Field label="Close At" value={alert.close_at ?? undefined} />
          </div>
          <div className="mt-4 flex gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-300 bg-white text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-60 transition-colors"
              >
                <Trash2 size={14} />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
