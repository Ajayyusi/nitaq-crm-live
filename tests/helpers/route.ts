/**
 * Helpers for calling REAL route handlers in tests.
 *
 * Test files must mock the session and DB-connection modules first:
 *
 *   vi.mock("@/auth", () => ({ auth: vi.fn() }));
 *   vi.mock("@/lib/db", () => ({ default: vi.fn(async () => undefined) }));
 *   vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
 *
 * The in-memory MongoDB from helpers/db.ts is already connected, so the route
 * code runs its actual queries, validation, permission checks and postings.
 */
import { NextRequest } from "next/server";
import { vi } from "vitest";
import { auth } from "@/auth";
import User from "@/models/User";
import { __resetAuthCache } from "@/lib/api-auth";
import type { AppRole } from "@/lib/permissions";

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
}

/** Create an active user with this role and make it the signed-in session. */
export async function signInAs(role: AppRole, over: Partial<{ name: string; email: string; active: boolean }> = {}): Promise<TestUser> {
  const email = over.email ?? `${role}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  const user = await User.create({
    name: over.name ?? `Test ${role}`,
    email,
    password: "x".repeat(60),
    role,
    active: over.active ?? true,
  });
  const session = { id: user._id.toString(), name: user.name, email: user.email, role };
  __resetAuthCache();
  vi.mocked(auth).mockResolvedValue({ user: session, expires: "2099-01-01" } as never);
  return session;
}

export function signOut() {
  __resetAuthCache();
  vi.mocked(auth).mockResolvedValue(null as never);
}

export function req(method: string, path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

export async function json<T = Record<string, unknown>>(res: Response): Promise<{ status: number; body: T }> {
  return { status: res.status, body: (await res.json()) as T };
}
