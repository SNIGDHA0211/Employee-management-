import React, { useState } from 'react';
import { CreditCard, Pencil, Plus, Trash2 } from 'lucide-react';
import { Bill, BillCategory, StatusType } from '../../types';

interface BillsManagerProps {
  bills: Bill[];
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>;
}

const BillsManager: React.FC<BillsManagerProps> = ({ bills, setBills }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Light Bills' as BillCategory,
    amount: '',
    recipient: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Pending' as StatusType,
  });

  const categories: BillCategory[] = ['Light Bills', 'Rent', 'Housekeeping', 'Tea Bills', 'WiFi Bills'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newBill: Bill = {
      ...formData,
      amount: parseFloat(formData.amount),
      id: Date.now().toString(),
    };
    setBills([newBill, ...bills]);
    setFormData({
      category: 'Light Bills',
      amount: '',
      recipient: '',
      date: new Date().toISOString().split('T')[0],
      status: 'Pending',
    });
    setShowForm(false);
  };

  const updateStatus = (id: string, newStatus: StatusType) => {
    setBills((prev) => prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b)));
  };

  const getStatusStyle = (status: StatusType) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Inprocess':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Pending':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Bill Management</h3>
          <p className="text-gray-500 text-sm mt-1">Track utility and maintenance expenses</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center space-x-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          {showForm ? 'Close Form' : (
            <>
              <Plus size={20} /> <span className="font-semibold">Create Bill Record</span>
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 mb-10 animate-in fade-in zoom-in duration-300">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as BillCategory })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Amount</label>
              <input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Recipient</label>
              <input
                type="text"
                value={formData.recipient}
                onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
                placeholder="Person / Company"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Billing Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div className="md:col-span-2 lg:col-span-4 mt-2">
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center justify-center space-x-2"
              >
                <CreditCard size={20} />
                <span>Submit Bill Entry</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bills.map((bill) => (
          <div key={bill.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div
                className={`p-3 rounded-2xl ${
                  bill.category === 'Light Bills'
                    ? 'bg-yellow-50 text-yellow-600'
                    : bill.category === 'Rent'
                      ? 'bg-indigo-50 text-indigo-600'
                      : bill.category === 'WiFi Bills'
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-gray-50 text-gray-600'
                }`}
              >
                <span className="font-bold text-xs uppercase">{bill.category}</span>
              </div>
              <span className="text-lg font-black text-gray-800">${Number(bill.amount).toLocaleString()}</span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center text-sm text-gray-500">
                <span className="w-20 font-medium">To:</span>
                <span className="text-gray-900 font-semibold">{bill.recipient}</span>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <span className="w-20 font-medium">Date:</span>
                <span className="text-gray-900 font-semibold">{bill.date}</span>
              </div>

              <div className="pt-4 flex flex-col space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Update</label>
                <select
                  value={bill.status}
                  onChange={(e) => updateStatus(bill.id, e.target.value as StatusType)}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none transition-all ${getStatusStyle(
                    bill.status,
                  )}`}
                >
                  <option value="Completed">Completed</option>
                  <option value="Inprocess">Inprocess</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
              <div className="flex space-x-6 text-gray-300">
                <button className="hover:text-indigo-600 transition-colors" title="Edit" type="button">
                  <Pencil size={18} />
                </button>
              </div>
              <button
                onClick={() => setBills(bills.filter((b) => b.id !== bill.id))}
                className="text-red-300 hover:text-red-500"
                title="Delete"
                type="button"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {bills.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
          <p className="text-gray-400 font-medium">No bills recorded yet.</p>
        </div>
      )}
    </div>
  );
};

export default BillsManager;

