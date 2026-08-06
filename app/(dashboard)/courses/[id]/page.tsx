import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div>
      <PageHeader title="Course Details" subtitle="Not yet available" />
      <Card>
        <CardContent>
          <p className="text-sm text-dim">
            The course detail view is planned for a later release. Manage courses from the catalog for now.
          </p>
          <Link
            href="/courses"
            className="mt-3 inline-block text-xs font-bold uppercase tracking-[0.08em] text-phos underline-offset-4 hover:underline"
          >
            Back to Courses
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
