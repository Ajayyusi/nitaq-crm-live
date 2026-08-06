"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ShieldAlert } from "lucide-react";
import { Spinner } from "@/components/ui/feedback";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
      <div
        role="alert"
        className="face mx-auto w-full max-w-md border-alert/30 p-8 text-center"
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)]">
          <ShieldAlert className="h-6 w-6 text-alert" aria-hidden />
        </div>
        <h1 className="text-base font-bold text-ink">Cannot Open This Session</h1>
        <p className="mt-2 text-sm text-dim">{error}</p>
        <Link href="/login" className={cn(buttonVariants({ variant: "primary" }), "mt-6")}>
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Spinner className="mx-auto h-7 w-7" />
      <p className="placard mt-4">Opening session</p>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-panel p-6">
      <Suspense fallback={<Spinner className="h-7 w-7" />}>
        <Redeem />
      </Suspense>
    </div>
  );
}
