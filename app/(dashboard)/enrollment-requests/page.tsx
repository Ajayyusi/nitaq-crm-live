"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, GraduationCap, Inbox, MessageCircle, X } from "lucide-react";
import { useSession } from "next-auth/react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, SearchInput, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Pagination, TableFooter, usePagination } from "@/components/ui/table";
import { LoadError, SkeletonRows, Spinner } from "@/components/ui/feedback";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type EnrollmentRequest = {
  id: string;
  leadRef: string;
  leadName: string;
  leadPhone: string;
  course: string;
  salesName: string;
  salesEmail: string;
  notes: string;
  expectedStartDate: string;
  status: string;
  reviewedBy: string;
  reviewNote: string;
  reviewedAt: string;
  createdAt: string;
};

const REQUEST_LAMP: Record<string, LampVariant> = {
  Pending: "caution",
  Approved: "ok",
  Rejected: "alert",
  "More Info Needed": "advisory",
};

function formatDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function EnrollmentRequestsPage() {
  const { data: session } = useSession();
  const rawRole = (session?.user as { role?: string })?.role ?? "sales";
  const role = rawRole === "staff" ? "sales" : rawRole;
  const isSales = role === "sales";

  const [requests, setRequests] = useState<EnrollmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState<EnrollmentRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState("Approved");
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await fetch("/api/enrollment-requests");
      const data = await res.json();
      if (!res.ok) throw data;
      setRequests(data.requests ?? []);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/enrollment-requests/${reviewing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: reviewStatus, reviewNote }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      setNotice(`Request for ${reviewing.leadName} marked as ${reviewStatus}.`);
      setReviewing(null);
      await load();
    } catch {
      setError("Couldn't save the review. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  function openReview(r: EnrollmentRequest) {
    setReviewing(r);
    setReviewStatus("Approved");
    setReviewNote("");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) =>
      [r.leadName, r.leadRef, r.leadPhone, r.course, r.salesName]
        .some((v) => (v ?? "").toLowerCase().includes(q))
    );
  }, [requests, query]);

  const pending = filtered.filter((r) => r.status === "Pending");
  const others = filtered.filter((r) => r.status !== "Pending");
  const reviewed = usePagination(others, 30);

  return (
    <div className="space-y-4">
      <PageHeader
        title={isSales ? "My Enrollment Requests" : "Enrollment Requests"}
        subtitle={isSales
          ? "Track enrollment requests you've submitted to Admin/Manager."
          : "Review enrollment requests from Sales staff."}
      />

      {notice && (
        <div role="status" className="flex items-center justify-between rounded-card border border-phos/30 bg-[var(--lamp-ok-bg)] px-4 py-3 text-sm font-semibold text-phos">
          <span>{notice}</span>
          <Button variant="ghost" size="iconSm" onClick={() => setNotice("")} aria-label="Dismiss message">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      {error && (
        <div role="alert" className="flex items-center justify-between rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)] px-4 py-3 text-sm font-semibold text-alert">
          <span>{error}</span>
          <Button variant="ghost" size="iconSm" onClick={() => setError("")} aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Review dialog (admin/manager only) */}
      <Dialog
        open={Boolean(reviewing) && !isSales}
        onClose={() => setReviewing(null)}
        title={reviewing ? `Review Request — ${reviewing.leadName}` : "Review Request"}
        guarded
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setReviewing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="solid" size="sm" type="submit" form="review-form" disabled={saving}>
              {saving && <Spinner className="h-3.5 w-3.5" />}
              Submit Review
            </Button>
          </>
        }
      >
        {reviewing && (
          <form id="review-form" onSubmit={submitReview} className="space-y-4">
            <dl className="space-y-1 rounded-ctl border border-bezel bg-well p-4 text-sm">
              <div className="flex gap-2"><dt className="font-bold text-dim">Lead:</dt><dd className="text-ink">{reviewing.leadName}</dd></div>
              <div className="flex gap-2"><dt className="font-bold text-dim">Phone:</dt><dd className="readout text-ink" data-numeric>{reviewing.leadPhone}</dd></div>
              <div className="flex gap-2"><dt className="font-bold text-dim">Course:</dt><dd className="text-ink">{reviewing.course}</dd></div>
              <div className="flex gap-2"><dt className="font-bold text-dim">Sales Rep:</dt><dd className="text-ink">{reviewing.salesName}</dd></div>
              {reviewing.notes && <div className="flex gap-2"><dt className="font-bold text-dim">Notes:</dt><dd className="text-ink">{reviewing.notes}</dd></div>}
              {reviewing.expectedStartDate && <div className="flex gap-2"><dt className="font-bold text-dim">Expected Start:</dt><dd className="text-ink">{formatDate(reviewing.expectedStartDate)}</dd></div>}
            </dl>
            <Field label="Decision" htmlFor="review-decision">
              <Select id="review-decision" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                <option value="Approved">Approve — Convert to Enrollment</option>
                <option value="Rejected">Reject</option>
                <option value="More Info Needed">Request More Info</option>
              </Select>
            </Field>
            <Field label="Note to Sales Rep" htmlFor="review-note" help="Reason, next steps, or instructions.">
              <Textarea id="review-note" rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
            </Field>
          </form>
        )}
      </Dialog>

      {loadFailed ? (
        <LoadError message="Couldn't load enrollment requests. Check your connection and retry." onRetry={() => void load()} />
      ) : loading ? (
        <Card>
          <SkeletonRows rows={6} cols={4} />
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.length > 0 && (
            <SearchInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, phone, course, sales rep…"
              aria-label="Search enrollment requests"
              className="max-w-sm"
            />
          )}

          {pending.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Pending
                  <Lamp variant="caution">{pending.length}</Lamp>
                </CardTitle>
              </CardHeader>
              <div className="divide-y divide-bezel/60">
                {pending.map((r) => (
                  <RequestRow key={r.id} r={r} isSales={isSales} onReview={() => openReview(r)} />
                ))}
              </div>
            </Card>
          )}

          {others.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Reviewed
                  <Lamp variant="off">{others.length}</Lamp>
                </CardTitle>
              </CardHeader>
              <div className="divide-y divide-bezel/60">
                {reviewed.slice.map((r) => (
                  <RequestRow key={r.id} r={r} isSales={isSales} onReview={() => openReview(r)} />
                ))}
              </div>
              <TableFooter>
                <Pagination
                  page={reviewed.page}
                  pages={reviewed.pages}
                  setPage={reviewed.setPage}
                  total={reviewed.total}
                  shown={reviewed.slice.length}
                />
              </TableFooter>
            </Card>
          )}

          {requests.length === 0 && (
            <Card>
              <EmptyState
                icon={Inbox}
                title="No enrollment requests yet"
                description={isSales
                  ? 'Use the "Request Enrollment" button on a lead to submit a request.'
                  : "Requests submitted by Sales staff will appear here for review."}
              />
            </Card>
          )}

          {requests.length > 0 && filtered.length === 0 && (
            <Card>
              <EmptyState
                icon={Inbox}
                title="No requests match your search"
                description="Try a different name, phone, or course."
                action={<Button variant="secondary" size="sm" onClick={() => setQuery("")}>Clear Search</Button>}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function RequestRow({ r, isSales, onReview }: { r: EnrollmentRequest; isSales: boolean; onReview: () => void }) {
  const waUrl = r.leadPhone ? (buildWhatsAppUrl(r.leadPhone) ?? "#") : null;
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-bold text-ink">{r.leadName}</p>
          {r.leadRef && <span className="readout text-xs text-faint" data-numeric>{r.leadRef}</span>}
          <Lamp variant={REQUEST_LAMP[r.status] ?? "off"}>{r.status}</Lamp>
        </div>
        <p className="text-sm text-dim">{r.course}</p>
        <div className="flex flex-wrap gap-3 text-xs text-faint">
          {!isSales && <span>Sales: <strong className="text-dim">{r.salesName}</strong></span>}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            {formatDate(r.createdAt)}
          </span>
          {waUrl && (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-phos hover:underline"
              aria-label={`WhatsApp ${r.leadName}`}
            >
              <MessageCircle className="h-3 w-3" aria-hidden />
              <span className="readout" data-numeric>{r.leadPhone}</span>
            </a>
          )}
        </div>
        {r.notes && (
          <p className="truncate text-xs italic text-faint" title={r.notes}>
            "{r.notes.slice(0, 120)}{r.notes.length > 120 ? "…" : ""}"
          </p>
        )}
        {r.reviewNote && (
          <p className="text-xs text-dim">
            <span className="font-bold">Admin note:</span> {r.reviewNote}
            {r.reviewedBy && <span className="ml-1 text-faint">— {r.reviewedBy}</span>}
          </p>
        )}
      </div>
      <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        {!isSales && r.status === "Pending" && (
          <Button variant="primary" size="sm" onClick={onReview}>
            Review
          </Button>
        )}
        {!isSales && r.status === "Approved" && (
          <Link
            href={`/enrollments?name=${encodeURIComponent(r.leadName)}&phone=${encodeURIComponent(r.leadPhone)}&course=${encodeURIComponent(r.course)}`}
            className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
          >
            <GraduationCap className="h-4 w-4" aria-hidden />
            Convert to Enrollment
          </Link>
        )}
      </div>
    </div>
  );
}
