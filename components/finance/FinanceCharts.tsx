"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip,
} from "recharts";

type MonthlyRow = { month: string; revenue: number; expenses: number; net: number };
type CourseRow = { name: string; value: number };

const PIE_COLORS = ["#2E7D32", "#00897B", "#2196F3", "#7B1FA2", "#F57C00", "#C62828", "#0288D1"];

function formatAED(v: number) {
  return "AED " + v.toLocaleString("en-AE", { minimumFractionDigits: 0 });
}

function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xl text-xs">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {formatAED(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function RevenueExpensesChart({ data }: { data: MonthlyRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} />
        <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} tick={{ fontSize: 11, fill: "#64748b" }} />
        <Tooltip content={<RevenueTooltip />} />
        <Legend
          formatter={(value) => <span style={{ fontSize: 12, color: "#374151" }}>{value}</span>}
        />
        <Bar dataKey="revenue" name="Revenue" fill="#2E7D32" radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="expenses" name="Expenses" fill="#EF5350" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieLabelLine({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function CourseRevenuePieChart({ data }: { data: CourseRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={PieLabelLine}
          outerRadius={100}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <PieTooltip
          formatter={(value) => [typeof value === "number" ? formatAED(value) : String(value), "Revenue"]}
          contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
