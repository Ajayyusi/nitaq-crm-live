import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <div>
      <PageHeader
        title="Lead Details"
        subtitle="Use the main Leads page to edit leads in this phase."
      />
      <Card>
        <CardContent>
          <p className="text-sm text-dim">
            This workflow is parked while the functional Leads module is being built.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
