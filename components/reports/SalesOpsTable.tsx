import React, { useEffect, useMemo } from 'react';
import { SalesOpsRow } from './types';

interface SalesOpsTableProps {
  rows: SalesOpsRow[];
  setRows: React.Dispatch<React.SetStateAction<SalesOpsRow[]>>;
  onStatusChange?: (rowId: string, status: 'PENDING' | 'INPROCESS' | 'Completed') => void;
}

const SalesOpsTable: React.FC<SalesOpsTableProps> = ({ rows, setRows, onStatusChange }) => {
  useEffect(() => {
    if (rows.length === 0) {
      const initial: SalesOpsRow[] = [];
      ['D1', 'D2', 'D3'].forEach(g => {
        for (let i = 0; i < 2; i++) {
          initial.push({
            id: Math.random().toString(36),
            no: (i + 1).toString(),
            group: g as 'D1' | 'D2' | 'D3',
            sale: '', calls: '', trial: '', demand: '',
            oldTargeted: '', newAcquired: '', newPitching: '', cpRatio: '',
            leadIn: '', qualify: '', demo: '', quotation: '', closing: '', convRate: '',
            status: 'PENDING'
          });
        }
      });
      setRows(initial);
    }
  }, [rows.length, setRows]);

  const updateRow = (id: string, field: keyof SalesOpsRow, value: string | 'PENDING' | 'INPROCESS' | 'Completed') => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleStatusChange = (rowId: string, newStatus: 'PENDING' | 'INPROCESS' | 'Completed') => {
    updateRow(rowId, 'status', newStatus);
    if (onStatusChange) {
      onStatusChange(rowId, newStatus);
    }
  };

  const groups = ['D1', 'D2', 'D3'];

  // Check if previous groups are filled (using 'sale' field as indicator)
  const isD1Filled = useMemo(() => rows.filter(r => r.group === 'D1').some(r => r.sale.trim().length > 0), [rows]);
  const isD2Filled = useMemo(() => rows.filter(r => r.group === 'D2').some(r => r.sale.trim().length > 0), [rows]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300 text-[10px]">
        <thead>
          <tr className="bg-gray-100">
            <th rowSpan={2} className="border border-gray-300 p-1 w-8">GRP</th>
            <th rowSpan={2} className="border border-gray-300 p-1 w-8">NO</th>
            <th rowSpan={2} className="border border-gray-300 p-1">SALE</th>
            <th rowSpan={2} className="border border-gray-300 p-1">CALLS</th>
            <th rowSpan={2} className="border border-gray-300 p-1">TRIAL</th>
            <th rowSpan={2} className="border border-gray-300 p-1">DEMAND</th>
            <th rowSpan={2} className="border border-gray-300 p-1 bg-yellow-50">OLD TGT</th>
            <th rowSpan={2} className="border border-gray-300 p-1 bg-green-50">NEW ACQ</th>
            <th rowSpan={2} className="border border-gray-300 p-1">PITCH</th>
            <th rowSpan={2} className="border border-gray-300 p-1">C:P</th>
            <th colSpan={5} className="border border-gray-300 p-1 bg-indigo-50">SALE PIPELINE UPDATE</th>
            <th rowSpan={2} className="border border-gray-300 p-1">CONV%</th>
            <th rowSpan={2} className="border border-gray-300 p-1 w-32">Status</th>
          </tr>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 p-1">LEAD</th>
            <th className="border border-gray-300 p-1">QUAL</th>
            <th className="border border-gray-300 p-1">DEMO</th>
            <th className="border border-gray-300 p-1">QUOTE</th>
            <th className="border border-gray-300 p-1">CLOSE</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(group => {
            const groupRows = rows.filter(r => r.group === group);
            const isLocked = (group === 'D2' && !isD1Filled) || (group === 'D3' && !isD2Filled);

            return (
              <React.Fragment key={group}>
                {groupRows.map((row, idx) => (
                  <tr key={row.id} className={`${isLocked ? 'bg-slate-50/40' : 'hover:bg-gray-50'}`}>
                    {idx === 0 && <td rowSpan={groupRows.length} className={`border border-gray-300 p-1 font-black text-center ${isLocked ? 'text-slate-300 bg-slate-100' : 'text-indigo-600 bg-indigo-50/30'}`}>{group}</td>}
                    <td className="border border-gray-300 p-1 text-center font-bold text-gray-400">{row.no}</td>
                    {[
                      'sale', 'calls', 'trial', 'demand', 'oldTargeted', 'newAcquired', 'newPitching', 'cpRatio',
                      'leadIn', 'qualify', 'demo', 'quotation', 'closing', 'convRate'
                    ].map(field => (
                      <td key={field} className={`border border-gray-300 p-0 ${field === 'oldTargeted' ? 'bg-yellow-50/20' : field === 'newAcquired' ? 'bg-green-50/20' : ''}`}>
                        <input 
                          className={`w-full p-1 bg-transparent outline-none border-none text-center ${isLocked ? 'opacity-20 cursor-not-allowed' : 'focus:bg-white'}`}
                          value={(row as any)[field]}
                          disabled={isLocked}
                          placeholder={isLocked && field === 'sale' ? "Locked" : ""}
                          onChange={(e) => updateRow(row.id, field as keyof SalesOpsRow, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="border border-gray-300 p-2 align-top">
                      <select
                        value={row.status || 'PENDING'}
                        onChange={(e) => handleStatusChange(row.id, e.target.value as 'PENDING' | 'INPROCESS' | 'Completed')}
                        disabled={isLocked}
                        className={`w-full px-2 py-2 text-xs font-semibold border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="PENDING" className="text-yellow-600">Pending</option>
                        <option value="INPROCESS" className="text-blue-600">In Process</option>
                        <option value="Completed" className="text-green-600">Completed</option>
                      </select>
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

export default SalesOpsTable;
