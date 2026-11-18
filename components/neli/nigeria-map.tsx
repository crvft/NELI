'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { IconBack, IconCursor, IconExternal } from '@/components/icons';
import shapes from '@/lib/map-shapes.json';
import { spring } from '@/lib/motion';
import { PARTIES, type PartyCode } from '@/lib/parties';
import type { MapPayload, MapState } from '@/lib/map-data';
import {
  lgaResults,
  loadLgaShapes,
  type LgaResult,
  type LgaShapes,
} from '@/lib/lga';
import { cn } from '@/utils/cn';
import { SortMenu, useSorted, type SortOption } from './sort-menu';

type Shapes = {
  width: number;
  height: number;
  states: Record<
    string,
    { d: string; cx: number; cy: number; box: [number, number, number, number] }
  >;
  neighbours: { name: string; d: string; cx: number; cy: number }[];
  nigeria: string;
};
const S = shapes as unknown as Shapes;

const strength = (m: number) =>
  m >= 0.2 ? 'strong' : m >= 0.08 ? 'clear' : 'narrow';
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const fmt = (n: number) => n.toLocaleString('en-NG');
const compact = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(2)}M`
    : n >= 1e3
      ? `${(n / 1e3).toFixed(0)}K`
      : String(n);

/** Full frame on wide screens (room for zone labels); tight on Nigeria on phones. */
const VIEW_WIDE: Box = [0, 0, S.width, S.height];
const VIEW_TIGHT: Box = [108, 64, 864, 708];
type Box = [number, number, number, number];
const toViewBox = (b: Box) => b.map((v) => Math.round(v * 100) / 100).join(' ');

/** Frame a state with breathing room, matched to the map's aspect ratio. */
function frameState(code: string, aspect: number): Box {
  const [x, y, w, h] = S.states[code].box;
  const pad = Math.max(w, h) * 0.14;
  let fw = w + pad * 2;
  let fh = h + pad * 2;
  if (fw / fh > aspect) fh = fw / aspect;
  else fw = fh * aspect;
  return [x + w / 2 - fw / 2, y + h / 2 - fh / 2, fw, fh];
}

// Zone labels sit in the empty corners (Niger to the north, the Gulf of Guinea and
// Cameroon to the south), joined to their zone by a leader line.
const CALLOUTS: Record<
  string,
  { lx: number; ly: number; align: 'left' | 'right' }
> = {
  NW: { lx: 14, ly: 64, align: 'left' },
  NE: { lx: 986, ly: 64, align: 'right' },
  SW: { lx: 14, ly: 692, align: 'left' },
  SS: { lx: 14, ly: 794, align: 'left' },
  NC: { lx: 986, ly: 692, align: 'right' },
  SE: { lx: 986, ly: 794, align: 'right' },
};
const NEIGHBOUR_LABELS: Record<string, [number, number]> = {
  Niger: [520, 40],
  Benin: [58, 380],
  Cameroon: [880, 560],
};

type Hover = { kind: 'state' | 'lga'; id: string; x: number; y: number };

export function NigeriaMap({
  data,
  overview,
  title,
  footer,
}: {
  data: MapPayload;
  overview: React.ReactNode;
  title?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [hover, setHover] = React.useState<Hover | null>(null);
  const [focus, setFocus] = React.useState<string | null>(null);
  const [lgaShapes, setLgaShapes] = React.useState<LgaShapes | null>(null);
  const [lgaError, setLgaError] = React.useState(false);
  const [listHover, setListHover] = React.useState<string | null>(null);
  // Desktop: hovering a zone label greys out the states outside that zone.
  const [zoneHover, setZoneHover] = React.useState<string | null>(null);
  // True while the camera is moving; hover is ignored so nothing pops up mid-flight.
  const [moving, setMoving] = React.useState(false);
  React.useEffect(() => {
    if (!moving) return;
    // Fallback in case the camera had nowhere to go and no animation completes.
    const t = window.setTimeout(() => setMoving(false), 900);
    return () => window.clearTimeout(t);
  }, [moving]);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const [wide, setWide] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const base = wide ? VIEW_WIDE : VIEW_TIGHT;
  const camera: Box = focus ? frameState(focus, base[2] / base[3]) : base;
  const zoom = base[2] / camera[2];

  const byCode = React.useMemo(
    () => Object.fromEntries(data.states.map((s) => [s.code, s])),
    [data.states],
  );
  const focused = focus ? byCode[focus] : null;

  // Load the focused state's LGAs (cached per session). Results are derived, not stored.
  React.useEffect(() => {
    if (!focus) return;
    let alive = true;
    loadLgaShapes(focus)
      .then((s) => alive && setLgaShapes(s))
      .catch(() => alive && setLgaError(true));
    return () => {
      alive = false;
    };
  }, [focus]);
  const lgaShapesForFocus =
    lgaShapes && lgaShapes.state === focus ? lgaShapes : null;
  const lgas = React.useMemo<LgaResult[] | null>(
    () =>
      focused && lgaShapesForFocus
        ? lgaResults(focused, lgaShapesForFocus.lgas, data.electionId)
        : null,
    [focused, lgaShapesForFocus, data.electionId],
  );
  const lgaById = React.useMemo(
    () => Object.fromEntries((lgas ?? []).map((l) => [l.id, l])),
    [lgas],
  );

  const open = React.useCallback(
    (code: string) => {
      setHover(null);
      setLgaError(false);
      if (!reduced) setMoving(true);
      setFocus(code);
    },
    [reduced],
  );
  const back = React.useCallback(() => {
    setHover(null);
    setListHover(null);
    if (!reduced) setMoving(true);
    setFocus(null);
  }, [reduced]);

  React.useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && back();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, back]);

  const anchors = React.useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const z of data.zones) {
      const ss = data.states.filter((s) => s.zone === z.code);
      out[z.code] = [
        ss.reduce((a, s) => a + S.states[s.code].cx, 0) / ss.length,
        ss.reduce((a, s) => a + S.states[s.code].cy, 0) / ss.length,
      ];
    }
    return out;
  }, [data]);

  const usedParties = Array.from(
    new Set(
      data.states.filter((s) => s.total > 0).map((s) => s.candidates[0].party),
    ),
  ) as PartyCode[];

  function track(ev: React.PointerEvent, kind: Hover['kind'], id: string) {
    if (ev.pointerType !== 'mouse' || moving) return;
    const r = wrapRef.current!.getBoundingClientRect();
    setHover({ kind, id, x: ev.clientX - r.left, y: ev.clientY - r.top });
  }

  function fill(
    party: PartyCode | undefined,
    margin: number,
    total: number,
    hatch: string,
  ) {
    if (!total || !party) return 'url(#empty)';
    const k = strength(margin);
    if (k === 'strong') return PARTIES[party].color;
    if (k === 'clear')
      return `color-mix(in oklab, ${PARTIES[party].color} 48%, var(--bg-white-0))`;
    return `url(#${hatch}-${party})`;
  }

  const hoveredState = hover?.kind === 'state' ? byCode[hover.id] : null;
  const hoveredLga = hover?.kind === 'lga' ? lgaById[hover.id] : null;
  const outlineLga = hover?.kind === 'lga' ? hover.id : listHover;
  const cameraTransition = reduced ? { duration: 0 } : spring.camera;
  const fade = {
    duration: reduced ? 0 : 0.24,
    ease: [0.32, 0.72, 0, 1] as const,
  };

  return (
    <div className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]'>
      <div className='border-stroke-soft-200 relative min-w-0 p-4 sm:p-5 xl:border-r'>
        {title}
        <div ref={wrapRef} className='relative'>
          <motion.svg
            initial={false}
            animate={{ viewBox: toViewBox(camera) }}
            transition={cameraTransition}
            onAnimationComplete={() => setMoving(false)}
            viewBox={toViewBox(camera)}
            className='block h-auto w-full touch-manipulation select-none'
            style={{ aspectRatio: `${base[2]} / ${base[3]}` }}
            role='group'
            aria-label={
              focused
                ? `Map of ${focused.name} by local government area`
                : 'Map of Nigeria showing the leading party in each state'
            }
          >
            <defs>
              {(Object.keys(PARTIES) as PartyCode[]).map((p) => (
                <React.Fragment key={p}>
                  <pattern
                    id={`hatch-${p}`}
                    width='7'
                    height='7'
                    patternUnits='userSpaceOnUse'
                    patternTransform='rotate(45)'
                  >
                    <rect
                      width='7'
                      height='7'
                      fill={`color-mix(in oklab, ${PARTIES[p].color} 14%, var(--bg-white-0))`}
                    />
                    <line
                      x1='0'
                      y1='0'
                      x2='0'
                      y2='7'
                      stroke={PARTIES[p].color}
                      strokeWidth='2.6'
                    />
                  </pattern>
                  {/* LGA hatch is drawn at the zoomed scale so stripes keep their on-screen size */}
                  <pattern
                    id={`lhatch-${p}`}
                    width={7 / zoom}
                    height={7 / zoom}
                    patternUnits='userSpaceOnUse'
                    patternTransform='rotate(45)'
                  >
                    <rect
                      width={7 / zoom}
                      height={7 / zoom}
                      fill={`color-mix(in oklab, ${PARTIES[p].color} 14%, var(--bg-white-0))`}
                    />
                    <line
                      x1='0'
                      y1='0'
                      x2='0'
                      y2={7 / zoom}
                      stroke={PARTIES[p].color}
                      strokeWidth={2.6 / zoom}
                    />
                  </pattern>
                </React.Fragment>
              ))}
              <radialGradient id='fade' cx='50%' cy='50%' r='60%'>
                <stop offset='58%' stopColor='white' stopOpacity='1' />
                <stop offset='100%' stopColor='white' stopOpacity='0.15' />
              </radialGradient>
              <mask
                id='fade-mask'
                maskUnits='userSpaceOnUse'
                x='0'
                y='0'
                width={S.width}
                height={S.height}
              >
                <rect
                  x='0'
                  y='0'
                  width={S.width}
                  height={S.height}
                  fill='url(#fade)'
                />
              </mask>
              <pattern
                id='empty'
                width='6'
                height='6'
                patternUnits='userSpaceOnUse'
              >
                <rect width='6' height='6' fill='var(--map-state-empty)' />
                <circle
                  cx='3'
                  cy='3'
                  r='0.8'
                  fill='var(--text-sub-600)'
                  opacity='0.5'
                />
              </pattern>
            </defs>

            {/* neighbours, washed out */}
            <motion.g
              aria-hidden
              mask='url(#fade-mask)'
              initial={false}
              animate={{ opacity: focus ? 0.5 : 1 }}
              transition={fade}
            >
              {S.neighbours.map((n) => (
                <path
                  key={n.name}
                  d={n.d}
                  fill='var(--map-neighbour)'
                  stroke='var(--map-neighbour-stroke)'
                  strokeWidth='1'
                  vectorEffect='non-scaling-stroke'
                />
              ))}
            </motion.g>

            {/* states; leaving this group (onto neighbours or sea) hides the tooltip */}
            <g onPointerLeave={() => hover?.kind === 'state' && setHover(null)}>
              {data.states.map((s) => {
                const shape = S.states[s.code];
                const lead = s.candidates[0];
                const isFocus = focus === s.code;
                return (
                  <path
                    key={s.code}
                    d={shape.d}
                    fill={
                      focus && !isFocus
                        ? 'var(--map-state-empty)'
                        : fill(lead?.party, s.margin, s.total, 'hatch')
                    }
                    stroke='var(--map-state-stroke)'
                    strokeWidth={1.2}
                    vectorEffect='non-scaling-stroke'
                    strokeLinejoin='round'
                    tabIndex={focus ? -1 : 0}
                    role='button'
                    aria-label={`${s.name}: ${s.total ? `${lead.party} leading with ${pct(lead.share)}, ${pct(s.margin)} ahead` : 'awaiting results'}. Open state map.`}
                    style={{
                      opacity: focus
                        ? isFocus
                          ? lgas
                            ? 0
                            : 1
                          : 0.75
                        : hover?.kind === 'state' && hover.id !== s.code
                          ? 0.6
                          : 1,
                      transition: `opacity ${reduced ? 0 : 240}ms cubic-bezier(0.32, 0.72, 0, 1)`,
                    }}
                    className='cursor-pointer outline-hidden'
                    onPointerMove={(ev) => !focus && track(ev, 'state', s.code)}
                    onPointerEnter={(ev) =>
                      !focus && track(ev, 'state', s.code)
                    }
                    onClick={() => (isFocus ? undefined : open(s.code))}
                    onFocus={() => {
                      const r = wrapRef.current!.getBoundingClientRect();
                      setHover({
                        kind: 'state',
                        id: s.code,
                        x: ((shape.cx - camera[0]) / camera[2]) * r.width,
                        y: ((shape.cy - camera[1]) / camera[3]) * r.height,
                      });
                    }}
                    onBlur={() => setHover(null)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter' || ev.key === ' ') {
                        ev.preventDefault();
                        open(s.code);
                      }
                    }}
                  />
                );
              })}
            </g>

            {/* zone highlight: states outside the hovered zone fade to grey */}
            <g aria-hidden pointerEvents='none'>
              {data.states.map((s) => (
                <path
                  key={s.code}
                  d={S.states[s.code].d}
                  fill='var(--map-state-empty)'
                  stroke='var(--map-state-stroke)'
                  strokeWidth={1.2}
                  vectorEffect='non-scaling-stroke'
                  style={{
                    opacity:
                      !focus && zoneHover && s.zone !== zoneHover ? 0.9 : 0,
                    transition: `opacity ${reduced ? 0 : 160}ms cubic-bezier(0.32, 0.72, 0, 1)`,
                  }}
                />
              ))}
            </g>

            {/* LGAs of the focused state fade in as the camera settles */}
            <AnimatePresence>
              {focused && lgaShapesForFocus && lgas && (
                <motion.g
                  key={focused.code}
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    transition: { ...fade, delay: reduced ? 0 : 0.18 },
                  }}
                  exit={{
                    opacity: 0,
                    transition: { duration: reduced ? 0 : 0.12 },
                  }}
                  onPointerLeave={() => setHover(null)}
                >
                  {lgaShapesForFocus.lgas.map((shape) => {
                    const r = lgaById[shape.id];
                    const lead = r?.candidates[0];
                    return (
                      <path
                        key={shape.id}
                        d={shape.d}
                        fill={fill(
                          lead?.party,
                          r?.margin ?? 0,
                          r?.votes ?? 0,
                          'lhatch',
                        )}
                        stroke='var(--map-state-stroke)'
                        strokeWidth={1}
                        vectorEffect='non-scaling-stroke'
                        strokeLinejoin='round'
                        style={{
                          opacity:
                            outlineLga && outlineLga !== shape.id ? 0.6 : 1,
                          transition: 'opacity 80ms linear',
                        }}
                        onPointerMove={(ev) => track(ev, 'lga', shape.id)}
                        onPointerEnter={(ev) => track(ev, 'lga', shape.id)}
                      />
                    );
                  })}
                </motion.g>
              )}
            </AnimatePresence>

            {/* outlines on top */}
            <path
              d={S.nigeria}
              fill='none'
              stroke='var(--text-strong-950)'
              strokeOpacity={focus ? 0.25 : 0.55}
              strokeWidth='1.4'
              vectorEffect='non-scaling-stroke'
              strokeLinejoin='round'
              pointerEvents='none'
            />
            {focus && (
              <path
                d={S.states[focus].d}
                fill='none'
                stroke='var(--text-strong-950)'
                strokeWidth='1.6'
                vectorEffect='non-scaling-stroke'
                strokeLinejoin='round'
                pointerEvents='none'
              />
            )}
            {!focus && hover?.kind === 'state' && (
              <path
                d={S.states[hover.id].d}
                fill='none'
                stroke='var(--text-strong-950)'
                strokeOpacity='0.85'
                strokeWidth='1.5'
                vectorEffect='non-scaling-stroke'
                strokeLinejoin='round'
                pointerEvents='none'
              />
            )}
            {focus &&
              outlineLga &&
              lgaShapesForFocus?.lgas.find((l) => l.id === outlineLga) && (
                <path
                  d={lgaShapesForFocus.lgas.find((l) => l.id === outlineLga)!.d}
                  fill='none'
                  stroke='var(--text-strong-950)'
                  strokeWidth='1.5'
                  strokeOpacity='0.85'
                  vectorEffect='non-scaling-stroke'
                  strokeLinejoin='round'
                  pointerEvents='none'
                />
              )}

            {/* zone leader lines */}
            <motion.g
              className='hidden md:inline'
              aria-hidden
              initial={false}
              animate={{ opacity: focus || moving ? 0 : 1 }}
              transition={{ duration: reduced ? 0 : 0.16 }}
            >
              {data.zones.map((z) => {
                const [ax, ay] = anchors[z.code];
                const c = CALLOUTS[z.code];
                const ruleEnd = c.align === 'left' ? c.lx + 150 : c.lx - 150;
                return (
                  <g key={z.code}>
                    <polyline
                      points={`${ax},${ay} ${ax},${c.ly} ${ruleEnd},${c.ly}`}
                      fill='none'
                      stroke={
                        zoneHover === z.code
                          ? 'var(--text-strong-950)'
                          : 'var(--text-sub-600)'
                      }
                      strokeWidth={zoneHover === z.code ? 1.4 : 0.9}
                      vectorEffect='non-scaling-stroke'
                    />
                    <line
                      x1={c.lx}
                      x2={ruleEnd}
                      y1={c.ly}
                      y2={c.ly}
                      stroke={
                        zoneHover === z.code
                          ? 'var(--text-strong-950)'
                          : 'var(--text-sub-600)'
                      }
                      strokeWidth={zoneHover === z.code ? 1.4 : 0.9}
                      vectorEffect='non-scaling-stroke'
                    />
                    <circle
                      cx={ax}
                      cy={ay}
                      r='3.2'
                      fill='var(--bg-white-0)'
                      stroke='var(--text-strong-950)'
                      strokeWidth='1.4'
                      vectorEffect='non-scaling-stroke'
                    />
                  </g>
                );
              })}
            </motion.g>
          </motion.svg>

          {/* HTML overlays keep text at real pixel sizes (12px+) at any map width */}
          <motion.div
            className={cn(
              'absolute inset-0 hidden md:block',
              focus || moving
                ? 'pointer-events-none'
                : 'pointer-events-none [&_a]:pointer-events-auto',
            )}
            initial={false}
            animate={{ opacity: focus || moving ? 0 : 1 }}
            transition={{ duration: reduced ? 0 : 0.16 }}
            aria-hidden={focus ? true : undefined}
          >
            {Object.entries(NEIGHBOUR_LABELS).map(([n, [x, y]]) => (
              <span
                key={n}
                aria-hidden
                className='text-text-sub-600 absolute -translate-x-1/2 -translate-y-1/2 text-[12px]'
                style={{
                  left: `${(x / S.width) * 100}%`,
                  top: `${(y / S.height) * 100}%`,
                }}
              >
                {n}
              </span>
            ))}
            <span
              aria-hidden
              className='text-text-sub-600 absolute text-[12px] italic'
              style={{ left: '22%', top: '95%' }}
            >
              Gulf of Guinea
            </span>
            {data.zones.map((z) => {
              const c = CALLOUTS[z.code];
              return (
                <Link
                  key={z.code}
                  href={`/zones/${z.code.toLowerCase()}` as Route}
                  tabIndex={focus ? -1 : undefined}
                  aria-label={`${z.name} zone analytics`}
                  onPointerEnter={(ev) =>
                    ev.pointerType === 'mouse' && setZoneHover(z.code)
                  }
                  onPointerLeave={() => setZoneHover(null)}
                  onFocus={() => setZoneHover(z.code)}
                  onBlur={() => setZoneHover(null)}
                  className={cn(
                    'absolute w-[15%] min-w-[124px] -translate-y-full rounded-md pb-1 transition-opacity duration-[80ms]',
                    zoneHover && zoneHover !== z.code && 'opacity-50',
                    c.align === 'right' && '-translate-x-full text-right',
                  )}
                  style={{
                    left: `${(c.lx / S.width) * 100}%`,
                    top: `${(c.ly / S.height) * 100}%`,
                  }}
                >
                  <div
                    className='text-[12px] leading-4 font-[550]'
                    style={{
                      color: z.lead
                        ? PARTIES[z.lead.party].text
                        : 'var(--text-sub-600)',
                    }}
                  >
                    {z.name}
                  </div>
                  <div className='tabular text-text-sub-600 text-[12px] leading-4'>
                    {z.lead
                      ? `${z.lead.party} ${pct(z.lead.share)} · ${compact(z.total)}`
                      : 'Awaiting results'}
                  </div>
                </Link>
              );
            })}
          </motion.div>

          {/* compact back control on the map itself, for when the panel is below (narrow screens) */}
          <AnimatePresence>
            {focused && (
              <motion.button
                type='button'
                onClick={back}
                initial={{ opacity: 0, y: -4 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { ...spring.moderate, delay: reduced ? 0 : 0.2 },
                }}
                exit={{ opacity: 0, transition: spring.moderate.exit }}
                className='hit bg-surface-4 text-label-xs text-text-strong-950 shadow-surface-4 absolute top-2 left-2 inline-flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2.5 xl:hidden'
              >
                <IconBack className='size-3.5' /> Nigeria
              </motion.button>
            )}
          </AnimatePresence>

          {/* tooltip: always below the pointer, so it never covers what you're pointing at */}
          {hover && (hoveredState || hoveredLga) && (
            <div
              className='bg-surface-4 shadow-surface-4 pointer-events-none absolute z-20 w-64 rounded-xl p-3.5'
              style={{
                left: `clamp(0px, calc(${hover.x}px - 8rem), calc(100% - 16rem))`,
                top: hover.y + 22,
              }}
              role='tooltip'
            >
              {hoveredState && (
                <StateTooltip s={hoveredState} live={data.live} />
              )}
              {hoveredLga && focused && (
                <LgaTooltip l={hoveredLga} stateName={focused.name} />
              )}
            </div>
          )}
        </div>

        {/* legend */}
        <div className='border-stroke-soft-200 mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t pt-4'>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
            {usedParties.map((p) => (
              <span
                key={p}
                className='text-label-xs text-text-sub-600 inline-flex items-center gap-1.5'
              >
                <span
                  className='size-3 rounded-sm'
                  style={{ background: PARTIES[p].color }}
                />
                {p}
              </span>
            ))}
          </div>
          <div className='text-paragraph-xs text-text-sub-600 flex flex-wrap items-center gap-x-4 gap-y-2'>
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
        <p className='text-paragraph-xs text-text-sub-600 mt-3 flex items-center gap-1.5'>
          <IconCursor className='size-4' />
          {focused
            ? `Showing ${focused.name}'s ${lgas?.length ?? ''} local government areas. Press Esc or use Back to return.`
            : 'Hover a state for a quick look. Click or tap it to zoom in.'}
        </p>
        {footer}
      </div>

      <aside
        ref={panelRef}
        className='border-stroke-soft-200 min-w-0 border-t xl:border-t-0'
        aria-live='polite'
      >
        <AnimatePresence mode='wait' initial={false}>
          <motion.div
            key={focused ? focused.code : 'overview'}
            initial={{ opacity: 0, x: focused ? 8 : -8 }}
            animate={{ opacity: 1, x: 0, transition: spring.moderate }}
            exit={{ opacity: 0, transition: spring.moderate.exit }}
          >
            {focused ? (
              <StatePanel
                s={focused}
                live={data.live}
                lgas={lgas}
                lgaError={lgaError}
                onBack={back}
                onHoverLga={setListHover}
              />
            ) : (
              overview
            )}
          </motion.div>
        </AnimatePresence>
      </aside>
    </div>
  );
}

