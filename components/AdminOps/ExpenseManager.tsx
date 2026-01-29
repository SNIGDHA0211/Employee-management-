import React, { useState } from 'react';
import { Calendar, DollarSign, FileText, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { Expense, StatusType } from '../../types';

interface ExpenseManagerProps {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
}

const ExpenseManager: React.FC<ExpenseManagerProps> = ({ expenses, setExpenses }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    note: '',
    paidDate: new Date().toISOString().split('T')[0],
    status: 'Pending' as StatusType,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newExpense: Expense = {
      ...formData,
      amount: parseFloat(formData.amount),
      id: Date.now().toString(),
    };
    setExpenses([newExpense, ...expenses]);
    setFormData({
      title: '',
      amount: '',
      note: '',
      paidDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
    });
    setShowForm(false);
  };

  const updateStatus = (id: string, newStatus: StatusType) => {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e)));
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
                  <DollarSign size={12} /> Amount
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
            <button
              type="submit"
              className="w-full bg-gray-900 text-white font-black py-5 rounded-2xl hover:bg-black shadow-2xl transition-all uppercase tracking-widest"
            >
              Register Expense
            </button>
          </form>
        </div>
      )}

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
              <span className="text-2xl font-black text-indigo-600">${Number(expense.amount).toLocaleString()}</span>
              <div className="flex items-center space-x-6 mt-4 text-gray-300">
                <button className="hover:text-indigo-600 transition-colors" title="Edit" type="button">
                  <Pencil size={18} />
                </button>
                <button
                  onClick={() => setExpenses(expenses.filter((e) => e.id !== expense.id))}
                  className="hover:text-red-500 transition-colors"
                  title="Delete"
                  type="button"
                >
                  <Trash2 size={18} />
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
    </div>
  );
};

export default ExpenseManager;

