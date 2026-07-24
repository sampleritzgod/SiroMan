/** Validate IANA time zone identifiers (e.g. Asia/Kolkata, America/New_York). */
export function isValidIanaTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) return false;
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function normalizeIanaTimeZone(
  timeZone: string | null | undefined,
  fallback = "UTC",
): string {
  if (timeZone && isValidIanaTimeZone(timeZone)) return timeZone;
  if (isValidIanaTimeZone(fallback)) return fallback;
  return "UTC";
}

/** HH:mm 24h clock. */
export function isValidDueTime(value: string): boolean {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return Boolean(match);
}

/** Add minutes to HH:mm, wrapping within the same civil day for end-time calc helpers. */
export function addMinutesToDueTime(dueTime: string, minutes: number): string {
  const [h, m] = dueTime.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nh = Math.floor(wrapped / 60);
  const nm = wrapped % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}
