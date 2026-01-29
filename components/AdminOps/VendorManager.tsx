import React, { useState } from 'react';
import { Building2, Hash, Mail, MapPin, Pencil, Phone, UserPlus } from 'lucide-react';
import { StatusType, Vendor } from '../../types';

interface VendorManagerProps {
  vendors: Vendor[];
  setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
}

const VendorManager: React.FC<VendorManagerProps> = ({ vendors, setVendors }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    email: '',
    phone: '',
    altPhone: '',
    gstNumber: '',
    status: 'Pending' as StatusType,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newVendor: Vendor = {
      ...formData,
      id: Date.now().toString(),
    };
    setVendors([newVendor, ...vendors]);
    setFormData({ name: '', address: '', email: '', phone: '', altPhone: '', gstNumber: '', status: 'Pending' });
    setShowForm(false);
  };

  const updateStatus = (id: string, newStatus: StatusType) => {
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, status: newStatus } : v)));
  };

  const getStatusStyle = (status: StatusType) => {
    switch (status) {
      case 'Completed':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'Inprocess':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Pending':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h3 className="text-3xl font-black text-gray-900 tracking-tight">Vendor Ecosystem</h3>
          <p className="text-gray-500 font-medium">Partner management and service directories</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all font-bold"
        >
          {showForm ? 'Cancel' : (
            <>
              <UserPlus size={24} /> Register New Partner
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 mb-12 animate-in fade-in zoom-in duration-500">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="space-y-2 lg:col-span-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Building2 size={14} /> Full Business Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Company legal name"
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-semibold"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Hash size={14} /> GST Number
              </label>
              <input
                type="text"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                placeholder="Tax ID / GSTIN"
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                required
              />
            </div>
            <div className="space-y-2 lg:col-span-3">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <MapPin size={14} /> Office Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Detailed street address"
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Mail size={14} /> Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@business.com"
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Phone size={14} /> Primary Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <Phone size={14} /> Alternate Phone
              </label>
              <input
                type="tel"
                value={formData.altPhone}
                onChange={(e) => setFormData({ ...formData, altPhone: e.target.value })}
                placeholder="Emergency contact"
                className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
            </div>
            <div className="lg:col-span-3 pt-4">
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.25rem] hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all uppercase tracking-[0.2em]"
              >
                Add to Network
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {vendors.map((vendor) => (
          <div
            key={vendor.id}
            className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col hover:shadow-xl transition-all group"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-16 h-16 bg-gray-900 text-white rounded-[1.25rem] flex items-center justify-center font-black text-2xl group-hover:rotate-6 transition-transform">
                {vendor.name.charAt(0)}
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-indigo-500 uppercase tracking-widest">GST Registered</p>
                <p className="font-mono text-sm text-gray-900 mt-1">{vendor.gstNumber}</p>
              </div>
            </div>
            <h4 className="text-2xl font-black text-gray-900 mb-2">{vendor.name}</h4>
            <p className="text-gray-500 text-sm mb-6 flex items-start gap-2">
              <MapPin size={16} className="mt-0.5 flex-shrink-0 text-indigo-400" /> {vendor.address}
            </p>

            <div className="space-y-3 mb-6">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Relationship Status</label>
              <select
                value={vendor.status}
                onChange={(e) => updateStatus(vendor.id, e.target.value as StatusType)}
                className={`w-full px-4 py-2 rounded-xl text-sm font-bold border outline-none transition-all ${getStatusStyle(
                  vendor.status,
                )}`}
              >
                <option value="Completed">Completed</option>
                <option value="Inprocess">Inprocess</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-auto">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Mail size={16} className="text-indigo-600" />
                <span className="text-sm font-semibold truncate text-gray-700">{vendor.email}</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Phone size={16} className="text-indigo-600" />
                <span className="text-sm font-semibold text-gray-700">{vendor.phone}</span>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
              <div className="flex space-x-6 text-gray-300">
                <button className="hover:text-indigo-600 transition-colors" title="Edit" type="button">
                  <Pencil size={18} />
                </button>
              </div>
              <button
                onClick={() => setVendors(vendors.filter((v) => v.id !== vendor.id))}
                className="text-xs font-bold text-red-300 hover:text-red-500 transition-colors uppercase tracking-widest"
                title="Delete"
                type="button"
              >
                Terminate
              </button>
            </div>
          </div>
        ))}
      </div>

      {vendors.length === 0 && (
        <div className="text-center py-32 opacity-20">
          <Building2 size={80} className="mx-auto mb-4" />
          <p className="text-2xl font-black">Empty Vendor Directory</p>
        </div>
      )}
    </div>
  );
};

export default VendorManager;

