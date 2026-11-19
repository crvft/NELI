'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import * as SegmentedControl from '@/components/ui/segmented-control';
import { IconChevronRight } from '@/components/icons';
import { PARTIES, type PartyCode } from '@/lib/parties';
import { Card, CardHeader } from './card';
import { PartyTag } from './party';

export type LegislativeRace = {
  id: string;
  district: string;
  winner: string;
  party: PartyCode;
  share?: number; // winner's share when votes are on record
  margin?: number;
  coverage: 'all candidates' | 'top candidates only' | 'winner only';
  conflict?: boolean;
};
export type LegislativeYear = { year: number; races: LegislativeRace[] };

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/**
 * Senate or House of Reps results for one state: a year picker, seats won by party,
 * and every district with its winner. Vote shares appear where the source has them;
 * otherwise the row says only the winner is on record.
 */
export function LegislativeView({
  chamber,
  years,
  name,
  control,
}: {
  chamber: 'senate' | 'reps';
  years: LegislativeYear[];
  name: string;
  control: React.ReactNode;
}) {
  const [year, setYear] = React.useState(String(years[years.length - 1]?.year ?? ''));
  const sel = years.find((y) => String(y.year) === year) ?? years[years.length - 1];
  const label = chamber === 'senate' ? 'Senate' : 'House of Reps';
  const seat = chamber === 'senate' ? 'senatorial district' : sel && sel.races.length === 1 ? 'federal constituency' : 'federal constituencies';
  const seats = new Map<PartyCode, number>();
  for (const r of sel?.races ?? []) seats.set(r.party, (seats.get(r.party) ?? 0) + 1);
  const withVotes = sel?.races.filter((r) => r.coverage !== 'winner only').length ?? 0;

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2'>
          {control}
          <p className='text-paragraph-sm text-text-sub-600'>
            {label} elections in {name}, {years[0]?.year}–{years[years.length - 1]?.year}.
          </p>
        </div>
        <div className='no-scrollbar -mx-4 max-w-[calc(100%+2rem)] overflow-x-auto px-4 lg:mx-0 lg:max-w-full lg:px-0'>
          <SegmentedControl.Root value={year} onValueChange={setYear}>
            <SegmentedControl.List className='w-max auto-cols-max' aria-label='Election year'>
              {years.map((y) => (
                <SegmentedControl.Trigger key={y.year} value={String(y.year)} className='px-3'>
                  {y.year}
                </SegmentedControl.Trigger>
              ))}
            </SegmentedControl.List>
          </SegmentedControl.Root>
        </div>
      </div>

      {sel && (
        <>
          <Card className='flex flex-col gap-3 p-4 sm:p-5'>
            <div className='flex flex-wrap items-baseline justify-between gap-2'>
              <h2 className='text-label-md text-text-strong-950'>
                Seats won in {sel.year} · {sel.races.length} {seat}
                {sel.races.length === 1 ? '' : chamber === 'reps' ? '' : 's'}
              </h2>
              <span className='text-paragraph-xs text-text-sub-600'>
                Vote counts on record for {withVotes} of {sel.races.length}
              </span>
            </div>
            <div className='bg-hover flex h-2.5 overflow-hidden rounded-full'>
              {[...seats.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([p, n]) => (
                  <div key={p} style={{ width: `${(n / sel.races.length) * 100}%`, background: PARTIES[p].color }} title={`${p}: ${n}`} />
                ))}
            </div>
            <div className='flex flex-wrap gap-x-4 gap-y-1.5'>
              {[...seats.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([p, n]) => (
                  <span key={p} className='text-paragraph-xs text-text-sub-600 flex items-center gap-1.5'>
                    <span className='size-2 rounded-full' style={{ background: PARTIES[p].color }} aria-hidden />
                    <span className='text-label-xs text-text-strong-950'>{p}</span> {n}
                  </span>
                ))}
            </div>
          </Card>

          <Card>
            <CardHeader title={`${label} results, ${sel.year}`} description='Winner in each district; share and margin where the vote count is on record' />
            <ul className='divide-stroke-soft-200 divide-y'>
              {sel.races
                .slice()
                .sort((a, b) => a.district.localeCompare(b.district))
                .map((r) => (
                  <li key={r.id}>
                    <Link href={`/elections/${r.id}` as Route} className='hover:bg-hover flex items-center gap-3 px-4 py-3 transition-colors duration-[80ms] sm:px-5'>
                      <div className='min-w-0 flex-1'>
                        <div className='text-label-sm text-text-strong-950 truncate'>{r.district}</div>
                        <div className='text-paragraph-xs text-text-sub-600 mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2'>
                          <span className='truncate'>{r.winner}</span>
                          {r.conflict && <span className='text-warning-dark'>· source figures disagree</span>}
                        </div>
                      </div>
                      <PartyTag code={r.party} />
                      <div className='w-24 shrink-0 text-right'>
                        {r.share != null ? (
                          <>
                            <div className='tabular text-label-sm text-text-strong-950'>{pct(r.share)}</div>
                            <div className='tabular text-paragraph-xs text-text-sub-600'>{r.margin != null ? `+${(r.margin * 100).toFixed(1)} pts` : ''}</div>
                          </>
                        ) : (
                          <div className='text-paragraph-xs text-text-sub-600'>Winner only</div>
                        )}
                      </div>
                      <IconChevronRight className='text-text-sub-600 size-4 shrink-0' />
                    </Link>
                  </li>
                ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
