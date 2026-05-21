import { NextResponse } from "next/server";

type DisabledSession = {
  user?: {
    id?: string;
    role?: string;
    teacherId?: string;
    name?: string;
    email?: string;
  };
} | null;

export async function auth(): Promise<DisabledSession> {
  return null;
}

export const handlers = {
  GET: async () => NextResponse.json({ message: "Authentication is not enabled in this phase." }),
  POST: async () => NextResponse.json({ message: "Authentication is not enabled in this phase." }),
};

export async function signIn() {
  return null;
}

export async function signOut() {
  return null;
}
