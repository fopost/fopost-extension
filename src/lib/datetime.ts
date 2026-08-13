/*
 * Pure date helpers for the composer's schedule picker, kept out of the
 * component so they can be exercised without a DOM.
 */

export const MINUTE_STEP = 5;

export const pad = (n: number) => String(n).padStart(2, '0');

/** The `YYYY-MM-DDTHH:mm` shape the composer already passes around. */
export function toLocalValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalValue(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Days to render for a month, padded to whole Monday-first weeks. */
export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  // getDay() is Sunday-first; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - lead);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  // Drop a trailing week that belongs entirely to the next month.
  return days.slice(0, days[35].getMonth() === month.getMonth() ? 42 : 35);
}

export function presets(): { label: string; at: Date }[] {
  const hour = new Date(Date.now() + 60 * 60 * 1000);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const monday = new Date();
  // 8 keeps it on *next* Monday even when today is Monday.
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  monday.setHours(9, 0, 0, 0);

  return [
    { label: 'In an hour', at: hour },
    { label: 'Tomorrow 9am', at: tomorrow },
    { label: 'Monday 9am', at: monday },
  ];
}
