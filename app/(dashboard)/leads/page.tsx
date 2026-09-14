import { auth } from "@/auth";
import LeadsClient from "@/components/leads/LeadsClient";
import PageTransition from "@/components/motion/PageTransition";

export default async function LeadsPage() {
  const session = await auth();
  const rawRole = (session?.user as { role?: string })?.role ?? "sales";
  const role = rawRole === "staff" ? "sales" : rawRole;

  return (
    <PageTransition>
      <LeadsClient role={role} />
    </PageTransition>
  );
}
