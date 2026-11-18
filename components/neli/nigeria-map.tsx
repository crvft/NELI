'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { IconBack, IconCursor, IconExternal } from '@/components/icons';
import shapes from '@/lib/map-shapes.json';
import { PARTIES, type PartyCode } from '@/lib/parties';
import type { MapPayload, MapState } from '@/lib/map-data';
import { cn } from '@/utils/cn';

type Shapes = {
  width: number;
  height: number;
  states: Record<string, { d: string; cx: number; cy: number }>;
  neighbours: { name: string; d: string; cx: number; cy: number }[];
  nigeria: string;
};
const S = shapes as Shapes;

function strength(m: number) {
  return m >= 0.2 ? 'strong' : m >= 0.08 ? 'clear' : 'narrow';
}

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const fmt = (n: number) => n.toLocaleString('en-NG');
const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : String(n));

// Callout placement for the six geopolitical zones, in map (viewBox) units.
// Labels sit over the washed-out neighbours and sea, like an editorial atlas.
const CALLOUTS: Record<string, { lx: number; ly: number; align: 'left' | 'right' }> = {
  NW: { lx: 16, ly: 96, align: 'left' },
  NE: { lx: 984, ly: 96, align: 'right' },
  NC: { lx: 16, ly: 300, align: 'left' },
  SW: { lx: 16, ly: 560, align: 'left' },
  SE: { lx: 984, ly: 740, align: 'right' },
  SS: { lx: 16, ly: 790, align: 'left' },
};
const NEIGHBOUR_LABELS: Record<string, [number, number]> = {
  Niger: [520, 64],
  Chad: [930, 330],
  Cameroon: [855, 590],
  Benin: [130, 430],
};

