import { describe, it, expect } from 'vitest';
import {
  fromLocalValue,
  monthGrid,
  presets,
  sameDay,
  startOfDay,
  toLocalValue,
} from './datetime.js';

const DAY_MS = 86_400_000;

describe('toLocalValue', () => {
  it('produces the shape the composer passes to the API', () => {
    expect(toLocalValue(new Date(2026, 7, 13, 17, 1))).toBe('2026-08-13T17:01');
  });

  it('pads single digits', () => {
    expect(toLocalValue(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05T09:07');
  });

  it('round-trips through the picker', () => {
    const picked = new Date(2026, 7, 13, 17, 1);
    expect(fromLocalValue(toLocalValue(picked)).getTime()).toBe(picked.getTime());
  });

  it('keeps the local instant when the composer serialises it', () => {
    // submit() does `new Date(scheduleAt).toISOString()`, so a value that
    // parsed as UTC would silently shift the post by the timezone offset.
    const parsed = new Date(toLocalValue(new Date(2026, 7, 13, 17, 1)));
    expect(parsed.getHours()).toBe(17);
    expect(parsed.getDate()).toBe(13);
  });

  it('falls back to now rather than an invalid date', () => {
    expect(Number.isNaN(fromLocalValue('not a date').getTime())).toBe(false);
  });
});

describe('monthGrid', () => {
  // A leap February, a month starting on a Sunday, and one spanning a DST
  // change are where naive grid maths breaks.
  const months: [number, number][] = [
    [2026, 7],
    [2026, 1],
    [2024, 1],
    [2026, 10],
    [2027, 0],
  ];

  it.each(months)('%i-%i renders whole Monday-first weeks', (year, month) => {
    const grid = monthGrid(new Date(year, month, 1));
    expect(grid.length % 7).toBe(0);
    expect(grid[0].getDay()).toBe(1);
  });

  it.each(months)('%i-%i contains every day of the month', (year, month) => {
    const grid = monthGrid(new Date(year, month, 1));
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    expect(grid.filter((d) => d.getMonth() === month)).toHaveLength(daysInMonth);
  });

  it.each(months)('%i-%i stays contiguous across a DST change', (year, month) => {
    const grid = monthGrid(new Date(year, month, 1));
    for (let i = 1; i < grid.length; i++) {
      const step = Math.round((+startOfDay(grid[i]) - +startOfDay(grid[i - 1])) / DAY_MS);
      expect(step).toBe(1);
    }
  });

  it('drops a trailing week that belongs entirely to the next month', () => {
    // Feb 2027 starts on a Monday and has 28 days: exactly five weeks.
    expect(monthGrid(new Date(2027, 1, 1))).toHaveLength(35);
  });
});

describe('sameDay', () => {
  it('ignores the time of day', () => {
    expect(sameDay(new Date(2026, 7, 13, 1), new Date(2026, 7, 13, 23))).toBe(true);
  });

  it('separates adjacent days', () => {
    expect(sameDay(new Date(2026, 7, 13), new Date(2026, 7, 14))).toBe(false);
  });
});

describe('presets', () => {
  it('never offers a time in the past', () => {
    for (const preset of presets()) {
      expect(preset.at.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('lands the Monday preset on a Monday that is not today', () => {
    const monday = presets().find((p) => p.label === 'Monday 9am')!.at;
    expect(monday.getDay()).toBe(1);
    expect(sameDay(monday, new Date())).toBe(false);
  });
});
