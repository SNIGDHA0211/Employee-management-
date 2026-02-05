import React, { useState } from 'react';
import { Calendar, DollarSign, FileText, Loader2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { Expense, StatusType } from '../../types';
import { createExpense, deleteExpense, updateExpense, uiToBackendStatus } from '../../services/expense.service';

interface ExpenseManagerProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  onExpensesUpdated?: () => void;
}

const ExpenseManager: React.FC<ExpenseManagerProps> = ({ expenses, setExpenses, onExpensesUpdated }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    amount: '',
    note: '',
    paidDate: '',
    status: 'Pending' as StatusType,
  });
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    note: '',
    paidDate: new Date().toISOString().split('T')[0],
    status: 'Pending' as StatusType,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const created = await createExpense({
        title: formData.title.trim(),
        amount: parseFloat(formData.amount) || 0,
        note: formData.note.trim(),
        paid_date: formData.paidDate,
        status: formData.status.toUpperCase(),
      });
      setExpenses([created, ...expenses]);
      onExpensesUpdated?.();
      setFormData({
        title: '',
        amount: '',
        note: '',
        paidDate: new Date().toISOString().split('T')[0],
        status: 'Pending',
      });
      setShowForm(false);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.detail ?? err?.message ?? 'Failed to create expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setEditFormData({
      title: expense.title,
      amount: String(expense.amount),
      note: expense.note,
      paidDate: expense.paidDate,
      status: expense.status,
    });
    setUpdateError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    setUpdateError(null);
    setIsUpdating(true);
    try {
      const updated = await updateExpense(editingExpense.id, {
        title: editFormData.title.trim(),
        amount: parseFloat(editFormData.amount) || 0,
        note: editFormData.note.trim(),
        paid_date: editFormData.paidDate,
        status: uiToBackendStatus(editFormData.status),
      });
      setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setEditingExpense(null);
      onExpensesUpdated?.();
    } catch (err: any) {
      setUpdateError(err?.response?.data?.detail ?? err?.message ?? 'Failed to update expense.');
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStatus = async (id: string, newStatus: StatusType) => {
    try {
      const updated = await updateExpense(id, { status: uiToBackendStatus(newStatus) });
      setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
      onExpensesUpdated?.();
    } catch {
      // Keep local state on error; user can retry
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (expense: Expense) => {
    setDeletingId(expense.id);
    try {
      await deleteExpense(expense.id);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      onExpensesUpdated?.();
    } catch {
      // Optionally show error; for now just reset deletingId
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusStyle = (status: StatusType) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-50 text-green-600 border-green-100';
      case 'Inprocess':
        return 'bg-amber-50 text-amber-600 border-amber-100';
      case 'Pending':
        return 'bg-gray-50 text-gray-500 border-gray-100';
      default:
        return 'bg-gray-50 text-gray-500';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Expenses Tracker</h3>
          <p className="text-gray-500">Log all operational costs and purchases</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all active:scale-95"
        >
          {showForm ? 'Cancel' : (
            <>
              <Plus size={20} /> <span className="font-bold">New Expense</span>
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 mb-10 animate-in fade-in slide-in-from-bottom-6 duration-300">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">
                  <Tag size={12} /> Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Marketing, Supplies, etc."
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-300"
                  required
                />
              </div>
              <div className="relative">
                <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">
                ₹ Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-300"
                  required
                />
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">
                <FileText size={12} /> Note / Description
              </label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="What was this expense for?"
                rows={3}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-300 resize-none"
                required
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">
                <Calendar size={12} /> Paid Date
              </label>
              <input
                type="date"
                value={formData.paidDate}
                onChange={(e) => setFormData({ ...formData, paidDate: e.target.value })}
                className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            {submitError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gray-900 text-white font-black py-5 rounded-2xl hover:bg-black shadow-2xl transition-all uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating…' : 'Register Expense'}
            </button>
          </form>
        </div>
      )}

      {editingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Edit Expense</h3>
              <button
                type="button"
                onClick={() => { setEditingExpense(null); setUpdateError(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">
                    <Tag size={12} /> Title
                  </label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    placeholder="Marketing, Supplies, etc."
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-300"
                    required
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">
                    <DollarSign size={12} /> Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.amount}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-300"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">
                  <FileText size={12} /> Note / Description
                </label>
                <textarea
                  value={editFormData.note}
                  onChange={(e) => setEditFormData({ ...editFormData, note: e.target.value })}
                  placeholder="What was this expense for?"
                  rows={3}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-gray-300 resize-none"
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">
                  <Calendar size={12} /> Paid Date
                </label>
                <input
                  type="date"
                  value={editFormData.paidDate}
                  onChange={(e) => setEditFormData({ ...editFormData, paidDate: e.target.value })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-black text-indigo-400 uppercase tracking-widest mb-2">
                  Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as StatusType })}
                  className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="Pending">Pending</option>
                  <option value="Inprocess">Inprocess</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              {updateError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {updateError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setEditingExpense(null); setUpdateError(null); }}
                  className="flex-1 px-4 py-3 border border-gray-200 rounded-2xl font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isUpdating ? <Loader2 size={18} className="animate-spin" /> : null}
                  {isUpdating ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {fetchError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
          {fetchError}
        </div>
      )}

      <>
      <div className="space-y-4">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between group hover:border-indigo-100 transition-all"
          >
            <div className="flex items-start space-x-5">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                EX
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-lg">{expense.title}</h4>
                <p className="text-gray-500 text-sm mt-1">{expense.note}</p>
                <div className="flex items-center space-x-3 mt-3">
                  <span className="text-xs bg-gray-50 text-gray-400 font-bold px-3 py-1 rounded-full">{expense.paidDate}</span>
                  <select
                    value={expense.status}
                    onChange={(e) => updateStatus(expense.id, e.target.value as StatusType)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border outline-none transition-all ${getStatusStyle(
                      expense.status,
                    )}`}
                  >
                    <option value="Completed">Completed</option>
                    <option value="Inprocess">Inprocess</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-4 md:mt-0 flex flex-col items-end">
              <span className="text-2xl font-black text-indigo-600">₹{Number(expense.amount).toLocaleString()}</span>
              <div className="flex items-center space-x-6 mt-4 text-gray-300">
                <button
                  onClick={() => openEditModal(expense)}
                  className="hover:text-indigo-600 transition-colors"
                  title="Edit"
                  type="button"
                >
                  <Pencil size={18} />
                </button>
                <button
                  onClick={() => handleDelete(expense)}
                  disabled={deletingId === expense.id}
                  className="hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Delete"
                  type="button"
                >
                  {deletingId === expense.id ? (
                    <Loader2 size={18} className="animate-spin text-red-500" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {expenses.length === 0 && (
        <div className="text-center py-24">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="text-gray-200" size={40} />
          </div>
          <p className="text-gray-400 font-medium">No expenses logged this period.</p>
        </div>
      )}
      </>
    </div>
  );
};

export default ExpenseManager;

