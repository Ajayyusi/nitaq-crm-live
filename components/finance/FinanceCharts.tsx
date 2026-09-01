"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip as PieTooltip,
} from "recharts";
import { formatAED as fmtAED } from "@/lib/utils";

type MonthlyRow = { month: string; revenue: number; expenses: number; net: number };
type CourseRow = { name: string; value: number };

/** Series colors come from the panel token layer so both themes read correctly. */
const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const formatAED = (v: number) => fmtAED(v, { decimals: 0 });

/* eslint-disable @typescript-eslint/no-explicit-any */
function PanelTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-ctl border border-bezel bg-raised px-3 py-2 text-xs shadow-raise">
      {label != null && <p className="placard mb-1.5">{label}</p>}
      {payload.map((entry: any) => (
        <p key={entry.dataKey ?? entry.name} className="readout" data-numeric>
          <span
            aria-hidden
            className="mr-1.5 inline-block h-2 w-2 rounded-lamp align-middle"
            style={{ background: entry.color ?? entry.payload?.fill }}
          />
          <span className="text-dim">{entry.name}: </span>
          <span className="text-ink">{formatAED(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function RevenueExpensesChart({ data }: { data: MonthlyRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bezel)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "var(--dim)" }}
          axisLine={{ stroke: "var(--bezel)" }}
          tickLine={{ stroke: "var(--bezel)" }}
        />
        <YAxis
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          tick={{ fontSize: 11, fill: "var(--dim)" }}
          axisLine={{ stroke: "var(--bezel)" }}
          tickLine={{ stroke: "var(--bezel)" }}
        />
        <Tooltip content={<PanelTooltip />} cursor={{ fill: "var(--bezel)", opacity: 0.35 }} />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 12, color: "var(--dim)" }}>{value}</span>
          )}
        />
        <Bar dataKey="revenue" name="Revenue" fill="var(--chart-1)" radius={[3, 3, 0, 0]} maxBarSize={36} />
        <Bar dataKey="expenses" name="Expenses" fill="var(--chart-5)" radius={[3, 3, 0, 0]} maxBarSize={36} />
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
          stroke="var(--bezel)"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
          ))}
        </Pie>
        <PieTooltip content={<PanelTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
