"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, RefreshCw, Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { Button, buttonVariants } from "@/components/ui/button";
import { Lamp, type LampVariant } from "@/components/ui/lamp";
import { SearchInput, Select } from "@/components/ui/input";
import {
  Pagination,
  Table,
  TableFooter,
  TableShell,
  Td,
  Th,
  THead,
  Tr,
  usePagination,
} from "@/components/ui/table";
import { LoadError, SkeletonRows } from "@/components/ui/feedback";
import { TickGauge } from "@/components/ui/tick-gauge";

interface Profile {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  riskStatus: "Low" | "Medium" | "High";
  docCompletionPct: number;
  missingRequiredDocs: string[];
  isActive: boolean;
  updatedAt: string;
}

const RISK_LAMP: Record<Profile["riskStatus"], LampVariant> = {
  Low: "ok",
  Medium: "caution",
  High: "alert",
};

export default function LearnerProfilesPage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  // Debounce the search — it drives a fetch.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ active: "true" });
      if (riskFilter) params.set("risk", riskFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/learner-profiles?${params}`);
      if (!res.ok) throw new Error();
      const d = await res.json();
      setProfiles(d.profiles ?? []);
    } catch {
      setError("Couldn't load learner profiles. Check your connection and retry.");
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, [riskFilter, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const { slice, page, pages, setPage, total } = usePagination(profiles, 50);
  const hasFilters = Boolean(debouncedSearch || riskFilter);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Learner Profiles"
        subtitle="Compliance records for enrolled learners"
        actions={
          <Button
            variant="secondary"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh profiles"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </Button>
        }
      />

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        <SearchInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone, Emirates ID…"
          aria-label="Search learner profiles"
          className="min-w-48 flex-1"
        />
        <Select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          aria-label="Filter by risk level"
          className="w-auto"
        >
          <option value="">All Risk Levels</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </Select>
      </div>

      {error ? (
        <LoadError message={error} onRetry={() => void load()} />
      ) : (
        <TableShell>
          {loading ? (
            <SkeletonRows rows={8} cols={5} />
          ) : profiles.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={Users}
                title="No matching profiles"
                description="No learner profiles match your search or risk filter."
                action={
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setRiskFilter("");
                    }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Users}
                title="No learner profiles yet"
                description="Compliance profiles are created from enrollment records — there is no manual add here."
                action={
                  <Link href="/enrollments" className={buttonVariants({ variant: "primary", size: "sm" })}>
                    Go to Enrollments
                  </Link>
                }
              />
            )
          ) : (
            <>
              <Table className="min-w-[640px]">
                <THead>
                  <tr>
                    <Th>Learner</Th>
                    <Th>Risk</Th>
                    <Th className="hidden sm:table-cell">Doc Completion</Th>
                    <Th className="hidden md:table-cell">Missing</Th>
                    <Th className="text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </THead>
                <tbody>
                  {slice.map((p) => (
                    <Tr key={p.id} clickable onClick={() => router.push(`/learner-profiles/${p.id}`)}>
                      <Td>
                        <p className="text-sm font-semibold text-ink">{p.fullName}</p>
                        <p className="readout text-xs text-faint" data-numeric>
                          {p.phone}
                        </p>
                      </Td>
                      <Td>
                        <Lamp variant={RISK_LAMP[p.riskStatus]}>{p.riskStatus}</Lamp>
                      </Td>
                      <Td className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <TickGauge
                            percent={p.docCompletionPct}
                            cautionBelow={99}
                            alertBelow={49}
                            className="w-24"
                          />
                          <span className="readout text-xs text-dim" data-numeric>
                            {p.docCompletionPct}%
                          </span>
                        </div>
                      </Td>
                      <Td className="hidden md:table-cell">
                        {p.missingRequiredDocs.length === 0 ? (
                          <span className="text-xs font-medium text-phos">All present</span>
                        ) : (
                          <span
                            className="block max-w-52 truncate text-xs text-alert"
                            title={p.missingRequiredDocs.join(", ")}
                          >
                            {p.missingRequiredDocs.join(", ")}
                          </span>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Link
                          href={`/learner-profiles/${p.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-phos hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <TableFooter>
                <Pagination page={page} pages={pages} setPage={setPage} total={total} shown={slice.length} />
              </TableFooter>
            </>
          )}
        </TableShell>
      )}
    </div>
  );
}
