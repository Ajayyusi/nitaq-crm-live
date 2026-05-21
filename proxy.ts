import { NextResponse } from "next/server";

export default function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/__nitaq_phase1_proxy_disabled__/:path*"],
};
