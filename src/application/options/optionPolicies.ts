const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day ? parsed : null;
}

export function calendarDaysBetween(from: string, to: string): number | null {
  const start = parseDateOnly(from);
  const end = parseDateOnly(to);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

export function timeToExpiryYears(valuationDate: string, expirationDate: string): number | null {
  const days = calendarDaysBetween(valuationDate, expirationDate);
  return days == null ? null : Math.max(0, days / 365);
}

export function addCalendarDays(date: string, days: number): string {
  const parsed = parseDateOnly(date);
  if (!parsed) return date;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function interpolateDate(from: string, to: string, fraction: number): string {
  const days = calendarDaysBetween(from, to);
  return addCalendarDays(from, Math.round(Math.max(0, days ?? 0) * Math.min(1, Math.max(0, fraction))));
}
