'use client';

import * as React from 'react';
import { RiArrowDownSLine } from '@remixicon/react';
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
          className='flex w-full items-center justify-center gap-1 border-t border-stroke-soft-200 py-3 text-label-sm text-text-sub-600 transition hover:bg-bg-weak-50 hover:text-text-strong-950'
        >
          {open ? 'Show fewer' : `Show all ${total} ${noun}s`}
          <RiArrowDownSLine className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    </Card>
  );
}
