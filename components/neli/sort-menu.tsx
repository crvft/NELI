'use client';

import * as React from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { IconCheck, IconChevronDown, IconSort } from '@/components/icons';
import { cn } from '@/utils/cn';
import { motion, useReducedMotion } from 'motion/react';
import { spring } from '@/lib/motion';

export type SortOption<K extends string> = { value: K; label: string; hint?: string };

/**
 * Compact sort dropdown for card headers (28px, the compact control step).
 * Radix handles focus, keyboard and dismissal; the popup sits on surface-4 and
 * opens on the moderate spring (see .menu-surface in globals.css).
 */
export function SortMenu<K extends string>({
  value,
  onChange,
  options,
  className,
  prefix = 'Sort:',
  menuTitle = 'Sort by',
  icon = true,
  align = 'end',
}: {
  value: K;
  onChange: (v: K) => void;
  options: SortOption<K>[];
  className?: string;
  /** Text before the current value on the trigger ("Sort:"); also used for its label */
  prefix?: string;
  menuTitle?: string;
  icon?: boolean;
  align?: 'start' | 'end';
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  // Fluid highlight: one fill glides to whichever item is highlighted (pointer or keys)
  const [lit, setLit] = React.useState<{ top: number; height: number } | null>(null);
  const reduced = useReducedMotion();
  return (
    <Dropdown.Root modal={false} onOpenChange={(o) => !o && setLit(null)}>
      <Dropdown.Trigger
        className={cn(
          'hit bg-surface-2 text-label-xs text-text-sub-600 shadow-surface-2 hover:bg-hover hover:text-text-strong-950 data-[state=open]:bg-hover data-[state=open]:text-text-strong-950 inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg pr-1.5 pl-2 outline-hidden transition-colors duration-[80ms] focus-visible:shadow-[0_0_0_2px_var(--primary-alpha-24)]',
          className,
        )}
        aria-label={`${menuTitle}: ${current.label}`}
      >
        {icon && <IconSort className='size-3.5' />}
        <span className='text-text-sub-600'>{prefix}</span>
        <span className='text-text-strong-950'>{current.label}</span>
        <IconChevronDown className='size-3.5' />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          className='menu-surface bg-surface-4 shadow-surface-4 z-50 min-w-44 rounded-xl p-1 outline-hidden'
        >
          <Dropdown.Label className='text-paragraph-xs text-text-sub-600 px-2.5 pt-1.5 pb-1'>
            {menuTitle}
          </Dropdown.Label>
          <Dropdown.RadioGroup
            value={value}
            onValueChange={(v) => onChange(v as K)}
            onPointerLeave={() => setLit(null)}
            className='relative isolate'
          >
            {lit && (
              <motion.div
                aria-hidden
                className='bg-hover absolute inset-x-0 -z-10 rounded-lg'
                initial={false}
                animate={{ top: lit.top, height: lit.height }}
                transition={reduced ? { duration: 0 } : spring.moderate}
              />
            )}
            {options.map((o) => (
              <Dropdown.RadioItem
                key={o.value}
                value={o.value}
                onFocus={(e) => setLit({ top: e.currentTarget.offsetTop, height: e.currentTarget.offsetHeight })}
                className='hit text-paragraph-sm text-text-strong-950 relative flex min-h-8 py-1.5 cursor-pointer items-center gap-2 rounded-lg pr-8 pl-2.5 outline-hidden transition-colors duration-[80ms] select-none data-[state=checked]:font-[550]'
              >
                <span className='flex flex-col'>
                  {o.label}
                  {o.hint && <span className='text-paragraph-xs text-text-sub-600 font-normal'>{o.hint}</span>}
                </span>
                <Dropdown.ItemIndicator className='absolute right-2.5 inline-flex'>
                  <IconCheck className='text-primary-base size-4' />
                </Dropdown.ItemIndicator>
              </Dropdown.RadioItem>
            ))}
          </Dropdown.RadioGroup>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

/** Generic sorter: numeric keys high→low, names A→Z. */
export function useSorted<T, K extends string>(
  items: T[],
  key: K,
  by: Record<K, (a: T, b: T) => number>,
) {
  return React.useMemo(() => items.slice().sort(by[key]), [items, key, by]);
}
