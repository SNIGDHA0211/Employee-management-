
import React, { useState, useEffect } from 'react';
import { User, UserRole, formatRoleForDisplay } from '../types';
import { LogOut, LayoutDashboard, Users, FolderKanban, MessageSquare, Menu, Bell, Gift, Sun, Cake, CalendarDays, Briefcase, ChevronRight, UserCheck, FileText, Target, Package, Receipt, Wallet, Building2 } from 'lucide-react';
import { getMotivationalQuote } from '../services/gemini';

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  onUserProfileClick?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, activeTab, setActiveTab, onLogout, isOpen, setIsOpen, onUserProfileClick }) => {
  const [expandedTasks, setExpandedTasks] = useState(false);
  const [expandedNMRHI, setExpandedNMRHI] = useState(false);
  
  const menuItems = [
    // Non-admin dashboard (existing)
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.MD, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },

    // Admin-only dashboard + modules
    { id: 'admin-dashboard', label: 'Admin Dashboard', icon: LayoutDashboard, roles: [UserRole.ADMIN] },
    { id: 'admin-assets', label: 'Assets', icon: Package, roles: [UserRole.ADMIN] },
    { id: 'admin-vendors', label: 'Vendors', icon: Building2, roles: [UserRole.ADMIN] },
    { id: 'admin-expenses', label: 'Expenses', icon: Wallet, roles: [UserRole.ADMIN] },
    { id: 'admin-bills', label: 'Bills', icon: Receipt, roles: [UserRole.ADMIN] },

    { id: 'attendance', label: 'Attendance & Tours', icon: CalendarDays, roles: [UserRole.MD, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN, UserRole.ADMIN] },
    { id: 'tasks', label: 'Tasks', icon: FolderKanban, roles: [UserRole.MD, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN], hasSubmenu: user.role === UserRole.MD || user.role === UserRole.EMPLOYEE || user.role === UserRole.INTERN || user.role === UserRole.TEAM_LEADER },
    { id: 'reports', label: 'Reports', icon: FileText, roles: [UserRole.MD, UserRole.ADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },
    { id: 'projects', label: 'Projects', icon: Briefcase, roles: [UserRole.MD, UserRole.TEAM_LEADER] },
    { id: 'team', label: 'Team', icon: Users, roles: [UserRole.MD, UserRole.ADMIN, UserRole.TEAM_LEADER] },
    { id: 'messages', label: 'Messages', icon: MessageSquare, roles: [UserRole.MD, UserRole.ADMIN, UserRole.TEAM_LEADER, UserRole.EMPLOYEE, UserRole.INTERN] },
    { id: 'admin', label: 'Admin Panel', icon: Users, roles: [UserRole.ADMIN] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user.role));

  // Check if tasks submenu should be expanded
  useEffect(() => {
    if (activeTab === 'assignTask' || activeTab === 'reportingTask') {
      setExpandedTasks(true);
    }
  }, [activeTab]);

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

      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-brand-500">planeteye<span className="text-white">Team</span></h1>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white">
            <LogOut size={20} />
          </button>
        </div>

        <div className="px-6 mb-6">
          <div 
            className="flex items-center space-x-3 p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors"
            onClick={onUserProfileClick}
          >
            <div className="relative flex-shrink-0">
              <img 
                src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`} 
                alt={user.name} 
                className="w-10 h-10 rounded-full border-2 border-brand-500 object-cover"
                onLoad={() => {
                  console.log('✅ [SIDEBAR AVATAR] Image loaded successfully:', user.avatar);
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  console.error('❌ [SIDEBAR AVATAR] Image failed to load:', target.src);
                  // If the image fails to load and it's not already a fallback, use ui-avatars
                  if (!target.src.includes('ui-avatars.com')) {
                    const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
                    console.log('🔄 [SIDEBAR AVATAR] Falling back to:', fallbackUrl);
                    target.src = fallbackUrl;
                  }
                }}
              />
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-sm truncate">{user.name}</p>
              <p className="text-xs text-brand-400 truncate font-bold">{formatRoleForDisplay(user.role)}</p>
            </div>
          </div>
        </div>

        <nav className="px-4 space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isTasksItem = item.id === 'tasks' && item.hasSubmenu;
            // Tasks parent should NOT turn blue - keep it gray/black always
            const isTasksParentActive = false; // Never highlight Tasks parent button
            // Check if any submenu is active
            const isSubmenuActive = activeTab === 'assignTask' || activeTab === 'reportingTask';
            
            return (
              <div key={item.id}>
              <button
                  onClick={() => { 
                    if (isTasksItem) {
                      if (!expandedTasks) {
                        setExpandedTasks(true);
                        setActiveTab('assignTask');
                      } else {
                        setExpandedTasks(false);
                      }
                    } else {
                      setActiveTab(item.id);
                    }
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                    isTasksParentActive ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                  <div className="flex items-center space-x-3">
                <Icon size={20} />
                <span>{item.label}</span>
                  </div>
                  {isTasksItem && (
                    <ChevronRight 
                      size={16} 
                      className={`transform transition-transform duration-200 ${expandedTasks ? 'rotate-90' : ''} text-gray-400`}
                    />
                  )}
                </button>
                
                {/* Tasks Submenu for MD, Employee, Intern, and Team Leader roles */}
                {isTasksItem && expandedTasks && (user.role === UserRole.MD || user.role === UserRole.EMPLOYEE || user.role === UserRole.INTERN || user.role === UserRole.TEAM_LEADER) && (
                  <div className="ml-4 mt-1 space-y-1">
                    <button
                      onClick={() => { setActiveTab('assignTask'); setIsOpen(false); }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                        activeTab === 'assignTask' 
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20 font-medium' 
                          : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span>Reporting Task</span>
                    </button>
                    <button
                      onClick={() => { setActiveTab('reportingTask'); setIsOpen(false); }}
                      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                        activeTab === 'reportingTask' 
                          ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20 font-medium' 
                          : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <span>Assigned Task</span>
              </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* NMRHI Section for MD Role */}
          {user.role === UserRole.MD && (
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
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                  'text-gray-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Target size={20} />
                  <span>NMRHI</span>
                </div>
                <ChevronRight 
                  size={16} 
                  className={`transform transition-transform duration-200 ${expandedNMRHI ? 'rotate-90' : ''} text-gray-400`}
                />
              </button>

              {/* NMRHI Submenu */}
              {expandedNMRHI && (
                <div className="ml-4 mt-1 space-y-1">
                  <button
                    onClick={() => { setActiveTab('nmrhi-npd'); setIsOpen(false); }}
                    className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                      activeTab === 'nmrhi-npd' 
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20 font-medium' 
                        : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="w-6 h-6 rounded bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">N</span>
                    <span>NPD</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('nmrhi-mmr'); setIsOpen(false); }}
                    className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                      activeTab === 'nmrhi-mmr' 
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20 font-medium' 
                        : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="w-6 h-6 rounded bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">M</span>
                    <span>MMR</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('nmrhi-rg'); setIsOpen(false); }}
                    className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                      activeTab === 'nmrhi-rg' 
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20 font-medium' 
                        : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="w-6 h-6 rounded bg-amber-600 text-white text-[10px] font-black flex items-center justify-center">R</span>
                    <span>RG</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('nmrhi-hc'); setIsOpen(false); }}
                    className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                      activeTab === 'nmrhi-hc' 
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20 font-medium' 
                        : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="w-6 h-6 rounded bg-purple-600 text-white text-[10px] font-black flex items-center justify-center">H</span>
                    <span>HC</span>
                  </button>
                  <button
                    onClick={() => { setActiveTab('nmrhi-ip'); setIsOpen(false); }}
                    className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200 ${
                      activeTab === 'nmrhi-ip' 
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20 font-medium' 
                        : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="w-6 h-6 rounded bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">I</span>
                    <span>IP</span>
                  </button>
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
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-200 ${
                  activeTab === 'allUsers' 
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/20' 
                    : 'text-gray-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <UserCheck size={20} />
                  <span>Userpanel</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            </div>
          )}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t border-slate-800">
          <button onClick={onLogout} className="flex items-center space-x-3 text-gray-400 hover:text-red-400 w-full px-4 py-2 transition-colors">
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export const Header: React.FC<{ user: User, toggleSidebar: () => void }> = ({ user, toggleSidebar }) => {
  const [quote, setQuote] = useState("Loading thought...");

  useEffect(() => {
    getMotivationalQuote().then(setQuote);
    const interval = setInterval(() => {
        getMotivationalQuote().then(setQuote);
    }, 3600000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center space-x-4">
        <button onClick={toggleSidebar} className="p-2 hover:bg-gray-100 rounded-lg md:hidden">
          <Menu size={24} />
        </button>
        <div className="hidden md:flex items-center text-sm text-gray-600 italic">
          <Sun size={16} className="text-orange-400 mr-2" />
          "{quote}"
        </div>
      </div>
      <div className="flex items-center space-x-4">
        {/* Notification bell and avatar - Commented out for all users */}
        {/* <div className="relative">
          <Bell size={20} className="text-gray-600 cursor-pointer hover:text-brand-600" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
        </div>
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold border border-brand-200">
          {user.name.charAt(0)}
        </div> */}
      </div>
    </header>
  );
};

export const BirthdayBanner: React.FC<{ users: User[], currentUser: User }> = ({ users, currentUser }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const birthdayUsers = users.filter(u => u.birthDate.endsWith(todayStr.slice(5)));
  
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
          <h3 className="font-bold text-2xl mb-1">Happy Birthday! 🎂</h3>
          <p className="text-white/90 font-medium">
            Let's celebrate: {birthdayUsers.map(u => u.name).join(', ')}
          </p>
          {birthdayUsers.find(u => u.id === currentUser.id) && (
             <p className="text-yellow-300 font-bold mt-1 text-sm">It's your special day! Have a wonderful one!</p>
          )}
        </div>
      </div>
      
      <div className="mt-4 md:mt-0 z-10 flex space-x-2">
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
