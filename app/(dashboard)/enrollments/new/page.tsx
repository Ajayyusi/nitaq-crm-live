import Link from "next/link";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="New Enrollment"
        subtitle="Enrollment creation will be rebuilt in a later phase."
      />
      <Card>
        <CardContent>
          <p className="text-sm text-dim">
            This workflow is parked while the functional Leads module is being built. Create
            enrollments from the{" "}
            <Link href="/enrollments" className="font-semibold text-phos underline-offset-4 hover:underline">
              Enrollments page
            </Link>{" "}
            instead.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
