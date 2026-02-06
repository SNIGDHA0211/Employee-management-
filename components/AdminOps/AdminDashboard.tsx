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
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const expenseChartData = useMemo(() => {
    const now = new Date();
    const byKey: Record<string, number> = {};
    const slots: { key: string; name: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      const shortYear = String(y).slice(-2);
      slots.push({ key, name: `${MONTH_NAMES[m]} '${shortYear}` });
      byKey[key] = 0;
    }
    expenses.forEach((e) => {
      const amount = Number(e.amount) || 0;
      const date = e.paidDate || "";
      const match = date.match(/^(\d{4})-(\d{2})/);
      if (match) {
        const key = `${match[1]}-${match[2]}`;
        if (byKey.hasOwnProperty(key)) byKey[key] += amount;
      }
    });
    return slots.map(({ key, name }) => ({ name, amount: byKey[key] ?? 0 }));
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

  const donutData = useMemo(() => {
    const hardwareCount = assets.filter((a) => a.type === "Hardware").length;
    const softwareCount = assets.filter((a) => a.type === "Software").length;

    return [
      { name: "Hardware", value: hardwareCount },
      { name: "Software", value: softwareCount },
    ];
  }, [assets]);

  const assetStatusCounts = useMemo(() => {
    const norm = (s: string) => (s || "").toLowerCase().replace(/\s/g, "");
    return {
      total: assets.length,
      pending: assets.filter((a) => norm(a.status) === "pending").length,
      inprocess: assets.filter((a) => norm(a.status) === "inprocess").length,
      completed: assets.filter((a) => norm(a.status) === "completed").length,
    };
  }, [assets]);

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
  {assets.length}
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
          <h3 className="text-lg font-bold mb-4 text-gray-800">
            Asset Distribution
          </h3>
          <div className="flex flex-row items-center gap-1">
            <div className="h-80 flex-1 min-w-0">
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
            <div className="flex flex-col gap-2 text-sm font-medium shrink-0 border-l border-gray-200 pl-2 pr-20">
              <span className="text-gray-700">Total: {assetStatusCounts.total}</span>
              <span className="text-amber-600">Pending: {assetStatusCounts.pending}</span>
              <span className="text-blue-600">In process: {assetStatusCounts.inprocess}</span>
              <span className="text-green-600">Completed: {assetStatusCounts.completed}</span>
            </div>
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
