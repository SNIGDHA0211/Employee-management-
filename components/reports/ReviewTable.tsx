import React, { useMemo, useState, useEffect } from 'react';
import { MeetingConfig, ReviewRow } from './types';

interface ReviewTableProps {
  config: MeetingConfig;
  rows: ReviewRow[];
  setRows: React.Dispatch<React.SetStateAction<ReviewRow[]>>;
  onStatusChange?: (rowId: string, status: 'PENDING' | 'INPROCESS' | 'COMPLETED') => void;
  onAddRow?: (tableType: 'D1' | 'D2' | 'D3') => void; // Callback to add row to specific table
}

const ReviewTable: React.FC<ReviewTableProps> = ({ config, rows, setRows, onStatusChange, onAddRow }) => {
  const [activeTable, setActiveTable] = useState<'D1' | 'D2' | 'D3'>('D1');
  
  // Expose activeTable to parent component via window (temporary solution)
  useEffect(() => {
    (window as any).__activeReviewTable = activeTable;
  }, [activeTable]);
  const updateRow = (id: string, field: keyof ReviewRow, value: string | 'PENDING' | 'INPROCESS' | 'COMPLETED') => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleStatusChange = (rowId: string, newStatus: 'PENDING' | 'INPROCESS' | 'COMPLETED') => {
    updateRow(rowId, 'status', newStatus);
    if (onStatusChange) {
      onStatusChange(rowId, newStatus);
    }
  };

  // Helper function to determine which tables should be displayed based on date
  const getDateBasedAccess = (dateStr: string) => {
    try {
      const entryDate = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      entryDate.setHours(0, 0, 0, 0);
      
      const daysDiff = Math.floor((entryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff >= 0 && daysDiff <= 9) {
        return { showD1: true, showD2: false, showD3: false };
      } else if (daysDiff >= 10 && daysDiff <= 19) {
        return { showD1: true, showD2: true, showD3: false };
      } else if (daysDiff >= 20) {
        return { showD1: true, showD2: true, showD3: true };
      } else {
        // Past dates: All visible
        return { showD1: true, showD2: true, showD3: true };
      }
    } catch (e) {
      return { showD1: true, showD2: true, showD3: true };
    }
  };

  // Check if any row requires D2 or D3 tables to be shown
  const shouldShowD2Table = useMemo(() => {
    return rows.some(row => {
      const access = getDateBasedAccess(row.col1);
      return access.showD2;
    });
  }, [rows]);

  const shouldShowD3Table = useMemo(() => {
    return rows.some(row => {
      const access = getDateBasedAccess(row.col1);
      return access.showD3;
    });
  }, [rows]);

  // Render a single table for D1, D2, or D3
  const renderTable = (tableType: 'D1' | 'D2' | 'D3') => {
    const getColumnData = (row: ReviewRow) => {
      if (tableType === 'D1') return row.col2;
      if (tableType === 'D3') return row.col4;
      return row.col3;
    };

    const getSubHead = () => {
      if (tableType === 'D1') return config.subHeads.d1;
      if (tableType === 'D3') return config.subHeads.d3;
      return config.subHeads.d2;
    };

    const getHeaderColor = () => {
      if (tableType === 'D1') return 'bg-indigo-50/20 text-indigo-600';
      return 'bg-slate-100/50 text-slate-400';
    };

    // Filter rows that belong to this specific table type AND are within the date range
    const filteredRows = rows.filter(row => {
      // First check if row belongs to this table type
      const belongsToTable = row.tableType === tableType;
      
      if (!belongsToTable) return false;
      
      // Then check date-based access
      const access = getDateBasedAccess(row.col1);
      if (tableType === 'D1') return access.showD1;
      if (tableType === 'D2') return access.showD2;
      return access.showD3;
    });

    if (filteredRows.length === 0) return null;

    return (
      <div className="mb-8">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-50">
                <th className="border border-slate-300 p-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-tighter w-40">
                  Entry Date
                </th>
                <th className={`border border-slate-300 p-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-tighter ${getHeaderColor()}`}>
                  <span className={`block mb-1 text-xs font-black ${tableType === 'D1' ? 'text-indigo-600' : 'text-slate-400'}`}>
                    SUB HEAD {tableType}
                  </span>
                  {getSubHead()}
                </th>
                <th className="border border-slate-300 p-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-tighter w-32">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, index) => {
                const showDate = index === 0 || filteredRows[index - 1].col1 !== row.col1;
                const columnData = getColumnData(row);
                const isD1Filled = row.col2.trim().length > 0;
                const isD2Filled = row.col3.trim().length > 0;
                
                // Enable logic based on table type and sequential requirements
                let isEnabled = false;
                if (tableType === 'D1') {
                  isEnabled = true; // D1 is always enabled for its date range
                } else if (tableType === 'D2') {
                  isEnabled = isD1Filled; // D2 enabled if D1 is filled
                } else {
                  isEnabled = isD2Filled; // D3 enabled if D2 is filled
                }

                const updateColumn = (value: string) => {
                  if (tableType === 'D1') {
                    updateRow(row.id, 'col2', value);
                  } else if (tableType === 'D2') {
                    updateRow(row.id, 'col3', value);
                  } else {
                    updateRow(row.id, 'col4', value);
                  }
                };

                return (
                  <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${!showDate ? 'border-t-0' : 'border-t border-slate-100'}`}>
                    {/* Date Column */}
                    <td className={`border-x border-slate-200 p-4 align-top ${!showDate ? 'bg-slate-50/20' : ''}`}>
                      {showDate ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-900">
                            {new Date(row.col1).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {new Date(row.col1).getFullYear()}
                          </span>
                        </div>
                      ) : (
                        <div className="h-4 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-slate-200 rounded-full"></div>
                        </div>
                      )}
                    </td>
                    
                    {/* Content Column */}
                    <td className={`border border-slate-200 p-0 transition-all duration-300 ${isEnabled ? 'bg-white' : 'bg-slate-100/40'}`}>
                      <textarea 
                        value={columnData} 
                        onChange={(e) => updateColumn(e.target.value)}
                        disabled={!isEnabled}
                        placeholder={
                          !isEnabled 
                            ? tableType === 'D2' 
                              ? "Locked (Fill D1 first)" 
                              : tableType === 'D3'
                              ? "Locked (Fill D2 first)"
                              : "Start with D1..."
                            : tableType === 'D1'
                            ? "Start with D1..."
                            : tableType === 'D2'
                            ? "Continue with D2..."
                            : "Finalize with D3..."
                        }
                        className={`w-full p-4 bg-transparent outline-none text-sm border-none resize-none min-h-[70px] leading-relaxed transition-opacity ${isEnabled ? 'focus:ring-1 focus:ring-indigo-500' : 'opacity-30 cursor-not-allowed italic text-slate-400'}`} 
                      />
                    </td>

                    {/* Status Column */}
                    <td className="border border-slate-200 p-2 align-top">
                      <select
                        value={row.status || 'PENDING'}
                        onChange={(e) => {
                          const selectedStatus = e.target.value;
                          let normalizedStatus: 'PENDING' | 'INPROCESS' | 'COMPLETED' = 'PENDING';
                          if (selectedStatus === 'COMPLETED' || selectedStatus === 'Completed') {
                            normalizedStatus = 'COMPLETED';
                          } else if (selectedStatus === 'INPROCESS') {
                            normalizedStatus = 'INPROCESS';
                          } else {
                            normalizedStatus = 'PENDING';
                          }
                          handleStatusChange(row.id, normalizedStatus);
                        }}
                        className="w-full px-2 py-2 text-xs font-semibold border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white"
                      >
                        <option value="PENDING" className="text-yellow-600">Pending</option>
                        <option value="INPROCESS" className="text-blue-600">In Process</option>
                        <option value="COMPLETED" className="text-green-600">Completed</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Table Selection Buttons */}
      <div className="mb-6 flex gap-3 justify-start">
        <button
          onClick={() => setActiveTable('D1')}
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${
            activeTable === 'D1'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-indigo-400'
          }`}
        >
          D1
        </button>
        {shouldShowD2Table && (
          <button
            onClick={() => setActiveTable('D2')}
            className={`px-6 py-3 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${
              activeTable === 'D2'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-indigo-400'
            }`}
          >
            D2
          </button>
        )}
        {shouldShowD3Table && (
          <button
            onClick={() => setActiveTable('D3')}
            className={`px-6 py-3 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${
              activeTable === 'D3'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-indigo-400'
            }`}
          >
            D3
          </button>
        )}
      </div>

      {/* Render only the active table */}
      {activeTable === 'D1' && renderTable('D1')}
      {activeTable === 'D2' && shouldShowD2Table && renderTable('D2')}
      {activeTable === 'D3' && shouldShowD3Table && renderTable('D3')}
      
      <div className="mt-6 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
        <div className="flex items-center">
          <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></div>
          Sequential Input Protocol: D1 → D2 → D3
        </div>
        <p>Planeteye AI Data Integrity Logic</p>
      </div>
    </div>
  );
};

export default ReviewTable;
