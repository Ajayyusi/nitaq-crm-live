import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const authed = await requireAuth(["admin", "manager", "trainer"]);
  if (authed instanceof NextResponse) return authed;


  return NextResponse.json({ message: "This module is not implemented in the Leads phase." }, { status: 501 });
}

export async function POST() {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;


  return NextResponse.json({ message: "This module is not implemented in the Leads phase." }, { status: 501 });
}

export async function PATCH() {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;


  return NextResponse.json({ message: "This module is not implemented in the Leads phase." }, { status: 501 });
}

export async function DELETE() {
  const authed = await requireAuth(["admin", "manager"]);
  if (authed instanceof NextResponse) return authed;


  return NextResponse.json({ message: "This module is not implemented in the Leads phase." }, { status: 501 });
}
