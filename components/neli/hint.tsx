'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

/**
 * NELI's tooltip: the same raised surface as the map's state tooltip (surface-4,
 * rounded-xl, soft shadow), opening just below the element. Replaces the browser's
 * native `title` tooltips so every hover reads the same way.
 */
export function Hint({
  content,
  children,
  side = 'bottom',
}: {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom';
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={80} skipDelayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={8}
            collisionPadding={12}
            className='menu-surface bg-surface-4 shadow-surface-4 text-paragraph-xs text-text-sub-600 pointer-events-none z-50 max-w-64 rounded-xl px-3 py-2.5'
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/** A tooltip line in the map's style: colour dot, label, value. */
export function HintRow({ color, label, value }: { color?: string; label: React.ReactNode; value?: React.ReactNode }) {
  return (
    <div className='flex items-center gap-2'>
      {color && <span className='size-2.5 shrink-0 rounded-full' style={{ background: color }} aria-hidden />}
      <span className='text-label-sm text-text-strong-950 truncate'>{label}</span>
      {value != null && <span className='tabular text-label-sm text-text-strong-950 ml-auto pl-3'>{value}</span>}
    </div>
  );
}
