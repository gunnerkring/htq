export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(base: Date, count: number): Date {
  const d = startOfMonth(base);
  d.setMonth(d.getMonth() + count);
  return d;
}

export function monthDiff(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}

export function monthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "long" });
}

export function yearLabel(date: Date): string {
  return String(date.getFullYear());
}
