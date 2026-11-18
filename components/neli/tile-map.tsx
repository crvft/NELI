'use client';

import * as React from 'react';
import Link from 'next/link';
import { STATES } from '@/lib/geo';
import { PARTIES, type PartyCode } from '@/lib/parties';
import { cn } from '@/utils/cn';

export type Tile = {
  code: string;
  leader?: { name: string; party: PartyCode; share: number };
  reported?: number; // 0..1
  href?: string;
};

function intensity(share: number) {
  return share >= 0.55 ? 100 : share >= 0.42 ? 72 : 46;
}

/**
 * Tile-grid cartogram of Nigeria's 36 states + FCT. Every state gets an equal
 * tile so small states (Lagos, FCT) are as readable as large ones.
 * Each tile carries its state code and leading party as text — colour is never
 * the only cue.
 */
export function TileMap({ tiles, showReporting = false }: { tiles: Tile[]; showReporting?: boolean }) {
  const [hover, setHover] = React.useState<string | null>(null);
  const byCode = Object.fromEntries(tiles.map((t) => [t.code, t]));
  const parties = Array.from(new Set(tiles.map((t) => t.leader?.party).filter(Boolean))) as PartyCode[];
  const active = hover ? STATES.find((s) => s.code === hover) : null;
  const activeTile = hover ? byCode[hover] : null;

  return (
    <div>
      <div className='relative'>
        <div className='grid grid-cols-7 gap-1 sm:gap-1.5' style={{ gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}>
          {STATES.map((s) => {
            const t = byCode[s.code];
            const lead = t?.leader;
            const color = lead ? PARTIES[lead.party].color : undefined;
            const Comp = t?.href ? Link : 'div';
            return (
              <Comp
                key={s.code}
                href={t?.href ?? '#'}
                onMouseEnter={() => setHover(s.code)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(s.code)}
                onBlur={() => setHover(null)}
                aria-label={`${s.name}: ${lead ? `${lead.party} leading with ${(lead.share * 100).toFixed(0)}%` : 'no results yet'}`}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-lg text-center outline-none transition focus-visible:ring-2 focus-visible:ring-stroke-strong-950',
                  !lead && 'bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200 [background-image:repeating-linear-gradient(135deg,transparent_0_5px,var(--stroke-soft-200)_5px_6px)]',
                  hover && hover !== s.code && 'opacity-60',
                )}
                style={{
                  gridColumn: s.col + 1,
                  gridRow: s.row + 1,
                  background: color ? `color-mix(in oklab, ${color} ${intensity(lead!.share)}%, var(--bg-white-0))` : undefined,
                }}
              >
                <span className='text-label-xs font-semibold text-text-strong-950 sm:text-label-sm'>{s.code}</span>
                {lead && <span className='hidden text-[12px] leading-4 text-text-strong-950 opacity-80 sm:block'>{lead.party}</span>}
                {showReporting && t?.reported !== undefined && t.reported < 1 && t.reported > 0 && (
                  <span className='absolute inset-x-1.5 bottom-1 hidden h-1 overflow-hidden rounded-full bg-bg-white-0 opacity-70 sm:block'>
                    <span className='block h-full rounded-full bg-bg-strong-950' style={{ width: `${t.reported * 100}%` }} />
                  </span>
                )}
              </Comp>
            );
          })}
        </div>
        {active && (
          <div className='pointer-events-none absolute right-0 top-0 z-10 w-56 rounded-xl bg-bg-white-0 p-3 shadow-regular-md ring-1 ring-stroke-soft-200'>
            <div className='text-label-sm text-text-strong-950'>{active.name}</div>
            {activeTile?.leader ? (
              <>
                <div className='mt-1.5 flex items-center gap-1.5 text-paragraph-xs text-text-sub-600'>
                  <span className='size-2 rounded-full' style={{ background: PARTIES[activeTile.leader.party].color }} />
                  <span className='truncate'>{activeTile.leader.name}</span>
                </div>
                <div className='tabular mt-1 text-label-sm text-text-strong-950'>
                  {activeTile.leader.party} · {(activeTile.leader.share * 100).toFixed(1)}%
                </div>
              </>
            ) : (
              <div className='mt-1 text-paragraph-xs text-text-sub-600'>No results yet</div>
            )}
            {showReporting && activeTile?.reported !== undefined && (
              <div className='tabular mt-1 text-paragraph-xs text-text-soft-400'>{Math.round(activeTile.reported * 100)}% of polling units reported</div>
            )}
          </div>
        )}
      </div>
      <div className='mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-paragraph-xs text-text-sub-600'>
        {parties.map((p) => (
          <span key={p} className='inline-flex items-center gap-1.5'>
            <span className='size-2.5 rounded-sm' style={{ background: PARTIES[p].color }} />
            {p} leading
          </span>
        ))}
        <span className='inline-flex items-center gap-1.5'>
          <span className='size-2.5 rounded-sm bg-bg-weak-50 ring-1 ring-inset ring-stroke-sub-300 [background-image:repeating-linear-gradient(135deg,transparent_0_2px,var(--stroke-sub-300)_2px_3px)]' />
          Awaiting results
        </span>
        <span className='inline-flex items-center gap-1.5 text-text-soft-400'>Darker tile = bigger lead</span>
      </div>
    </div>
  );
}
