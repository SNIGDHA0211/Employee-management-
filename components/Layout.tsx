
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole, formatRoleForDisplay } from '../types';
import { LogOut, LayoutDashboard, Users, FolderKanban, MessageSquare, Menu, Bell, Gift, Sun, Cake, CalendarDays, Briefcase, ChevronRight, UserCheck, FileText, Target, Package, Receipt, Wallet, Building2, Calendar, X, Video, Heart, Phone, VideoIcon, Search, Check, PhoneCall, Mic, ClipboardList, UserPlus } from 'lucide-react';
import { canAccessCustomerLeads } from './customerLeads/CustomerLeadsPage';
import { getMotivationalQuote } from '../services/gemini';
import { getPermission, requestPermission, isNotificationSupported } from '../utils/browserNotifications';
import { getBirthdayCounter, postBirthdayCounter, initiateCall, initiateGroupCall } from '../services/api';

const formatBookingTime = (val: string): string => {
  if (!val) return '';
  try {
    const parts = String(val).split(',');
    if (parts.length >= 2) return (parts[1]?.trim() || val);
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    return val;
  } catch {
    return val;
  }
};

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isLoggingOut?: boolean;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  onUserProfileClick?: () => void;
  onTasksHover?: () => void;
  /** NMRHI category IDs employee can access (from department/function). Default: all. */
  allowedNMRHICategories?: string[];
}


