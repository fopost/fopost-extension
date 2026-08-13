import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button.js';
import { cn } from '../../lib/utils.js';
import {
  MINUTE_STEP,
  fromLocalValue,
  monthGrid,
  pad,
  presets,
  sameDay,
  startOfDay,
  toLocalValue,
} from '../../lib/datetime.js';

/*
 * A calendar of our own, because <input type="datetime-local"> hands its picker
 * to the browser, which positions it against the top-level viewport. Inside a
 * 400px overlay pinned to the right edge, that puts the calendar somewhere near
 * the top of the page, detached from the field. No CSS reaches it.
 *
 * This one renders inline, in flow. It cannot be clipped by the scroll
 * container and it cannot land outside the panel.
 */

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function DateTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const selected = useMemo(() => fromLocalValue(value), [value]);
  const [month, setMonth] = useState(
    () => new Date(selected.getFullYear(), selected.getMonth(), 1),
  );
  const [open, setOpen] = useState(false);

  const today = startOfDay(new Date());
  const days = useMemo(() => monthGrid(month), [month]);

  const setDay = (day: Date) => {
    const next = new Date(day);
    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    onChange(toLocalValue(next));
  };

  const setTime = (hours: number, minutes: number) => {
    const next = new Date(selected);
    next.setHours(hours, minutes, 0, 0);
    onChange(toLocalValue(next));
  };

  const shiftMonth = (by: number) =>
    setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
          'outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
          open ? 'border-accent bg-accent-soft/40' : 'border-slate-200 hover:bg-slate-50',
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-slate-400" />
        <span className="flex-1 tabular-nums">
          {selected.toLocaleDateString(undefined, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
          <span className="text-slate-400"> · </span>
          {pad(selected.getHours())}:{pad(selected.getMinutes())}
        </span>
      </button>

      {open && (
        <div className="space-y-3 rounded-lg border border-slate-200 p-3">
          <div className="flex flex-wrap gap-1.5">
            {presets().map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  onChange(toLocalValue(preset.at));
                  setMonth(new Date(preset.at.getFullYear(), preset.at.getMonth(), 1));
                }}
                className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition-colors hover:bg-slate-50"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              title="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft />
            </Button>
            <span className="text-xs font-medium">
              {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </span>
            <Button variant="ghost" size="icon" title="Next month" onClick={() => shiftMonth(1)}>
              <ChevronRight />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((day, i) => (
              <span key={i} className="py-1 text-center text-[10px] font-medium text-slate-400">
                {day}
              </span>
            ))}
            {days.map((day) => {
              const outside = day.getMonth() !== month.getMonth();
              const past = startOfDay(day) < today;
              const active = sameDay(day, selected);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={past}
                  onClick={() => setDay(day)}
                  className={cn(
                    'rounded-md py-1.5 text-center text-xs tabular-nums transition-colors',
                    'outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                    active && 'bg-accent font-semibold text-white',
                    !active && !past && 'hover:bg-slate-100',
                    !active && outside && 'text-slate-300',
                    !active && !outside && 'text-slate-700',
                    past && 'cursor-not-allowed text-slate-300 hover:bg-transparent',
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-medium text-slate-700">Time</span>
            <select
              aria-label="Hour"
              value={selected.getHours()}
              onChange={(e) => setTime(Number(e.target.value), selected.getMinutes())}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs tabular-nums outline-none focus:border-accent"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {pad(h)}
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-400">:</span>
            <select
              aria-label="Minute"
              value={selected.getMinutes() - (selected.getMinutes() % MINUTE_STEP)}
              onChange={(e) => setTime(selected.getHours(), Number(e.target.value))}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs tabular-nums outline-none focus:border-accent"
            >
              {Array.from({ length: 60 / MINUTE_STEP }, (_, i) => i * MINUTE_STEP).map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