function LegendSwatch({
  kind,
}: {
  kind: 'strong' | 'clear' | 'narrow' | 'empty';
}) {
  const c = 'var(--text-sub-600)';
  return (
    <svg width='16' height='12' className='shrink-0 rounded-sm' aria-hidden>
      {kind === 'strong' && <rect width='16' height='12' fill={c} />}
      {kind === 'clear' && (
        <rect
          width='16'
          height='12'
          fill={`color-mix(in oklab, ${c} 48%, var(--bg-white-0))`}
        />
      )}
      {kind === 'narrow' && (
        <>
          <rect
            width='16'
            height='12'
            fill={`color-mix(in oklab, ${c} 14%, var(--bg-white-0))`}
          />
          {[-8, -3, 2, 7, 12, 17].map((o) => (
            <line
              key={o}
              x1={o}
              y1='12'
              x2={o + 12}
              y2='0'
              stroke={c}
              strokeWidth='1.8'
            />
          ))}
        </>
      )}
      {kind === 'empty' && (
        <rect
          width='16'
          height='12'
          fill='var(--map-state-empty)'
          stroke='var(--stroke-sub-300)'
        />
      )}
    </svg>
  );
}

function ShareRows({
  rows,
}: {
  rows: { key: string; party: PartyCode; share: number }[];
}) {
  return (
    <ul className='mt-2.5 flex flex-col gap-1.5'>
      {rows.slice(0, 3).map((c) => (
        <li
          key={c.key}
          className='text-paragraph-xs text-text-sub-600 grid grid-cols-[2.75rem_1fr_3rem] items-center gap-2'
        >
          <span>{c.party}</span>
          <span className='bg-hover h-1.5 overflow-hidden rounded-full'>
            <span
              className='block h-full rounded-full'
              style={{
                width: `${c.share * 100}%`,
                background: PARTIES[c.party].color,
              }}
            />
          </span>
          <span className='tabular text-right'>{pct(c.share, 0)}</span>
        </li>
      ))}
    </ul>
  );
}

