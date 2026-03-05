import React, { useState, useEffect, useMemo } from 'react';
import { User } from '../../types';
import { Plus, ChevronDown, ChevronUp, User as UserIcon, Package, Clock, ListPlus, StickyNote, UserPlus, Search, BarChart2, MapPin, Phone } from 'lucide-react';
import { format, startOfMonth, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

const STORAGE_KEY = 'customer_leads';

export type CustomerLeadStatus = 'Lead' | 'Qualified Lead' | 'Demo' | 'Proposal' | 'Performa' | 'Invoice' | 'Repeate';

export interface CustomerLeadNote {
  text: string;
  createdAt: string;
}

export interface AssignedEmployee {
  id: string;
  name: string;
}

export interface CustomerLead {
  id: string;
  title: string;
  customerName: string;
  customerAddress?: string;
  customerContact?: string;
  description: string;
  product: string;
  notes: CustomerLeadNote[];
  status: CustomerLeadStatus;
  createdAt: string;
  createdBy: string;
  assignedEmployees?: AssignedEmployee[];
}

interface CustomerLeadsPageProps {
  currentUser: User;
  users: User[];
}

export function canAccessCustomerLeads(user: User): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase().trim();
  return role === 'MD';
}

const STATUS_OPTIONS: CustomerLeadStatus[] = ['Lead', 'Qualified Lead', 'Demo', 'Proposal', 'Performa', 'Invoice', 'Repeate'];

const STATUS_STYLES: Record<CustomerLeadStatus, string> = {
  'Lead': 'bg-gray-100 text-gray-700 border-gray-300',
  'Qualified Lead': 'bg-blue-100 text-blue-700 border-blue-300',
  'Demo': 'bg-amber-100 text-amber-700 border-amber-300',
  'Proposal': 'bg-purple-100 text-purple-700 border-purple-300',
  'Performa': 'bg-indigo-100 text-indigo-700 border-indigo-300',
  'Invoice': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'Repeate': 'bg-green-100 text-green-700 border-green-300',
};

const OLD_TO_NEW_STATUS: Record<string, CustomerLeadStatus> = {
  'New': 'Lead',
  'Contacted': 'Qualified Lead',
  'Qualified': 'Qualified Lead',
  'Won': 'Invoice',
  'Lost': 'Lead',
};

function loadLeads(): CustomerLead[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : [];
    const validStatuses: CustomerLeadStatus[] = ['Lead', 'Qualified Lead', 'Demo', 'Proposal', 'Performa', 'Invoice', 'Repeate'];
    return arr.map((l: any) => {
      let status = l.status;
      if (!validStatuses.includes(status)) {
        status = OLD_TO_NEW_STATUS[status] ?? 'Lead';
      }
      const rawNotes = Array.isArray(l.notes) ? l.notes : (l.notes ? [l.notes] : []);
      const notes: CustomerLeadNote[] = rawNotes.map((n: any) =>
        typeof n === 'string'
          ? { text: n, createdAt: l.createdAt || new Date().toISOString() }
          : { text: n?.text ?? String(n), createdAt: n?.createdAt || new Date().toISOString() }
      );
      let assignedEmployees: AssignedEmployee[] = [];
      if (Array.isArray(l.assignedEmployees) && l.assignedEmployees.length > 0) {
        assignedEmployees = l.assignedEmployees.map((a: any) => ({ id: a.id, name: a.name || a.id }));
      } else if (l.assignedEmployeeId || l.assignedEmployeeName) {
        assignedEmployees = [{ id: l.assignedEmployeeId || '', name: l.assignedEmployeeName || l.assignedEmployeeId || '' }];
      }
      return {
        ...l,
        notes,
        status,
        assignedEmployees,
      };
    });
  } catch {
    return [];
  }
}

function saveLeads(leads: CustomerLead[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  } catch {
    // ignore
  }
}

