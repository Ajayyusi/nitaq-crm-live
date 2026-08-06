"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { BookMarked, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { isReadOnlyRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Field, Input, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/dialog";
import { Pagination, usePagination } from "@/components/ui/table";
import { LoadError, Skeleton, Spinner } from "@/components/ui/feedback";

interface Qualification {
  id: string;
  title: string;
  awardingBody: string;
  level: string;
  qualificationCode: string;
  credits: number | null;
  units: { unitCode: string; unitTitle: string; isMandatory: boolean }[];
  status: string;
  updatedAt: string;
}

const QUAL_LAMP: Record<string, LampVariant> = {
  Active: "ok",
  Inactive: "off",
  "Pending Approval": "caution",
};

const AWARDING_BODIES = ["Qualifi", "Pearson", "City & Guilds", "OTHM", "ATHE", "Other"];

interface FormState {
  title: string;
  awardingBody: string;
  level: string;
  qualificationCode: string;
  credits: string;
  glh: string;
  tqt: string;
  status: string;
}

const emptyForm = (): FormState => ({
  title: "",
  awardingBody: "Qualifi",
  level: "",
  qualificationCode: "",
  credits: "",
  glh: "",
  tqt: "",
  status: "Active",
});

export default function QualificationsPage() {
  const { data: session } = useSession();
  const role = ((session?.user as any)?.role ?? "") as AppRole;
  const readOnly = isReadOnlyRole(role) || (role !== "admin" && role !== "manager" && role !== "iqa");

  const [quals, setQuals] = useState<Qualification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; level?: string }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/qualifications");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setQuals(d.qualifications ?? []);
    } catch {
      setLoadError("Couldn't load qualifications. Check your connection and retry.");
      setQuals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openDrawer = () => {
    setForm(emptyForm());
    setError("");
    setFieldErrors({});
    setDrawerOpen(true);
  };
  const closeDrawer = () => setDrawerOpen(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { title?: string; level?: string } = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    if (!form.level.trim()) errs.level = "Level is required.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          credits: form.credits ? Number(form.credits) : null,
          glh: form.glh ? Number(form.glh) : null,
          tqt: form.tqt ? Number(form.tqt) : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't create the qualification — try again.");
      setQuals((prev) => [d.qualification, ...prev]);
      closeDrawer();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const { slice, page, pages, setPage, total } = usePagination(quals, 24);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Qualifications"
        subtitle="Qualifi, OTHM and other awarding body qualifications"
        actions={
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh qualifications"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </Button>
            {!readOnly && (
              <Button variant="solid" onClick={openDrawer}>
                <Plus className="h-4 w-4" aria-hidden /> Add Qualification
              </Button>
            )}
          </>
        }
      />

      {loadError ? (
        <LoadError message={loadError} onRetry={() => void load()} />
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : quals.length === 0 ? (
        <EmptyState
          icon={BookMarked}
          title="No qualifications yet"
          description="Add the qualifications your centre delivers to start tracking units and assessments."
          action={
            !readOnly ? (
              <Button variant="primary" size="sm" onClick={openDrawer}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add Qualification
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {slice.map((q) => (
              <Link
                key={q.id}
                href={`/qualifications/${q.id}`}
                className="face group block p-4 transition-all duration-150 hover:border-bezel-strong hover:shadow-raise"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-phos">
                      {q.title}
                    </p>
                    <p className="mt-1 text-xs text-dim">
                      {q.awardingBody} · Level {q.level}
                    </p>
                    {q.qualificationCode && (
                      <p className="readout text-xs text-faint" data-numeric>
                        {q.qualificationCode}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    className="h-4 w-4 flex-shrink-0 text-faint transition-colors group-hover:text-phos"
                    aria-hidden
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Lamp variant={QUAL_LAMP[q.status] ?? "off"}>{q.status}</Lamp>
                  {q.credits != null && (
                    <span className="readout text-xs text-faint" data-numeric>
                      {q.credits} credits
                    </span>
                  )}
                  <span className="readout text-xs text-faint" data-numeric>
                    {q.units.length} unit{q.units.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {pages > 1 && (
            <div className="flex items-center rounded-card border border-bezel bg-face px-4 py-2.5 text-xs text-dim">
              <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
            </div>
          )}
        </>
      )}

      {/* Add drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title="Add Qualification"
        footer={
          <>
            <Button variant="secondary" onClick={closeDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" form="qual-add-form" variant="solid" disabled={saving}>
              {saving && <Spinner className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Create Qualification"}
            </Button>
          </>
        }
      >
        <form id="qual-add-form" onSubmit={submit} noValidate className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-ctl border border-alert/30 bg-[var(--lamp-alert-bg)] px-3 py-2 text-sm font-semibold text-alert"
            >
              {error}
            </p>
          )}
          <Field label="Title" required htmlFor="qual-title" error={fieldErrors.title}>
            <Input
              id="qual-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Qualifi Level 5 Diploma in Leadership & Management"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Awarding Body" htmlFor="qual-body">
              <Select
                id="qual-body"
                value={form.awardingBody}
                onChange={(e) => setForm((f) => ({ ...f, awardingBody: e.target.value }))}
              >
                {AWARDING_BODIES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
            <Field label="Level" required htmlFor="qual-level" error={fieldErrors.level}>
              <Input
                id="qual-level"
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
                placeholder="e.g. 5"
              />
            </Field>
          </div>
          <Field label="Qualification Code" htmlFor="qual-code">
            <Input
              id="qual-code"
              value={form.qualificationCode}
              onChange={(e) => setForm((f) => ({ ...f, qualificationCode: e.target.value }))}
              placeholder="e.g. 603/1234/X"
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Credits" htmlFor="qual-credits">
              <Input
                id="qual-credits"
                type="number"
                min={0}
                value={form.credits}
                onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))}
              />
            </Field>
            <Field label="GLH" htmlFor="qual-glh">
              <Input
                id="qual-glh"
                type="number"
                min={0}
                value={form.glh}
                onChange={(e) => setForm((f) => ({ ...f, glh: e.target.value }))}
              />
            </Field>
            <Field label="TQT" htmlFor="qual-tqt">
              <Input
                id="qual-tqt"
                type="number"
                min={0}
                value={form.tqt}
                onChange={(e) => setForm((f) => ({ ...f, tqt: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="Status" htmlFor="qual-status">
            <Select
              id="qual-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option>Active</option>
              <option>Inactive</option>
              <option>Pending Approval</option>
            </Select>
          </Field>
        </form>
      </Drawer>
    </div>
  );
}
