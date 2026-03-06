import React, { useState, useEffect, useCallback } from 'react';
import { UserPen, Share2, Loader2 } from 'lucide-react';
import { getActionableEntriesCoAuthor, getActionableEntriesSharedWith, updateActionableEntry, updateShareChainItem, addShareToEntry, getEmployeesFromAccounts } from '../../services/api';
import { getGoalPurposeAndMainGoal } from './constants';

const NMRHIRequestsPage: React.FC = () => {
  const [coAuthorEntries, setCoAuthorEntries] = useState<any[]>([]);
  const [sharedEntries, setSharedEntries] = useState<any[]>([]);
  const [loadingCoAuthor, setLoadingCoAuthor] = useState(true);
  const [loadingShared, setLoadingShared] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);
  const [savingShareChainId, setSavingShareChainId] = useState<number | null>(null);
  const [shareChainEdits, setShareChainEdits] = useState<Record<number, { shared_note: string; status: string }>>({});
  const [coAuthorNotes, setCoAuthorNotes] = useState<Record<number, string>>({});
  const [activePanel, setActivePanel] = useState<'co-author' | 'shared'>('co-author');
  const [employees, setEmployees] = useState<any[]>([]);
  const [addShareState, setAddShareState] = useState<Record<number, { employeeId: string; note: string }>>({});
  const [addingShareId, setAddingShareId] = useState<number | null>(null);
  const [coAuthorFilter, setCoAuthorFilter] = useState<'all' | 'approved' | 'not-approved'>('all');
  const [sharedFilter, setSharedFilter] = useState<'all' | 'completed' | 'inprocess' | 'pending'>('all');

  const fetchCoAuthorEntries = useCallback(() => {
    setLoadingCoAuthor(true);
    getActionableEntriesCoAuthor()
      .then(setCoAuthorEntries)
      .catch(() => setCoAuthorEntries([]))
      .finally(() => setLoadingCoAuthor(false));
  }, []);

  const fetchSharedEntries = useCallback(() => {
    setLoadingShared(true);
    getActionableEntriesSharedWith()
      .then(setSharedEntries)
      .catch(() => setSharedEntries([]))
      .finally(() => setLoadingShared(false));
  }, []);

  useEffect(() => {
    fetchCoAuthorEntries();
  }, [fetchCoAuthorEntries]);

  useEffect(() => {
    if (activePanel === 'shared') {
      fetchSharedEntries();
      getEmployeesFromAccounts().then(setEmployees).catch(() => setEmployees([]));
    }
  }, [activePanel, fetchSharedEntries]);

  const handleToggleApproved = async (id: number, approved: boolean) => {
    setApprovingId(id);
    try {
      await updateActionableEntry(id, { approved_by_coauthor: approved });
      fetchCoAuthorEntries();
    } catch (err) {
      console.warn('[NMRHI] Failed to update approval:', err);
    } finally {
      setApprovingId(null);
    }
  };

  const handleSaveNote = async (id: number) => {
    setSavingNoteId(id);
    try {
      const note = coAuthorNotes[id] ?? '';
      await updateActionableEntry(id, { co_author_note: note.trim() || '' });
      fetchCoAuthorEntries();
    } catch (err) {
      console.warn('[NMRHI] Failed to save co-author note:', err);
    } finally {
      setSavingNoteId(null);
    }
  };

  const getStatusColors = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'INPROCESS' || s === 'INPROGRESS') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const formatDate = (d: string) => {
    const m = d?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(m[2], 10) - 1]} ${m[1]}` : d || '';
  };

  const getShareChainEdit = (sc: any) => {
    if (!sc) return { shared_note: '', status: 'PENDING' };
    const key = sc.id ?? sc.Id;
    return shareChainEdits[key] ?? { shared_note: sc.shared_note ?? sc.sharedNote ?? '', status: sc.status_name ?? sc.statusName ?? 'PENDING' };
  };

  const handleSaveShareChain = async (sc: any, entryId: number) => {
    const key = sc?.id ?? sc?.Id;
    const edit = shareChainEdits[key] ?? getShareChainEdit(sc);
    if (!edit || entryId == null) return;
    setSavingShareChainId(key);
    try {
      await updateShareChainItem(entryId, { share_note: String(edit.shared_note || '').trim(), individual_status: edit.status });
      setShareChainEdits((prev) => { const next = { ...prev }; if (key != null) delete next[key]; return next; });
      fetchSharedEntries();
    } catch (err) {
      console.warn('[NMRHI] Failed to update share chain:', err);
    } finally {
      setSavingShareChainId(null);
    }
  };

  const handleAddShare = async (entryId: number) => {
    const state = addShareState[entryId];
    if (!state?.employeeId) return;
    setAddingShareId(entryId);
    try {
      await addShareToEntry(entryId, { share_with: state.employeeId, shared_note: state.note?.trim() || '' });
      setAddShareState((prev) => { const next = { ...prev }; delete next[entryId]; return next; });
      fetchSharedEntries();
    } catch (err) {
      console.warn('[NMRHI] Failed to add share:', err);
    } finally {
      setAddingShareId(null);
    }
  };

  const filteredCoAuthorEntries = coAuthorEntries.filter((e) => {
    if (coAuthorFilter === 'approved') return e.approved_by_coauthor === true;
    if (coAuthorFilter === 'not-approved') return !e.approved_by_coauthor;
    return true;
  });

  const filteredSharedEntries = sharedEntries.filter((e) => {
    const s = (e.final_Status || '').toUpperCase();
    if (sharedFilter === 'completed') return s === 'COMPLETED';
    if (sharedFilter === 'inprocess') return ['INPROCESS', 'INPROGRESS'].includes(s);
    if (sharedFilter === 'pending') return !['COMPLETED', 'INPROCESS', 'INPROGRESS'].includes(s);
    return true;
  });

  const getEligibleEmployees = (entry: any) => {
    const existingIds = new Set(
      (entry.share_chain ?? []).map((sc: any) => String(sc.shared_with_id ?? sc.sharedWithId ?? sc.shared_with ?? sc.sharedWith ?? '')).filter(Boolean)
    );
    existingIds.add(String(entry.creator_id ?? entry.creatorId ?? ''));
    existingIds.add(String(entry.co_author_id ?? entry.coAuthorId ?? ''));
    return employees.filter((e) => {
      const eid = String((e as any).Employee_id ?? e.id ?? '');
      return eid && !existingIds.has(eid);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-2 px-6 pb-6 md:pt-4 md:px-10 md:pb-10">
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-center gap-3 gap-y-1">
          <div className="inline-flex items-center bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md shadow-blue-200">
            Strategic Framework
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">
            NMRHI Requests
          </h1>
          <p className="text-slate-500 text-sm font-medium">
            View and manage actionable entry requests, approvals, and collaboration workflows.
          </p>
        </div>

        {/* Panel switcher buttons */}
        <div className="flex flex-wrap justify-center gap-3 mt-4">
          <button
            onClick={() => setActivePanel('co-author')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
              activePanel === 'co-author'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105'
                : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50'
            }`}
          >
            <UserPen size={20} strokeWidth={2} />
            Co-author Requests
          </button>
          <button
            onClick={() => setActivePanel('shared')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all ${
              activePanel === 'shared'
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 scale-105'
                : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-violet-300 hover:bg-violet-50'
            }`}
          >
            <Share2 size={20} strokeWidth={2} />
            Shared With
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        {activePanel === 'co-author' && (
        /* Co-author Requests Panel */
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
          <div className="border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-white px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <UserPen size={24} className="text-blue-600" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Co-author Requests</h2>
                  <p className="text-sm text-slate-500">Entries where you are listed as co-author. Review and approve.</p>
                </div>
              </div>
              <span className="flex items-center gap-3 shrink-0 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setCoAuthorFilter(coAuthorFilter === 'approved' ? 'all' : 'approved')}
                  className={`px-2 py-1 rounded-md transition-colors ${coAuthorFilter === 'approved' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'text-emerald-600 hover:bg-emerald-50'}`}
                >
                  {coAuthorEntries.filter((e) => e.approved_by_coauthor === true).length} approved
                </button>
                <button
                  type="button"
                  onClick={() => setCoAuthorFilter(coAuthorFilter === 'not-approved' ? 'all' : 'not-approved')}
                  className={`px-2 py-1 rounded-md transition-colors ${coAuthorFilter === 'not-approved' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' : 'text-amber-600 hover:bg-amber-50'}`}
                >
                  {coAuthorEntries.filter((e) => !e.approved_by_coauthor).length} not approved
                </button>
              </span>
            </div>
          </div>
          <div className="p-6 min-h-[200px] overflow-y-auto max-h-[70vh]">
            {loadingCoAuthor ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={28} className="animate-spin text-blue-500" />
              </div>
            ) : coAuthorEntries.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No co-author requests at the moment.</p>
            ) : filteredCoAuthorEntries.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No {coAuthorFilter === 'approved' ? 'approved' : 'not approved'} requests.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCoAuthorEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-slate-600">{formatDate(entry.date)}</span>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-[10px] font-bold text-slate-500">Approved</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!entry.approved_by_coauthor}
                          disabled={approvingId === entry.id}
                          onClick={() => handleToggleApproved(entry.id, !entry.approved_by_coauthor)}
                          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed ${
                            entry.approved_by_coauthor ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                        >
                          {approvingId === entry.id ? (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <Loader2 size={12} className="animate-spin text-white" />
                            </span>
                          ) : (
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                entry.approved_by_coauthor ? 'translate-x-6' : 'translate-x-0.5'
                              }`}
                            />
                          )}
                        </button>
                        <span className="text-[10px] font-bold text-slate-600 min-w-[3ch]">
                          {entry.approved_by_coauthor ? 'Yes' : 'No'}
                        </span>
                      </label>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Goal & Purpose */}
                      {(() => {
                        const goalInfo = getGoalPurposeAndMainGoal(entry.goal ?? 0);
                        return goalInfo ? (
                          <div className="rounded-lg bg-blue-50/80 border border-blue-100 px-3 py-2.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-blue-600 mb-0.5">{goalInfo.main_goal}</p>
                            <p className="text-sm font-medium text-slate-800">{goalInfo.purpose}</p>
                          </div>
                        ) : null;
                      })()}

                      {/* Entry content */}
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Creator</p>
                        <p className="text-sm text-slate-800 font-medium">{entry.creator_name || '—'}</p>
                        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-3">
                          <p className="text-sm text-slate-700 leading-relaxed">{entry.original_entry || '—'}</p>
                        </div>
                      </div>

                      {/* Co-author note */}
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Co-author note</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={coAuthorNotes[entry.id] ?? entry.co_author_note ?? ''}
                            onChange={(e) => setCoAuthorNotes((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                            placeholder="Add your note..."
                            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow"
                          />
                          {entry.approved_by_coauthor && (
                            <button
                              onClick={() => handleSaveNote(entry.id)}
                              disabled={savingNoteId === entry.id}
                              className="shrink-0 px-4 py-2.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                            >
                              {savingNoteId === entry.id ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Shared with */}
                      {entry.share_chain?.length > 0 && (
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Shared with</p>
                          <div className="space-y-1.5">
                            {entry.share_chain.map((sc: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between gap-3">
                                <span className="text-sm text-slate-700">{sc.shared_with_name || sc.sharedWithName || '—'}</span>
                                {(sc.status_name || sc.statusName) ? (
                                  <span className={`shrink-0 rounded-md px-2.5 py-0.5 text-[10px] font-bold ${getStatusColors(sc.status_name || sc.statusName)}`}>{sc.status_name || sc.statusName}</span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {activePanel === 'shared' && (
        /* Shared With Panel */
        <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-sm overflow-hidden">
          <div className="border-l-4 border-violet-500 bg-gradient-to-r from-violet-50 to-white px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
                  <Share2 size={24} className="text-violet-600" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Shared With</h2>
                  <p className="text-sm text-slate-500">Entries shared with you. View shared notes and status.</p>
                </div>
              </div>
              <span className="flex items-center gap-2 shrink-0 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setSharedFilter(sharedFilter === 'completed' ? 'all' : 'completed')}
                  className={`px-2 py-1 rounded-md transition-colors ${sharedFilter === 'completed' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'text-emerald-600 hover:bg-emerald-50'}`}
                >
                  {sharedEntries.filter((e) => (e.final_Status || '').toUpperCase() === 'COMPLETED').length} completed
                </button>
                <button
                  type="button"
                  onClick={() => setSharedFilter(sharedFilter === 'inprocess' ? 'all' : 'inprocess')}
                  className={`px-2 py-1 rounded-md transition-colors ${sharedFilter === 'inprocess' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' : 'text-amber-600 hover:bg-amber-50'}`}
                >
                  {sharedEntries.filter((e) => ['INPROCESS', 'INPROGRESS'].includes((e.final_Status || '').toUpperCase())).length} in process
                </button>
                <button
                  type="button"
                  onClick={() => setSharedFilter(sharedFilter === 'pending' ? 'all' : 'pending')}
                  className={`px-2 py-1 rounded-md transition-colors ${sharedFilter === 'pending' ? 'bg-slate-200 text-slate-700 ring-1 ring-slate-300' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {sharedEntries.filter((e) => !['COMPLETED', 'INPROCESS', 'INPROGRESS'].includes((e.final_Status || '').toUpperCase())).length} pending
                </button>
              </span>
            </div>
          </div>
          <div className="p-6 min-h-[200px] overflow-y-auto max-h-[70vh]">
            {loadingShared ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={28} className="animate-spin text-violet-500" />
              </div>
            ) : sharedEntries.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No shared entries at the moment.</p>
            ) : filteredSharedEntries.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No {sharedFilter === 'inprocess' ? 'in process' : sharedFilter} entries.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSharedEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-slate-50 to-violet-50/50 border-b border-slate-100">
                      <span className="text-[11px] font-bold text-slate-600">{formatDate(entry.date)}</span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                        entry.final_Status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                        entry.final_Status === 'INPROCESS' || entry.final_Status === 'INPROGRESS' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {entry.final_Status || '—'}
                      </span>
                    </div>
                    <div className="p-4 space-y-4">
                      {(() => {
                        const goalInfo = getGoalPurposeAndMainGoal(entry.goal ?? 0);
                        return goalInfo ? (
                          <div className="rounded-lg bg-violet-50/80 border border-violet-100 px-3 py-2.5">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-violet-600 mb-0.5">{goalInfo.main_goal}</p>
                            <p className="text-sm font-medium text-slate-800">{goalInfo.purpose}</p>
                          </div>
                        ) : null;
                      })()}
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Creator <span className="mx-1.5">·</span> Co-author</p>
                        <p className="text-sm text-slate-800 font-medium">{entry.creator_name || '—'} <span className="mx-1.5">·</span> {entry.co_author_name || '—'}</p>
                        <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-3">
                          <p className="text-sm text-slate-700 leading-relaxed">{entry.original_entry || '—'}</p>
                        </div>
                      </div>
                      {Array.isArray(entry.share_chain) && entry.share_chain.length > 0 && (
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Share chain</p>
                          <div className="space-y-3">
                            {entry.share_chain.map((sc: any, idx: number) => {
                              const scKey = sc?.id ?? sc?.Id ?? idx;
                              const edit = getShareChainEdit(sc);
                              return (
                                <div key={scKey} className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-medium text-slate-700 text-sm">{sc?.shared_with_name ?? sc?.sharedWithName ?? '—'}</span>
                                    <select
                                      value={edit?.status ?? 'PENDING'}
                                      onChange={(e) => setShareChainEdits((prev) => ({
                                        ...prev,
                                        [scKey]: { ...(prev[scKey] ?? edit), status: e.target.value }
                                      }))}
                                      className={`text-[10px] font-bold rounded-md border px-2.5 py-1 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 ${getStatusColors(edit?.status ?? 'PENDING')}`}
                                    >
                                      <option value="PENDING">PENDING</option>
                                      <option value="INPROCESS">INPROCESS</option>
                                      <option value="COMPLETED">COMPLETED</option>
                                    </select>
                                  </div>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={edit?.shared_note ?? ''}
                                      onChange={(e) => setShareChainEdits((prev) => ({
                                        ...prev,
                                        [scKey]: { ...(prev[scKey] ?? edit), shared_note: e.target.value }
                                      }))}
                                      placeholder="Shared note..."
                                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                                    />
                                    <button
                                      onClick={() => handleSaveShareChain(sc, entry?.id)}
                                      disabled={savingShareChainId === scKey}
                                      className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                    >
                                      {savingShareChainId === scKey ? <Loader2 size={14} className="animate-spin" /> : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="rounded-lg bg-violet-50/80 border border-violet-100 p-3 space-y-3">
                        <p className="text-[10px] font-semibold text-violet-600 uppercase tracking-wider">Share with</p>
                        <div className="flex flex-wrap gap-2 items-end">
                          <div className="min-w-[140px] flex-1">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Employee</label>
                            <select
                              value={addShareState[entry.id]?.employeeId ?? ''}
                              onChange={(e) => setAddShareState((prev) => ({ ...prev, [entry.id]: { ...(prev[entry.id] ?? { employeeId: '', note: '' }), employeeId: e.target.value } }))}
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                            >
                              <option value="">Select employee...</option>
                              {getEligibleEmployees(entry).map((emp: any) => {
                                const eid = String(emp.Employee_id ?? emp.id ?? '');
                                return (
                                  <option key={eid} value={eid}>{emp.name ?? emp.Name ?? eid}</option>
                                );
                              })}
                              {getEligibleEmployees(entry).length === 0 && (
                                <option value="" disabled>No employees to add</option>
                              )}
                            </select>
                          </div>
                          <div className="min-w-[100px] flex-1">
                            <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Note (optional)</label>
                            <input
                              type="text"
                              value={addShareState[entry.id]?.note ?? ''}
                              onChange={(e) => setAddShareState((prev) => ({ ...prev, [entry.id]: { ...(prev[entry.id] ?? { employeeId: '', note: '' }), note: e.target.value } }))}
                              placeholder="Shared note..."
                              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                            />
                          </div>
                          <button
                            onClick={() => handleAddShare(entry.id)}
                            disabled={!addShareState[entry.id]?.employeeId || addingShareId === entry.id}
                            className="shrink-0 px-4 py-2 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          >
                            {addingShareId === entry.id ? <Loader2 size={14} className="animate-spin inline" /> : 'Share'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default NMRHIRequestsPage;
