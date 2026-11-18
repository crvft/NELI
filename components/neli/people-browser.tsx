'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { FluidHover } from '@/components/motion/fluid-hover';
import type { OfficeType } from '@/lib/domain';
import type { PartyCode } from '@/lib/parties';
import { Card } from './card';
import { PersonAvatar } from './avatar';
import { PartyTag } from './party';
import { FilterChips } from './filter-chips';
import { SearchField } from './election-browser';

export type PersonSummary = {
  id: string;
  name: string;
  party: PartyCode;
  office?: OfficeType;
  officeLabel: string;
  title: string;
  inOffice: boolean;
  appointed: boolean;
  state: string;
  wins: number;
  contests: number;
  switches: number;
};

const GROUPS = [
  { value: 'all', label: 'Everyone' },
  { value: 'executive', label: 'President & VP' },
  { value: 'governor', label: 'Governors' },
  { value: 'senator', label: 'Senators' },
  { value: 'rep', label: 'House of Reps' },
  { value: 'assembly', label: 'State Assembly' },
  { value: 'lga-chair', label: 'LGA Chairmen' },
  { value: 'minister', label: 'Appointees' },
] as const;
type Group = (typeof GROUPS)[number]['value'];

function inGroup(p: PersonSummary, g: Group) {
  if (g === 'all') return true;
  if (g === 'executive') return p.office === 'president' || p.office === 'vice-president';
  return p.office === g;
}

export function PeopleBrowser({ items }: { items: PersonSummary[] }) {
  const [group, setGroup] = React.useState<Group>('all');
  const [q, setQ] = React.useState('');
  const [onlyCurrent, setOnlyCurrent] = React.useState(false);
  const list = items.filter(
    (p) => inGroup(p, group) && (!onlyCurrent || p.inOffice) && (!q || `${p.name} ${p.state} ${p.party} ${p.title}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <SearchField value={q} onChange={setQ} placeholder='Search by name, state or party' className='sm:w-80' />
        <label className='flex items-center gap-2 text-label-sm text-text-sub-600 sm:ml-auto'>
          <input type='checkbox' checked={onlyCurrent} onChange={(e) => setOnlyCurrent(e.target.checked)} className='size-4 accent-[var(--primary-base)]' />
          Currently in office
        </label>
      </div>
      <FilterChips options={GROUPS as unknown as { value: Group; label: string }[]} value={group} onChange={setGroup} />
      <p className='text-paragraph-xs text-text-sub-600'>
        {list.length} {list.length === 1 ? 'person' : 'people'}
      </p>
      <FluidHover layer='over' radius={16} gapClick={16} className='reveal-items grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
        {list.map((p) => (
          <Link key={p.id} href={`/politicians/${p.id}` as Route} data-fluid-item className='relative block'>
            <Card className='flex h-full flex-col gap-4 p-4'>
              <div className='flex items-start gap-3'>
                <PersonAvatar name={p.name} party={p.party} size='lg' />
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-label-md text-text-strong-950'>{p.name}</div>
                  <div className='mt-0.5 line-clamp-2 text-paragraph-xs text-text-sub-600'>{p.title}</div>
                </div>
              </div>
              <div className='mt-auto flex flex-wrap items-center gap-2'>
                <PartyTag code={p.party} />
                <span className='inline-flex h-6 items-center rounded-md bg-bg-weak-50 px-2 text-label-xs text-text-sub-600'>{p.state}</span>
                {p.appointed && <span className='inline-flex h-6 items-center rounded-md bg-feature-lighter px-2 text-label-xs text-feature-dark'>Appointed</span>}
                {!p.appointed && p.contests > 0 && (
                  <span className='tabular ml-auto text-paragraph-xs text-text-sub-600'>
                    {p.wins}/{p.contests} won
                  </span>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </FluidHover>
    </div>
  );
}
