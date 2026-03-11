import React, { useState, useEffect } from 'react';
import { Pencil, UserPen, Share2, StickyNote } from 'lucide-react';
import { getProducts } from '../../../services/api';
import { DailyLog, ProgressStatus } from '../types';

interface Employee {
  id: string;
  name: string;
  [key: string]: any;
}

interface DailyLogEntryProps {
  log: DailyLog;
  onUpdate: (updates: Partial<DailyLog>) => void | Promise<void>;
  onDelete: () => void;
  onSubmit?: (opts?: { share_with?: string[]; co_author?: string[]; shared_note?: string; product?: string }) => void | Promise<void>;
  isDraft?: boolean;
  isSubmitting?: boolean;
  isToday: boolean;
  readOnly?: boolean;
  pointLabel?: string;
  users?: Employee[];
  currentUserId?: string;
}

const DailyLogEntry: React.FC<DailyLogEntryProps> = ({ log, onUpdate, onDelete, onSubmit, isDraft, isSubmitting, isToday, readOnly, pointLabel, users = [], currentUserId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [shareWithIds, setShareWithIds] = useState<string[]>([]);
  const [coAuthorIds, setCoAuthorIds] = useState<string[]>([]);
  const [sharedNote, setSharedNote] = useState('');
  const [product, setProduct] = useState('');
  const [products, setProducts] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [editStatus, setEditStatus] = useState<ProgressStatus>(log.status);
  const [editNote, setEditNote] = useState(log.note);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setEditStatus(log.status);
      setEditNote(log.note);
    }
  }, [log.status, log.note, isEditing]);

  const isExistingEntry = !isDraft && !log.id.startsWith('temp-');
  const canEditEntry =
    isExistingEntry &&
    log.approvedByCoauthor === true &&
    (!log.shareChain?.length || log.shareChain.every((sc) => (sc.statusName ?? '').toUpperCase() === 'COMPLETED'));
  const getStatusStyles = (status: ProgressStatus) => {
    switch (status) {
      case 'completed': return 'bg-emerald-500 text-white border-emerald-600';
      case 'in-progress': return 'bg-amber-400 text-white border-amber-500';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const getShareStatusColors = (status?: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED') return 'bg-emerald-100 text-emerald-700';
    if (s === 'INPROCESS' || s === 'INPROGRESS') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-200/80 text-slate-600';
  };

  const handleStartEdit = () => {
    setEditStatus(log.status);
    setEditNote(log.note);
    setIsEditing(true);
  };

  const handleSubmitEdit = async () => {
    const hasChanges = editStatus !== log.status || editNote !== log.note;
    if (!hasChanges) {
      setIsEditing(false);
      return;
    }
    setIsSubmittingEdit(true);
    try {
      await Promise.resolve(onUpdate({ status: editStatus, note: editNote }));
      setIsEditing(false);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditStatus(log.status);
    setEditNote(log.note);
    setIsEditing(false);
  };

  useEffect(() => {
    if (isDraft && !readOnly) {
      setLoadingProducts(true);
      getProducts()
        .then(setProducts)
        .catch(() => setProducts([]))
        .finally(() => setLoadingProducts(false));
    }
  }, [isDraft, readOnly]);

  const eligibleUsers = users.filter((u) => {
    const eid = String((u as any).Employee_id ?? u.id ?? '');
    return eid && eid !== (currentUserId ?? '');
  });

  const handleShareWithChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setShareWithIds(v ? [v] : []);
  };

  const handleCoAuthorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    setCoAuthorIds(v ? [v] : []);
  };

  const handleSubmitClick = () => {
    onSubmit?.({ share_with: shareWithIds, co_author: coAuthorIds, shared_note: sharedNote.trim() || undefined, product: product.trim() || undefined });
  };

  const showReadOnly = readOnly || (isExistingEntry && !isEditing);
  const displayStatus = isExistingEntry && isEditing ? editStatus : log.status;
  const displayNote = isExistingEntry && isEditing ? editNote : log.note;

  return (
    <div className={`relative pl-8 pb-6 border-l-2 ${isToday ? 'border-blue-400' : 'border-slate-200'} last:pb-0`}>
      <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-white ${isToday ? 'border-blue-500' : 'border-slate-300'}`}></div>
      
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${isToday ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                {log.date} {isToday && '(Today)'}
              </span>
              {(log.productName || (isDraft && product)) && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200/80">
                  {log.productName || product}
                </span>
              )}
              {canEditEntry && !readOnly && !isEditing && (
                <button
                  onClick={handleStartEdit}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit entry"
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
            
            {!showReadOnly && (
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                {(['pending', 'in-progress', 'completed'] as ProgressStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => isExistingEntry && isEditing ? setEditStatus(s) : onUpdate({ status: s })}
                    className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase transition-all ${
                      displayStatus === s ? getStatusStyles(s) : 'text-slate-400 hover:bg-white'
                    }`}
                  >
                    {s.replace('-', ' ')}
                  </button>
                ))}
              </div>
            )}
            {showReadOnly && (
              <span className={`text-[9px] px-2 py-1 rounded-md font-bold uppercase ${getStatusStyles(log.status)}`}>
                {log.status.replace('-', ' ')}
              </span>
            )}
          </div>

          <textarea
            value={displayNote}
            onChange={(e) => {
              if (showReadOnly) return;
              if (isExistingEntry && isEditing) setEditNote(e.target.value);
              else onUpdate({ note: e.target.value });
            }}
            placeholder="What did you do today regarding this objective?"
            readOnly={showReadOnly}
            className={`w-full text-sm bg-slate-50 border-none rounded-lg p-3 outline-none resize-none min-h-[80px] text-slate-700 ${showReadOnly ? '' : 'focus:ring-2 focus:ring-blue-500 transition-all'}`}
          />

          {isDraft && !readOnly && (
          <div className="mt-3 flex flex-col sm:flex-row gap-4 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Product</label>
              <select
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
              >
                <option value="">{loadingProducts ? 'Loading products...' : 'Select product...'}</option>
                {!loadingProducts && (Array.isArray(products) ? products : []).map((p, idx) => {
                  const label = typeof p === 'string' ? p : String((p as any)?.name ?? (p as any)?.id ?? p ?? '');
                  const value = typeof p === 'string' ? p : String((p as any)?.name ?? (p as any)?.id ?? p ?? '');
                  return <option key={value || idx} value={value}>{label}</option>;
                })}
              </select>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Share with</label>
              <select
                value={shareWithIds[0] ?? ''}
                onChange={handleShareWithChange}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select employee...</option>
                {eligibleUsers.length === 0 ? (
                  <option disabled>No employees available</option>
                ) : (
                  eligibleUsers.map((u) => {
                    const eid = String((u as any).Employee_id ?? u.id ?? '');
                    return (
                      <option key={eid} value={eid}>{u.name || eid}</option>
                    );
                  })
                )}
              </select>
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Share note</label>
              <input
                type="text"
                value={sharedNote}
                onChange={(e) => setSharedNote(e.target.value)}
                placeholder="Optional note when sharing..."
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Co-author</label>
              <select
                value={coAuthorIds[0] ?? ''}
                onChange={handleCoAuthorChange}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select employee...</option>
                {eligibleUsers.length === 0 ? (
                  <option disabled>No employees available</option>
                ) : (
                  eligibleUsers.map((u) => {
                    const eid = String((u as any).Employee_id ?? u.id ?? '');
                    return (
                      <option key={eid} value={eid}>{u.name || eid}</option>
                    );
                  })
                )}
              </select>
            </div>
          </div>
        )}
        
        {!readOnly && (isDraft || canEditEntry) && (
          <div className="flex justify-end items-center gap-2 mt-2">
            {isDraft && onSubmit && (
              <button 
                onClick={handleSubmitClick}
                disabled={isSubmitting}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            )}
            {isExistingEntry && isEditing && (
              <>
                <button 
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmitEdit}
                  disabled={isSubmittingEdit}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmittingEdit ? 'Saving...' : 'Submit'}
                </button>
              </>
            )}
            {(!isEditing || isDraft) && (
              <button 
                onClick={onDelete}
                className="text-[10px] text-slate-400 hover:text-red-500 font-bold uppercase tracking-widest transition-colors"
              >
                Remove Log
              </button>
            )}
          </div>
        )}
        </div>

        {isExistingEntry && (log.coAuthorName || (log.shareChain && log.shareChain.length > 0)) && (
          <div className="w-full shrink-0 overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-blue-50/30 shadow-sm lg:w-80">
            <div className="border-l-4 border-blue-400 bg-white/60 px-4 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sharing & Collaboration</span>
            </div>
            <div className="space-y-0 divide-y divide-slate-200/80">
              {log.coAuthorName && (
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <UserPen size={14} strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Co-author</span>
                    <p className="text-sm font-medium text-slate-800">{log.coAuthorName}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    log.approvedByCoauthor === true
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {log.approvedByCoauthor === true ? 'Approved' : 'Not approved'}
                  </span>
                </div>
              )}
              {log.shareChain && log.shareChain.length > 0 && log.shareChain.map((sc, idx) => (
                <div key={idx} className="space-y-2 px-4 py-3">
                  {sc.sharedWithName && (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                          <Share2 size={14} strokeWidth={2.5} />
                        </div>
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Share with</span>
                          <p className="text-sm font-medium text-slate-800">{sc.sharedWithName}</p>
                        </div>
                      </div>
                      {sc.statusName && (
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getShareStatusColors(sc.statusName)}`}>{sc.statusName}</span>
                      )}
                    </div>
                  )}
                  {sc.sharedNote != null && sc.sharedNote !== '' && (
                    <div className="ml-11 flex items-start gap-3 rounded-lg bg-white/70 p-2.5">
                      <StickyNote size={14} className="mt-0.5 shrink-0 text-slate-400" strokeWidth={2} />
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Shared note</span>
                        <p className="text-sm text-slate-700">{sc.sharedNote}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default DailyLogEntry;
