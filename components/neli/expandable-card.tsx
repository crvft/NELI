'use client';

import * as React from 'react';
import { IconChevronDown } from '@/components/icons';
import { Card } from './card';

export function ExpandableCard({ children, total, limit, noun }: { children: React.ReactNode; total: number; limit: number; noun: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <Card className='group/tbl' data-collapsed={!open && total > limit}>
      {children}
      {total > limit && (
        <button
          type='button'
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className='flex w-full items-center justify-center gap-1 border-t border-stroke-soft-200 py-3 text-label-sm text-text-sub-600 transition-colors duration-[80ms] hover:bg-hover hover:text-text-strong-950'
        >
          {open ? 'Show fewer' : `Show all ${total} ${noun}s`}
          <IconChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    </Card>
  );
}
