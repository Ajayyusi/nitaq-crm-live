/**
 * WhatsApp click-to-chat helpers.
 *
 * The prefilled message only shows if WhatsApp receives a VALID international
 * number. A number stored as a UAE local format (e.g. "0501234567") produces
 * an invalid wa.me link and WhatsApp silently drops the prefilled text — which
 * is the usual reason "the message doesn't show". We normalise to full
 * international format (defaulting to UAE +971) before building the link.
 */

const DEFAULT_COUNTRY_CODE = "971"; // UAE

/** Normalise a phone number to bare international digits, or null if unusable. */
export function normalizePhone(raw: string | undefined | null): string | null {
  let d = (raw ?? "").replace(/\D/g, "");
  if (!d) return null;

  if (d.startsWith("00")) {
    d = d.slice(2);                       // 00971… → 971…
  } else if (d.startsWith("0")) {
    d = DEFAULT_COUNTRY_CODE + d.slice(1); // 0501234567 → 971501234567
  } else if (d.length === 9 && d.startsWith("5")) {
    d = DEFAULT_COUNTRY_CODE + d;          // 501234567 → 971501234567
  }

  return d.length >= 8 ? d : null;
}

/**
 * Build a wa.me click-to-chat URL, optionally with a prefilled message.
 * Returns null when the number can't be normalised.
 */
export function buildWhatsAppUrl(phone: string | undefined | null, text?: string): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
