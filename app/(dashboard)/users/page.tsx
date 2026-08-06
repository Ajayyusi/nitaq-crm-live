import Link from "next/link";
import { Users } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/shared/EmptyState";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function UsersPage() {
  return (
    <div>
      <PageHeader title="Users" subtitle="Staff accounts and roles" />
      <div className="face">
        <EmptyState
          icon={Users}
          title="User Management Lives in Settings"
          description="Add staff accounts, change roles, and reset passwords from the Staff Accounts section in Settings."
          action={
            <Link href="/settings" className={cn(buttonVariants({ variant: "primary", size: "sm" }))}>
              Open Settings
            </Link>
          }
        />
      </div>
    </div>
  );
}
