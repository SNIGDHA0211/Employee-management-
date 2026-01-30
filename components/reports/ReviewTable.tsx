import React, { useMemo, useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { MeetingConfig, ReviewRow } from './types';

interface ReviewTableProps {
  config: MeetingConfig;
  rows: ReviewRow[];
  setRows: React.Dispatch<React.SetStateAction<ReviewRow[]>>;
  onStatusChange?: (rowId: string, status: 'PENDING' | 'INPROCESS' | 'COMPLETED') => void;
  onAddRow?: (tableType: 'D1' | 'D2' | 'D3') => void;
  onRemoveRow?: (rowId: string) => void;
  emptyMessage?: string;
  isLoadingEntries?: boolean;
}

const ReviewTable: React.FC<ReviewTableProps> = ({ config, rows, setRows, onStatusChange, onAddRow, onRemoveRow, emptyMessage, isLoadingEntries }) => {
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

  const DAYS_REQUIRED = 10;

  // D1 "10 days completed" = at least 10 distinct dates with D1 rows that have content (col2)
  const d1TenDaysCompleted = useMemo(() => {
    const dates = new Set<string>();
    rows
      .filter(r => r.tableType === 'D1' && (r.col2 || '').trim().length > 0)
      .forEach(r => dates.add(r.col1));
    return dates.size >= DAYS_REQUIRED;
  }, [rows]);

  // D2 "10 days completed" = at least 10 distinct dates with D2 rows that have content (col3)
  const d2TenDaysCompleted = useMemo(() => {
    const dates = new Set<string>();
    rows
      .filter(r => r.tableType === 'D2' && (r.col3 || '').trim().length > 0)
      .forEach(r => dates.add(r.col1));
    return dates.size >= DAYS_REQUIRED;
  }, [rows]);

  const shouldShowD2Button = d1TenDaysCompleted;
  const shouldShowD3Button = d1TenDaysCompleted && d2TenDaysCompleted;

  // Progress counts for UI hint (distinct dates with content)
  const d1DaysCount = useMemo(() => {
    const dates = new Set<string>();
    rows.filter(r => r.tableType === 'D1' && (r.col2 || '').trim().length > 0).forEach(r => dates.add(r.col1));
    return dates.size;
  }, [rows]);
  const d2DaysCount = useMemo(() => {
    const dates = new Set<string>();
    rows.filter(r => r.tableType === 'D2' && (r.col3 || '').trim().length > 0).forEach(r => dates.add(r.col1));
    return dates.size;
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

    // Filter rows that belong to this specific table type only (no date-based access)
    const filteredRows = rows.filter(row => row.tableType === tableType);
    const isEmpty = filteredRows.length === 0;

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
                <th className="border border-slate-300 p-4 text-center text-[10px] font-black text-slate-500 uppercase tracking-tighter w-24 no-print">
                  Remove
                </th>
              </tr>
            </thead>
            <tbody>
              {isEmpty && (
                <tr>
                  <td colSpan={4} className="border border-slate-200 p-8 text-center text-slate-500 bg-slate-50/50">
                    {emptyMessage || 'No entries yet. Use "+ ADD ENTRY" below to add an entry.'}
                  </td>
                </tr>
              )}
              {filteredRows.map((row, index) => {
                const showDate = index === 0 || filteredRows[index - 1].col1 !== row.col1;
                const columnData = getColumnData(row);
                const date = row.col1;
                // Same-date completion: D2 enabled if D1 row for this date has col2 filled; D3 if D2 has col3 filled
                const isD1FilledForDate = rows.some(r => r.tableType === 'D1' && r.col1 === date && (r.col2 || '').trim().length > 0);
                const isD2FilledForDate = rows.some(r => r.tableType === 'D2' && r.col1 === date && (r.col3 || '').trim().length > 0);

                let isEnabled = false;
                if (tableType === 'D1') {
                  isEnabled = true;
                } else if (tableType === 'D2') {
                  isEnabled = isD1FilledForDate;
                } else {
                  isEnabled = isD2FilledForDate;
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

                    {/* Remove Row - hidden when printing */}
                    <td className="border border-slate-200 p-2 align-top text-center no-print w-24">
                      {onRemoveRow && (
                        <button
                          type="button"
                          onClick={() => onRemoveRow(row.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Remove row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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

  if (isLoadingEntries) {
    return (
      <div className="py-12 text-center text-slate-500 font-semibold">
        Loading entries…
      </div>
    );
  }

  if (emptyMessage && rows.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-600 font-semibold">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Table Selection Buttons: D1 always; D2 when D1 has 10 days completed; D3 when D1 & D2 have 10 days completed */}
      <div className="mb-6 flex gap-3 justify-start flex-wrap">
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
        <button
          onClick={() => setActiveTable('D2')}
          disabled={!shouldShowD2Button}
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${
            !shouldShowD2Button
              ? 'bg-slate-100 text-slate-400 border-2 border-slate-200 cursor-not-allowed'
              : activeTable === 'D2'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-indigo-400'
          }`}
          title={!shouldShowD2Button ? 'Complete 10 days in D1 to access D2' : undefined}
        >
          D2
        </button>
        <button
          onClick={() => setActiveTable('D3')}
          disabled={!shouldShowD3Button}
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider rounded-lg transition-all ${
            !shouldShowD3Button
              ? 'bg-slate-100 text-slate-400 border-2 border-slate-200 cursor-not-allowed'
              : activeTable === 'D3'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-slate-600 border-2 border-slate-300 hover:border-indigo-400'
          }`}
          title={!shouldShowD3Button ? 'Complete 10 days in D1 and D2 to access D3' : undefined}
        >
          D3
        </button>
      </div>

      {/* D1 only | D1+D2 | D1+D2+D3 based on active button */}
      {activeTable === 'D1' && renderTable('D1')}
      {activeTable === 'D2' && (
        <>
          {renderTable('D1')}
          {renderTable('D2')}
        </>
      )}
      {activeTable === 'D3' && (
        <>
          {renderTable('D1')}
          {renderTable('D2')}
          {renderTable('D3')}
        </>
      )}
      
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center">
            <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2" />
            Sequential Input Protocol: D1 → D2 → D3
          </span>
          <span className="text-slate-500 font-semibold normal-case">
            D1: {d1DaysCount}/{DAYS_REQUIRED} days
            {shouldShowD2Button && ` • D2: ${d2DaysCount}/${DAYS_REQUIRED} days`}
          </span>
        </div>
        <p>Planeteye AI Data Integrity Logic</p>
      </div>
    </div>
  );
};

export default ReviewTable;
