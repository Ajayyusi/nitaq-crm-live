import { auth } from "@/auth";
import LeadsClient from "@/components/leads/LeadsClient";

export default async function LeadsPage() {
  const session = await auth();
  const rawRole = (session?.user as { role?: string })?.role ?? "sales";
  const role = rawRole === "staff" ? "sales" : rawRole;
  const userName = session?.user?.name ?? "";

  return <LeadsClient role={role} userName={userName} />;
}
