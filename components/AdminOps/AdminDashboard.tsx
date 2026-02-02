import React, { useState, useMemo, useEffect } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Asset, Bill, Expense, Vendor } from "../../types";
import api from "../../services/api";

interface DashboardProps {
  assets: Asset[];
  bills: Bill[];
  expenses: Expense[];
  vendors: Vendor[];
}

const AdminDashboard: React.FC<DashboardProps> = ({
  assets,
  bills,
  expenses,
  vendors,
}) => {
  const expenseChartData = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    return [
      { name: "Jan", amount: 400 },
      { name: "Feb", amount: 700 },
      { name: "Mar", amount: 1200 },
      { name: "Apr", amount: 900 },
      { name: "May", amount: 1500 },
      { name: "Jun", amount: 1300 },
      { name: "Jul", amount: total },
    ];
  }, [expenses]);

  const billsData = useMemo(() => {
    const categories: Record<string, number> = {};
    bills.forEach((b) => {
      categories[b.category] =
        (categories[b.category] || 0) + (Number(b.amount) || 0);
    });
    return Object.keys(categories).map((cat) => ({
      name: cat,
      amount: categories[cat],
      lastMonth: categories[cat] * 0.85,
    }));
  }, [bills]);

  const [assetList, setAssetList] = useState<Asset[]>([]);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await api.get("/adminapi/assets/");
        setAssetList(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchAssets();
  }, []);

  const donutData = useMemo(() => {
    const hardwareCount = assetList.filter(
      (a) => a.asset_type === "Hardware",
    ).length;

    const softwareCount = assetList.filter(
      (a) => a.asset_type === "Software",
    ).length;

    return [
      { name: "Hardware", value: hardwareCount },
      { name: "Software", value: softwareCount },
    ];
  }, [assetList]);

  const COLORS = ["#f97316", "#10b981"];
  const totalExpense = expenses.reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
<span className="text-2xl font-bold">
  {assetList.length}
</span>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Assets</p>
            <p className="text-lg font-bold">In System</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl">
            <span className="text-2xl font-bold">{bills.length}</span>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Active Bills</p>
            <p className="text-lg font-bold">This Month</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <span className="text-2xl font-bold">{vendors.length}</span>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">
              Verified Vendors
            </p>
            <p className="text-lg font-bold">Partners</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <span className="text-2xl font-bold">
            ₹{totalExpense.toLocaleString()}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Total Expenses</p>
            <p className="text-lg font-bold">YTD Spend</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6 text-gray-800">
            Expense Trend (Monthly Comparison)
          </h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={expenseChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="#4f46e5"
                  strokeWidth={3}
                  dot={{
                    r: 6,
                    fill: "#4f46e5",
                    strokeWidth: 2,
                    stroke: "#fff",
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800">Bills Analysis</h3>
            <div className="flex space-x-2">
              <button className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full">
                Monthly
              </button>
              <button className="px-3 py-1 bg-gray-50 text-gray-400 text-xs font-bold rounded-full hover:bg-gray-100">
                Yearly
              </button>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={billsData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Legend iconType="circle" />
                <Bar
                  dataKey="amount"
                  fill="#4f46e5"
                  radius={[4, 4, 0, 0]}
                  name="Current Period"
                />
                <Bar
                  dataKey="lastMonth"
                  fill="#e2e8f0"
                  radius={[4, 4, 0, 0]}
                  name="Last Period"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6 text-gray-800">
            Asset Distribution
          </h3>

          <div className="h-80">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {donutData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4 text-gray-800">
            Vendor Overview
          </h3>
          <div className="space-y-4">
            {vendors.slice(0, 4).map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold">
                    {v.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{v.name}</p>
                    <p className="text-xs text-gray-500">{v.email}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-400">
                  # {v.gstNumber}
                </span>
              </div>
            ))}
            {vendors.length === 0 && (
              <p className="text-center text-gray-400 py-4">
                No vendors added yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
