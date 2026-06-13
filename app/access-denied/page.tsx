import Link from "next/link";
import { ShieldOff } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-rose-50">
          <ShieldOff className="h-8 w-8 text-rose-500" />
        </div>
        <h1 className="text-xl font-bold text-[#0D1F0E]">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-500">
          You do not have permission to view this page. Contact your administrator if you believe this is an error.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-xl bg-[#2E7D32] px-6 text-sm font-bold text-white transition hover:bg-[#1B5E20]"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
