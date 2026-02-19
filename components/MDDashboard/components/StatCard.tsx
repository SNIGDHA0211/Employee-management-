import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { KPIData } from '../types';

const StatCard: React.FC<KPIData> = ({ title, value, change, trend }) => {
  return (
    <div className="bg-white p-3 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
      {/* Mobile: 2-line layout - Line 1: label + trend, Line 2: value */}
      <div className="flex flex-col sm:block">
        <div className="flex items-center justify-between gap-2 mb-1 sm:mb-4">
          <p className="text-[10px] sm:text-sm font-semibold text-slate-500 uppercase tracking-wide line-clamp-1 sm:line-clamp-2 min-w-0">{title}</p>
          <div className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold shrink-0 ${
            trend === 'up' 
              ? 'bg-emerald-50 text-emerald-600' 
              : 'bg-rose-50 text-rose-600'
          }`}>
            {trend === 'up' ? <TrendingUp size={8} className="sm:w-3 sm:h-3" /> : <TrendingDown size={8} className="sm:w-3 sm:h-3" />}
            {change}
          </div>
        </div>
        <p className="text-lg sm:text-3xl font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
};

export default StatCard;
