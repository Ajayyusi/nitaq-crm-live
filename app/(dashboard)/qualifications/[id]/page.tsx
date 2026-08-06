"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { BookMarked, ChevronLeft, Plus, Save, Trash2 } from "lucide-react";
import { isReadOnlyRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Field, Input, Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { LoadError, PanelLoading, Spinner } from "@/components/ui/feedback";

interface Unit {
  unitCode: string;
  unitTitle: string;
  level: string;
  credits: number | null;
  glh: number | null;
  isMandatory: boolean;
  learningOutcomes: string;
  assessmentCriteria: string;
}

interface Qualification {
  id: string;
  title: string;
  awardingBody: string;
  level: string;
  qualificationCode: string;
  credits: number | null;
  glh: number | null;
  tqt: number | null;
  units: Unit[];
  status: string;
  updatedAt: string;
}

const AWARDING_BODIES = ["Qualifi", "Pearson", "City & Guilds", "OTHM", "ATHE", "Other"];

const QUAL_LAMP: Record<string, LampVariant> = {
  Active: "ok",
  Inactive: "off",
  "Pending Approval": "caution",
};

function emptyUnit(): Unit {
  return {
    unitCode: "",
    unitTitle: "",
    level: "",
    credits: null,
    glh: null,
    isMandatory: true,
    learningOutcomes: "",
    assessmentCriteria: "",
  };
}

export default function QualificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const role = ((session?.user as any)?.role ?? "") as AppRole;
  const readOnly = isReadOnlyRole(role) || (role !== "admin" && role !== "manager" && role !== "iqa");

  const [qual, setQual] = useState<Qualification | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);

  const [title, setTitle] = useState("");
  const [awardingBody, setAwardingBody] = useState("Qualifi");
  const [level, setLevel] = useState("");
  const [qualCode, setQualCode] = useState("");
  const [credits, setCredits] = useState("");
  const [glh, setGlh] = useState("");
  const [tqt, setTqt] = useState("");
  const [status, setStatus] = useState("Active");
  const [units, setUnits] = useState<Unit[]>([]);
  const [addingUnit, setAddingUnit] = useState(false);
  const [newUnit, setNewUnit] = useState<Unit>(emptyUnit());
  const [unitErrors, setUnitErrors] = useState<{ code?: string; title?: string }>({});
  const [removeIdx, setRemoveIdx] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await fetch(`/api/qualifications/${id}`);
      const d = await res.json();
      const q: Qualification | undefined = d.qualification;
      if (!res.ok || !q) {
        setQual(null);
        if (res.status !== 404) setLoadFailed(true);
        return;
      }
      setQual(q);
      setTitle(q.title);
      setAwardingBody(q.awardingBody);
      setLevel(q.level);
      setQualCode(q.qualificationCode);
      setCredits(q.credits != null ? String(q.credits) : "");
      setGlh(q.glh != null ? String(q.glh) : "");
      setTqt(q.tqt != null ? String(q.tqt) : "");
      setStatus(q.status);
      setUnits(q.units);
    } catch {
      setQual(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setSaveMsg("");
    setSaveFailed(false);
    try {
      const res = await fetch(`/api/qualifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          awardingBody,
          level,
          qualificationCode: qualCode,
          credits: credits ? Number(credits) : null,
          glh: glh ? Number(glh) : null,
          tqt: tqt ? Number(tqt) : null,
          status,
          units,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Save failed — try again.");
      setQual(d.qualification);
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveFailed(true);
      setSaveMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const addUnit = () => {
    const errs: { code?: string; title?: string } = {};
    if (!newUnit.unitCode.trim()) errs.code = "Unit code is required.";
    if (!newUnit.unitTitle.trim()) errs.title = "Unit title is required.";
    setUnitErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setUnits((prev) => [...prev, { ...newUnit }]);
    setNewUnit(emptyUnit());
    setUnitErrors({});
    setAddingUnit(false);
  };

  const removeUnit = (idx: number) => setUnits((prev) => prev.filter((_, i) => i !== idx));

  if (loading) return <PanelLoading label="Loading qualification" />;

  if (loadFailed) {
    return (
      <div className="space-y-4">
        <BackLink />
        <LoadError
          message="Couldn't load this qualification. Check your connection and retry."
          onRetry={() => void load()}
        />
      </div>
    );
  }

  if (!qual) {
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState
          icon={BookMarked}
          title="Qualification not found"
          description="This qualification may have been removed."
          action={
            <Link href="/qualifications" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Back to Qualifications
            </Link>
          }
        />
      </div>
    );
  }

  const saveMsgEl = saveMsg ? (
    <span
      role={saveFailed ? "alert" : "status"}
      className={`text-sm font-semibold ${saveFailed ? "text-alert" : "text-phos"}`}
    >
      {saveMsg}
    </span>
  ) : null;

  return (
    <div className="space-y-4">
      <BackLink />
      <PageHeader
        title={qual.title}
        subtitle={`${qual.awardingBody} · Level ${qual.level}`}
        actions={<Lamp variant={QUAL_LAMP[qual.status] ?? "off"}>{qual.status}</Lamp>}
      />

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {readOnly ? (
            <dl className="space-y-3">
              {[
                ["Title", qual.title],
                ["Awarding Body", qual.awardingBody],
                ["Level", qual.level],
                ["Code", qual.qualificationCode || "—"],
                ["Credits", qual.credits ?? "—"],
                ["GLH", qual.glh ?? "—"],
                ["TQT", qual.tqt ?? "—"],
                ["Status", qual.status],
              ].map(([l, v]) => (
                <div key={String(l)} className="flex gap-3">
                  <dt className="placard w-32 flex-shrink-0 pt-0.5">{l}</dt>
                  <dd className="flex-1 text-sm text-ink">{String(v)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="space-y-4">
              <Field label="Title" htmlFor="q-title">
                <Input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Awarding Body" htmlFor="q-body">
                  <Select id="q-body" value={awardingBody} onChange={(e) => setAwardingBody(e.target.value)}>
                    {AWARDING_BODIES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Level" htmlFor="q-level">
                  <Input id="q-level" value={level} onChange={(e) => setLevel(e.target.value)} />
                </Field>
              </div>
              <Field label="Qualification Code" htmlFor="q-code">
                <Input id="q-code" value={qualCode} onChange={(e) => setQualCode(e.target.value)} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Credits" htmlFor="q-credits">
                  <Input
                    id="q-credits"
                    type="number"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                  />
                </Field>
                <Field label="GLH" htmlFor="q-glh">
                  <Input id="q-glh" type="number" value={glh} onChange={(e) => setGlh(e.target.value)} />
                </Field>
                <Field label="TQT" htmlFor="q-tqt">
                  <Input id="q-tqt" type="number" value={tqt} onChange={(e) => setTqt(e.target.value)} />
                </Field>
              </div>
              <Field label="Status" htmlFor="q-status">
                <Select id="q-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option>Active</option>
                  <option>Inactive</option>
                  <option>Pending Approval</option>
                </Select>
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="solid" onClick={() => void save()} disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" aria-hidden />}
                  Save
                </Button>
                {saveMsgEl}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Units */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Units</CardTitle>
            <Lamp variant="off">{units.length}</Lamp>
          </div>
          {!readOnly && !addingUnit && (
            <Button variant="ghost" size="sm" onClick={() => setAddingUnit(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add Unit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {units.length === 0 && !addingUnit && (
            <p className="text-sm text-faint">No units added yet.</p>
          )}

          <div className="space-y-2">
            {units.map((u, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-ctl border border-bezel px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {u.unitCode} — {u.unitTitle}
                  </p>
                  <p className="text-xs text-faint">
                    {[
                      u.level && `Level ${u.level}`,
                      u.credits && `${u.credits} credits`,
                      u.glh && `${u.glh} GLH`,
                      u.isMandatory ? "Mandatory" : "Optional",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="iconSm"
                    onClick={() => setRemoveIdx(idx)}
                    aria-label={`Remove unit ${u.unitCode}`}
                    className="flex-shrink-0 hover:text-alert"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {addingUnit && (
            <div className="mt-3 space-y-3 rounded-card border border-bezel bg-well p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unit Code" required htmlFor="u-code" error={unitErrors.code}>
                  <Input
                    id="u-code"
                    value={newUnit.unitCode}
                    onChange={(e) => setNewUnit((u) => ({ ...u, unitCode: e.target.value }))}
                    placeholder="e.g. U01"
                  />
                </Field>
                <Field label="Level" htmlFor="u-level">
                  <Input
                    id="u-level"
                    value={newUnit.level}
                    onChange={(e) => setNewUnit((u) => ({ ...u, level: e.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Unit Title" required htmlFor="u-title" error={unitErrors.title}>
                <Input
                  id="u-title"
                  value={newUnit.unitTitle}
                  onChange={(e) => setNewUnit((u) => ({ ...u, unitTitle: e.target.value }))}
                  placeholder="e.g. Managing People"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Credits" htmlFor="u-credits">
                  <Input
                    id="u-credits"
                    type="number"
                    value={newUnit.credits ?? ""}
                    onChange={(e) =>
                      setNewUnit((u) => ({ ...u, credits: e.target.value ? Number(e.target.value) : null }))
                    }
                  />
                </Field>
                <Field label="GLH" htmlFor="u-glh">
                  <Input
                    id="u-glh"
                    type="number"
                    value={newUnit.glh ?? ""}
                    onChange={(e) =>
                      setNewUnit((u) => ({ ...u, glh: e.target.value ? Number(e.target.value) : null }))
                    }
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={newUnit.isMandatory}
                  onChange={(e) => setNewUnit((u) => ({ ...u, isMandatory: e.target.checked }))}
                  className="h-4 w-4 rounded accent-phos"
                />
                Mandatory unit
              </label>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={addUnit}>
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddingUnit(false);
                    setNewUnit(emptyUnit());
                    setUnitErrors({});
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!readOnly && units.length > 0 && !addingUnit && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={() => void save()} disabled={saving}>
                {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" aria-hidden />}
                Save Units
              </Button>
              {saveMsgEl}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={removeIdx !== null}
        onClose={() => setRemoveIdx(null)}
        onConfirm={() => {
          if (removeIdx !== null) removeUnit(removeIdx);
          setRemoveIdx(null);
        }}
        title="Remove Unit"
        confirmLabel="Remove"
        message={
          removeIdx !== null && units[removeIdx]
            ? `Remove unit ${units[removeIdx].unitCode} — ${units[removeIdx].unitTitle}? The change applies when you save.`
            : "Remove this unit? The change applies when you save."
        }
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/qualifications"
      className="inline-flex items-center gap-1 text-xs font-medium text-dim transition-colors hover:text-ink"
    >
      <ChevronLeft className="h-3 w-3" aria-hidden /> Qualifications
    </Link>
  );
}
