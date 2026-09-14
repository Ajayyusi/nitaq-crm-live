import { NextResponse } from "next/server";

/** A user-facing error with an explicit HTTP status (e.g. 409 on a conflicting edit). */
export class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Turn an error thrown inside a route handler into a response.
 *
 * Routes throw plain `Error("Student name is required.")` for validation, and
 * those messages are meant for the user. Database and driver errors are not:
 * a duplicate-key or connection error carries collection names, index names,
 * other users' values and hostnames. Those are logged and replaced with a
 * generic message.
 */
export function apiError(error: unknown, fallback: string, context = "api"): NextResponse {
  const e = error as { name?: string; message?: string; code?: number; path?: string; status?: number };
  const name = e?.name ?? "";

  // Driver / server failures — never shown to the client
  if (name.startsWith("Mongo") || e?.code === 11000) {
    console.error(`[${context}]`, error);
    const duplicate = e?.code === 11000;
    return NextResponse.json(
      { message: duplicate ? "This record already exists." : fallback },
      { status: duplicate ? 409 : 500 }
    );
  }
  if (name === "CastError") {
    return NextResponse.json({ message: `Invalid value for ${e.path ?? "a field"}.` }, { status: 400 });
  }
  if (error instanceof Error) {
    const status = typeof e.status === "number" ? e.status : 400;
    return NextResponse.json({ message: error.message || fallback }, { status });
  }
  console.error(`[${context}]`, error);
  return NextResponse.json({ message: fallback }, { status: 500 });
}
