"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  MessageSquarePlus,
  Save,
  Users,
  XCircle,
} from "lucide-react";
import { isReadOnlyRole } from "@/lib/permissions";
import type { AppRole } from "@/lib/permissions";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { LoadError, PanelLoading, Spinner } from "@/components/ui/feedback";
import { TickGauge } from "@/components/ui/tick-gauge";

interface Document {
  docType: string;
  label: string;
  status: string;
  expiryDate: string;
  uploadRef: string;
  verifiedBy: string;
  notes: string;
}

interface CommsEntry {
  note: string;
  by: string;
  at: string;
}

interface Profile {
  id: string;
  enrollmentId: string;
  fullName: string;
  phone: string;
  email: string;
  emiratesId: string;
  emiratesIdExpiry: string;
  passportNumber: string;
  passportExpiry: string;
  visaNumber: string;
  visaExpiry: string;
  nationality: string;
  dateOfBirth: string;
  photoOnFile: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  riskStatus: "Low" | "Medium" | "High";
  riskNotes: string;
  documents: Document[];
  commsLog: CommsEntry[];
  docCompletionPct: number;
  missingRequiredDocs: string[];
  isActive: boolean;
}

const docStatusOptions = ["Present", "Missing", "Expired", "Pending Review"];

const RISK_LAMP: Record<Profile["riskStatus"], LampVariant> = {
  Low: "ok",
  Medium: "caution",
  High: "alert",
};

const DOC_LAMP: Record<string, LampVariant> = {
  Present: "ok",
  Missing: "alert",
  Expired: "caution",
  "Pending Review": "advisory",
};

