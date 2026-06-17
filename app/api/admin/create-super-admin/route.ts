import { NextResponse } from "next/server";

// This endpoint has been permanently disabled after initial setup.
export async function POST() {
  return NextResponse.json({ message: "Not found." }, { status: 404 });
}
