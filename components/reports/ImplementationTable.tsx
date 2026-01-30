import React, { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { ImplementationRow } from './types';

interface ImplementationTableProps {
  rows: ImplementationRow[];
  setRows: React.Dispatch<React.SetStateAction<ImplementationRow[]>>;
  onStatusChange?: (rowId: string, status: 'PENDING' | 'INPROCESS' | 'Completed') => void;
  onRemoveRow?: (rowId: string) => void;
}

const ImplementationTable: React.FC<ImplementationTableProps> = ({ rows, setRows, onStatusChange, onRemoveRow }) => {
  const updateRow = (id: string, field: keyof ImplementationRow, value: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleStatusChange = (rowId: string, newStatus: string) => {
    updateRow(rowId, 'status', newStatus);
    // Map local status to API status format
    let apiStatus: 'PENDING' | 'INPROCESS' | 'Completed' = 'PENDING';
    if (newStatus === 'Completed') {
      apiStatus = 'Completed';
    } else if (newStatus === 'In Progress') {
      apiStatus = 'INPROCESS';
    } else {
      apiStatus = 'PENDING';
    }
    
    if (onStatusChange) {
      onStatusChange(rowId, apiStatus);
    }
  };

  const groups = ['D1', 'D2', 'D3'];

  // Check if previous groups are filled
  const isD1Filled = useMemo(() => rows.filter(r => r.group === 'D1').some(r => r.action.trim().length > 0), [rows]);
  const isD2Filled = useMemo(() => rows.filter(r => r.group === 'D2').some(r => r.action.trim().length > 0), [rows]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
             <th className="border border-gray-300 p-2 text-center text-xs font-bold text-gray-500 w-12">GRP</th>
             <th className="border border-gray-300 p-2 text-center text-xs font-bold text-gray-500 w-12">NO</th>
             <th className="border border-gray-300 p-2 text-left text-xs font-bold text-gray-500 uppercase">Action (Milestone)</th>
             <th className="border border-gray-300 p-2 text-left text-xs font-bold text-gray-500 uppercase w-32">Deadline</th>
             <th className="border border-gray-300 p-2 text-left text-xs font-bold text-gray-500 uppercase w-48">Assigned Help</th>
             <th className="border border-gray-300 p-2 text-left text-xs font-bold text-gray-500 uppercase w-32">Status</th>
             <th className="border border-gray-300 p-2 text-center text-xs font-bold text-gray-500 uppercase w-20 no-print">Remove</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
              const groupRows = rows.filter(r => r.group === group);
              const isLocked = (group === 'D2' && !isD1Filled) || (group === 'D3' && !isD2Filled);

              return (
                  <React.Fragment key={group}>
                      {groupRows.map((row, idx) => (
                          <tr key={row.id} className={`transition-colors ${isLocked ? 'bg-slate-50/50' : 'hover:bg-gray-50'}`}>
                              {idx === 0 && (
                                  <td rowSpan={groupRows.length} className={`border border-gray-300 p-2 text-center font-black text-[10px] ${isLocked ? 'text-slate-300' : 'text-indigo-600 bg-indigo-50/20'}`}>
                                      {group}
                                  </td>
                              )}
                              <td className="border border-gray-300 p-2 text-center text-sm font-medium text-gray-400">{row.no}</td>
                              <td className={`border border-gray-300 p-0 ${isLocked ? 'cursor-not-allowed' : ''}`}>
                                  <input 
                                    className={`w-full p-2 outline-none border-none text-sm bg-transparent ${isLocked ? 'opacity-30 italic text-slate-400' : ''}`} 
                                    value={row.action} 
                                    disabled={isLocked}
                                    placeholder={isLocked ? "Locked (Fill D1 first)" : "Enter action..."}
                                    onChange={(e) => updateRow(row.id, 'action', e.target.value)}
                                  />
                              </td>
                              <td className="border border-gray-300 p-0">
                                  <input 
                                    type="date"
                                    className={`w-full p-2 outline-none border-none text-sm bg-transparent ${isLocked ? 'opacity-10' : ''}`} 
                                    value={row.deadline} 
                                    disabled={isLocked}
                                    onChange={(e) => updateRow(row.id, 'deadline', e.target.value)}
                                  />
                              </td>
                              <td className="border border-gray-300 p-0">
                                  <input 
                                    className={`w-full p-2 outline-none border-none text-sm bg-transparent ${isLocked ? 'opacity-10' : ''}`} 
                                    value={row.assignedHelp} 
                                    disabled={isLocked}
                                    onChange={(e) => updateRow(row.id, 'assignedHelp', e.target.value)}
                                  />
                              </td>
                              <td className="border border-gray-300 p-0">
                                  <select 
                                    className={`w-full p-2 outline-none border-none text-sm bg-transparent ${isLocked ? 'opacity-10' : ''}`}
                                    value={row.status}
                                    disabled={isLocked}
                                    onChange={(e) => handleStatusChange(row.id, e.target.value)}
                                  >
                                      <option value="">Status</option>
                                      <option value="Pending">Pending</option>
                                      <option value="In Progress">In Progress</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Delayed">Delayed</option>
                                  </select>
                              </td>
                              <td className="border border-gray-300 p-2 text-center align-middle no-print w-20">
                                  {onRemoveRow && (
                                    <button
                                      type="button"
                                      onClick={() => onRemoveRow(row.id)}
                                      className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                      title="Remove row"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </React.Fragment>
              )
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ImplementationTable;
