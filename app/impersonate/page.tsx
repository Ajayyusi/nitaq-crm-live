"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, ShieldAlert } from "lucide-react";

function Redeem() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get("token");
    if (!token) { setError("No impersonation token supplied."); return; }

    signIn("impersonate", { token, redirect: false })
      .then((res) => {
        if (res?.error) {
          setError("This link is invalid, already used, or has expired. Generate a new one from the Trainers page.");
        } else {
          router.replace("/dashboard");
          router.refresh();
        }
      })
      .catch(() => setError("Could not start the session. Please try again."));
  }, [params, router]);

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
        <ShieldAlert className="mx-auto h-9 w-9 text-rose-500" />
        <h1 className="mt-3 text-base font-bold text-rose-900">Cannot open this session</h1>
        <p className="mt-1 text-sm text-rose-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#2E7D32]" />
      <p className="mt-3 text-sm font-medium text-slate-600">Opening session…</p>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Suspense fallback={<Loader2 className="h-7 w-7 animate-spin text-[#2E7D32]" />}>
        <Redeem />
      </Suspense>
    </div>
  );
}
