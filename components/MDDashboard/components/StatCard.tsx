import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { KPIData } from '../types';

const StatCard: React.FC<KPIData> = ({ title, value, change, trend }) => {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{title}</p>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
          trend === 'up' 
            ? 'bg-emerald-50 text-emerald-600' 
            : 'bg-rose-50 text-rose-600'
        }`}>
          {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change}
        </div>
      </div>
      <p className="text-3xl font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
        {value}
      </p>
    </div>
  );
};

export default StatCard;
