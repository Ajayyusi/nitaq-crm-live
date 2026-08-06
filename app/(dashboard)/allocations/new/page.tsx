import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div>
      <PageHeader title="New Allocation" subtitle="Not yet available" />
      <Card>
        <CardContent>
          <p className="text-sm text-dim">
            Teacher allocation is planned for a later release. Nothing can be created here yet.
          </p>
          <Link
            href="/allocations"
            className="mt-3 inline-block text-xs font-bold uppercase tracking-[0.08em] text-phos underline-offset-4 hover:underline"
          >
            Back to Allocations
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