export function NigeriaMap({ data, overview, title, footer }: { data: MapPayload; overview: React.ReactNode; title?: React.ReactNode; footer?: React.ReactNode }) {
  const [hover, setHover] = React.useState<{ code: string; x: number; y: number } | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [wide, setWide] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  // On small screens the zone callouts are hidden, so crop tight to Nigeria.
  const viewBox = wide ? `0 0 ${S.width} ${S.height}` : '185 80 700 690';
  const byCode = React.useMemo(() => Object.fromEntries(data.states.map((s) => [s.code, s])), [data.states]);

  const anchors = React.useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const z of data.zones) {
      const ss = data.states.filter((s) => s.zone === z.code);
      out[z.code] = [ss.reduce((a, s) => a + S.states[s.code].cx, 0) / ss.length, ss.reduce((a, s) => a + S.states[s.code].cy, 0) / ss.length];
    }
    return out;
  }, [data]);

  const usedParties = Array.from(new Set(data.states.filter((s) => s.total > 0).map((s) => s.candidates[0].party))) as PartyCode[];

  function select(code: string) {
    setSelected(code);
    if (window.matchMedia('(max-width: 1023px)').matches) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function pointer(ev: React.PointerEvent, code: string) {
    if (ev.pointerType !== 'mouse') return;
    const r = wrapRef.current!.getBoundingClientRect();
    setHover({ code, x: ev.clientX - r.left, y: ev.clientY - r.top });
  }

  function fillFor(s: MapState) {
    if (!s.total) return `url(#empty)`;
    const p = s.candidates[0].party;
    const k = strength(s.margin);
    if (k === 'strong') return PARTIES[p].color;
    if (k === 'clear') return `color-mix(in oklab, ${PARTIES[p].color} 48%, var(--bg-white-0))`;
    return `url(#hatch-${p})`;
  }

  const hs = hover ? byCode[hover.code] : null;
  const sel = selected ? byCode[selected] : null;

  return (
    <div className='grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]'>
      <div className='relative min-w-0 border-stroke-soft-200 p-4 sm:p-6 lg:border-r'>
        {title}
        <div ref={wrapRef} className='relative' onPointerLeave={() => setHover(null)}>
          <svg viewBox={viewBox} className='block h-auto w-full' role='group' aria-label='Map of Nigeria showing the leading party in each state'>
            <defs>
              {(Object.keys(PARTIES) as PartyCode[]).map((p) => (
                <pattern key={p} id={`hatch-${p}`} width='7' height='7' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>
                  <rect width='7' height='7' fill={`color-mix(in oklab, ${PARTIES[p].color} 14%, var(--bg-white-0))`} />
                  <line x1='0' y1='0' x2='0' y2='7' stroke={PARTIES[p].color} strokeWidth='2.6' />
                </pattern>
              ))}
              <radialGradient id='fade' cx='50%' cy='50%' r='62%'>
                <stop offset='55%' stopColor='white' stopOpacity='1' />
                <stop offset='100%' stopColor='white' stopOpacity='0' />
              </radialGradient>
              <mask id='fade-mask'>
                <rect {...(() => { const [x, y, width, height] = viewBox.split(' ').map(Number); return { x, y, width, height }; })()} fill='url(#fade)' />
              </mask>
              <pattern id='empty' width='6' height='6' patternUnits='userSpaceOnUse'>
                <rect width='6' height='6' fill='var(--map-state-empty)' />
                <circle cx='3' cy='3' r='0.8' fill='var(--text-soft-400)' opacity='0.6' />
              </pattern>
            </defs>

            {/* neighbours, washed out */}
            <g aria-hidden mask='url(#fade-mask)'>
              {S.neighbours.map((n) => (
                <path key={n.name} d={n.d} fill='var(--map-neighbour)' stroke='var(--map-neighbour-stroke)' strokeWidth='1' />
              ))}
            </g>

            {/* states */}
            <g>
              {data.states.map((s) => {
                const shape = S.states[s.code];
                const lead = s.candidates[0];
                return (
                  <path
                    key={s.code}
                    d={shape.d}
                    fill={fillFor(s)}
                    stroke='var(--map-state-stroke)'
                    strokeWidth={1.2}
                    strokeLinejoin='round'
                    tabIndex={0}
                    role='button'
                    aria-pressed={selected === s.code}
                    aria-label={`${s.name}: ${s.total ? `${lead.party} leading with ${pct(lead.share)}, ${pct(s.margin)} ahead` : 'awaiting results'}`}
                    className={cn(
                      'cursor-pointer outline-hidden transition-opacity duration-150',
                      hover && hover.code !== s.code && 'opacity-55',
                      selected && selected !== s.code && !hover && 'opacity-70',
                    )}
                    onPointerMove={(ev) => pointer(ev, s.code)}
                    onPointerEnter={(ev) => pointer(ev, s.code)}
                    onClick={() => select(s.code)}
                    onFocus={() => {
                      const r = wrapRef.current!.getBoundingClientRect();
                      const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
                      setHover({ code: s.code, x: ((shape.cx - vx) / vw) * r.width, y: ((shape.cy - vy) / vh) * r.height });
                    }}
                    onBlur={() => setHover(null)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        select(s.code);
                      }
                    }}
                  />
                );
              })}
            </g>
            {/* emphasis outlines drawn on top */}
            <path d={S.nigeria} fill='none' stroke='var(--text-strong-950)' strokeOpacity='0.55' strokeWidth='1.4' strokeLinejoin='round' pointerEvents='none' />
            {(hover || selected) && (
              <path
                d={S.states[(hover?.code ?? selected)!].d}
                fill='none'
                stroke='var(--text-strong-950)'
                strokeWidth='2.4'
                strokeLinejoin='round'
                pointerEvents='none'
              />
            )}

            {/* zone callout leader lines */}
            <g className='hidden md:inline' aria-hidden>
              {data.zones.map((z) => {
                const [ax, ay] = anchors[z.code];
                const c = CALLOUTS[z.code];
                const ruleEnd = c.align === 'left' ? c.lx + 140 : c.lx - 140;
                return (
                  <g key={z.code}>
                    <polyline points={`${ax},${ay} ${ax},${c.ly} ${ruleEnd},${c.ly}`} fill='none' stroke='var(--text-sub-600)' strokeWidth='0.9' />
                    <line x1={c.lx} x2={ruleEnd} y1={c.ly} y2={c.ly} stroke='var(--text-sub-600)' strokeWidth='0.9' />
                    <circle cx={ax} cy={ay} r='3.2' fill='var(--bg-white-0)' stroke='var(--text-strong-950)' strokeWidth='1.4' />
                  </g>
                );
              })}
            </g>
          </svg>

          {/* HTML overlays keep text at real pixel sizes (12px+) at any map width */}
          <div className='pointer-events-none absolute inset-0 hidden md:block'>
            {Object.entries(NEIGHBOUR_LABELS).map(([n, [x, y]]) => (
              <span
                key={n}
                aria-hidden
                className='absolute -translate-x-1/2 -translate-y-1/2 text-[12px] text-text-sub-600'
                style={{ left: `${(x / S.width) * 100}%`, top: `${(y / S.height) * 100}%` }}
              >
                {n}
              </span>
            ))}
            <span aria-hidden className='absolute text-[12px] italic text-text-sub-600' style={{ left: '34%', top: '94%' }}>
              Gulf of Guinea
            </span>
            {data.zones.map((z) => {
              const c = CALLOUTS[z.code];
              return (
                <Link
                  key={z.code}
                  href={`/zones/${z.code.toLowerCase()}` as Route}
                  aria-label={`${z.name} zone analytics`}
                  className={cn(
                    'pointer-events-auto absolute w-[15%] min-w-[128px] -translate-y-full rounded-md pb-1 transition-opacity duration-[80ms] hover:opacity-70',
                    c.align === 'right' && '-translate-x-full text-right',
                  )}
                  style={{ left: `${(c.lx / S.width) * 100}%`, top: `${(c.ly / S.height) * 100}%` }}
                >
                  <div className='text-[12px] font-[550] leading-4' style={{ color: z.lead ? PARTIES[z.lead.party].text : 'var(--text-sub-600)' }}>
                    {z.name}
                  </div>
                  <div className='tabular text-[12px] leading-4 text-text-sub-600'>{z.lead ? `${z.lead.party} ${pct(z.lead.share)} · ${compact(z.total)}` : 'Awaiting results'}</div>
                </Link>
              );
            })}
          </div>

          {/* tooltip */}
          {hs && hover && (
            <div
              className='pointer-events-none absolute z-20 w-64 rounded-xl bg-surface-4 p-3.5 shadow-surface-4'
              style={{
                // keep the 256px tooltip inside the map without reading layout during render
                left: `min(${hover.x + 16}px, calc(100% - 16.5rem))`,
                top: Math.max(0, hover.y - 20),
              }}
              role='tooltip'
            >
              <StateTooltip s={hs} live={data.live} />
            </div>
          )}
        </div>

        {/* legend */}
        <div className='mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-stroke-soft-200 pt-4'>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
            {usedParties.map((p) => (
              <span key={p} className='inline-flex items-center gap-1.5 text-label-xs text-text-sub-600'>
                <span className='size-3 rounded-sm' style={{ background: PARTIES[p].color }} />
                {p}
              </span>
            ))}
          </div>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-2 text-paragraph-xs text-text-sub-600'>
            <LegendSwatch kind='strong' /> 20+ pt lead
            <LegendSwatch kind='clear' /> 8–20 pts
            <LegendSwatch kind='narrow' /> Under 8 pts
            {data.live && (
              <>
                <LegendSwatch kind='empty' /> Awaiting
              </>
            )}
          </div>
        </div>
        <p className='mt-3 flex items-center gap-1.5 text-paragraph-xs text-text-sub-600'>
          <IconCursor className='size-4' /> Hover a state for a quick look. Click or tap it for the full breakdown.
        </p>
        {footer}
      </div>

      <aside ref={panelRef} className='min-w-0 scroll-mt-20 border-t border-stroke-soft-200 lg:border-t-0' aria-live='polite'>
        {sel ? <StatePanel s={sel} live={data.live} onBack={() => setSelected(null)} /> : overview}
      </aside>
    </div>
  );
}

