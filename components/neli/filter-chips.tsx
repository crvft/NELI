'use client';

import { cn } from '@/utils/cn';

export function FilterChips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className='-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0' role='group'>
      {options.map((o) => (
        <button
          key={o.value}
          type='button'
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'hit h-9 shrink-0 whitespace-nowrap rounded-full px-3.5 text-label-sm transition-colors duration-[80ms]',
            value === o.value
              ? 'bg-primary-base text-static-white'
              : 'bg-surface-2 text-text-sub-600 shadow-surface-2 hover:bg-hover hover:text-text-strong-950',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
