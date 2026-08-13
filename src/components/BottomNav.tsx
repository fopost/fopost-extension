import { PenLine, ListChecks, Settings } from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '../lib/utils.js';

export type Screen = 'compose' | 'queue' | 'settings';

const ITEMS: { id: Screen; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: 'compose', label: 'Compose', icon: PenLine },
  { id: 'queue', label: 'Queue', icon: ListChecks },
  { id: 'settings', label: 'Settings', icon: Settings },
];

/**
 * Every destination is a peer on one bar, rather than two tabs plus a gear
 * hidden in a corner. Pinned to the bottom, so it never moves as a screen's
 * content grows.
 */
export default function BottomNav({
  screen,
  onChange,
  queueCount,
}: {
  screen: Screen;
  onChange: (next: Screen) => void;
  queueCount: number;
}) {
  return (
    <nav className="shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur">
      <ul className="flex">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = screen === id;
          return (
            <li key={id} className="flex-1">
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onChange(id)}
                className={cn(
                  'flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  'outline-none focus-visible:bg-slate-50',
                  active ? 'text-accent' : 'text-slate-500 hover:text-slate-800',
                )}
              >
                <span className="relative">
                  <Icon className="size-5" />
                  {id === 'queue' && queueCount > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-accent px-1 text-[9px] leading-4 font-semibold text-white">
                      {queueCount > 9 ? '9+' : queueCount}
                    </span>
                  )}
                </span>
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
