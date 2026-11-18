'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import type { PartyCode } from '@/lib/parties';
import { CardHeader } from './card';
import { ExpandableCard } from './expandable-card';
import { MeterBar } from './share-bar';
import { PartyTag } from './party';
import { SortMenu, useSorted, type SortOption } from './sort-menu';

export type ResultRow = {
  code: string;
  name: string;
  href?: string;
  votes: number;
  reported: number;
  margin: number;
  lead: { name: string; party: PartyCode; share: number } | null;
};

type SortKey = 'votes' | 'reported' | 'name' | 'share' | 'margin';

const SORTERS: Record<SortKey, (a: ResultRow, b: ResultRow) => number> = {
  votes: (a, b) => b.votes - a.votes,
  reported: (a, b) => b.reported - a.reported || b.votes - a.votes,
  name: (a, b) => a.name.localeCompare(b.name),
  share: (a, b) => (b.lead?.share ?? -1) - (a.lead?.share ?? -1),
  margin: (a, b) => (a.lead ? a.margin : 2) - (b.lead ? b.margin : 2), // closest races first
};

const fmt = (n: number) => n.toLocaleString('en-NG');
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—');

/** "Results by state/district/LGA" with a sort dropdown in the header. */
export function ResultsTable({
  rows,
  areaLabel,
  live,
}: {
  rows: ResultRow[];
  areaLabel: string;
  live: boolean;
}) {
  const noun = areaLabel.toLowerCase();
  const options: SortOption<SortKey>[] = [
    { value: 'votes', label: 'Votes' },
    ...(live ? [{ value: 'reported' as const, label: 'Reported' }] : []),
    { value: 'name', label: 'Alphabetical' },
    { value: 'share', label: 'Leader’s share' },
    { value: 'margin', label: 'Closest race' },
  ];
  const [sort, setSort] = React.useState<SortKey>('votes');
  const sorted = useSorted(rows, sort, SORTERS);
  const description = {
    votes: 'most votes counted first',
    reported: 'most reported first',
    name: 'A to Z',
    share: 'biggest leader’s share first',
    margin: 'closest races first',
  }[sort];

  return (
    <ExpandableCard total={rows.length} limit={10} noun={noun}>
      <CardHeader
        title={`Results by ${noun}`}
        description={`${rows.length} ${noun}s, ${description}`}
        action={<SortMenu value={sort} onChange={setSort} options={options} />}
      />
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[640px] text-left'>
          <thead>
            <tr className='text-label-xs text-text-sub-600'>
              <th className='bg-hover px-4 py-2 font-[550] sm:px-5'>
                {areaLabel}
              </th>
              {live && (
                <th className='bg-hover px-3 py-2 font-[550]'>Reported</th>
              )}
              <th className='bg-hover px-3 py-2 font-[550]'>Leading</th>
              <th className='bg-hover px-3 py-2 text-right font-[550]'>
                Share
              </th>
              <th className='bg-hover px-3 py-2 text-right font-[550]'>
                Margin
              </th>
              <th className='bg-hover px-4 py-2 text-right font-[550] sm:px-5'>
                Votes
              </th>
            </tr>
          </thead>
          <tbody className='divide-stroke-soft-200 divide-y'>
            {sorted.map((r, i) => (
              <tr
                key={r.code}
                className={`${i >= 10 ? 'group-data-[collapsed=true]/tbl:hidden' : ''} text-paragraph-sm text-text-strong-950 hover:bg-hover transition-colors duration-[80ms]`}
              >
                <td className='px-4 py-2.5 sm:px-5'>
                  {r.href ? (
                    <Link href={r.href as Route} className='hover:underline'>
                      {r.name}
                    </Link>
                  ) : (
                    r.name
                  )}
                </td>
                {live && (
                  <td className='px-3 py-2.5'>
                    <div className='flex items-center gap-2'>
                      <MeterBar
                        value={r.reported}
                        color='var(--text-sub-600)'
                        className='w-14'
                      />
                      <span className='tabular text-paragraph-xs text-text-sub-600'>
                        {Math.round(r.reported * 100)}%
                      </span>
                    </div>
                  </td>
                )}
                <td className='px-3 py-2.5'>
                  {r.lead ? (
                    <span className='flex items-center gap-2'>
                      <PartyTag code={r.lead.party} />
                      <span className='text-paragraph-xs text-text-sub-600 hidden truncate md:inline'>
                        {r.lead.name}
                      </span>
                    </span>
                  ) : (
                    <span className='text-paragraph-xs text-text-sub-600'>
                      Awaiting
                    </span>
                  )}
                </td>
                <td className='tabular px-3 py-2.5 text-right'>
                  {r.lead ? pct(r.lead.share) : '—'}
                </td>
                <td className='tabular text-text-sub-600 px-3 py-2.5 text-right'>
                  {r.lead ? `+${pct(r.margin)}` : '—'}
                </td>
                <td className='tabular px-4 py-2.5 text-right sm:px-5'>
                  {r.votes ? fmt(r.votes) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ExpandableCard>
  );
}