function StateTooltip({ s, live }: { s: MapState; live: boolean }) {
  const [a, b] = s.candidates;
  return (
    <>
      <div className='flex items-baseline justify-between gap-2'>
        <span className='text-label-sm text-text-strong-950'>{s.name}</span>
        <span className='text-paragraph-xs text-text-sub-600'>
          {s.zoneName}
        </span>
      </div>
      {s.total ? (
        <>
          <div className='mt-2.5 flex items-center gap-2'>
            <span
              className='size-2.5 rounded-full'
              style={{ background: PARTIES[a.party].color }}
            />
            <span className='text-label-sm text-text-strong-950 truncate'>
              {a.name}
            </span>
            <span className='tabular text-label-sm text-text-strong-950 ml-auto'>
              {pct(a.share)}
            </span>
          </div>
          <div className='text-paragraph-xs text-text-sub-600 mt-1'>
            {a.party} leads{' '}
            {b ? (
              <>
                by{' '}
                <span className='tabular text-text-strong-950'>
                  {(s.margin * 100).toFixed(1)} pts
                </span>{' '}
                over {b.party}
              </>
            ) : null}
          </div>
          <ShareRows
            rows={s.candidates.map((c) => ({
              key: c.personId,
              party: c.party,
              share: c.share,
            }))}
          />
          <div className='tabular border-stroke-soft-200 text-paragraph-xs text-text-sub-600 mt-2.5 flex justify-between border-t pt-2'>
            <span>{compact(s.total)} votes</span>
            {live ? (
              <span>{pct(s.reported, 0)} reported</span>
            ) : (
              <span>{pct(s.turnout, 0)} turnout</span>
            )}
          </div>
          <div className='text-paragraph-xs text-text-sub-600 mt-1.5'>
            Click to zoom in
          </div>
        </>
      ) : (
        <p className='text-paragraph-xs text-text-sub-600 mt-2'>
          No polling-unit results uploaded yet.
        </p>
      )}
    </>
  );
}