const NMRHI_ITEMS = [
  { id: 'nmrhi-npd', label: 'NPD', letter: 'N', color: 'bg-blue-600' },
  { id: 'nmrhi-mmr', label: 'MMR', letter: 'M', color: 'bg-emerald-600' },
  { id: 'nmrhi-rg', label: 'RG', letter: 'R', color: 'bg-amber-600' },
  { id: 'nmrhi-hc', label: 'HC', letter: 'H', color: 'bg-purple-600' },
  { id: 'nmrhi-ip', label: 'IP', letter: 'I', color: 'bg-rose-600' },
  { id: 'nmrhi-requests', label: 'Requests', letter: 'Q', color: 'bg-cyan-600' },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({ user, activeTab, setActiveTab, onLogout, isLoggingOut = false, isOpen, setIsOpen, onUserProfileClick, onTasksHover, allowedNMRHICategories }) => {
  const baseNMRHI = allowedNMRHICategories && allowedNMRHICategories.length > 0
    ? NMRHI_ITEMS.filter((item) => allowedNMRHICategories.includes(item.id))
    : NMRHI_ITEMS;
  const requestsItem = NMRHI_ITEMS.find((i) => i.id === 'nmrhi-requests');
  const visibleNMRHI = requestsItem && !baseNMRHI.some((i) => i.id === 'nmrhi-requests')
    ? [...baseNMRHI, requestsItem]
    : baseNMRHI;
  const [expandedNMRHI, setExpandedNMRHI] = useState(false);
  
  const menuItems = [
    // Non-admin dashboard (existing)
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.MD, UserRole.HR, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },

    // Admin Dashboard (MD, Admin); Assets/Vendors/Expenses/Bills for Admin only
    { id: 'admin-dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, roles: [UserRole.MD, UserRole.ADMIN] },
    { id: 'admin-assets', label: 'Assets', icon: Package, roles: [UserRole.ADMIN] },
    { id: 'admin-vendors', label: 'Vendors', icon: Building2, roles: [UserRole.ADMIN] },
    { id: 'admin-expenses', label: 'Expenses', icon: Wallet, roles: [UserRole.ADMIN] },
    { id: 'admin-bills', label: 'Bills', icon: Receipt, roles: [UserRole.ADMIN] },

    { id: 'schedule-hub', label: 'Schedule Hub', icon: Calendar, roles: [UserRole.MD, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN, UserRole.ADMIN, UserRole.HR] },
    // Attendance & Tours - commented out for all roles
    // { id: 'attendance', label: 'Attendance & Tours', icon: CalendarDays, roles: [UserRole.MD, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN, UserRole.ADMIN] },
    { id: 'tasks', label: 'Tasks', icon: FolderKanban, roles: [UserRole.MD, UserRole.ADMIN, UserRole.HR, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },
    { id: 'reports', label: 'Reports', icon: FileText, roles: [UserRole.MD, UserRole.ADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE] },
    { id: 'projects', label: 'Projects', icon: Briefcase, roles: [UserRole.MD, UserRole.TEAM_LEADER] },
    { id: 'messages', label: 'Messages', icon: MessageSquare, roles: [UserRole.MD, UserRole.ADMIN, UserRole.HR, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },
    { id: 'leave', label: 'Leave', icon: ClipboardList, roles: [UserRole.MD, UserRole.HR, UserRole.ADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },
    { id: 'admin', label: 'Admin Panel', icon: Users, roles: [UserRole.ADMIN] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  // Check if NMRHI submenu should be expanded
  useEffect(() => {
    if (['nmrhi-npd', 'nmrhi-mmr', 'nmrhi-rg', 'nmrhi-hc', 'nmrhi-ip', 'nmrhi-requests'].includes(activeTab)) {
      setExpandedNMRHI(true);
    }
  }, [activeTab]);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setIsOpen(false)} />
      )}

      <div className={`fixed inset-y-0 left-0 z-30 w-[280px] max-w-[85vw] md:w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col h-full shadow-xl md:shadow-none pl-[env(safe-area-inset-left)] ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex-shrink-0 p-4 md:p-6 flex items-center justify-between border-b border-slate-800/50">
          <h1 className="text-xl md:text-2xl font-bold text-brand-500 truncate">planeteye<span className="text-white">Team</span></h1>
          <button onClick={() => setIsOpen(false)} className="md:hidden p-2 -m-2 text-gray-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors" aria-label="Close menu">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
        <div className="px-4 md:px-6 pt-4 md:pt-6 pb-2">
          <div 
            className="flex items-center space-x-3 p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors"
            onClick={onUserProfileClick}
          >
            <div className="relative flex-shrink-0">
              <img 
                src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name && !/^\d+$/.test(String(user.name).trim()) ? user.name : 'Employee')}&background=random`} 
                alt={user.name || 'Employee'} 
                className="w-10 h-10 rounded-full border-2 border-brand-500 object-cover"
                onLoad={() => {}}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  console.error('❌ [SIDEBAR AVATAR] Image failed to load:', target.src);
                  if (!target.src.includes('ui-avatars.com')) {
                    const displayName = user.name && !/^\d+$/.test(String(user.name).trim()) ? user.name : 'Employee';
                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
                  }
                }}
              />
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-sm truncate">
                {user.name && !/^\d+$/.test(String(user.name).trim()) ? user.name : 'Employee'}
              </p>
              <p className="text-xs text-brand-400 truncate font-bold">
                {user.name && !/^\d+$/.test(String(user.name).trim()) ? formatRoleForDisplay(user.role) : `ID: ${(user as any).Employee_id || user.id} • ${formatRoleForDisplay(user.role)}`}
              </p>
            </div>
          </div>
        </div>

        <nav className="px-2 md:px-4 pb-4 space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isTasksItem = item.id === 'tasks';
            const isTasksActive = isTasksItem && (activeTab === 'assignTask' || activeTab === 'reportingTask');
            const isActive = isTasksActive || (!isTasksItem && activeTab === item.id);
            
            return (
              <div key={item.id}>
              <button
                  onClick={() => { 
                    if (isTasksItem) {
                      setActiveTab('assignTask');
                    } else {
                      setActiveTab(item.id);
                    }
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => isTasksItem && onTasksHover?.()}
                  className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-lg transition-all duration-200 ${
                    isActive ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                <Icon size={20} className="flex-shrink-0" />
                <span className="truncate">{item.label}</span>
                  </div>
                </button>
              </div>
            );
          })}

          {/* NMRHI Section - MD sees all 5; Employees see only pages matching their function */}
          {allowedNMRHICategories && allowedNMRHICategories.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  if (!expandedNMRHI) {
                    setExpandedNMRHI(true);
                    setActiveTab('nmrhi-requests');
                  } else {
                    setExpandedNMRHI(false);
                  }
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-lg transition-all duration-200 ${
                  'text-gray-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <Target size={20} className="flex-shrink-0" />
                  <span className="truncate">NMRHI</span>
                </div>
                <ChevronRight 
                  size={16} 
                  className={`transform transition-transform duration-200 ${expandedNMRHI ? 'rotate-90' : ''} text-gray-400`}
                />
              </button>

              {/* NMRHI Submenu - filtered by employee department/function */}
              {expandedNMRHI && (
                <div className="ml-4 mt-1 space-y-1">
                  {visibleNMRHI.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setActiveTab(item.id); setIsOpen(false); }}
                      className={`w-full flex items-center space-x-3 px-4 py-2.5 min-h-[44px] rounded-lg transition-all duration-200 ${
                        activeTab === item.id 
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20 font-medium' 
                          : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded ${item.color} text-white text-[10px] font-black flex items-center justify-center flex-shrink-0`}>{item.letter}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Client Leads - MD with MMR or RG function */}
          {canAccessCustomerLeads(user) && (
            <div className="mt-2">
              <button
                onClick={() => {
                  setActiveTab('customer-leads');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-lg transition-all duration-200 ${
                  activeTab === 'customer-leads'
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20'
                    : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <UserPlus size={20} className="flex-shrink-0" />
                  <span className="truncate">Client Leads</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            </div>
          )}

          {/* Userpanel Section for MD Role - After NMRHI */}
          {user.role === UserRole.MD && (
            <div className="mt-2">
              <button
                onClick={() => {
                  // MD "Userpanel" should open the user-management table view (AdminPanel)
                  setActiveTab('allUsers');
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-lg transition-all duration-200 ${
                  activeTab === 'allUsers' 
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' 
                    : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <UserCheck size={20} className="flex-shrink-0" />
                  <span className="truncate">Userpanel</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            </div>
          )}
        </nav>
        </div>

        <div className="flex-shrink-0 w-full p-4 border-t border-slate-800 bg-slate-900">
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="flex items-center space-x-3 text-gray-400 hover:text-red-400 w-full px-4 py-3 min-h-[44px] rounded-lg transition-colors hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <LogOut size={20} className="flex-shrink-0" />
            <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </div>
    </>
  );
};

type NotificationItem = { id: number; type_of_notification: number; from_user: string; receipient: string; message: string; is_read: boolean; created_at: string };

/** Tracks when notification scrolls into view - reports to onSeen for marking read when panel closes */
const NotificationEntry: React.FC<{
  notification: NotificationItem;
  onSeen?: (id: number) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  isPanelOpen: boolean;
}> = ({ notification: n, onSeen, scrollContainerRef, isPanelOpen }) => {
  const entryRef = useRef<HTMLDivElement>(null);
  const hasSeenRef = useRef(false);

  useEffect(() => {
    if (!isPanelOpen || !scrollContainerRef?.current || !entryRef.current || n.is_read || hasSeenRef.current || !onSeen) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasSeenRef.current) {
          hasSeenRef.current = true;
          onSeen(n.id);
        }
      },
      { root: scrollContainerRef.current, threshold: 0.1 }
    );
    observer.observe(entryRef.current);
    return () => observer.disconnect();
  }, [isPanelOpen, n.id, n.is_read, onSeen, scrollContainerRef]);

  return (
    <div
      ref={entryRef}
      className={`p-3 rounded-lg hover:bg-gray-50 border-b border-gray-100 last:border-0 ${!n.is_read ? 'bg-blue-100/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-xs font-medium text-brand-600 shrink-0">{n.from_user}</p>
        <p className="text-[10px] text-gray-400 shrink-0">{n.created_at}</p>
      </div>
      <p className="text-sm text-gray-800 break-words whitespace-pre-wrap">{n.message}</p>
    </div>
  );
};

// ─── HeaderCallModal ────────────────────────────────────────────────────────

interface HeaderCallModalProps {
  users: User[];
  currentUser: User;
  onClose: () => void;
}

const HeaderCallModal: React.FC<HeaderCallModalProps> = ({ users, currentUser, onClose }) => {
  const [step, setStep] = useState<'type' | 'select'>('type');
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Exclude self from the list
  const candidates = users.filter(
    (u) => u.id !== currentUser.id && u.name !== currentUser.name
  );

  const filtered = search.trim()
    ? candidates.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          (u.designation || '').toLowerCase().includes(search.toLowerCase()) ||
          (u.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : candidates;

  const toggleUser = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Focus search field when entering select step
  useEffect(() => {
    if (step === 'select') setTimeout(() => searchRef.current?.focus(), 80);
  }, [step]);

  const handleStart = async () => {
    if (selected.size === 0) return;
    setIsStarting(true);
    setError(null);
    try {
      const ids = Array.from(selected);
      if (ids.length === 1) {
        await initiateCall(ids[0], callType);
      } else {
        await initiateGroupCall(ids, callType);
      }
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to start call. Please try again.';
      setError(msg);
    } finally {
      setIsStarting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99998] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {step === 'select' && (
              <button
                onClick={() => { setStep('type'); setSelected(new Set()); setError(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors mr-1"
                aria-label="Back"
              >
                <ChevronRight size={16} className="rotate-180 text-gray-500" />
              </button>
            )}
            <PhoneCall size={18} className="text-brand-600" />
            <h2 className="font-semibold text-gray-800 text-base">
              {step === 'type' ? 'Start a Call' : `${callType === 'audio' ? 'Voice' : 'Video'} Call — Select People`}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Step 1 — Choose call type */}
        {step === 'type' && (
          <div className="p-6 flex flex-col gap-4">
            <p className="text-sm text-gray-500 mb-1">Choose how you'd like to connect</p>
            <button
              onClick={() => { setCallType('audio'); setStep('select'); }}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <Mic size={20} className="text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800">Voice Call</p>
                <p className="text-xs text-gray-500">Audio only call</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 ml-auto" />
            </button>
            <button
              onClick={() => { setCallType('video'); setStep('select'); }}
              className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-brand-500 hover:bg-brand-50 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <VideoIcon size={20} className="text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-800">Video Call</p>
                <p className="text-xs text-gray-500">Audio & video call</p>
              </div>
              <ChevronRight size={16} className="text-gray-400 ml-auto" />
            </button>
          </div>
        )}

        {/* Step 2 — Select employees */}
        {step === 'select' && (
          <>
            {/* Search */}
            <div className="px-4 pt-4 pb-2">
              <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                <Search size={15} className="text-gray-400 flex-shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or role…"
                  className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Selection badge */}
            {selected.size > 0 && (
              <div className="px-4 pb-1 flex items-center gap-1.5 flex-wrap">
                {Array.from(selected).map((id) => {
                  const u = users.find((x) => x.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full text-xs font-medium">
                      {u?.name ?? id}
                      <button onClick={() => toggleUser(id)} className="hover:text-brand-900">
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* User list */}
            <div className="flex-1 overflow-y-auto px-3 pb-3" style={{ maxHeight: '300px' }}>
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-6">No employees found</p>
              ) : (
                filtered.map((u) => {
                  const isSelected = selected.has(u.id);
                  return (
                    <button
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors mb-0.5 ${isSelected ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50'}`}
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`}
                          alt={u.name}
                          className="w-9 h-9 rounded-full object-cover border border-gray-200"
                          onError={(e) => {
                            const t = e.target as HTMLImageElement;
                            if (!t.src.includes('ui-avatars.com'))
                              t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random`;
                          }}
                        />
                        {isSelected && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-600 flex items-center justify-center border-2 border-white">
                            <Check size={9} className="text-white" />
                          </span>
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.designation || u.role}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'border-brand-600 bg-brand-600' : 'border-gray-300'}`}>
                        {isSelected && <Check size={11} className="text-white" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {error}
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3 bg-gray-50">
              <p className="text-xs text-gray-500">
                {selected.size === 0
                  ? 'Select at least one person'
                  : selected.size === 1
                  ? '1 person selected — 1-to-1 call'
                  : `${selected.size} people selected — Group call`}
              </p>
              <button
                onClick={handleStart}
                disabled={selected.size === 0 || isStarting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStarting ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : callType === 'audio' ? (
                  <Phone size={14} />
                ) : (
                  <VideoIcon size={14} />
                )}
                {isStarting ? 'Starting…' : 'Start Call'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

// ─── Header ────────────────────────────────────────────────────────────────

export const Header: React.FC<{ user: User; users?: User[]; toggleSidebar: () => void; onMeetClick?: () => void; meetingRefreshTrigger?: number; notificationMeetings?: any[]; notificationsToday?: NotificationItem[]; onMarkNotificationRead?: (id: number) => void | Promise<void> }> = ({ user, users = [], toggleSidebar, onMeetClick, notificationMeetings = [], notificationsToday = [], onMarkNotificationRead }) => {
  const [quote, setQuote] = useState("Loading thought...");
  const [showMeetingDropdown, setShowMeetingDropdown] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const meetings = notificationMeetings ?? [];
  const notifications = notificationsToday ?? [];

  useEffect(() => {
    if (isNotificationSupported()) setNotifPermission(getPermission());
  }, []);

  const toggleMeetingDropdown = () => setShowMeetingDropdown((prev) => !prev);
  const notificationScrollRef = useRef<HTMLDivElement>(null);
  const bellTriggerRef = useRef<HTMLButtonElement>(null);
  const [panelPosition, setPanelPosition] = useState({ top: 0, right: 0 });
  const seenNotificationIdsRef = useRef<Set<number>>(new Set());

  // Update panel position when opening (for portal placement)
  useEffect(() => {
    if (showMeetingDropdown && bellTriggerRef.current) {
      const rect = bellTriggerRef.current.getBoundingClientRect();
      setPanelPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
  }, [showMeetingDropdown]);

  // When panel closes, mark all notifications that were displayed/scrolled as read
  const prevPanelOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = prevPanelOpenRef.current;
    prevPanelOpenRef.current = showMeetingDropdown;
    if (wasOpen && !showMeetingDropdown && onMarkNotificationRead) {
      seenNotificationIdsRef.current.forEach((id) => onMarkNotificationRead(id));
      seenNotificationIdsRef.current.clear();
    }
  }, [showMeetingDropdown, onMarkNotificationRead]);

  const handleNotificationSeen = useCallback((id: number) => {
    seenNotificationIdsRef.current.add(id);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showMeetingDropdown && !target.closest('.meeting-dropdown-trigger') && !target.closest('.notification-panel')) {
        setShowMeetingDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showMeetingDropdown]);

  useEffect(() => {
    getMotivationalQuote().then(setQuote);
    const interval = setInterval(() => {
        getMotivationalQuote().then(setQuote);
    }, 3600000); 
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const sortedNotifications = [...notifications].sort((a, b) => (b?.id ?? 0) - (a?.id ?? 0));

  const todayStr = new Date().toISOString().split('T')[0];
  const birthdayUsers = users.filter((u: User) => u.birthDate?.endsWith(todayStr.slice(5)));
  const showBirthdayWish = birthdayUsers.length > 0;

  const [wishCount, setWishCount] = useState<number>(0);
  const [isSendingWishes, setIsSendingWishes] = useState(false);

  const currentUserId = (user as any).Employee_id ?? user.id;

  useEffect(() => {
    if (!showBirthdayWish || !currentUserId) return;
    const fetchCount = async () => {
      try {
        const res = await getBirthdayCounter(currentUserId);
        setWishCount(res.birthday_counter);
      } catch {
        setWishCount(0);
      }
    };
    fetchCount();
  }, [showBirthdayWish, currentUserId]);

  const handleSendWishes = async () => {
    if (birthdayUsers.length === 0 || isSendingWishes) return;
    setIsSendingWishes(true);
    try {
      const res = await postBirthdayCounter(currentUserId);
      setWishCount(res.birthday_counter);
    } catch {
      /* ignore */
    } finally {
      setIsSendingWishes(false);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center space-x-4 flex-1 min-w-0">
        <button onClick={toggleSidebar} className="p-2 hover:bg-gray-100 rounded-lg md:hidden flex-shrink-0">
          <Menu size={24} />
        </button>
        <div className="hidden md:flex items-center flex-1 min-w-0" style={{ maxWidth: '100%' }}>
          {showBirthdayWish ? (
            <div className="flex items-center gap-3 w-full max-w-full bg-gradient-to-r from-pink-500/90 via-purple-500/90 to-indigo-500/90 text-white px-4 py-2 rounded-lg shadow-md border border-white/20">
              <Cake size={20} className="flex-shrink-0 text-pink-100" />
              <div className="min-w-0 flex-1 truncate">
                <span className="font-bold text-sm">Wishing you a very Happy Birthday {birthdayUsers.map((u: User) => u.name).join(', ')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full font-bold text-sm">
                  <Cake size={14} className="text-pink-200" />
                  <span>{birthdayUsers.length}</span>
                  <span className="text-pink-200/90 text-xs font-normal">birthdays</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full font-bold text-sm">
                  <Heart size={16} className="text-pink-300 fill-pink-300" />
                  <span>{wishCount}</span>
                  <span className="text-pink-200/90 text-xs font-normal">wishes</span>
                </div>
              </div>
              <button
                onClick={handleSendWishes}
                disabled={isSendingWishes}
                className="flex-shrink-0 flex items-center gap-1.5 bg-white text-purple-600 px-3 py-1.5 rounded-lg font-semibold text-sm hover:bg-purple-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Gift size={14} />
                <span>{isSendingWishes ? 'Sending...' : 'Send Wishes'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center text-sm text-gray-600 italic min-w-0 truncate">
              <Sun size={16} className="text-orange-400 mr-2 flex-shrink-0" />
              <span className="truncate">&quot;{quote}&quot;</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {notifPermission === 'default' && (
          <button
            type="button"
            onClick={() => requestPermission().then((p) => setNotifPermission(p))}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-600 bg-brand-50 rounded-lg hover:bg-brand-100 transition-colors"
          >
            <Bell size={14} />
            <span>Enable notifications</span>
          </button>
        )}
        {user.role === UserRole.MD && onMeetClick && (
          <button
            type="button"
            onClick={onMeetClick}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            <span>Meet</span>
          </button>
        )}
        {/* Call button */}
        <button
          type="button"
          onClick={() => setShowCallModal(true)}
          className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Start a call"
          title="Start a call"
        >
          <Phone size={20} className="text-gray-600 hover:text-brand-600" />
        </button>

        {showCallModal && typeof document !== 'undefined' && (
          <HeaderCallModal
            users={users}
            currentUser={user}
            onClose={() => setShowCallModal(false)}
          />
        )}

        <div className="relative meeting-dropdown-trigger">
          <button
            ref={bellTriggerRef}
            type="button"
            onClick={toggleMeetingDropdown}
            className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="View notifications"
          >
            <Bell size={20} className="text-gray-600 hover:text-brand-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full z-[1]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {showMeetingDropdown && typeof document !== 'undefined' && createPortal(
            <div
              className="notification-panel fixed w-96 max-h-[28rem] overflow-hidden bg-white rounded-xl shadow-xl border border-gray-200"
              style={{ top: panelPosition.top, right: panelPosition.right, zIndex: 2147483647 }}
            >
              <div className="p-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-800 text-sm">Notifications</h3>
              </div>
              <div ref={notificationScrollRef} className="overflow-y-auto max-h-80 p-2">
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No notifications</p>
                ) : (
                  sortedNotifications.map((n) => (
                    <NotificationEntry
                      key={n.id}
                      notification={n}
                      onSeen={handleNotificationSeen}
                      scrollContainerRef={notificationScrollRef}
                      isPanelOpen={showMeetingDropdown}
                    />
                  ))
                )}
              </div>
            </div>,
            document.body
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold border border-brand-200">
          {user.name.charAt(0)}
        </div>
      </div>
    </header>
  );
};

export const BirthdayBanner: React.FC<{ users: User[], currentUser: User }> = ({ users, currentUser }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const birthdayUsers = users.filter(u => u.birthDate?.endsWith(todayStr.slice(5)));
  
  const [showConfetti, setShowConfetti] = useState(false);
  const [wishCount, setWishCount] = useState<number>(0);
  const [isSendingWishes, setIsSendingWishes] = useState(false);

  const currentUserId = (currentUser as any).Employee_id ?? currentUser.id;

  useEffect(() => {
    if (birthdayUsers.length > 0) setShowConfetti(true);
  }, [birthdayUsers.length]);

  useEffect(() => {
    if (birthdayUsers.length === 0 || !currentUserId) return;
    const fetchCount = async () => {
      try {
        const res = await getBirthdayCounter(currentUserId);
        setWishCount(res.birthday_counter);
      } catch {
        setWishCount(0);
      }
    };
    fetchCount();
  }, [birthdayUsers.length, currentUserId]);

  const handleSendWishes = async () => {
    if (birthdayUsers.length === 0 || isSendingWishes) return;
    setIsSendingWishes(true);
    try {
      const res = await postBirthdayCounter(currentUserId);
      setWishCount(res.birthday_counter);
    } catch {
      /* ignore */
    } finally {
      setIsSendingWishes(false);
    }
  };

  if (birthdayUsers.length === 0) return null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white p-6 mb-8 rounded-xl shadow-lg flex flex-col md:flex-row items-center justify-between animate-float border-4 border-white/20">
      
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-30">
         <div className="absolute top-2 left-10 text-4xl">🎈</div>
         <div className="absolute bottom-2 right-20 text-4xl">✨</div>
         <div className="absolute top-1/2 left-1/2 text-6xl">🎉</div>
      </div>

      <div className="flex items-center space-x-4 z-10">
        <div className="bg-white p-3 rounded-full text-pink-500 shadow-lg">
          <Cake size={32} />
        </div>
        <div>
          <h3 className="font-bold text-2xl mb-1">Birthday Wishes 🎂</h3>
          <p className="text-white/95 font-medium text-lg">
            Let&apos;s celebrate: {birthdayUsers.map(u => u.name).join(', ')}
          </p>
          {birthdayUsers.find(u => u.id === currentUser.id) && (
             <p className="text-yellow-300 font-bold mt-1 text-sm">It&apos;s your special day! Have a wonderful one!</p>
          )}
        </div>
      </div>
      
      <div className="mt-4 md:mt-0 z-10 flex items-center space-x-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full font-bold text-lg">
            <Cake size={20} className="text-pink-200" />
            <span>{birthdayUsers.length}</span>
            <span className="text-white/80 text-sm font-normal">birthdays</span>
          </div>
          <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full font-bold text-lg">
            <Heart size={24} className="text-pink-300 fill-pink-300" />
            <span>{wishCount}</span>
            <span className="text-white/80 text-sm font-normal">wishes</span>
          </div>
        </div>
        <button 
          onClick={handleSendWishes}
          disabled={isSendingWishes}
          className="bg-white text-purple-600 px-6 py-2 rounded-full font-bold shadow-md hover:scale-105 transition-transform flex items-center space-x-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
           <Gift size={18} />
           <span>{isSendingWishes ? 'Sending...' : 'Send Wishes'}</span>
        </button>
      </div>
    </div>
  );
};
