import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div>
      <PageHeader title="Trainer Details" subtitle="Not yet available" />
      <Card>
        <CardContent>
          <p className="text-sm text-dim">
            The trainer detail view is planned for a later release. Manage trainers from the roster for now.
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
