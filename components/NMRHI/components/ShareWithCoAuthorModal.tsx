import React, { useState } from 'react';
import { X, UserPlus } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  Employee_id?: string;
}

interface ShareWithCoAuthorModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: Employee[];
  currentUserId?: string;
  entryText: string;
  pointLabel?: string;
  title?: string;
  description?: string;
  onShare: (selectedIds: string[]) => void;
}

const ShareWithCoAuthorModal: React.FC<ShareWithCoAuthorModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUserId,
  entryText,
  pointLabel,
  title = 'Share with',
  description = 'Select employee(s) to share this entry with.',
  onShare,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const currentId = currentUserId ?? '';
  const eligibleUsers = users.filter(
    (u) => {
      const eid = String((u as any).Employee_id ?? u.id ?? '');
      return eid && eid !== currentId;
    }
  );

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredUsers = searchLower
    ? eligibleUsers.filter((u) =>
        (u.name ?? '').toLowerCase().includes(searchLower) ||
        String((u as any).Employee_id ?? u.id ?? '').toLowerCase().includes(searchLower)
      )
    : eligibleUsers;

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShare = () => {
    onShare(Array.from(selectedIds));
    setSelectedIds(new Set());
    setSearchQuery('');
    onClose();
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearchQuery('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <UserPlus size={20} className="text-blue-600" />
            {title}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-slate-600 mb-3">{description}</p>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or ID..."
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No employees found</p>
            ) : (
              filteredUsers.map((u) => {
                const eid = String((u as any).Employee_id ?? u.id ?? '');
                const isSelected = selectedIds.has(eid);
                return (
                  <label
                    key={eid}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleUser(eid)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-800">{u.name || eid}</span>
                    <span className="text-xs text-slate-400 ml-auto">{eid}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={selectedIds.size === 0}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Share ({selectedIds.size} selected)
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareWithCoAuthorModal;
