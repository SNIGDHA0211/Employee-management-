
import React, { useState } from 'react';
import { User, Project, Task, TaskStatus, UserRole } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area, Legend } from 'recharts';
import { TrendingUp, Users, AlertCircle, Calendar } from 'lucide-react';

export const StatCard: React.FC<{ title: string, value: string | number, color: string, icon?: any, trend?: string }> = ({ title, value, color, icon: Icon, trend }) => (
  <div className={`bg-white p-6 rounded-xl shadow-sm border-l-4 ${color} relative overflow-hidden group hover:shadow-md transition-shadow`}>
    <div className="relative z-10 flex justify-between items-start">
      <div>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{title}</p>
        <h3 className="text-3xl font-bold text-gray-800 mt-2">{value}</h3>
        {trend && <p className="text-xs text-green-500 font-bold mt-1 flex items-center"><TrendingUp size={12} className="mr-1"/> {trend}</p>}
      </div>
      {Icon && <div className="p-3 bg-gray-50 rounded-lg group-hover:bg-white transition-colors"><Icon className="text-gray-400 w-6 h-6" /></div>}
    </div>
  </div>
);

export const ProjectCard: React.FC<{ project: Project, userRole: string }> = ({ project, userRole }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all flex flex-col h-full">
    <div className="flex justify-between items-start mb-4">
      <div>
         <span className={`text-[10px] font-bold px-2 py-1 rounded mb-2 inline-block uppercase tracking-wider ${project.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : project.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{project.status}</span>
         <h3 className="text-lg font-bold text-gray-900 leading-tight">{project.title}</h3>
         <span className="text-xs text-brand-600 font-medium">{project.branch}</span>
      </div>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-4 border-gray-50 ${project.progress === 100 ? 'bg-green-100 text-green-700' : 'bg-brand-50 text-brand-700'}`}>
        {project.progress}%
      </div>
    </div>
    
    <p className="text-gray-500 text-sm mb-6 flex-1">{project.description}</p>
    
    <div className="space-y-4">
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="bg-brand-600 h-full rounded-full transition-all duration-1000" style={{ width: `${project.progress}%` }}></div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-50">
        <div className="flex -space-x-2">
           {project.memberIds.map((mid, idx) => (
             <div key={mid} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 font-bold" title={mid}>
               {mid.substring(0,2).toUpperCase()}
             </div>
           ))}
           {project.memberIds.length > 3 && (
             <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] text-gray-500 font-bold">
               +{project.memberIds.length - 3}
             </div>
           )}
        </div>
        <button className="text-xs font-bold text-gray-400 hover:text-brand-600 uppercase">View</button>
      </div>
    </div>
  </div>
);

export const PerformanceChart: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
  const completed = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const pending = tasks.filter(t => t.status === TaskStatus.PENDING).length;
  const overdue = tasks.filter(t => t.status === TaskStatus.OVERDUE).length;

  const data = [
    { name: 'Completed', value: completed, color: '#22c55e' },
    { name: 'Pending', value: pending, color: '#3b82f6' },
    { name: 'Overdue', value: overdue, color: '#ef4444' },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
      <h3 className="text-lg font-bold text-gray-800 mb-6">Task Analytics</h3>
      <div className="flex-1 min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center space-x-6 mt-6">
        {data.map(item => (
          <div key={item.name} className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
            <span className="text-xs font-medium text-gray-600">{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const BossRevenueChart: React.FC = () => {
    const data = [
      { name: 'Jan', revenue: 4000 },
      { name: 'Feb', revenue: 3000 },
      { name: 'Mar', revenue: 2000 },
      { name: 'Apr', revenue: 2780 },
      { name: 'May', revenue: 1890 },
      { name: 'Jun', revenue: 2390 },
      { name: 'Jul', revenue: 3490 },
    ];

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Company Performance</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                        <Tooltip />
                        <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

export const DistributionChart: React.FC<{ 
  title: string, 
  data: { name: string, value: number, color: string }[], 
  onBarClick?: (name: string) => void 
}> = ({ title, data, onBarClick }) => {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col h-full">
        <h3 className="text-lg font-bold text-gray-800 mb-6">{title}</h3>
        <div className="flex-1 min-h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
               <CartesianGrid strokeDasharray="3 3" horizontal={false} />
               <XAxis type="number" hide />
               <YAxis dataKey="name" type="category" tick={{fontSize: 12, fill: '#64748b', fontWeight: 'bold'}} width={80} />
               <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px' }} />
               <Bar 
                 dataKey="value" 
                 radius={[0, 4, 4, 0]}
                 onClick={(data: any) => {
                   if (onBarClick && data && data.activePayload && data.activePayload[0]) {
                     const clickedName = data.activePayload[0].payload.name;
                     onBarClick(clickedName);
                   }
                 }}
                 style={{ cursor: onBarClick ? 'pointer' : 'default' }}
               >
                 {data.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                    />
                 ))}
               </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
};
