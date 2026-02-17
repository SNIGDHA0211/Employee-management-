
import React, { useState, useEffect } from 'react';
import { User, UserRole, formatRoleForDisplay } from '../types';
import { LogOut, LayoutDashboard, Users, FolderKanban, MessageSquare, Menu, Bell, Gift, Sun, Cake, CalendarDays, Briefcase, ChevronRight, UserCheck, FileText, Target, Package, Receipt, Wallet, Building2, Calendar, X, Video, Heart } from 'lucide-react';
import { getMotivationalQuote } from '../services/gemini';

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
] as const;

export const Sidebar: React.FC<SidebarProps> = ({ user, activeTab, setActiveTab, onLogout, isOpen, setIsOpen, onUserProfileClick, onTasksHover, allowedNMRHICategories }) => {
  const visibleNMRHI = allowedNMRHICategories && allowedNMRHICategories.length > 0
    ? NMRHI_ITEMS.filter((item) => allowedNMRHICategories.includes(item.id))
    : NMRHI_ITEMS;
  const [expandedNMRHI, setExpandedNMRHI] = useState(false);
  
  const menuItems = [
    // Non-admin dashboard (existing)
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.MD, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },

    // Admin Dashboard (MD and Admin); Assets/Vendors/Expenses/Bills only for Admin
    { id: 'admin-dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, roles: [UserRole.MD, UserRole.ADMIN] },
    { id: 'admin-assets', label: 'Assets', icon: Package, roles: [UserRole.ADMIN] },
    { id: 'admin-vendors', label: 'Vendors', icon: Building2, roles: [UserRole.ADMIN] },
    { id: 'admin-expenses', label: 'Expenses', icon: Wallet, roles: [UserRole.ADMIN] },
    { id: 'admin-bills', label: 'Bills', icon: Receipt, roles: [UserRole.ADMIN] },

    { id: 'schedule-hub', label: 'Schedule Hub', icon: Calendar, roles: [UserRole.MD, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN, UserRole.ADMIN] },
    // Attendance & Tours - commented out for all roles
    // { id: 'attendance', label: 'Attendance & Tours', icon: CalendarDays, roles: [UserRole.MD, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN, UserRole.ADMIN] },
    { id: 'tasks', label: 'Tasks', icon: FolderKanban, roles: [UserRole.MD, UserRole.ADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },
    { id: 'reports', label: 'Reports', icon: FileText, roles: [UserRole.MD, UserRole.ADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },
    { id: 'projects', label: 'Projects', icon: Briefcase, roles: [UserRole.MD, UserRole.TEAM_LEADER] },
    { id: 'messages', label: 'Messages', icon: MessageSquare, roles: [UserRole.MD, UserRole.ADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },
    { id: 'admin', label: 'Admin Panel', icon: Users, roles: [UserRole.ADMIN] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  // Check if NMRHI submenu should be expanded
  useEffect(() => {
    if (activeTab === 'nmrhi-npd' || activeTab === 'nmrhi-mmr' || activeTab === 'nmrhi-rg' || activeTab === 'nmrhi-hc' || activeTab === 'nmrhi-ip') {
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
                    setActiveTab('nmrhi-npd');
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
          <button onClick={onLogout} className="flex items-center space-x-3 text-gray-400 hover:text-red-400 w-full px-4 py-3 min-h-[44px] rounded-lg transition-colors hover:bg-slate-800">
            <LogOut size={20} className="flex-shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export const Header: React.FC<{ user: User; users?: User[]; toggleSidebar: () => void; onMeetClick?: () => void; meetingRefreshTrigger?: number; notificationMeetings?: any[] }> = ({ user, users = [], toggleSidebar, onMeetClick, notificationMeetings = [] }) => {
  const [quote, setQuote] = useState("Loading thought...");
  const [showMeetingDropdown, setShowMeetingDropdown] = useState(false);
  const meetings = notificationMeetings ?? [];

  const toggleMeetingDropdown = () => setShowMeetingDropdown((prev) => !prev);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showMeetingDropdown && !target.closest('.meeting-dropdown-trigger')) {
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

  const meetingCount = meetings.length;
  const sortedMeetings = [...meetings].sort((a: any, b: any) => (Number(b?.id) || 0) - (Number(a?.id) || 0));

  const todayStr = new Date().toISOString().split('T')[0];
  const birthdayUsers = users.filter((u: User) => u.birthDate?.endsWith(todayStr.slice(5)));
  const showBirthdayWish = birthdayUsers.length > 0;

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
              <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full font-bold text-sm">
                <Heart size={16} className="text-pink-300 fill-pink-300" />
                <span>{birthdayUsers.length}</span>
              </div>
              <button
                onClick={() => alert(`Wish sent to ${birthdayUsers.map((u: User) => u.name).join(', ')}!`)}
                className="flex-shrink-0 flex items-center gap-1.5 bg-white text-purple-600 px-3 py-1.5 rounded-lg font-semibold text-sm hover:bg-purple-50 transition-colors"
              >
                <Gift size={14} />
                <span>Send Wishes</span>
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
        {user.role === UserRole.MD && onMeetClick && (
          <button
            type="button"
            onClick={onMeetClick}
            className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
          >
            <span>Meet</span>
          </button>
        )}
        <div className="relative meeting-dropdown-trigger">
          <button
            type="button"
            onClick={toggleMeetingDropdown}
            className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="View meetings"
          >
            <Bell size={20} className="text-gray-600 hover:text-brand-600" />
            {meetingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full z-[1]">
                {meetingCount > 99 ? '99+' : meetingCount}
              </span>
            )}
          </button>
          {showMeetingDropdown && (
            <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-hidden bg-white rounded-xl shadow-lg border border-gray-200 z-[9999]">
              <div className="p-3 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-800 text-sm">Meets</h3>
              </div>
              <div className="overflow-y-auto max-h-72 p-2">
                {meetings.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4 text-center">No meetings scheduled</p>
                ) : (
                  sortedMeetings.map((m: any) => {
                    const room = m.meeting_room ?? m.room ?? m.meeting_name ?? m.name ?? 'Meeting';
                    const duration = m.time ?? m.duration ?? 60;
                    const scheduled = m.schedule_time ?? m.scheduled_time ?? m.scheduled_at ?? m.created_at ?? m.date ?? m.datetime;
                    const members = m.user_details ?? m.users ?? [];
                    return (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="text-xs font-medium text-brand-600 mb-1">
                        {room} · {duration === 60 ? '1 hr' : `${duration} min`}
                      </p>
                      {scheduled && (
                        <p className="text-xs text-gray-500 mb-1">
                          Scheduled: {formatBookingTime(String(scheduled))}
                        </p>
                      )}
                      <div className="text-xs text-gray-700">
                        <span className="font-medium">Members: </span>
                        {members.map((u: any) => u?.full_name ?? u?.username ?? (typeof u === 'string' ? u : u?.name)).filter(Boolean).join(', ') || '—'}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
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

  useEffect(() => {
    if (birthdayUsers.length > 0) setShowConfetti(true);
  }, [birthdayUsers.length]);

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
        <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full font-bold text-lg">
          <Heart size={24} className="text-pink-300 fill-pink-300" />
          <span>{birthdayUsers.length}</span>
        </div>
        <button 
          onClick={() => alert(`Wish sent to ${birthdayUsers.map(u => u.name).join(', ')}!`)}
          className="bg-white text-purple-600 px-6 py-2 rounded-full font-bold shadow-md hover:scale-105 transition-transform flex items-center space-x-2"
        >
           <Gift size={18} />
           <span>Send Wishes</span>
        </button>
      </div>
    </div>
  );
};
