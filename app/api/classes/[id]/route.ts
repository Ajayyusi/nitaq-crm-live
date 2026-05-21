import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "This module is not implemented in the Leads phase." }, { status: 501 });
}

export async function POST() {
  return NextResponse.json({ message: "This module is not implemented in the Leads phase." }, { status: 501 });
}

export async function PATCH() {
  return NextResponse.json({ message: "This module is not implemented in the Leads phase." }, { status: 501 });
}

export async function DELETE() {
  return NextResponse.json({ message: "This module is not implemented in the Leads phase." }, { status: 501 });
}
