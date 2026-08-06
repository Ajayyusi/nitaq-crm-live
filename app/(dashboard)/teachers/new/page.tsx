import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div>
      <PageHeader title="New Trainer" subtitle="Not yet available" />
      <Card>
        <CardContent>
          <p className="text-sm text-dim">
            This page is planned for a later release. Add trainers with the Add Trainer action on the roster.
          </p>
          <Link
            href="/teachers"
            className="mt-3 inline-block text-xs font-bold uppercase tracking-[0.08em] text-phos underline-offset-4 hover:underline"
          >
            Back to Trainers
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
