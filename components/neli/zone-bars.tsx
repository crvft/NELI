import { PARTIES } from '@/lib/parties';
import { fmtCompact, pct, type Tally } from '@/lib/analytics';
import type { ZONES } from '@/lib/geo';
import { ShareBar } from './share-bar';

/** One stacked share bar per geopolitical zone, with the leader labelled in text. */
export function ZoneBars({ rows }: { rows: { zone: (typeof ZONES)[number]; tally: Tally[] }[] }) {
  return (
    <ul className='flex flex-col gap-4'>
      {rows.map(({ zone, tally }) => {
        const total = tally.reduce((a, b) => a + b.votes, 0);
        const lead = tally[0];
        return (
          <li key={zone.code}>
            <div className='mb-1.5 flex items-baseline justify-between gap-2'>
              <span className='text-label-sm text-text-strong-950'>{zone.name}</span>
              {total > 0 ? (
                <span className='tabular flex items-center gap-1.5 text-paragraph-xs text-text-sub-600'>
                  <span className='size-2 rounded-full' style={{ background: PARTIES[lead.party].color }} />
                  {lead.party} {pct(lead.share)}
                  <span className='text-text-sub-600'>· {fmtCompact(total)} votes</span>
                </span>
              ) : (
                <span className='text-paragraph-xs text-text-sub-600'>No results yet</span>
              )}
            </div>
            <ShareBar tally={tally} height='h-2.5' />
          </li>
        );
      })}
    </ul>
  );
}

/** Where a candidate's votes came from: share of their total, per zone/area. */
export function SourceBars({ rows, color }: { rows: { key: string; label: string; votes: number; pct: number }[]; color: string }) {
  const max = Math.max(...rows.map((r) => r.pct), 0.0001);
  return (
    <ul className='flex flex-col gap-2.5'>
      {rows.map((r) => (
        <li key={r.key} className='grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3'>
          <span className='truncate text-paragraph-xs text-text-sub-600'>{r.label}</span>
          <span className='h-2 overflow-hidden rounded-full bg-bg-soft-200'>
            <span className='block h-full rounded-full' style={{ width: `${(r.pct / max) * 100}%`, background: color }} />
          </span>
          <span className='tabular w-12 text-right text-label-xs text-text-strong-950'>{pct(r.pct, 0)}</span>
        </li>
      ))}
    </ul>
  );
}
