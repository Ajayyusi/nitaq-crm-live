"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  FileWarning,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

interface DashboardData {
  total: number;
  active: number;
  missingDocCount: number;
  avgDocCompletion: number;
  riskCounts: { Low: number; Medium: number; High: number };
  highRisk: { id: string; fullName: string; riskStatus: string; missingDocs: string[] }[];
  healthScore: number;
}

function healthColor(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 55) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function healthLabel(score: number) {
  if (score >= 80) return "Good";
  if (score >= 55) return "Needs Attention";
  return "At Risk";
}

function healthBg(score: number) {
  if (score >= 80) return "bg-green-500";
  if (score >= 55) return "bg-amber-500";
  return "bg-red-500";
}

export default function CompliancePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/compliance/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading…
      </div>
    );
  }

  const { total, missingDocCount, avgDocCompletion, riskCounts, highRisk, healthScore } = data;
  const compliantCount = total - missingDocCount;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Compliance Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Centre-wide compliance overview · {total} active learner{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <Link
            href="/learner-profiles"
            className="flex items-center gap-1.5 rounded-lg bg-[#2E7D32] px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-[#1B5E20]"
          >
            <Users className="h-3.5 w-3.5" /> View Profiles
          </Link>
        </div>
      </div>

      {/* Health score banner */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`grid h-16 w-16 flex-shrink-0 place-items-center rounded-2xl ${healthScore >= 80 ? "bg-green-50 dark:bg-green-950/40" : healthScore >= 55 ? "bg-amber-50 dark:bg-amber-950/40" : "bg-red-50 dark:bg-red-950/40"}`}>
              <ShieldCheck className={`h-8 w-8 ${healthColor(healthScore)}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Centre Health Score</p>
              <p className={`text-4xl font-extrabold ${healthColor(healthScore)}`}>{healthScore}%</p>
              <p className={`text-sm font-semibold ${healthColor(healthScore)}`}>{healthLabel(healthScore)}</p>
            </div>
          </div>
          <div className="w-full sm:w-64">
            <div className="mb-1.5 flex justify-between text-xs text-gray-500">
              <span>0%</span><span>100%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${healthBg(healthScore)}`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Learners"
          value={total}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          bg="bg-blue-50 dark:bg-blue-950/30"
        />
        <StatCard
          label="Docs Complete"
          value={`${avgDocCompletion}%`}
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          bg="bg-green-50 dark:bg-green-950/30"
          sub={`${compliantCount} of ${total} learners`}
        />
        <StatCard
          label="Missing Docs"
          value={missingDocCount}
          icon={<FileWarning className="h-5 w-5 text-amber-500" />}
          bg="bg-amber-50 dark:bg-amber-950/30"
          highlight={missingDocCount > 0}
        />
        <StatCard
          label="High Risk"
          value={riskCounts.High ?? 0}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          bg="bg-red-50 dark:bg-red-950/30"
          highlight={(riskCounts.High ?? 0) > 0}
        />
      </div>

      {/* Risk breakdown */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Risk Breakdown
        </h2>
        <div className="space-y-3">
          {(["Low", "Medium", "High"] as const).map((level) => {
            const count = riskCounts[level] ?? 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const color = level === "Low" ? "bg-green-500" : level === "Medium" ? "bg-amber-500" : "bg-red-500";
            const textColor = level === "Low" ? "text-green-700 dark:text-green-400" : level === "Medium" ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400";
            return (
              <div key={level} className="flex items-center gap-3">
                <span className={`w-16 text-xs font-semibold ${textColor}`}>{level}</span>
                <div className="flex-1 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 text-right text-xs text-gray-500">{count} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* High-risk learners */}
      {highRisk.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm dark:border-red-800/40 dark:bg-red-950/20">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" /> High Risk Learners ({highRisk.length})
          </h2>
          <div className="space-y-2">
            {highRisk.map((l) => (
              <Link
                key={l.id}
                href={`/learner-profiles/${l.id}`}
                className="flex items-center justify-between rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm hover:bg-red-50 dark:border-red-800/30 dark:bg-red-950/30 dark:hover:bg-red-900/30"
              >
                <span className="font-medium text-gray-900 dark:text-white">{l.fullName}</span>
                {l.missingDocs.length > 0 && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    Missing: {l.missingDocs.join(", ")}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  bg,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  bg: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${highlight ? "border-red-200 dark:border-red-800/40" : "border-gray-200 dark:border-white/10"} bg-white dark:bg-white/5`}>
      <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${bg}`}>{icon}</div>
      <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}
