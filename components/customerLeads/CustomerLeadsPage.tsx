import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '../../types';
import { getProducts, createClientProfile, getClientProfiles, getClientStages, updateClientProfile, addConversations, updateConversation, type ClientProfileResponse, type ClientStage } from '../../services/api';
import { useEmployeesQuery } from '../../hooks/useEmployees';
import { Plus, ChevronDown, ChevronUp, User as UserIcon, Package, Clock, ListPlus, StickyNote, UserPlus, Search, BarChart2, MapPin, Phone, PhoneCall, Receipt, Pencil, Check, X } from 'lucide-react';
import { format, startOfMonth, parseISO } from 'date-fns';

function safeFormatDate(dateStr: string | undefined, formatStr: string, fallback = '—'): string {
  if (!dateStr) return fallback;
  try {
    const d = parseISO(dateStr);
    if (!(d instanceof Date) || isNaN(d.getTime())) return fallback;
    return format(d, formatStr);
  } catch {
    return fallback;
  }
}
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

export interface CustomerLeadNote {
  id?: string;
  text: string;
  createdAt: string;
  createdBy?: string;
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
  representativeContactNumber?: string;
  representativeName?: string;
  gstNumber?: string;
  description: string;
  product: string;
  productValue?: string;
  notes: CustomerLeadNote[];
  status: string;
  createdAt: string;
  createdBy: string;
  assignedEmployees?: AssignedEmployee[];
}

interface CustomerLeadsPageProps {
  currentUser: User;
  users: User[];
}

const CLIENT_LEADS_ALLOWED_DEPARTMENTS = ['marketing', 'sales', 'business strategy', 'business_strategy'];
const EMPLOYEE_SEARCH_ALLOWED_DEPARTMENTS = ['marketing', 'sales', 'business strategy', 'business_strategy'];
const EMPLOYEE_SEARCH_ALLOWED_FUNCTIONS = ['mmr', 'rg']; // case-insensitive match within function string

export function canAccessCustomerLeads(user: User): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase().trim();
  if (role === 'MD') return true;
  const dept = String(user.department || '').toLowerCase().trim();
  return CLIENT_LEADS_ALLOWED_DEPARTMENTS.some(
    allowed => dept === allowed || dept.includes(allowed)
  );
}

function getStatusStyle(statusName: string): string {
  const styles: Record<string, string> = {
    'Leads': 'bg-gray-100 text-gray-700 border-gray-300',
    'Qualified': 'bg-blue-100 text-blue-700 border-blue-300',
    'Demo': 'bg-amber-100 text-amber-700 border-amber-300',
    'Proposal': 'bg-purple-100 text-purple-700 border-purple-300',
    'Performer': 'bg-indigo-100 text-indigo-700 border-indigo-300',
    'Invoice': 'bg-emerald-100 text-emerald-700 border-emerald-300',
    'Repeat': 'bg-green-100 text-green-700 border-green-300',
  };
  return styles[statusName] ?? 'bg-gray-100 text-gray-700 border-gray-300';
}

function mapApiProfileToLead(item: ClientProfileResponse): CustomerLead {
  const status = item.status_name ?? 'Leads';
  const assignedEmployees: AssignedEmployee[] = (item.members ?? []).map((m: any) => {
    let empId: number | string | undefined;
    let nameVal: string | undefined;
    if (typeof m === 'number' || (typeof m === 'string' && m.trim() !== '')) {
      empId = typeof m === 'number' ? m : m.trim();
      nameVal = String(empId);
    } else if (m && typeof m === 'object') {
      // Support various API shapes: user/employee objects, user_id, employee_id
      const uid = m.user_id ?? m.employee_id ?? m.employee ?? m.user ?? m.id;
      const nested = m.user ?? m.employee;
      empId = typeof uid === 'object' && uid != null
        ? (uid.Employee_id ?? uid.employee_id ?? uid.id ?? uid)
        : uid;
      nameVal = m.username ?? m.name ?? (typeof nested === 'object' && nested != null ? (nested.Name ?? nested['Full Name'] ?? nested.name ?? nested.username) : undefined) ?? (empId != null ? String(empId) : undefined);
    } else {
      empId = undefined;
      nameVal = undefined;
    }
    const idStr = empId != null && String(empId) !== '' ? String(empId) : '—';
    const safeName = (nameVal && String(nameVal) !== 'undefined' ? String(nameVal) : idStr) || '—';
    return { id: idStr, name: safeName };
  });
  const notes: CustomerLeadNote[] = (item.notes ?? []).map((n) => ({
    id: String(n.id),
    text: n.note ?? '',
    createdAt: n.created_at,
    ...(n.created_by && { createdBy: n.created_by }),
  }));
  return {
    id: String(item.id),
    title: item.company_name,
    customerName: item.client_name,
    ...(item.client_contact && { customerContact: item.client_contact }),
    ...(item.representative_contact_number && { representativeContactNumber: item.representative_contact_number }),
    ...(item.representative_name && { representativeName: item.representative_name }),
    ...(item.gst_number && { gstNumber: item.gst_number }),
    description: item.motive ?? '',
    product: item.product_name ?? '',
    notes,
    status,
    createdAt: item.created_at,
    createdBy: item.created_by ?? 'Unknown',
    ...(assignedEmployees.length > 0 && { assignedEmployees }),
  };
}

