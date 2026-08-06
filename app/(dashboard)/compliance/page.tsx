"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ShieldCheck, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Instrument } from "@/components/ui/instrument";
import { Dial } from "@/components/ui/dial";
import { LoadError, PanelLoading } from "@/components/ui/feedback";

interface DashboardData {
  total: number;
  active: number;
  missingDocCount: number;
  avgDocCompletion: number;
  riskCounts: { Low: number; Medium: number; High: number };
  highRisk: { id: string; fullName: string; riskStatus: string; missingDocs: string[] }[];
  healthScore: number;
}

function healthTone(score: number): "phos" | "caution" | "alert" {
  if (score >= 80) return "phos";
  if (score >= 55) return "caution";
  return "alert";
}

function healthLamp(score: number): LampVariant {
  if (score >= 80) return "ok";
  if (score >= 55) return "caution";
  return "alert";
}

function healthLabel(score: number) {
  if (score >= 80) return "Good";
  if (score >= 55) return "Needs Attention";
  return "At Risk";
}

const HEALTH_TEXT: Record<"phos" | "caution" | "alert", string> = {
  phos: "text-phos",
  caution: "text-caution",
  alert: "text-alert",
};

const RISK_FILL: Record<"Low" | "Medium" | "High", string> = {
  Low: "bg-phos",
  Medium: "bg-caution-fill",
  High: "bg-alert",
};

export default function CompliancePage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/compliance/dashboard");
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError("Couldn't load the compliance overview. Check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Compliance"
        subtitle={
          data
            ? `Centre-wide compliance overview · ${total} active learner${total !== 1 ? "s" : ""}`
            : "Centre-wide compliance overview"
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
            </Button>
            <Link href="/learner-profiles" className={buttonVariants({ variant: "primary" })}>
              <Users className="h-3.5 w-3.5" aria-hidden /> View Profiles
            </Link>
          </>
        }
      />

      {error ? (
        <LoadError message={error} onRetry={() => void load()} />
      ) : loading || !data ? (
        <PanelLoading label="Loading compliance data" />
      ) : (
        <>
          {/* Centre health score — the panel's master instrument */}
          <Card>
            <CardContent className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:justify-start">
              <Dial
                value={data.healthScore}
                label="Centre Health"
                cautionBelow={79}
                alertBelow={54}
              />
              <div>
                <div className="flex items-center gap-3">
                  <ShieldCheck
                    className={`h-6 w-6 ${HEALTH_TEXT[healthTone(data.healthScore)]}`}
                    aria-hidden
                  />
                  <Lamp variant={healthLamp(data.healthScore)}>{healthLabel(data.healthScore)}</Lamp>
                </div>
                <p className="mt-3 max-w-md text-sm leading-6 text-dim">
                  Weighted across document completion, assessment currency, IQA sampling
                  coverage, and staff compliance. Sweep the readings below for the
                  contributing measures.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Key readings */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Instrument label="Total Learners" value={total} sub="Active compliance profiles" />
            <Instrument
              label="Docs Complete"
              value={`${data.avgDocCompletion}%`}
              sub={`${total - data.missingDocCount} of ${total} learners`}
              tone={data.avgDocCompletion === 100 ? "phos" : "ink"}
            />
            <Instrument
              label="Missing Docs"
              value={data.missingDocCount}
              sub="Learners with gaps"
              tone={data.missingDocCount > 0 ? "caution" : "ink"}
              corner={data.missingDocCount > 0 ? <Lamp variant="caution">Check</Lamp> : undefined}
            />
            <Instrument
              label="High Risk"
              value={data.riskCounts.High ?? 0}
              sub="Require intervention"
              tone={(data.riskCounts.High ?? 0) > 0 ? "alert" : "ink"}
              corner={(data.riskCounts.High ?? 0) > 0 ? <Lamp variant="alert">Alert</Lamp> : undefined}
            />
          </div>

          {/* Risk breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Risk Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(["Low", "Medium", "High"] as const).map((level) => {
                const count = data.riskCounts[level] ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={level} className="flex items-center gap-3">
                    <span className="placard w-16">{level}</span>
                    <div
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${level} risk share`}
                      className="h-2 flex-1 overflow-hidden rounded-sm bg-well"
                    >
                      <div className={`h-full rounded-sm ${RISK_FILL[level]}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="readout w-20 text-right text-xs text-dim" data-numeric>
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* High-risk learners */}
          {data.highRisk.length > 0 && (
            <Card className="border-alert/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-alert">
                  <AlertTriangle className="h-4 w-4" aria-hidden /> High Risk Learners
                </CardTitle>
                <Lamp variant="alert">{data.highRisk.length}</Lamp>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {data.highRisk.map((l) => (
                  <Link
                    key={l.id}
                    href={`/learner-profiles/${l.id}`}
                    className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-ctl border border-bezel px-3 py-2 text-sm transition-colors hover:border-bezel-strong hover:bg-well"
                  >
                    <span className="font-semibold text-ink">{l.fullName}</span>
                    {l.missingDocs.length > 0 && (
                      <span className="text-xs text-alert">Missing: {l.missingDocs.join(", ")}</span>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
