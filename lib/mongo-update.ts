/**
 * Build a Mongo update from a plain `{ field: value }` patch.
 *
 * Mongoose 8 silently DROPS keys whose value is `undefined` from an update, so
 * the common `update.field = clean(x) || undefined` meant to clear a field did
 * nothing — and `update.journalEntryId = undefined` left a stale link behind
 * that stopped reversed payments from ever being reposted. Undefined values
 * become `$unset` here instead.
 */
export function toMongoUpdate(patch: Record<string, unknown>): {
  $set?: Record<string, unknown>;
  $unset?: Record<string, 1>;
} {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) $unset[key] = 1;
    else $set[key] = value;
  }
  return {
    ...(Object.keys($set).length ? { $set } : {}),
    ...(Object.keys($unset).length ? { $unset } : {}),
  };
}

/** Same calendar day (UTC date part — how date inputs are stored and shown). */
export function sameDay(a: Date | string | null | undefined, b: Date | string | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
}

/** Parse an optional date field from a request body; throws on garbage. */
export function parseOptionalDate(raw: unknown, field: string): Date | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) throw new Error(`${field} is not a valid date.`);
  return d;
}