function LegendSwatch({ kind }: { kind: 'strong' | 'clear' | 'narrow' | 'empty' }) {
  const c = 'var(--text-sub-600)';
  return (
    <svg width='16' height='12' className='shrink-0 rounded-sm' aria-hidden>
      {kind === 'strong' && <rect width='16' height='12' fill={c} />}
      {kind === 'clear' && <rect width='16' height='12' fill={`color-mix(in oklab, ${c} 48%, var(--bg-white-0))`} />}
      {kind === 'narrow' && (
        <>
          <rect width='16' height='12' fill={`color-mix(in oklab, ${c} 14%, var(--bg-white-0))`} />
          {[-8, -3, 2, 7, 12, 17].map((o) => (
            <line key={o} x1={o} y1='12' x2={o + 12} y2='0' stroke={c} strokeWidth='1.8' />
          ))}
        </>
      )}
      {kind === 'empty' && <rect width='16' height='12' fill='var(--map-state-empty)' stroke='var(--stroke-sub-300)' />}
    </svg>
  );
}

function StateTooltip({ s, live }: { s: MapState; live: boolean }) {
  const [a, b] = s.candidates;
  return (
    <>
      <div className='flex items-baseline justify-between gap-2'>
        <span className='text-label-sm text-text-strong-950'>{s.name}</span>
        <span className='text-paragraph-xs text-text-sub-600'>{s.zoneName}</span>
      </div>
      {s.total ? (
        <>
          <div className='mt-2.5 flex items-center gap-2'>
            <span className='size-2.5 rounded-full' style={{ background: PARTIES[a.party].color }} />
            <span className='truncate text-label-sm text-text-strong-950'>{a.name}</span>
            <span className='tabular ml-auto text-label-sm text-text-strong-950'>{pct(a.share)}</span>
          </div>
          <div className='mt-1 text-paragraph-xs text-text-sub-600'>
            {a.party} leads {b ? <>by <span className='tabular text-text-strong-950'>{(s.margin * 100).toFixed(1)} pts</span> over {b.party}</> : ''}
          </div>
          <ul className='mt-2.5 flex flex-col gap-1.5'>
            {s.candidates.slice(0, 3).map((c) => (
              <li key={c.personId} className='grid grid-cols-[2.5rem_1fr_3rem] items-center gap-2 text-paragraph-xs text-text-sub-600'>
                <span>{c.party}</span>
                <span className='h-1.5 overflow-hidden rounded-full bg-bg-soft-200'>
                  <span className='block h-full rounded-full' style={{ width: `${c.share * 100}%`, background: PARTIES[c.party].color }} />
                </span>
                <span className='tabular text-right'>{pct(c.share, 0)}</span>
              </li>
            ))}
          </ul>
          <div className='tabular mt-2.5 flex justify-between border-t border-stroke-soft-200 pt-2 text-paragraph-xs text-text-sub-600'>
            <span>{compact(s.total)} votes</span>
            {live ? <span>{pct(s.reported, 0)} reported</span> : <span>{pct(s.turnout, 0)} turnout</span>}
          </div>
        </>
      ) : (
        <p className='mt-2 text-paragraph-xs text-text-sub-600'>No polling-unit results uploaded yet.</p>
      )}
    </>
  );
}