function LgaTooltip({ l, stateName }: { l: LgaResult; stateName: string }) {
  const [a, b] = l.candidates;
  return (
    <>
      <div className='flex items-baseline justify-between gap-2'>
        <span className='text-label-sm text-text-strong-950 truncate'>
          {l.name}
        </span>
        <span className='text-paragraph-xs text-text-sub-600 shrink-0'>
          LGA · {stateName}
        </span>
      </div>
      {a ? (
        <>
          <div className='mt-2.5 flex items-center gap-2'>
            <span
              className='size-2.5 rounded-full'
              style={{ background: PARTIES[a.party].color }}
            />
            <span className='text-label-sm text-text-strong-950 truncate'>
              {a.name}
            </span>
            <span className='tabular text-label-sm text-text-strong-950 ml-auto'>
              {pct(a.share)}
            </span>
          </div>
          <div className='text-paragraph-xs text-text-sub-600 mt-1'>
            {a.party} leads{' '}
            {b ? (
              <>
                by{' '}
                <span className='tabular text-text-strong-950'>
                  {(l.margin * 100).toFixed(1)} pts
                </span>{' '}
                over {b.party}
              </>
            ) : null}
          </div>
          <ShareRows
            rows={l.candidates.map((c) => ({
              key: c.personId,
              party: c.party,
              share: c.share,
            }))}
          />
          <div className='tabular border-stroke-soft-200 text-paragraph-xs text-text-sub-600 mt-2.5 border-t pt-2'>
            {fmt(l.votes)} votes
          </div>
        </>
      ) : (
        <p className='text-paragraph-xs text-text-sub-600 mt-2'>
          No results yet.
        </p>
      )}
    </>
  );
}

