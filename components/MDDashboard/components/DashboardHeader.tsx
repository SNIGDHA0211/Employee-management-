import React from 'react';
import { Search, Bell, Settings, Command, Globe, Shield } from 'lucide-react';

interface DashboardHeaderProps {
  title: string;
  userName?: string;
  userRole?: string;
  userAvatar?: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ 
  title, 
  userName = 'MD User', 
  userRole = 'Managing Director',
  userAvatar 
}) => {
  return (
    <header className="sticky top-0 z-30 w-full backdrop-blur-md bg-white border-b border-slate-200/60 shadow-sm">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100/50">
              <Command size={20} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight text-slate-900 leading-none">PLANETEYE</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.1em] mt-0.5">COMMAND</p>
            </div>
          </div>

          <div className="h-8 w-px bg-slate-200 ml-2"></div>

          <nav className="flex items-center gap-5 ml-2">
            <div className="flex items-center gap-2 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100/50 cursor-pointer hover:bg-indigo-100 transition-colors">
              <Globe size={13} /> Global Control
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
              <Shield size={13} /> Security Audit
            </div>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
            <input 
              type="text" 
              placeholder="Search command..." 
              className="pl-11 pr-6 py-2.5 bg-slate-50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-xs font-medium focus:outline-none w-64 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-1 px-2">
            <button className="p-2 text-slate-400 hover:text-slate-600 relative transition-all">
              <Bell size={20} />
              <span className="absolute top-2 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-all">
              <Settings size={20} />
            </button>
          </div>
          
          <div className="h-8 w-px bg-slate-200"></div>
          
          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-black text-slate-900 leading-tight">{userName}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{userRole}</p>
            </div>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-slate-100 cursor-pointer hover:border-indigo-500 transition-all shadow-sm">
              <img 
                src={userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=6366f1&color=fff`}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