function StatePanel({ s, live, onBack }: { s: MapState; live: boolean; onBack: () => void }) {
  const lead = s.candidates[0];
  return (
    <div className='flex flex-col'>
      <div className='flex items-center justify-between gap-2 border-b border-stroke-soft-200 px-4 py-3 sm:px-5'>
        <button type='button' onClick={onBack} className='inline-flex items-center gap-1.5 rounded-lg py-1 text-label-sm text-text-sub-600 hover:text-text-strong-950'>
          <IconBack className='size-4' /> All of Nigeria
        </button>
        <Link href={`/states/${s.code}` as Route} className='inline-flex items-center gap-1 text-label-sm text-text-sub-600 hover:text-text-strong-950'>
          State page <IconExternal className='size-4' />
        </Link>
      </div>
      <div className='px-4 py-5 sm:px-5'>
        <h3 className='text-title-h5 tracking-tight text-text-strong-950'>{s.name}</h3>
        <p className='text-paragraph-sm text-text-sub-600'>
          {s.zoneName} · Capital: {s.capital}
        </p>

        {s.total ? (
          <div className='mt-4 rounded-xl p-3.5 shadow-surface-2' style={{ background: `color-mix(in oklab, ${PARTIES[lead.party].color} 8%, var(--bg-white-0))` }}>
            <div className='text-paragraph-xs text-text-sub-600'>{live ? 'Leading' : 'Won'}</div>
            <div className='mt-0.5 text-label-md text-text-strong-950'>{lead.name}</div>
            <div className='tabular mt-0.5 text-paragraph-sm' style={{ color: PARTIES[lead.party].text }}>
              {lead.party} · {pct(lead.share)} · +{(s.margin * 100).toFixed(1)} pts
            </div>
          </div>
        ) : (
          <p className='mt-4 text-paragraph-sm text-text-sub-600'>No results uploaded from {s.name} yet.</p>
        )}

        <dl className='mt-5 grid grid-cols-2 gap-x-4 gap-y-4'>
          <Fact label='Votes counted' value={fmt(s.total)} />
          <Fact label='Registered voters' value={compact(s.registered)} />
          <Fact label={live ? 'Polling units reported' : 'Reported'} value={pct(s.reported, 0)} />
          <Fact label='Turnout' value={s.total ? pct(s.turnout) : '—'} />
        </dl>
      </div>

      {s.total > 0 && (
        <div className='border-t border-stroke-soft-200 px-4 py-5 sm:px-5'>
          <h4 className='mb-3 text-label-sm text-text-strong-950'>All candidates in {s.name}</h4>
          <ul className='flex flex-col gap-3.5'>
            {s.candidates.map((c) => (
              <li key={c.personId}>
                <div className='flex items-baseline justify-between gap-2'>
                  <Link href={`/politicians/${c.personId}`} className='truncate text-label-sm text-text-strong-950 hover:underline'>
                    {c.name}
                  </Link>
                  <span className='tabular text-label-sm text-text-strong-950'>{pct(c.share)}</span>
                </div>
                <div className='mt-1.5 flex items-center gap-2'>
                  <span className='w-10 text-paragraph-xs text-text-sub-600'>{c.party}</span>
                  <span className='h-1.5 flex-1 overflow-hidden rounded-full bg-bg-soft-200'>
                    <span className='block h-full rounded-full' style={{ width: `${c.share * 100}%`, background: PARTIES[c.party].color }} />
                  </span>
                  <span className='tabular w-16 text-right text-paragraph-xs text-text-sub-600'>{compact(c.votes)}</span>
                </div>
                {c.share >= 0.25 && <div className='mt-1 text-paragraph-xs text-success-base'>Meets 25% here</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className='text-paragraph-xs text-text-sub-600'>{label}</dt>
      <dd className='tabular mt-0.5 text-label-md text-text-strong-950'>{value}</dd>
    </div>
  );
}
