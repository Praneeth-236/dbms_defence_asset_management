export type DateValue = string | Date | null | undefined;

function toValidDate(value: DateValue): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: DateValue, fallback = "Unspecified"): string {
  const date = toValidDate(value);
  return date ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : fallback;
}

export function formatDateTime(value: DateValue, fallback = "Date unavailable"): string {
  const date = toValidDate(value);
  return date ? date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : fallback;
}