/**
 * Money input rules shared by every route that accepts an amount.
 *
 * Amounts are stored as JS numbers (IEEE doubles) rounded to the fils, the
 * same convention the accounting engine uses. The danger is not the double
 * itself but what reaches it: `Number("Infinity")`, `NaN`, `1e308` and
 * three-decimal values all used to slip past `amount <= 0` checks.
 */

/** Largest single amount any one document may carry (AED). */
export const MAX_AMOUNT = 10_000_000;

/** Round to the fils — identical to the engine's round2 so totals agree. */
export const round2 = (n: number) => Math.round(n * 100) / 100;

export class MoneyInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyInputError";
  }
}

/**
 * Parse a user-supplied amount. Throws MoneyInputError when the value is not
 * a finite number, is negative, is zero (unless allowZero), or is absurdly large.
 */
export function parseAmount(
  raw: unknown,
  { field = "Amount", allowZero = false }: { field?: string; allowZero?: boolean } = {}
): number {
  const text = typeof raw === "string" ? raw.replace(/,/g, "").trim() : raw;
  if (text === "" || text === null || text === undefined) {
    if (allowZero) return 0;
    throw new MoneyInputError(`${field} is required.`);
  }
  const n = typeof text === "number" ? text : Number(text);
  if (!Number.isFinite(n)) throw new MoneyInputError(`${field} must be a number.`);
  if (n < 0) throw new MoneyInputError(`${field} cannot be negative.`);
  if (n === 0 && !allowZero) throw new MoneyInputError(`${field} must be greater than 0.`);
  if (n > MAX_AMOUNT) {
    throw new MoneyInputError(`${field} exceeds the maximum of AED ${MAX_AMOUNT.toLocaleString("en-US")}.`);
  }
  return round2(n);
}
