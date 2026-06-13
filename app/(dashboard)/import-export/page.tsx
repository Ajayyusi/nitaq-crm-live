import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { AppRole } from "@/lib/permissions";
import ImportExportClient from "./ImportExportClient";

export default async function ImportExportPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const rawRole = (session.user as { role?: string }).role;
  const role = (rawRole === "staff" ? "sales" : rawRole) as AppRole;

  return <ImportExportClient role={role} />;
}