type LgaSort = 'votes' | 'name' | 'share' | 'margin';
const EMPTY_LGAS: LgaResult[] = [];
const LGA_SORT_OPTIONS: SortOption<LgaSort>[] = [
  { value: 'votes', label: 'Votes' },
  { value: 'name', label: 'Alphabetical' },
  { value: 'share', label: 'Leader’s share' },
  { value: 'margin', label: 'Closest race' },
];
const LGA_SORTERS: Record<LgaSort, (a: LgaResult, b: LgaResult) => number> = {
  votes: (a, b) => b.votes - a.votes,
  name: (a, b) => a.name.localeCompare(b.name),
  share: (a, b) =>
    (b.candidates[0]?.share ?? 0) - (a.candidates[0]?.share ?? 0),
  margin: (a, b) => a.margin - b.margin,
};

function StatePanel({
  s,
  live,
  lgas,
  lgaError,
  onBack,
  onHoverLga,
}: {
  s: MapState;
  live: boolean;
  lgas: LgaResult[] | null;
  lgaError: boolean;
  onBack: () => void;
  onHoverLga: (id: string | null) => void;
}) {
  const lead = s.candidates[0];
  const backRef = React.useRef<HTMLButtonElement>(null);
  // Move keyboard focus to Back once the panel opens, so Enter/Esc return immediately.
  React.useEffect(() => backRef.current?.focus({ preventScroll: true }), []);
  const [lgaSort, setLgaSort] = React.useState<LgaSort>('votes');
  const sortedLgas = useSorted(lgas ?? EMPTY_LGAS, lgaSort, LGA_SORTERS);
  const lgasWon: Partial<Record<PartyCode, number>> = {};
  for (const l of lgas ?? [])
    if (l.candidates[0])
      lgasWon[l.candidates[0].party] =
        (lgasWon[l.candidates[0].party] ?? 0) + 1;

  return (
    <div className='flex flex-col'>
      <div className='border-stroke-soft-200 flex items-center justify-between gap-2 border-b p-3 sm:px-4'>
        <button
          ref={backRef}
          type='button'
          onClick={onBack}
          className='hit rounded-10 bg-surface-2 text-label-sm text-text-strong-950 shadow-surface-2 hover:bg-hover inline-flex h-9 items-center gap-2 pr-3.5 pl-2.5 transition-colors duration-[80ms]'
        >
          <IconBack className='size-4' /> Back to Nigeria
          <kbd className='bg-hover text-text-sub-600 ml-1 rounded-[5px] px-1.5 text-[12px] leading-5 font-normal'>
            Esc
          </kbd>
        </button>
        <Link
          href={`/states/${s.code}` as Route}
          className='hit text-label-sm text-text-sub-600 hover:text-text-strong-950 inline-flex items-center gap-1 transition-colors duration-[80ms]'
        >
          State page <IconExternal className='size-4' />
        </Link>
      </div>
      <div className='px-4 py-5 sm:px-5'>
        <h3 className='text-title-h5 text-text-strong-950 tracking-tight'>
          {s.name}
        </h3>
        <p className='text-paragraph-sm text-text-sub-600'>
          {s.zoneName} · Capital: {s.capital}
        </p>

        {s.total ? (
          <div
            className='shadow-surface-2 mt-4 rounded-xl p-3.5'
            style={{
              background: `color-mix(in oklab, ${PARTIES[lead.party].color} 8%, var(--bg-white-0))`,
            }}
          >
            <div className='text-paragraph-xs text-text-sub-600'>
              {live ? 'Leading' : 'Won'}
            </div>
            <div className='text-label-md text-text-strong-950 mt-0.5'>
              {lead.name}
            </div>
            <div
              className='tabular text-paragraph-sm mt-0.5'
              style={{ color: PARTIES[lead.party].text }}
            >
              {lead.party} · {pct(lead.share)} · +{(s.margin * 100).toFixed(1)}{' '}
              pts
            </div>
          </div>
        ) : (
          <p className='text-paragraph-sm text-text-sub-600 mt-4'>
            No results uploaded from {s.name} yet.
          </p>
        )}

        <dl className='mt-5 grid grid-cols-2 gap-x-4 gap-y-4'>
          <Fact label='Votes counted' value={fmt(s.total)} />
          <Fact label='Registered voters' value={compact(s.registered)} />
          <Fact
            label={live ? 'Polling units reported' : 'Reported'}
            value={pct(s.reported, 0)}
          />
          <Fact label='Turnout' value={s.total ? pct(s.turnout) : '—'} />
        </dl>
      </div>

      <div className='border-stroke-soft-200 border-t px-4 py-5 sm:px-5'>
        <h4 className='text-label-sm text-text-strong-950'>
          Local government areas
        </h4>
        {lgaError ? (
          <p className='text-paragraph-xs text-text-sub-600 mt-2'>
            Couldn&apos;t load the LGA map. Check your connection and open the
            state again.
          </p>
        ) : !lgas ? (
          <div className='mt-3 flex flex-col gap-2' aria-busy>
            <div className='skeleton h-6 w-2/3' />
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className='skeleton h-8 w-full' />
            ))}
          </div>
        ) : (
          <>
            <p className='text-paragraph-xs text-text-sub-600 mt-1'>
              {lgas.length} LGAs ·{' '}
              {(Object.entries(lgasWon) as [PartyCode, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([p, n], i) => (
                  <span key={p}>
                    {i > 0 && ', '}
                    <span style={{ color: PARTIES[p].text }}>{p}</span>{' '}
                    {live ? 'leads' : 'won'} {n}
                  </span>
                ))}
            </p>
            <div className='mt-3 flex items-center justify-between gap-2'>
              <span className='text-paragraph-xs text-text-sub-600'>
                Hover a row to find it on the map
              </span>
              <SortMenu
                value={lgaSort}
                onChange={setLgaSort}
                options={LGA_SORT_OPTIONS}
              />
            </div>
            <ul
              className='mt-2 flex max-h-[320px] flex-col overflow-y-auto pr-1'
              onPointerLeave={() => onHoverLga(null)}
            >
              {sortedLgas.map((l) => {
                const w = l.candidates[0];
                return (
                  <li
                    key={l.id}
                    onPointerEnter={() => onHoverLga(l.id)}
                    className='border-stroke-soft-200 grid grid-cols-[minmax(0,1fr)_auto_3.5rem] items-center gap-2 border-b py-2 last:border-b-0'
                  >
                    <span className='text-paragraph-sm text-text-strong-950 truncate'>
                      {l.name}
                    </span>
                    <span className='text-label-xs text-text-sub-600 inline-flex items-center gap-1.5'>
                      {w && (
                        <span
                          className='size-2 rounded-full'
                          style={{ background: PARTIES[w.party].color }}
                          aria-hidden
                        />
                      )}
                      {w?.party ?? '—'}
                    </span>
                    <span className='tabular text-paragraph-xs text-text-sub-600 text-right'>
                      {w ? pct(w.share, 0) : '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className='text-paragraph-xs text-text-sub-600 mt-2'>
              Sample LGA figures, derived from the state result.
            </p>
          </>
        )}
      </div>

      {s.total > 0 && (
        <div className='border-stroke-soft-200 border-t px-4 py-5 sm:px-5'>
          <h4 className='text-label-sm text-text-strong-950 mb-3'>
            All candidates in {s.name}
          </h4>
          <ul className='flex flex-col gap-3.5'>
            {s.candidates.map((c) => (
              <li key={c.personId}>
                <div className='flex items-baseline justify-between gap-2'>
                  <Link
                    href={`/politicians/${c.personId}` as Route}
                    className='text-label-sm text-text-strong-950 truncate hover:underline'
                  >
                    {c.name}
                  </Link>
                  <span className='tabular text-label-sm text-text-strong-950'>
                    {pct(c.share)}
                  </span>
                </div>
                <div className='mt-1.5 flex items-center gap-2'>
                  <span className='text-paragraph-xs text-text-sub-600 w-10'>
                    {c.party}
                  </span>
                  <span className='bg-hover h-1.5 flex-1 overflow-hidden rounded-full'>
                    <span
                      className='block h-full rounded-full'
                      style={{
                        width: `${c.share * 100}%`,
                        background: PARTIES[c.party].color,
                      }}
                    />
                  </span>
                  <span className='tabular text-paragraph-xs text-text-sub-600 w-16 text-right'>
                    {compact(c.votes)}
                  </span>
                </div>
                {c.share >= 0.25 && (
                  <div className='text-paragraph-xs text-success-base mt-1'>
                    Meets 25% here
                  </div>
                )}
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
      <dd className='tabular text-label-md text-text-strong-950 mt-0.5'>
        {value}
      </dd>
    </div>
  );
}