export const CustomerLeadsPage: React.FC<CustomerLeadsPageProps> = ({ currentUser, users: usersProp }) => {
  const users = Array.isArray(usersProp) ? usersProp : [];
  const { data: employeesFromApi = [] } = useEmployeesQuery(!!currentUser?.id);
  const employeeIdToName = useMemo(() => {
    const map: Record<string, string> = {};
    const add = (u: { Employee_id?: string; id?: string; name?: string }) => {
      const eid = String(u.Employee_id ?? u.id ?? '').trim();
      const name = (u.name ?? '').trim();
      if (eid && name) map[eid] = name;
    };
    employeesFromApi.forEach(add);
    users.forEach(add); // Merge users prop (same source, may be available earlier)
    return map;
  }, [employeesFromApi, users]);

  const [leads, setLeads] = useState<CustomerLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [openStatusDropdown, setOpenStatusDropdown] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [representativeContactNumber, setRepresentativeContactNumber] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [description, setDescription] = useState('');
  const [product, setProduct] = useState('');
  const [productValue, setProductValue] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [products, setProducts] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [stages, setStages] = useState<ClientStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Add note state (per lead)
  const [newNoteInput, setNewNoteInput] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showGraphs, setShowGraphs] = useState(true);

  // Employee search: MD always included; others need Marketing/Sales/Business Strategy + function MMR or Rg
  const eligibleEmployeesForSearch = useMemo(() => {
    return users.filter((u) => {
      const role = String(u.role || '').toUpperCase().trim();
      if (role === 'MD') return true;
      const dept = String(u.department || '').toLowerCase().trim();
      const hasDept = EMPLOYEE_SEARCH_ALLOWED_DEPARTMENTS.some(
        (d) => dept === d || dept.includes(d.replace(/_/g, ' '))
      );
      const fn = String(u.function || '').toLowerCase();
      const hasFunction = EMPLOYEE_SEARCH_ALLOWED_FUNCTIONS.some((f) => fn.includes(f));
      return hasDept && hasFunction;
    });
  }, [users]);

  // Default MD as selected when Add Client Lead modal opens
  useEffect(() => {
    if (showAddModal) {
      const mdUser = users.find((u) => String(u.role || '').toUpperCase().trim() === 'MD');
      if (mdUser) {
        setSelectedEmployeeIds((prev) => (prev.includes(mdUser.id) ? prev : [mdUser.id, ...prev]));
      }
    }
  }, [showAddModal, users]);

  // Fetch client profiles from API on mount
  const fetchLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const data = await getClientProfiles();
      setLeads(data.map(mapApiProfileToLead));
    } catch {
      // Keep current state on error (no cache fallback)
    } finally {
      setLoadingLeads(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    setLoadingStages(true);
    getClientStages()
      .then(setStages)
      .catch(() => setStages([]))
      .finally(() => setLoadingStages(false));
  }, []);

  // Clear any previously cached customer leads from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('customer_leads');
    } catch {
      // ignore
    }
  }, []);

  // Fetch products when Add Client Lead modal opens
  useEffect(() => {
    if (showAddModal) {
      setLoadingProducts(true);
      getProducts()
        .then(setProducts)
        .catch(() => setProducts([]))
        .finally(() => setLoadingProducts(false));
    }
  }, [showAddModal]);

  const resetForm = () => {
    setTitle('');
    setCustomerName('');
    setCustomerAddress('');
    setCustomerContact('');
    setRepresentativeContactNumber('');
    setRepresentativeName('');
    setGstNumber('');
    setDescription('');
    setProduct('');
    setProductValue('');
    setSelectedEmployeeIds([]);
    setEmployeeSearchQuery('');
    setFormError(null);
  };

  const addNote = async (leadId: string) => {
    const text = (newNoteInput[leadId] || '').trim();
    if (!text) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const prevNotes = lead.notes;
    const optimisticNote: CustomerLeadNote = { text, createdAt: new Date().toISOString() };
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, notes: [...l.notes, optimisticNote] } : l))
    );
    setNewNoteInput((prev) => ({ ...prev, [leadId]: '' }));
    try {
      await addConversations(leadId, [text]);
      await fetchLeads();
    } catch {
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, notes: prevNotes } : l))
      );
    }
  };

  const [editingNote, setEditingNote] = useState<{ leadId: string; noteId: string } | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  const startEditNote = (leadId: string, note: CustomerLeadNote) => {
    if (!note.id) return;
    setEditingNote({ leadId, noteId: note.id });
    setEditingNoteText(note.text);
  };

  const cancelEditNote = () => {
    setEditingNote(null);
    setEditingNoteText('');
  };

  const saveEditNote = async () => {
    if (!editingNote || !editingNoteText.trim()) return;
    const { leadId, noteId } = editingNote;
    const lead = leads.find((l) => l.id === leadId);
    const note = lead?.notes.find((n) => n.id === noteId);
    if (!lead || !note) return;
    const prevText = note.text;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, notes: l.notes.map((n) => (n.id === noteId ? { ...n, text: editingNoteText.trim() } : n)) }
          : l
      )
    );
    setEditingNote(null);
    setEditingNoteText('');
    try {
      await updateConversation(leadId, noteId, editingNoteText.trim());
      await fetchLeads();
    } catch {
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, notes: l.notes.map((n) => (n.id === noteId ? { ...n, text: prevText } : n)) }
            : l
        )
      );
    }
  };

  const handleCreate = async () => {
    const t = title.trim();
    const cn = customerName.trim();
    if (!t || !cn) {
      setFormError('Company name and Client name are required.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const members: number[] = selectedEmployeeIds
        .map((id) => users.find((u) => u.id === id))
        .filter(Boolean)
        .map((u) => {
          const empId = u!.Employee_id ?? u!.id;
          const n = parseInt(String(empId), 10);
          return isNaN(n) ? 0 : n;
        })
        .filter((n) => n > 0);

      await createClientProfile({
        company_name: t,
        client_name: cn,
        ...(customerContact.trim() && { client_contact: customerContact.trim() }),
        ...(representativeContactNumber.trim() && { representative_contact_number: representativeContactNumber.trim() }),
        ...(representativeName.trim() && { representative_name: representativeName.trim() }),
        ...(description.trim() && { motive: description.trim() }),
        ...(gstNumber.trim() && { gst_number: gstNumber.trim() }),
        status_id: stages[0]?.id ?? 1,
        ...(product.trim() && { product_name: product.trim() }),
        ...(members.length > 0 && { members }),
      });
      await fetchLeads();
      resetForm();
      setShowAddModal(false);
    } catch (err: any) {
      const data = err?.response?.data;
      const msg = typeof data?.detail === 'string' ? data.detail
        : Array.isArray(data?.detail) ? data.detail.join(' ')
        : data?.message || data?.error || err?.message || 'Failed to add client lead.';
      const hint = err?.response?.status === 403
        ? ' Your account may not have permission to create client profiles. Contact your admin if you need access.'
        : '';
      setFormError(msg + hint);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    const prevLead = leads.find((l) => l.id === leadId);
    const prevStatus = prevLead?.status;
    const statusId = stages.find((s) => s.name === newStatus)?.id ?? stages[0]?.id ?? 1;
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    setOpenStatusDropdown(null);
    try {
      await updateClientProfile(leadId, { status_id: statusId });
      await fetchLeads();
    } catch {
      if (prevStatus) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: prevStatus } : l))
        );
      }
    }
  };

  const searchLower = searchQuery.trim().toLowerCase();
  const hasActiveFilters = !!searchLower || !!statusFilter;
  const filteredLeads = leads.filter((lead) => {
    if (statusFilter && lead.status !== statusFilter) return false;
    if (!searchLower) return true;
    const match = (s: string) => s && s.toLowerCase().includes(searchLower);
    if (match(lead.title) || match(lead.customerName) || match(lead.customerAddress ?? '') || match(lead.customerContact ?? '') || match(lead.representativeContactNumber ?? '') || match(lead.representativeName ?? '') || match(lead.gstNumber ?? '') || match(lead.product) || match(lead.productValue ?? '') || match(lead.description) || match(lead.createdBy)) return true;
    if (lead.assignedEmployees?.some((e) => match(e.name))) return true;
    if (lead.notes?.some((n) => match(n.text))) return true;
    return false;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
  };

  const statusChartColors: Record<string, string> = {
    'Leads': '#64748b', 'Qualified': '#3b82f6', 'Demo': '#f59e0b', 'Proposal': '#a855f7',
    'Performer': '#6366f1', 'Invoice': '#10b981', 'Repeat': '#22c55e',
  };

  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    const stageNames = stages.map((s) => s.name);
    const allStatuses = [...new Set([...stageNames, ...filteredLeads.map((l) => l.status)])];
    allStatuses.forEach((s) => { counts[s] = 0; });
    filteredLeads.forEach((l) => { counts[l.status] = (counts[l.status] ?? 0) + 1; });
    return allStatuses.map((status) => ({
      name: status,
      value: counts[status] ?? 0,
      color: statusChartColors[status] ?? '#94a3b8',
    })).filter((d) => d.value > 0);
  }, [filteredLeads, stages]);

  const leadsOverTimeData = useMemo(() => {
    try {
      const map = new Map<string, { ts: number; count: number }>();
      filteredLeads.forEach((l) => {
        const parsed = l.createdAt ? parseISO(l.createdAt) : new Date();
        const d = parsed instanceof Date && !isNaN(parsed.getTime()) ? parsed : new Date();
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
    } catch {
      return [];
    }
  }, [filteredLeads]);

  return (
    <div className="w-full max-w-7xl mx-auto min-h-[200px]">
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
            {stages.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
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
        {loadingLeads ? (
          <div className="col-span-full text-center py-16 bg-white rounded-xl border border-gray-200">
            <div className="animate-pulse flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-200" />
              <p className="text-gray-500 font-medium">Loading client leads...</p>
            </div>
          </div>
        ) : leads.length === 0 ? (
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
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${getStatusStyle(lead.status)}`}>
                  {lead.status}
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

                {/* Representative contact */}
                {(lead.representativeContactNumber || lead.representativeName) && (
                  <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-slate-50/80 border-l-2 border-slate-200">
                    <PhoneCall size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Representative</p>
                      {lead.representativeName && <span className="text-xs font-medium text-slate-800 truncate block">{lead.representativeName}</span>}
                      {lead.representativeContactNumber && <span className="text-xs font-medium text-slate-600 truncate block">{lead.representativeContactNumber}</span>}
                    </div>
                  </div>
                )}

                {/* GST number */}
                {lead.gstNumber && (
                  <div className="flex items-start gap-2 py-2 px-3 rounded-lg bg-slate-50/80 border-l-2 border-slate-200">
                    <Receipt size={14} className="text-slate-500 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">GST No.</p>
                      <span className="text-xs font-medium text-slate-800 truncate block">{lead.gstNumber}</span>
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
                      {lead.productValue && (
                        <span className="text-xs text-amber-800/90 mt-0.5 block">Value: {lead.productValue}</span>
                      )}
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
                        {lead.assignedEmployees.map((emp, idx) => {
                          const empIdStr = (emp.id && String(emp.id) !== 'undefined') ? String(emp.id).trim() : '';
                          const fromMap = empIdStr ? employeeIdToName[empIdStr] : undefined;
                          const raw = fromMap ?? emp.name ?? emp.id;
                          const displayName = (raw && String(raw) !== 'undefined' ? String(raw).trim() : '—') || '—';
                          return (
                            <li key={emp.id || `emp-${idx}`} className="truncate">{displayName}</li>
                          );
                        })}
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
                            {lead.notes.map((note, i) => {
                              const isEditing = editingNote?.leadId === lead.id && editingNote?.noteId === note.id;
                              return (
                                <li key={note.id ?? i} className="flex gap-2">
                                  <span className="flex-shrink-0 font-bold text-emerald-700 min-w-[1.25rem]">{i + 1}.</span>
                                  <div className="min-w-0 flex-1">
                                    {isEditing ? (
                                      <div className="space-y-1.5">
                                        <textarea
                                          value={editingNoteText}
                                          onChange={(e) => setEditingNoteText(e.target.value)}
                                          rows={2}
                                          className="w-full text-xs border border-emerald-200 rounded-md px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                                          autoFocus
                                        />
                                        <div className="flex gap-1">
                                          <button
                                            type="button"
                                            onClick={saveEditNote}
                                            className="p-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                            title="Save"
                                          >
                                            <Check size={12} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={cancelEditNote}
                                            className="p-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                                            title="Cancel"
                                          >
                                            <X size={12} />
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <span className="block whitespace-pre-wrap">{note.text}</span>
                                        <span className="text-[10px] text-emerald-600/80 mt-0.5 block flex items-center gap-2">
                                          {safeFormatDate(note.createdAt, 'dd MMM yyyy, HH:mm')}
                                          {note.createdBy && (
                                            <span className="text-emerald-500/90"> • by {employeeIdToName[String(note.createdBy).trim()] ?? note.createdBy}</span>
                                          )}
                                          {note.id && (
                                            <button
                                              type="button"
                                              onClick={() => startEditNote(lead.id, note)}
                                              className="text-emerald-500 hover:text-emerald-700"
                                              title="Edit note"
                                            >
                                              <Pencil size={10} />
                                            </button>
                                          )}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
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
                    {safeFormatDate(lead.createdAt, 'dd MMM yyyy, HH:mm')}
                  </span>
                  <span>By: <strong className="text-brand-600">{employeeIdToName[String(lead.createdBy).trim()] ?? lead.createdBy}</strong></span>
                </div>
              </div>

              {/* Status & footer */}
              <div className="px-4 pb-4 pt-3 flex justify-between items-center border-t border-gray-100">
                <div className="relative">
                  <button
                    onClick={() => setOpenStatusDropdown(openStatusDropdown === lead.id ? null : lead.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all duration-200 hover:opacity-90 hover:scale-[1.02] ${getStatusStyle(lead.status)}`}
                  >
                    {lead.status}
                    <ChevronDown size={12} className={openStatusDropdown === lead.id ? 'rotate-180' : ''} />
                  </button>
                  {openStatusDropdown === lead.id && (
                    <div className="absolute left-0 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[130px]">
                      {stages.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => handleStatusChange(lead.id, s.name)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                            lead.status === s.name ? 'bg-gray-100 font-semibold' : 'text-gray-700'
                          }`}
                        >
                          {s.name}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Representative contact number</label>
                <input
                  type="text"
                  value={representativeContactNumber}
                  onChange={(e) => setRepresentativeContactNumber(e.target.value)}
                  placeholder="Representative contact number"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none hover:border-gray-400 transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Representative name</label>
                <input
                  type="text"
                  value={representativeName}
                  onChange={(e) => setRepresentativeName(e.target.value)}
                  placeholder="Representative name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none hover:border-gray-400 transition-colors duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST number</label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  placeholder="GST number"
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
                <select
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 focus:outline-none hover:border-gray-400 transition-colors duration-200 bg-white"
                  disabled={loadingProducts}
                >
                  <option value="">{loadingProducts ? 'Loading products...' : 'Select product'}</option>
                  {products.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product value</label>
                <input
                  type="text"
                  value={productValue}
                  onChange={(e) => setProductValue(e.target.value)}
                  placeholder="Product value"
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
                      ? eligibleEmployeesForSearch.filter((u) => {
                          const name = (u.name || '').toLowerCase();
                          const email = (u.email || '').toLowerCase();
                          const id = (u.id || '').toLowerCase();
                          return name.includes(q) || email.includes(q) || id.includes(q);
                        })
                      : eligibleEmployeesForSearch;
                    if (filtered.length === 0) {
                      return <p className="text-xs text-gray-500 py-2">{q ? 'No employees match your search.' : 'No employees with function MMR/Rg in Marketing, Sales or Business Strategy.'}</p>;
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
                              const isMD = String(u.role || '').toUpperCase().trim() === 'MD';
                              if (isMD) return;
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
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 hover:shadow-md active:scale-[0.99] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
