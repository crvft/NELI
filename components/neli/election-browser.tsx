'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { FluidHover } from '@/components/motion/fluid-hover';
import { IconChevronRight, IconSearch } from '@/components/icons';
import * as SegmentedControl from '@/components/ui/segmented-control';
import type { ElectionType } from '@/lib/domain';
import type { PartyCode } from '@/lib/parties';
import { PARTIES } from '@/lib/parties';
import type { Tally } from '@/lib/analytics';
import { Card } from './card';
import { ShareBar } from './share-bar';
import { LiveDot } from './live-dot';
import { PersonAvatar } from './avatar';
import { FilterChips } from './filter-chips';
import { cn } from '@/utils/cn';

export type ElectionSummary = {
  id: string;
  title: string;
  type: ElectionType;
  typeLabel: string;
  year: number;
  date?: string;
  status: 'live' | 'concluded' | 'upcoming';
  place: string;
  totalVotes: number;
  tally: Tally[];
  top?: { personId: string; party: PartyCode; value: number };
};

const PAGE = 60;

const TYPES: { value: ElectionType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'presidential', label: 'Presidential' },
  { value: 'governorship', label: 'Governorship' },
  { value: 'senate', label: 'Senate' },
  { value: 'reps', label: 'House of Reps' },
  { value: 'assembly', label: 'State Assembly' },
  { value: 'lga', label: 'Local Govt' },
];

export function ElectionBrowser({ items }: { items: ElectionSummary[] }) {
  const [status, setStatus] = React.useState<'all' | 'live' | 'concluded' | 'upcoming'>('all');
  const [type, setType] = React.useState<ElectionType | 'all'>('all');
  const [q, setQ] = React.useState('');
  const filtered = items.filter(
    (i) =>
      (status === 'all' || i.status === status) &&
      (type === 'all' || i.type === type) &&
      (!q || `${i.title} ${i.place} ${i.tally.map((t) => t.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())),
  );
  // Render in pages of 60 so 1,700+ races stay fast; filters start a fresh page
  const sig = `${status}|${type}|${q}`;
  const [page, setPage] = React.useState({ sig, n: PAGE });
  const limit = page.sig === sig ? page.n : PAGE;
  const shown = filtered.slice(0, limit);
  const years = Array.from(new Set(shown.map((i) => i.year))).sort((a, b) => b - a);

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-center'>
        <SegmentedControl.Root value={status} onValueChange={(v) => setStatus(v as typeof status)} className='lg:w-[360px]'>
          <SegmentedControl.List>
            <SegmentedControl.Trigger value='all'>All</SegmentedControl.Trigger>
            <SegmentedControl.Trigger value='live'>Live</SegmentedControl.Trigger>
            <SegmentedControl.Trigger value='concluded'>Past</SegmentedControl.Trigger>
            <SegmentedControl.Trigger value='upcoming'>Upcoming</SegmentedControl.Trigger>
          </SegmentedControl.List>
        </SegmentedControl.Root>
        <SearchField value={q} onChange={setQ} placeholder='Search elections, states or candidates' className='lg:ml-auto lg:w-80' />
      </div>
      <FilterChips options={TYPES} value={type} onChange={setType} />

      {years.length === 0 && (
        <Card className='p-8 text-center'>
          <p className='text-label-sm text-text-strong-950'>No elections match these filters</p>
          <p className='mt-1 text-paragraph-sm text-text-sub-600'>Try a different type or clear the search.</p>
        </Card>
      )}

      {years.map((y) => (
        <section key={y} className='flex flex-col gap-3'>
          <h2 className='text-label-md text-text-strong-950'>{y}</h2>
          <FluidHover layer='over' radius={16} gapClick={16} className='grid grid-cols-1 gap-3 md:grid-cols-2'>
            {shown
              .filter((i) => i.year === y)
              .map((i) => (
                <ElectionCard key={i.id} i={i} />
              ))}
          </FluidHover>
        </section>
      ))}
      {filtered.length > limit && (
        <button
          type='button'
          onClick={() => setPage({ sig, n: limit + PAGE })}
          className='hit bg-surface-2 text-label-sm text-text-sub-600 shadow-surface-2 hover:bg-hover hover:text-text-strong-950 mx-auto inline-flex h-9 items-center rounded-10 px-4 transition-colors duration-[80ms]'
        >
          Show more ({filtered.length - limit} more)
        </button>
      )}
    </div>
  );
}

function ElectionCard({ i }: { i: ElectionSummary }) {
  return (
    <Link href={(i.status === 'live' ? '/' : `/elections/${i.id}`) as Route} data-fluid-item className='group relative block'>
      <Card className='flex h-full flex-col gap-3 p-4 sm:p-5'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2 text-paragraph-xs text-text-sub-600'>
              {i.status === 'live' && <LiveDot label />}
              {i.status === 'upcoming' && <span className='text-label-xs text-information-base'>Upcoming</span>}
              <span>{i.typeLabel}</span>
              <span className='text-text-sub-600'>·</span>
              <span>{i.place}</span>
            </div>
            <h3 className='mt-1 text-label-md text-text-strong-950'>{i.title}</h3>
          </div>
          <IconChevronRight className='size-5 shrink-0 text-text-sub-600 transition group-hover:translate-x-0.5 duration-[80ms] group-hover:text-text-strong-950' />
        </div>
        {i.status === 'upcoming' ? (
          i.top && (
            <div className='mt-auto flex items-center gap-2 text-paragraph-sm text-text-sub-600'>
              <span className='size-2 rounded-full' style={{ background: PARTIES[i.top.party].color }} />
              Favourite: <span className='text-text-strong-950'>{i.top.party}</span>
              <span className='tabular ml-auto text-label-sm text-text-strong-950'>{Math.round(i.top.value * 100)}% to win</span>
            </div>
          )
        ) : (
          <div className='mt-auto flex flex-col gap-2.5'>
            <ShareBar tally={i.tally} height='h-2' />
            <div className='flex items-center gap-2'>
              <PersonAvatar name={i.tally[0].name} party={i.tally[0].party} size='sm' />
              <div className='min-w-0 flex-1'>
                <div className='truncate text-label-sm text-text-strong-950'>{i.tally[0].name}</div>
                <div className='text-paragraph-xs text-text-sub-600'>
                  {i.status === 'live' ? 'Leading' : 'Won'} · {i.tally[0].party}
                </div>
              </div>
              {i.top && Number.isFinite(i.top.value) ? (
                <span className='tabular text-label-md text-text-strong-950'>{(i.tally[0].share * 100).toFixed(1)}%</span>
              ) : (
                <span className='text-paragraph-xs text-text-sub-600'>Winner only</span>
              )}
            </div>
          </div>
        )}
      </Card>
    </Link>
  );
}

export function SearchField({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={cn('flex h-9 items-center gap-2 rounded-10 bg-surface-2 px-3 shadow-surface-2 transition-shadow duration-[80ms] focus-within:shadow-[0_0_0_2px_var(--primary-alpha-24)]', className)}>
      <IconSearch className='size-4 shrink-0 text-text-sub-600' />
      <input
        type='search'
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className='w-full bg-transparent text-paragraph-sm text-text-strong-950 outline-hidden placeholder:text-text-sub-600 pointer-coarse:text-[16px]'
      />
    </label>
  );
}