const DOC_TEXT: Record<string, string> = {
  Present: "text-phos",
  Missing: "text-alert",
  Expired: "text-caution",
  "Pending Review": "text-advisory",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function LearnerProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const role = ((session?.user as any)?.role ?? "") as AppRole;
  const readOnly = isReadOnlyRole(role);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);

  // Form state
  const [riskStatus, setRiskStatus] = useState<"Low" | "Medium" | "High">("Low");
  const [riskNotes, setRiskNotes] = useState("");
  const [photoOnFile, setPhotoOnFile] = useState(false);
  const [docs, setDocs] = useState<Document[]>([]);
  const [commsNote, setCommsNote] = useState("");
  const [postingComms, setPostingComms] = useState(false);
  const [commsError, setCommsError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await fetch(`/api/learner-profiles/${id}`);
      const d = await res.json();
      const p: Profile | undefined = d.profile;
      if (!res.ok || !p) {
        setProfile(null);
        if (res.status !== 404) setLoadFailed(true);
        return;
      }
      setProfile(p);
      setRiskStatus(p.riskStatus);
      setRiskNotes(p.riskNotes);
      setPhotoOnFile(p.photoOnFile);
      setDocs(p.documents);
    } catch {
      setProfile(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveRisk = async () => {
    setSaving(true);
    setSaveMsg("");
    setSaveFailed(false);
    try {
      const res = await fetch(`/api/learner-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskStatus, riskNotes, photoOnFile, documents: docs }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Save failed — try again.");
      setProfile(d.profile);
      setSaveMsg("Saved.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveFailed(true);
      setSaveMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const appendComms = async () => {
    if (!commsNote.trim()) return;
    setPostingComms(true);
    setCommsError("");
    try {
      const res = await fetch(`/api/learner-profiles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appendComms: commsNote.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Couldn't add the note — try again.");
      setProfile(d.profile);
      setCommsNote("");
    } catch (e) {
      setCommsError((e as Error).message);
    } finally {
      setPostingComms(false);
    }
  };

  const updateDocStatus = (docType: string, status: string) => {
    setDocs((prev) => prev.map((d) => (d.docType === docType ? { ...d, status } : d)));
  };

  if (loading) return <PanelLoading label="Loading profile" />;

  if (loadFailed) {
    return (
      <div className="space-y-4">
        <BackLink />
        <LoadError message="Couldn't load this learner profile. Check your connection and retry." onRetry={() => void load()} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <BackLink />
        <EmptyState
          icon={Users}
          title="Profile not found"
          description="This learner profile may have been removed."
          action={
            <Link href="/learner-profiles" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Back to Learner Profiles
            </Link>
          }
        />
      </div>
    );
  }

  const requiredDocTypes = ["Emirates ID", "Passport", "Visa"];

  return (
    <div className="space-y-4">
      <BackLink />
      <PageHeader
        title={profile.fullName}
        subtitle={`${profile.phone} · ${profile.email || "—"}`}
        actions={<Lamp variant={RISK_LAMP[profile.riskStatus]}>{profile.riskStatus} Risk</Lamp>}
      />

      {/* Document completion */}
      <Card>
        <CardContent>
          <TickGauge
            percent={profile.docCompletionPct}
            cautionBelow={99}
            alertBelow={49}
            label="Document Completion"
            detail={`${profile.docCompletionPct}%`}
          />
          {profile.missingRequiredDocs.length > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-caution">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" aria-hidden />
              Missing: {profile.missingRequiredDocs.join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Personal details */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <DetailRow label="Nationality" value={profile.nationality} />
              <DetailRow label="Date of Birth" value={profile.dateOfBirth} />
              <DetailRow
                label="Emirates ID"
                value={profile.emiratesId}
                sub={profile.emiratesIdExpiry ? `Expires ${profile.emiratesIdExpiry}` : ""}
              />
              <DetailRow
                label="Passport"
                value={profile.passportNumber}
                sub={profile.passportExpiry ? `Expires ${profile.passportExpiry}` : ""}
              />
              <DetailRow
                label="Visa"
                value={profile.visaNumber}
                sub={profile.visaExpiry ? `Expires ${profile.visaExpiry}` : ""}
              />
              {profile.emergencyContactName && (
                <DetailRow
                  label="Emergency Contact"
                  value={`${profile.emergencyContactName} (${profile.emergencyContactRelation})`}
                  sub={profile.emergencyContactPhone}
                />
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Risk assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            {readOnly ? (
              <dl className="space-y-3">
                <DetailRow label="Risk Level" value={profile.riskStatus} />
                <DetailRow label="Notes" value={profile.riskNotes || "—"} />
                <DetailRow label="Photo on File" value={profile.photoOnFile ? "Yes" : "No"} />
              </dl>
            ) : (
              <div className="space-y-4">
                <Field label="Risk Level" htmlFor="risk-level">
                  <Select
                    id="risk-level"
                    value={riskStatus}
                    onChange={(e) => setRiskStatus(e.target.value as "Low" | "Medium" | "High")}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </Select>
                </Field>
                <Field label="Risk Notes" htmlFor="risk-notes">
                  <Textarea
                    id="risk-notes"
                    rows={3}
                    value={riskNotes}
                    onChange={(e) => setRiskNotes(e.target.value)}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={photoOnFile}
                    onChange={(e) => setPhotoOnFile(e.target.checked)}
                    className="h-4 w-4 rounded accent-phos"
                  />
                  Photo on file
                </label>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Document checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Document Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          {requiredDocTypes.length === 0 && docs.length === 0 ? (
            <p className="text-sm text-faint">No documents.</p>
          ) : (
            <div className="space-y-2">
              {/* Required docs derived from profile (always show) */}
              {requiredDocTypes.map((docType) => {
                const existing = docs.find((d) => d.docType === docType);
                const status = existing?.status ?? "Missing";
                return (
                  <div
                    key={docType}
                    className="flex items-center gap-3 rounded-ctl border border-bezel px-4 py-2.5"
                  >
                    <span className="flex-1 text-sm font-medium text-ink">{docType}</span>
                    {readOnly ? (
                      <Lamp variant={DOC_LAMP[status] ?? "off"}>{status}</Lamp>
                    ) : (
                      <Select
                        value={status}
                        aria-label={`${docType} status`}
                        onChange={(e) => {
                          if (existing) {
                            updateDocStatus(docType, e.target.value);
                          } else {
                            setDocs((prev) => [
                              ...prev,
                              {
                                docType,
                                label: "",
                                status: e.target.value,
                                expiryDate: "",
                                uploadRef: "",
                                verifiedBy: "",
                                notes: "",
                              },
                            ]);
                          }
                        }}
                        className={`h-8 w-auto pr-7 text-xs font-semibold ${DOC_TEXT[status] ?? ""}`}
                      >
                        {docStatusOptions.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </Select>
                    )}
                    {status === "Present" ? (
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-phos" aria-hidden />
                    ) : (
                      <XCircle
                        className={`h-4 w-4 flex-shrink-0 ${DOC_TEXT[status] ?? "text-faint"}`}
                        aria-hidden
                      />
                    )}
                  </div>
                );
              })}
              {/* Extra docs */}
              {docs
                .filter((d) => !requiredDocTypes.includes(d.docType))
                .map((d) => (
                  <div
                    key={d.docType}
                    className="flex items-center gap-3 rounded-ctl border border-bezel px-4 py-2.5"
                  >
                    <span className="flex-1 text-sm text-ink">{d.label || d.docType}</span>
                    <Lamp variant={DOC_LAMP[d.status] ?? "off"}>{d.status}</Lamp>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="solid" onClick={() => void saveRisk()} disabled={saving}>
            {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" aria-hidden />}
            Save Changes
          </Button>
          {saveMsg && (
            <span
              role={saveFailed ? "alert" : "status"}
              className={`text-sm font-semibold ${saveFailed ? "text-alert" : "text-phos"}`}
            >
              {saveMsg}
            </span>
          )}
        </div>
      )}

      {/* Communications log */}
      <Card>
        <CardHeader>
          <CardTitle>Communications Log</CardTitle>
          <Lamp variant="off">{profile.commsLog.length}</Lamp>
        </CardHeader>
        <CardContent>
          {!readOnly && (
            <div className="mb-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a communication note…"
                  aria-label="Communication note"
                  value={commsNote}
                  onChange={(e) => setCommsNote(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && appendComms()}
                  className="flex-1"
                />
                <Button
                  variant="primary"
                  onClick={() => void appendComms()}
                  disabled={postingComms || !commsNote.trim()}
                >
                  {postingComms ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <MessageSquarePlus className="h-4 w-4" aria-hidden />
                  )}
                  Add
                </Button>
              </div>
              {commsError && (
                <p role="alert" className="mt-1.5 text-xs font-semibold text-alert">
                  {commsError}
                </p>
              )}
            </div>
          )}
          {profile.commsLog.length === 0 ? (
            <p className="text-sm text-faint">No communications logged yet.</p>
          ) : (
            <div className="space-y-2">
              {[...profile.commsLog].reverse().map((entry, i) => (
                <div key={i} className="rounded-ctl border border-bezel bg-well px-4 py-2.5">
                  <p className="text-sm text-ink">{entry.note}</p>
                  <p className="mt-1 text-xs text-faint">
                    {entry.by} · <span title={new Date(entry.at).toLocaleString()}>{timeAgo(entry.at)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/learner-profiles"
      className="inline-flex items-center gap-1 text-xs font-medium text-dim transition-colors hover:text-ink"
    >
      <ChevronLeft className="h-3 w-3" aria-hidden /> Learner Profiles
    </Link>
  );
}

function DetailRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex gap-3">
      <dt className="placard w-32 flex-shrink-0 pt-0.5">{label}</dt>
      <dd className="flex-1 text-sm text-ink">
        {value || "—"}
        {sub && <span className="block text-xs text-faint">{sub}</span>}
      </dd>
    </div>
  );
}
