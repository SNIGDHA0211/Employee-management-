import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Asset, AssetType, StatusType } from '../../types';
import { getAssetTypes } from '../../services/api';

interface AssetManagerProps {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
}

const AssetManager: React.FC<AssetManagerProps> = ({ assets, setAssets }) => {
  const [showForm, setShowForm] = useState(false);
  const [assetTypes, setAssetTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoadingAssetTypes, setIsLoadingAssetTypes] = useState(false);
  const [formData, setFormData] = useState({
    type: 'Hardware' as AssetType | string,
    name: '',
    author: '',
    code: '',
    status: 'Pending' as StatusType,
  });

  useEffect(() => {
    const fetchAssetTypes = async () => {
      setIsLoadingAssetTypes(true);
      try {
        const types = await getAssetTypes();
        console.log('📋 [AssetManager] Asset types from API:', types);
        setAssetTypes(types);
      } catch (e) {
        console.error('❌ [AssetManager] Failed to fetch asset types:', e);
        setAssetTypes([]);
      } finally {
        setIsLoadingAssetTypes(false);
      }
    };
    fetchAssetTypes();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newAsset: Asset = {
      ...formData,
      type: (formData.type || 'Hardware') as AssetType,
      id: Date.now().toString(),
      createdAt: new Date().toISOString().split('T')[0],
    };
    setAssets([newAsset, ...assets]);
    const defaultType = assetTypes.length > 0 ? assetTypes[0].name : 'Hardware';
    setFormData({ type: defaultType, name: '', author: '', code: '', status: 'Pending' });
    setShowForm(false);
  };

  const updateStatus = (id: string, newStatus: StatusType) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
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
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-800">Manage Assets</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-indigo-700 transition-colors shadow-md"
        >
          {showForm ? 'Cancel' : (
            <>
              <Plus size={18} /> <span>Add Asset</span>
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Asset Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
                disabled={isLoadingAssetTypes}
              >
                {isLoadingAssetTypes && <option value="Hardware">Loading…</option>}
                {!isLoadingAssetTypes && assetTypes.length === 0 && (
                  <>
                    <option value="Hardware">Hardware</option>
                    <option value="Software">Software</option>
                  </>
                )}
                {!isLoadingAssetTypes &&
                  assetTypes.length > 0 &&
                  assetTypes.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Asset Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Dell Monitor, VS Code License"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Author/Department</label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                placeholder="Department Name"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Asset Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Serial or ID"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/30"
              >
                Save Asset
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Code</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Name</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Type</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Author</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-mono text-sm text-indigo-600">{asset.code}</td>
                <td className="px-6 py-4 font-medium">{asset.name}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      asset.type === 'Hardware' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                    }`}
                  >
                    {asset.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{asset.author}</td>
                <td className="px-6 py-4">
                  <select
                    value={asset.status}
                    onChange={(e) => updateStatus(asset.id, e.target.value as StatusType)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border outline-none transition-all ${getStatusStyle(
                      asset.status,
                    )}`}
                  >
                    <option value="Completed">Completed</option>
                    <option value="Inprocess">Inprocess</option>
                    <option value="Pending">Pending</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-4 text-gray-400">
                    <button className="hover:text-indigo-600 transition-colors" title="Edit" type="button">
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => setAssets(assets.filter((a) => a.id !== asset.id))}
                      className="hover:text-red-600 transition-colors"
                      title="Delete"
                      type="button"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {assets.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-400">No assets recorded.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetManager;