export const CustomerLeadsPage: React.FC<CustomerLeadsPageProps> = ({ currentUser, users = [] }) => {
  const [leads, setLeads] = useState<CustomerLead[]>(loadLeads);
  const [showAddModal, setShowAddModal] = useState(false);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [description, setDescription] = useState('');
  const [product, setProduct] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Add note state (per lead)
  const [newNoteInput, setNewNoteInput] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showGraphs, setShowGraphs] = useState(true);

  useEffect(() => {
    saveLeads(leads);
  }, [leads]);

  const resetForm = () => {
    setTitle('');
    setCustomerName('');
    setCustomerAddress('');
    setCustomerContact('');
    setDescription('');
    setProduct('');
    setSelectedEmployeeIds([]);
    setEmployeeSearchQuery('');
    setFormError(null);
  };

  const addNote = (leadId: string) => {
    const text = (newNoteInput[leadId] || '').trim();
    if (!text) return;
    const createdAt = new Date().toISOString();
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, notes: [...l.notes, { text, createdAt }] } : l))
    );
    setNewNoteInput((prev) => ({ ...prev, [leadId]: '' }));
  };

  const handleCreate = () => {
    const t = title.trim();
    const cn = customerName.trim();
    if (!t || !cn) {
      setFormError('Company name and Client name are required.');
      return;
    }
    const assignedEmployees: AssignedEmployee[] = selectedEmployeeIds
      .map((id) => users.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => ({ id: u!.id, name: u!.name || u!.email || u!.id }));
    const lead: CustomerLead = {
      id: `cl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      title: t,
      customerName: cn,
      ...(customerAddress.trim() && { customerAddress: customerAddress.trim() }),
      ...(customerContact.trim() && { customerContact: customerContact.trim() }),
      description: description.trim(),
      product: product.trim(),
      notes: [],
      status: 'Lead',
      createdAt: new Date().toISOString(),
      createdBy: currentUser.name || currentUser.id || 'Unknown',
      ...(assignedEmployees.length > 0 && { assignedEmployees }),
    };
    setLeads((prev) => [lead, ...prev]);
    resetForm();
    setShowAddModal(false);
  };

  const handleStatusChange = (leadId: string, newStatus: CustomerLeadStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    setOpenStatusDropdown(null);
  };

  const searchLower = searchQuery.trim().toLowerCase();
  const hasActiveFilters = !!searchLower || !!statusFilter;
  const filteredLeads = leads.filter((lead) => {
    if (statusFilter && lead.status !== statusFilter) return false;
    if (!searchLower) return true;
    const match = (s: string) => s && s.toLowerCase().includes(searchLower);
    if (match(lead.title) || match(lead.customerName) || match(lead.customerAddress ?? '') || match(lead.customerContact ?? '') || match(lead.product) || match(lead.description) || match(lead.createdBy)) return true;
    if (lead.assignedEmployees?.some((e) => match(e.name))) return true;
    if (lead.notes?.some((n) => match(n.text))) return true;
    return false;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
  };

  const statusChartColors: Record<CustomerLeadStatus, string> = {
    'Lead': '#64748b',
    'Qualified Lead': '#3b82f6',
    'Demo': '#f59e0b',
    'Proposal': '#a855f7',
    'Performa': '#6366f1',
    'Invoice': '#10b981',
    'Repeate': '#22c55e',
  };

  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_OPTIONS.forEach((s) => { counts[s] = 0; });
    filteredLeads.forEach((l) => { counts[l.status] = (counts[l.status] ?? 0) + 1; });
    return STATUS_OPTIONS.map((status) => ({
      name: status,
      value: counts[status] ?? 0,
      color: statusChartColors[status],
    })).filter((d) => d.value > 0);
  }, [filteredLeads]);

  const leadsOverTimeData = useMemo(() => {
    const byMonth: { key: string; ts: number; count: number }[] = [];
    const map = new Map<string, { ts: number; count: number }>();
    filteredLeads.forEach((l) => {
      const d = l.createdAt ? parseISO(l.createdAt) : new Date();
      const key = format(startOfMonth(d), 'MMM yyyy');
      const ts = startOfMonth(d).getTime();
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { ts, count: 1 });
    });
    return Array.from(map.entries())
      .map(([name, { ts, count }]) => ({ name, count, ts }))
      .sort((a, b) => a.ts - b.ts)
      .slice(-6)
      .map(({ name, count }) => ({ name, count }));
  }, [filteredLeads]);

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Under Development Banner */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl shadow-sm mb-4">
        <span className="text-xl mt-0.5 shrink-0">🚧</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-800">This panel is currently under development</p>
          <p className="text-xs text-amber-700 mt-0.5">Features may be incomplete or non-functional. Please do not use this panel for actual client lead management until further notice.</p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Client Leads</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGraphs((v) => !v)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
              showGraphs ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:shadow-md' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:shadow-sm'
            }`}
          >
            <BarChart2 size={18} />
            <span>{showGraphs ? 'Hide Graphs' : 'Show Graphs'}</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Plus size={20} />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Search & Filters header - compact */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-3 py-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 mr-1 shrink-0">Search & filters</span>
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:outline-none text-sm"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm" aria-label="Clear">×</button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-500 focus:outline-none bg-white text-xs font-medium text-gray-700 min-w-[120px]"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="px-2.5 py-1.5 rounded-md border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:border-gray-400 transition-colors duration-200">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Graph Section */}
      {showGraphs && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Leads by Status */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300">
          <h3 className="text-base font-bold text-gray-800 mb-3">Leads by Status</h3>
          {statusChartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData} layout="vertical" margin={{ top: 4, right: 20, left: 60, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748b' }} width={90} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.1)' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Leads">
                    {statusChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No data to display</div>
          )}
        </div>

        {/* Leads Over Time */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 transition-all duration-200 hover:shadow-md hover:border-gray-300">
          <h3 className="text-base font-bold text-gray-800 mb-3">Leads Over Time</h3>
          {leadsOverTimeData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={leadsOverTimeData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                  <defs>
                    <linearGradient id="colorLeadsOverTime" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                  <Area type="monotone" dataKey="count" stroke="#6366f1" fillOpacity={1} fill="url(#colorLeadsOverTime)" name="Leads" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">No data to display</div>
          )}
        </div>
      </div>
      )}

      {/* Lead Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
        {leads.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-white rounded-xl border border-gray-200">
            <UserIcon size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">No leads yet</p>
            <p className="text-sm text-gray-400 mt-1">Click &quot;Add Lead&quot; to create your first client lead.</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="col-span-full text-center py-16 bg-white rounded-xl border border-gray-200">
            <Search size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">No matching leads</p>
            <p className="text-sm text-gray-400 mt-1">Try a different search term.</p>
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <div
              key={lead.id}
              className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-brand-200/60"
            >
              {/* Status badge - top */}
              <div className="flex justify-between items-center px-4 pt-3 pb-2 border-b border-gray-100">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-gray-100 text-gray-500">
                  Lead
                </span>
              </div>

              <div className="p-4 space-y-3">
                {/* Company Name */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-600 mb-0.5">Company Name</p>
                  <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2">{lead.title}</h3>
                </div>

                {/* Client name */}
                <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-slate-50 border-l-2 border-slate-200">
                  <UserIcon size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Client</p>
                    <span className="text-xs font-medium text-slate-800 truncate block">{lead.customerName}</span>
                  </div>
                </div>

                {/* Client address */}
                {lead.customerAddress && (
                  <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-slate-50/80 border-l-2 border-slate-200">
                    <MapPin size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Address</p>
                      <span className="text-xs font-medium text-slate-800 line-clamp-2 block">{lead.customerAddress}</span>
                    </div>
                  </div>
                )}

                {/* Client contact */}
                {lead.customerContact && (
                  <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-slate-50/80 border-l-2 border-slate-200">
                    <Phone size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Contact</p>
                      <span className="text-xs font-medium text-slate-800 truncate block">{lead.customerContact}</span>
                    </div>
                  </div>
                )}

                {/* Product */}
                {lead.product && (
                  <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-amber-50/80 border-l-2 border-amber-200">
                    <Package size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700/80 mb-0.5">Product</p>
                      <span className="text-xs font-medium text-amber-900 truncate block">{lead.product}</span>
                    </div>
                  </div>
                )}

                {/* Assigned employees */}
                {lead.assignedEmployees && lead.assignedEmployees.length > 0 && (
                  <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-violet-50/80 border-l-2 border-violet-200">
                    <UserPlus size={14} className="text-violet-600 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700/80 mb-1">Assigned to</p>
                      <ul className="text-xs font-medium text-violet-900 space-y-0.5">
                        {lead.assignedEmployees.map((emp) => (
                          <li key={emp.id} className="truncate">{emp.name}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* More / Less: toggle description & notes */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedCardId((id) => (id === lead.id ? null : lead.id))}
                    className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                  >
                    {expandedCardId === lead.id ? (
                      <> <ChevronUp size={14} /> Less</>
                    ) : (
                      <> <ChevronDown size={14} /> More</>
                    )}
                  </button>
                  {expandedCardId === lead.id && (
                    <div className="mt-2 space-y-3">
                      {/* Description - full */}
                      {lead.description && (
                        <div className="py-2 px-3 rounded-lg bg-blue-50/60 border-l-2 border-blue-200">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600/90 mb-1">Description</p>
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{lead.description}</p>
                        </div>
                      )}
                      {/* Notes - full */}
                      <div className="py-2 px-3 rounded-lg bg-emerald-50/60 border-l-2 border-emerald-200">
                        <div className="flex items-center gap-1.5 mb-1">
                          <StickyNote size={12} className="text-emerald-600" />
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90">Notes</p>
                        </div>
                        {lead.notes.length > 0 ? (
                          <ol className="text-xs text-gray-700 space-y-1.5 list-none pl-0">
                            {lead.notes.map((note, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="flex-shrink-0 font-bold text-emerald-700 min-w-[1.25rem]">{i + 1}.</span>
                                <div className="min-w-0 flex-1">
                                  <span className="block whitespace-pre-wrap">{note.text}</span>
                                  <span className="text-[10px] text-emerald-600/80 mt-0.5 block">
                                    {format(new Date(note.createdAt), 'dd MMM yyyy, HH:mm')}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="text-xs text-gray-400 italic">No notes yet</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={newNoteInput[lead.id] ?? ''}
                            onChange={(e) => setNewNoteInput((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNote(lead.id))}
                            placeholder="Add note..."
                            className="flex-1 text-xs border border-emerald-200 rounded-md px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 focus:outline-none hover:border-emerald-300 transition-colors duration-200"
                          />
                          <button
                            type="button"
                            onClick={() => addNote(lead.id)}
                            className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors flex-shrink-0"
                            title="Add note"
                          >
                            <ListPlus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Meta: date & created by */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {format(new Date(lead.createdAt), 'dd MMM yyyy, HH:mm')}
                  </span>
                  <span>By: <strong className="text-brand-600">{lead.createdBy}</strong></span>
                </div>
              </div>

              {/* Status & footer */}
              <div className="px-4 pb-4 pt-3 flex justify-between items-center border-t border-gray-100">
                <div className="relative">
                  <button
                    onClick={() => setOpenStatusDropdown(openStatusDropdown === lead.id ? null : lead.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all duration-200 hover:opacity-90 hover:scale-[1.02] ${STATUS_STYLES[lead.status]}`}
                  >
                    {lead.status}
                    <ChevronDown size={12} className={openStatusDropdown === lead.id ? 'rotate-180' : ''} />
                  </button>
                  {openStatusDropdown === lead.id && (
                    <div className="absolute left-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[130px]">
                      {STATUS_OPTIONS.map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(lead.id, status)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                            lead.status === status ? 'bg-gray-100 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Lead Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 text-gray-800 border-b pb-2">
              Add Client Lead
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Company name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none hover:border-gray-400 transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Client name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none hover:border-gray-400 transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client address</label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Client address"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none hover:border-gray-400 transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client contact number</label>
                <input
                  type="text"
                  value={customerContact}
                  onChange={(e) => setCustomerContact(e.target.value)}
                  placeholder="Contact number"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none hover:border-gray-400 transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the lead..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none hover:border-gray-400 transition-colors duration-200 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <input
                  type="text"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="Product name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none hover:border-gray-400 transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employees (optional)</label>
                <div className="relative mb-2">
                  <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={employeeSearchQuery}
                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    placeholder="Search employees..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none hover:border-gray-400 transition-colors duration-200"
                  />
                </div>
                <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-2 bg-gray-50/50 space-y-1.5 hover:border-gray-400 transition-colors duration-200">
                  {(() => {
                    const q = employeeSearchQuery.trim().toLowerCase();
                    const filtered = q
                      ? users.filter((u) => {
                          const name = (u.name || '').toLowerCase();
                          const email = (u.email || '').toLowerCase();
                          const id = (u.id || '').toLowerCase();
                          return name.includes(q) || email.includes(q) || id.includes(q);
                        })
                      : users;
                    if (filtered.length === 0) {
                      return <p className="text-xs text-gray-500 py-2">{q ? 'No employees match your search.' : 'No employees found.'}</p>;
                    }
                    return filtered.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-white cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEmployeeIds.includes(u.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmployeeIds((prev) => [...prev, u.id]);
                            } else {
                              setSelectedEmployeeIds((prev) => prev.filter((id) => id !== u.id));
                            }
                          }}
                          className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        <span className="text-sm text-gray-800 truncate">{u.name || u.email || u.id}</span>
                      </label>
                    ));
                  })()}
                </div>
                {selectedEmployeeIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">{selectedEmployeeIds.length} selected</p>
                )}
              </div>
              {formError && (
                <p className="text-sm text-red-600">{formError}</p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  resetForm();
                  setShowAddModal(false);
                }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 hover:shadow-md active:scale-[0.99] transition-all duration-200"
              >
                Create Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
