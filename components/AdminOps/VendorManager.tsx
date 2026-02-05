import React, { useState } from 'react';
import { Building2, Hash, Loader2, Mail, MapPin, Pencil, Phone, UserPlus, X } from 'lucide-react';
import { StatusType, Vendor } from '../../types';
import { createVendor, deleteVendor, updateVendor } from '../../services/vendor.service';

interface VendorManagerProps {
  vendors: Vendor[];
  setVendors: React.Dispatch<React.SetStateAction<Vendor[]>>;
  onVendorsUpdated?: () => void;
}

const VendorManager: React.FC<VendorManagerProps> = ({ vendors, setVendors, onVendorsUpdated }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    address: '',
    email: '',
    phone: '',
    altPhone: '',
    gstNumber: '',
    status: 'Pending' as StatusType,
  });
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    email: '',
    phone: '',
    altPhone: '',
    gstNumber: '',
    status: 'Pending' as StatusType,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const created = await createVendor({
        business_name: formData.name.trim(),
        gst_number: formData.gstNumber.trim(),
        office_address: formData.address.trim(),
        email: formData.email.trim(),
        primary_phone: formData.phone.trim(),
        ...(formData.altPhone.trim() && { alternate_phone: formData.altPhone.trim() }),
      });
      setVendors([created, ...vendors]);
      onVendorsUpdated?.();
      setFormData({ name: '', address: '', email: '', phone: '', altPhone: '', gstNumber: '', status: 'Pending' });
      setShowForm(false);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.detail ?? err?.message ?? 'Failed to add vendor. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setEditFormData({
      name: vendor.name,
      address: vendor.address,
      email: vendor.email,
      phone: vendor.phone,
      altPhone: vendor.altPhone ?? '',
      gstNumber: vendor.gstNumber,
      status: vendor.status,
    });
    setUpdateError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;
    setUpdateError(null);
    setIsUpdating(true);
    try {
      const payload: Parameters<typeof updateVendor>[1] = {
        business_name: editFormData.name.trim(),
        gst_number: editFormData.gstNumber.trim(),
        office_address: editFormData.address.trim(),
        email: editFormData.email.trim(),
        primary_phone: editFormData.phone.trim(),
      };
      if (editFormData.altPhone.trim()) {
        payload.alternate_phone = editFormData.altPhone.trim();
      } else {
        payload.alternate_phone = null;
      }
      const updated = await updateVendor(editingVendor.id, payload);
      setVendors((prev) =>
        prev.map((v) =>
          v.id === updated.id ? { ...updated, status: editFormData.status } : v
        )
      );
      setEditingVendor(null);
      onVendorsUpdated?.();
    } catch (err: any) {
      setUpdateError(err?.response?.data?.detail ?? err?.message ?? 'Failed to update vendor.');
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStatus = (id: string, newStatus: StatusType) => {
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, status: newStatus } : v)));
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (vendor: Vendor) => {
    setDeletingId(vendor.id);
    try {
      await deleteVendor(vendor.id);
      setVendors((prev) => prev.filter((v) => v.id !== vendor.id));
      onVendorsUpdated?.();
    } catch {
      // Optionally show error; for now just reset deletingId
    } finally {
      setDeletingId(null);
    }
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
            {submitError && (
              <div className="lg:col-span-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {submitError}
              </div>
            )}
            <div className="lg:col-span-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 text-white font-black py-5 rounded-[1.25rem] hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all uppercase tracking-[0.2em] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding…' : 'Add to Network'}
              </button>
            </div>
          </form>
        </div>
      )}

      {editingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-gray-900">Edit Vendor</h3>
              <button
                type="button"
                onClick={() => { setEditingVendor(null); setUpdateError(null); }}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-100"
              >
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <Building2 size={14} /> Full Business Name
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
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
                  value={editFormData.gstNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, gstNumber: e.target.value })}
                  placeholder="Tax ID / GSTIN"
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Relationship Status
                </label>
                <select
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as StatusType })}
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="Pending">Pending</option>
                  <option value="Inprocess">Inprocess</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <MapPin size={14} /> Office Address
                </label>
                <input
                  type="text"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
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
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
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
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
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
                  value={editFormData.altPhone}
                  onChange={(e) => setEditFormData({ ...editFormData, altPhone: e.target.value })}
                  placeholder="Emergency contact"
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                />
              </div>
              {updateError && (
                <div className="md:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {updateError}
                </div>
              )}
              <div className="md:col-span-2 flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setEditingVendor(null); setUpdateError(null); }}
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
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-8">
          {fetchError}
        </div>
      )}

      <>
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
                <button
                  onClick={() => openEditModal(vendor)}
                  className="hover:text-indigo-600 transition-colors"
                  title="Edit"
                  type="button"
                >
                  <Pencil size={18} />
                </button>
              </div>
              <button
                onClick={() => handleDelete(vendor)}
                disabled={deletingId === vendor.id}
                className="text-xs font-bold text-red-300 hover:text-red-500 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title="Delete"
                type="button"
              >
                {deletingId === vendor.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
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
      </>
    </div>
  );
};

export default VendorManager;

