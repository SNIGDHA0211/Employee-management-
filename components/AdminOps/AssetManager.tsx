import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Asset, AssetType, StatusType } from "../../types";

interface AssetManagerProps {
  assets: Asset[];
  setAssets: React.Dispatch<React.SetStateAction<Asset[]>>;
}
/* ----------------------------- UI STATES ----------------------------- */
const AssetManager: React.FC<AssetManagerProps> = ({ assets, setAssets }) => {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: "" as AssetType,
    name: "",
    author: "",
    code: "",
    status: "Pending" as StatusType,
  });
  /* --------------------------- EDIT MODAL STATES ------------------------ */

  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editData, setEditData] = useState({
    name: "",
    author: "",
  });

  /* ------------------------- DROPDOWN DATA ------------------------------ */

  const [assetTypes, setAssetTypes] = useState<{ id: number; name: string }[]>(
    [],
  );
  /* ----------------------- FETCH ASSET TYPES ---------------------------- */

  useEffect(() => {
    const fetchAssetTypes = async () => {
      try {
        const res = await api.get("/adminapi/asset-types/");
        setAssetTypes(res.data);
      } catch (error) {
        console.error("❌ Failed to fetch asset types", error);
      }
    };
    fetchAssetTypes();
  }, []);
  /* ------------------------- FETCH ASSETS ------------------------------- */

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await api.get("/adminapi/assets/");

        const mappedAssets: Asset[] = res.data.map((item: any) => ({
          id: item.id.toString(),
          type: item.asset_type,
          name: item.asset_name,
          author: item.author,
          code: item.asset_code,
          status:
            item.status === "COMPLETED"
              ? "Completed"
              : item.status === "INPROCESS"
                ? "Inprocess"
                : "Pending",
          createdAt: item.created_at ?? new Date().toISOString().split("T")[0],
        }));

        setAssets(mappedAssets);
      } catch (error) {
        console.error("❌ Failed to fetch assets", error);
      }
    };

    fetchAssets();
  }, []);

  /* ------------------------ CREATE ASSET (POST) ------------------------- */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      asset_type: formData.type,
      asset_name: formData.name,
      author: formData.author,
      status: formData.status.toUpperCase(), // backend wants COMPLETED
      asset_code: formData.type === "Hardware" ? formData.code : null,
    };

    try {
      const res = await api.post("/adminapi/assets/", payload);

      // OPTIONAL: if backend returns saved asset
      const savedAsset: Asset = {
        id: res.data.id.toString(),
        type: res.data.asset_type,
        name: res.data.asset_name,
        author: res.data.author,
        code: res.data.asset_code,
        status:
          res.data.status === "COMPLETED"
            ? "Completed"
            : res.data.status === "INPROCESS"
              ? "Inprocess"
              : "Pending",
        createdAt: res.data.created_at, // ✅ FIX
      };
      // Add new asset to top of table

      setAssets((prev) => [savedAsset, ...prev]);

      // reset form
      setFormData({
        type: "" as AssetType,
        name: "",
        author: "",
        code: "",
        status: "Pending",
      });

      setShowForm(false);
    } catch (error: any) {
      console.error(
        "❌ Error saving asset:",
        error.response?.data || error.message,
      );
      alert("Failed to save asset");
    }
  };
  /* ------------------------ UPDATE STATUS (PATCH) ------------------------ */

  const updateStatus = async (id: string, newStatus: StatusType) => {
    const previousAssets = [...assets];

    // 1️⃣ Optimistic UI update
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
    );

    try {
      await api.patch(`/adminapi/assets/${id}/`, {
        status: newStatus.toUpperCase(),
      });
    } catch (error) {
      console.error("❌ Failed to update status", error);

      // 2️⃣ Rollback UI if API fails
      setAssets(previousAssets);

      alert("Failed to update status");
    }
  };
  /* ----------------- UPDATE NAME + AUTHOR (PATCH) ------------------------ */

  const handlePatchFields = async () => {
    if (!editingAsset) return;

    const previousAssets = [...assets];

    // Optimistic UI update
    setAssets((prev) =>
      prev.map((a) =>
        a.id === editingAsset.id
          ? {
              ...a,
              name: editData.name,
              author: editData.author,
            }
          : a,
      ),
    );

    try {
      await api.patch(`/adminapi/assets/${editingAsset.id}/`, {
        asset_name: editData.name,
        author: editData.author,
      });
      setEditingAsset(null);
    } catch (error) {
      console.error("❌ Failed to update asset", error);

      // rollback
      setAssets(previousAssets);
      alert("Failed to update asset");
    }
  };
  /* ------------------------ DELETE ASSET (DELETE) ------------------------ */

  const handleDeleteAsset = async (id: string) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this asset?",
    );

    if (!confirmDelete) return;

    const previousAssets = [...assets];

    // Optimistic UI update
    setAssets((prev) => prev.filter((a) => a.id !== id));

    try {
      await api.delete(`/adminapi/assets/${id}/`);
    } catch (error) {
      console.error("❌ Failed to delete asset", error);

      // Rollback if delete fails
      setAssets(previousAssets);
      alert("Failed to delete asset");
    }
  };

  /* ------------------------ STATUS COLOR UTILS --------------------------- */

  const getStatusStyle = (status: StatusType) => {
    switch (status) {
      case "Completed":
        return "bg-green-100 text-green-700 border-green-200";
      case "Inprocess":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "Pending":
        return "bg-gray-100 text-gray-700 border-gray-200";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };
  const isFormValid =
    formData.type !== "" &&
    formData.name.trim() !== "" &&
    formData.author.trim() !== "" &&
    (formData.type !== "Hardware" || formData.code.trim() !== "");
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-800">Manage Assets</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-indigo-700 transition-colors shadow-md"
        >
          {showForm ? (
            "Cancel"
          ) : (
            <>
              <Plus size={18} /> <span>Add Asset</span>
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Asset Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => {
                  const selectedType = e.target.value as AssetType;
                  setFormData({
                    ...formData,
                    type: selectedType,
                    code: selectedType === "Software" ? "" : formData.code,
                  });
                }}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl"
                required
              >
                <option value="">Select Asset Type</option>
                {assetTypes.map((type) => (
                  <option key={type.id} value={type.name}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Asset Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g. Dell Monitor, VS Code License"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Author/Department
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) =>
                  setFormData({ ...formData, author: e.target.value })
                }
                placeholder="Department Name"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                required
              />
            </div>
            {formData.type === "Hardware" && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Asset Code
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value })
                  }
                  placeholder="Serial or ID"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  required
                />
              </div>
            )}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={!isFormValid}
                className={`w-full font-bold py-3 rounded-xl shadow-lg transition
                  
    ${
      isFormValid
        ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/30"
        : "bg-gray-300 text-gray-500 cursor-not-allowed"
    }
  `}
              >
                Save Asset
              </button>
            </div>
          </form>
        </div>
      )}
      {editingAsset && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">Edit Asset</h3>

            {/* FORM START */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePatchFields(); // ✅ Enter key triggers this
              }}
              className="space-y-4"
            >
              {/* Asset Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Asset Name
                </label>
                <input
                  type="text"
                  value={editData.name}
                  onChange={(e) =>
                    setEditData({ ...editData, name: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Asset Name"
                />
              </div>

              {/* Author */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Author
                </label>
                <input
                  type="text"
                  value={editData.author}
                  onChange={(e) =>
                    setEditData({ ...editData, author: e.target.value })
                  }
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Author"
                />
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="px-4 py-2 rounded-lg border"
                >
                  Cancel
                </button>

                {/* type="submit" is the key */}
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
                >
                  Save
                </button>
              </div>
            </form>
            {/* FORM END */}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                Code
              </th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                Author
              </th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-mono text-sm text-indigo-600">
                  {asset.code}
                </td>
                <td className="px-6 py-4 font-medium">{asset.name}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      asset.type === "Hardware"
                        ? "bg-blue-50 text-blue-600"
                        : "bg-purple-50 text-purple-600"
                    }`}
                  >
                    {asset.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{asset.author}</td>
                <td className="px-6 py-4">
                  <select
                    value={asset.status}
                    onChange={(e) =>
                      updateStatus(asset.id, e.target.value as StatusType)
                    }
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
                    <button
                      className="hover:text-indigo-600 transition-colors"
                      title="Edit"
                      type="button"
                      onClick={() => {
                        setEditingAsset(asset);
                        setEditData({
                          name: asset.name,
                          author: asset.author,
                        });
                      }}
                    >
                      <Pencil size={18} />
                    </button>

                    <button
                      onClick={() => handleDeleteAsset(asset.id)}
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
