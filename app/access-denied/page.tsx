import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-panel px-4">
      <div className="face w-full max-w-md p-10 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-card border border-alert/30 bg-[var(--lamp-alert-bg)]">
          <ShieldOff className="h-7 w-7 text-alert" aria-hidden />
        </div>
        <p className="placard">Access Restricted</p>
        <h1 className="mt-1 text-xl font-bold text-ink">Access Denied</h1>
        <p className="mt-2 text-sm text-dim">
          You do not have permission to view this page. Contact your administrator if you believe
          this is an error.
        </p>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "solid" }), "mt-6")}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
