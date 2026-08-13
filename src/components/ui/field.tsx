import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../../lib/utils.js';

const control = cn(
  'w-full rounded-lg border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400',
  'outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20',
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
);

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(control, 'h-9', className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea className={cn(control, 'resize-none py-2 leading-relaxed', className)} {...props} />
  );
}

/** Label plus control, with an optional right-aligned hint on the same line. */
export function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-xs font-medium text-slate-700">
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
  );
}
