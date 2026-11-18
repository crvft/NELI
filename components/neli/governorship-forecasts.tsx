'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { motion } from 'motion/react';
import { IconChevronDown, IconChevronRight } from '@/components/icons';
import { PARTIES, type PartyCode } from '@/lib/parties';
import { ZONES } from '@/lib/geo';
import { spring } from '@/lib/motion';
import { Card } from './card';
import { SortMenu, useSorted, type SortOption } from './sort-menu';

export type GovForecastCard = {
  id: string;
  state: string;
  stateCode: string;
  zone: string;
  openSeat: boolean;
  byParty: boolean;
  rows: { personId: string; name: string; party: PartyCode; prob: number; share: number }[];
};

type Sort = 'closest' | 'safest' | 'name' | 'zone';
const SORTS: SortOption<Sort>[] = [
  { value: 'closest', label: 'Closest race' },
  { value: 'safest', label: 'Most certain' },
  { value: 'name', label: 'State (A–Z)' },
  { value: 'zone', label: 'Zone' },
];
const zoneOrder = (z: string) => ZONES.findIndex((x) => x.code === z);
const SORTERS: Record<Sort, (a: GovForecastCard, b: GovForecastCard) => number> = {
  closest: (a, b) => a.rows[0].prob - b.rows[0].prob,
  safest: (a, b) => b.rows[0].prob - a.rows[0].prob,
  name: (a, b) => a.state.localeCompare(b.state),
  zone: (a, b) => zoneOrder(a.zone) - zoneOrder(b.zone) || a.state.localeCompare(b.state),
};
const COLLAPSED = 6;
const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * The governorship forecasts as one section: six cards, then "Show all". Sorting
 * applies to the whole list, so "Closest race" surfaces the competitive states first.
 */
export function GovernorshipForecasts({ cards }: { cards: GovForecastCard[] }) {
  const [sort, setSort] = React.useState<Sort>('closest');
  const [open, setOpen] = React.useState(false);
  const sorted = useSorted(cards, sort, SORTERS);
  const shown = open ? sorted : sorted.slice(0, COLLAPSED);
  const favourites = new Map<PartyCode, number>();
  for (const c of cards) favourites.set(c.rows[0].party, (favourites.get(c.rows[0].party) ?? 0) + 1);

  return (
    <section aria-labelledby='gov-heading' className='flex flex-col gap-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h2 id='gov-heading' className='text-title-h6 text-text-strong-950 tracking-tight'>
            Governorship
          </h2>
          <p className='text-paragraph-sm text-text-sub-600 mt-1'>
            {cards.length} states · Favourite in{' '}
            {[...favourites.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([p, n], i) => (
                <span key={p}>
                  {i > 0 && ', '}
                  <span style={{ color: PARTIES[p].text }}>{p}</span> {n}
                </span>
              ))}
          </p>
        </div>
        <SortMenu value={sort} onChange={setSort} options={SORTS} />
      </div>

      <ul className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
        {shown.map((c, i) => (
          <motion.li
            key={c.id}
            layout='position'
            initial={i >= COLLAPSED ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={spring.moderate}
          >
            <Link href={`/elections/${c.id}` as Route} className='group block h-full'>
              <Card className='flex h-full flex-col gap-3 p-4 transition-colors duration-[80ms] group-hover:bg-hover'>
                <div className='flex items-start justify-between gap-2'>
                  <div className='min-w-0'>
                    <div className='text-label-sm text-text-strong-950 truncate'>{c.state}</div>
                    <div className='text-paragraph-xs text-text-sub-600 mt-0.5'>
                      {c.openSeat ? 'Open seat' : 'Governor eligible'}
                      {c.byParty ? ' · by party' : ''}
                    </div>
                  </div>
                  <IconChevronRight className='text-text-sub-600 size-4 shrink-0 transition-transform duration-[80ms] group-hover:translate-x-0.5' />
                </div>
                <ul className='flex flex-col gap-2'>
                  {c.rows.slice(0, 3).map((r, j) => (
                    <li key={r.personId} className='flex flex-col gap-1'>
                      <div className='flex items-center justify-between gap-2'>
                        <span className={`flex min-w-0 items-center gap-1.5 ${j === 0 ? 'text-label-xs text-text-strong-950' : 'text-paragraph-xs text-text-sub-600'}`}>
                          <span className='size-2 shrink-0 rounded-full' style={{ background: PARTIES[r.party].color }} aria-hidden />
                          <span className='truncate'>{r.name}</span>
                        </span>
                        <span className={`tabular shrink-0 ${j === 0 ? 'text-label-xs text-text-strong-950' : 'text-paragraph-xs text-text-sub-600'}`}>{pct(r.prob)}</span>
                      </div>
                      <div className='bg-hover h-1 overflow-hidden rounded-full'>
                        <div className='h-full rounded-full' style={{ width: `${r.prob * 100}%`, background: PARTIES[r.party].color }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </Link>
          </motion.li>
        ))}
      </ul>

      {cards.length > COLLAPSED && (
        <button
          type='button'
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className='hit bg-surface-2 text-label-sm text-text-sub-600 shadow-surface-2 hover:bg-hover hover:text-text-strong-950 mx-auto inline-flex h-9 items-center gap-1.5 rounded-10 px-4 transition-colors duration-[80ms]'
        >
          {open ? 'Show fewer' : `Show all ${cards.length} states`}
          <IconChevronDown className={`size-4 transition-transform duration-[160ms] ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    </section>
  );
}
