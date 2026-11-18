'use client';

import * as React from 'react';
import { PARTIES, type PartyCode } from '@/lib/parties';
import { cn } from '@/utils/cn';

export type LineSeries = {
  key: string;
  label: string;
  /** Party colours the line; or pass `color`/`textColor` for non-party measures */
  party?: PartyCode;
  color?: string;
  textColor?: string;
  /** Optional projected final value, drawn as a dotted line into the projection zone */
  projected?: number;
};

type Row = Record<string, number | string>;

type Props = {
  data: Row[];
  series: LineSeries[];
  xKey?: string;
  height?: number;
  yDomain?: [number, number];
  yTicks?: number[];
  /** 'percent' → "36.2%", 'compact' → "1.2M" */
  valueFormat?: 'percent' | 'compact';
  /** Shade the gap between the two leading series (by last value). */
  fillBetween?: boolean;
  /** Label for the projection zone end, e.g. "Final". Enables the projection zone. */
  projectionLabel?: string;
  /** Show markers on every point (useful for sparse data like careers). */
  markers?: boolean;
  /** Per-point marker emphasis, keyed by x label (e.g. wins vs losses). */
  /** Row key whose truthy value draws a hollow (faded) marker, e.g. lost elections. */
  fadedKey?: string;
  className?: string;
  ariaLabel: string;
};

const M = { top: 16, right: 72, bottom: 32, left: 48 };

const colorOf = (s: LineSeries) => s.color ?? (s.party ? PARTIES[s.party].color : 'var(--primary-base)');
const textOf = (s: LineSeries) => s.textColor ?? (s.party ? PARTIES[s.party].text : 'var(--text-strong-950)');

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [w, setW] = React.useState(0);
  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    setW(Math.round(ref.current.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Smooth-ish path with slight monotone easing so lines read like price charts. */
function linePath(pts: [number, number][]) {
  if (!pts.length) return '';
  return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
}

/**
 * NELI line chart. Visual language: dotted grid, dotted accent axis, thin glowing
 * lines (glow only in dark mode), shaded gap between the two leaders, end-of-line
 * value labels in the series colour, and an optional dotted projection fan.
 */
export function LineChart({
  data,
  series,
  xKey = 'label',
  height = 280,
  yDomain,
  yTicks,
  valueFormat = 'percent',
  fillBetween = false,
  projectionLabel,
  markers = false,
  fadedKey,
  className,
  ariaLabel,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const format = (v: number) =>
    valueFormat === 'percent' ? `${Math.round(v * 10) / 10}%` : v >= 1e6 ? `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}K` : `${Math.round(v)}`;
  const [hover, setHover] = React.useState<number | null>(null);
  const uid = React.useId().replace(/:/g, '');

  const values = data.flatMap((r) => series.map((s) => Number(r[s.key]) || 0)).concat(series.map((s) => s.projected ?? 0));
  const yMin = yDomain?.[0] ?? 0;
  const yMax = yDomain?.[1] ?? niceMax(Math.max(...values, 1));
  const ticks = yTicks ?? [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + (yMax - yMin) * f);

  const hasProj = !!projectionLabel && series.some((s) => s.projected !== undefined);
  const slots = data.length - 1 + (hasProj ? Math.max(2, Math.round(data.length * 0.28)) : 0);
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const x = (i: number) => M.left + (slots > 0 ? (i / slots) * innerW : innerW / 2);
  const y = (v: number) => M.top + innerH - ((v - yMin) / (yMax - yMin || 1)) * innerH;
  const nowX = x(data.length - 1);
  // X labels: first and last always; others only if they keep ~80px from both neighbours shown
  const tickStep = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 90))));
  const showTick = (i: number) => {
    if (i === 0 || i === data.length - 1) return true;
    if (i % tickStep !== 0) return false;
    return x(data.length - 1) - x(i) >= 80 && x(i) - x(0) >= 60;
  };
  const endX = x(slots);

  const last = data[data.length - 1] ?? {};
  const ranked = series.slice().sort((a, b) => Number(last[b.key]) - Number(last[a.key]));
  const lead = ranked[0];
  const second = ranked[1];

  const pts = (s: LineSeries) => data.map((r, i) => [x(i), y(Number(r[s.key]) || 0)] as [number, number]);

  // End labels: avoid collisions by nudging apart vertically
  const endLabels = ranked.map((s) => ({ s, v: s.projected ?? (Number(last[s.key]) || 0), y: y(s.projected ?? (Number(last[s.key]) || 0)) }));
  endLabels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) if (endLabels[i].y - endLabels[i - 1].y < 16) endLabels[i].y = endLabels[i - 1].y + 16;

  function onMove(ev: React.PointerEvent<SVGRectElement>) {
    const rect = (ev.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = ev.clientX - rect.left + M.left;
    const i = Math.round(((px - M.left) / innerW) * slots);
    setHover(i >= 0 && i < data.length ? i : null);
  }

  return (
    <div ref={ref} className={cn('relative w-full select-none', className)}>
      {width > 0 && (
        <svg width={width} height={height} role='img' aria-label={ariaLabel} className='block overflow-visible'>
          <defs>
            <pattern id={`dots-${uid}`} width='8' height='8' patternUnits='userSpaceOnUse'>
              <circle cx='1' cy='1' r='0.7' fill='var(--chart-grid)' opacity='0.5' />
            </pattern>
            {lead && (
              <linearGradient id={`fill-${uid}`} x1='0' x2='0' y1='0' y2='1'>
                <stop offset='0%' stopColor={colorOf(lead)} stopOpacity='0.22' />
                <stop offset='100%' stopColor={colorOf(lead)} stopOpacity='0.03' />
              </linearGradient>
            )}
            <linearGradient id={`proj-${uid}`} x1='0' x2='1' y1='0' y2='0'>
              <stop offset='0%' stopColor='var(--text-soft-400)' stopOpacity='0.10' />
              <stop offset='100%' stopColor='var(--text-soft-400)' stopOpacity='0.02' />
            </linearGradient>
          </defs>

          {/* dotted field + grid */}
          <rect x={M.left} y={M.top} width={innerW} height={innerH} fill={`url(#dots-${uid})`} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} stroke='var(--chart-grid)' strokeDasharray='1 5' strokeLinecap='round' />
              <text x={M.left - 12} y={y(t)} dy='0.35em' textAnchor='end' className='tabular fill-[var(--text-sub-600)] text-[12px]'>
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((r, i) =>
            showTick(i) ? (
              <g key={i}>
                <line x1={x(i)} x2={x(i)} y1={M.top} y2={M.top + innerH} stroke='var(--chart-grid)' strokeDasharray='1 5' strokeLinecap='round' opacity='0.6' />
                <text x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === data.length - 1 && !hasProj ? 'end' : 'middle'} className='fill-[var(--text-sub-600)] text-[12px]'>
                  {String(r[xKey])}
                </text>
              </g>
            ) : null,
          )}
          {/* accent axes: dotted, like a terminal chart */}
          <line x1={M.left} x2={M.left} y1={M.top - 4} y2={M.top + innerH} stroke='var(--chart-axis)' strokeWidth='1.5' strokeDasharray='1.5 3.5' strokeLinecap='round' />
          <line x1={M.left} x2={M.left + innerW} y1={M.top + innerH} y2={M.top + innerH} stroke='var(--chart-axis)' strokeWidth='1.5' strokeDasharray='1.5 3.5' strokeLinecap='round' />

          {/* projection zone */}
          {hasProj && (
            <g>
              <rect x={nowX} y={M.top} width={endX - nowX} height={innerH} fill={`url(#proj-${uid})`} />
              <line x1={nowX} x2={nowX} y1={M.top} y2={M.top + innerH} stroke='var(--text-soft-400)' strokeDasharray='2 4' />
              <text x={nowX + 6} y={M.top + 12} className='fill-[var(--text-sub-600)] text-[12px]'>
                Now
              </text>
              <text x={endX} y={height - 8} textAnchor='end' className='fill-[var(--text-sub-600)] text-[12px]'>
                {projectionLabel}
              </text>
            </g>
          )}

          {/* shaded gap between the two leaders (or under a single series) */}
          {fillBetween && lead && (
            <path
              d={
                second
                  ? `${linePath(pts(lead))}${pts(second)
                      .slice()
                      .reverse()
                      .map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`)
                      .join('')}Z`
                  : `${linePath(pts(lead))}L${x(data.length - 1)},${M.top + innerH}L${x(0)},${M.top + innerH}Z`
              }
              fill={`url(#fill-${uid})`}
            />
          )}

          {/* projection fans */}
          {hasProj &&
            series.map((s) =>
              s.projected === undefined ? null : (
                <g key={`p-${s.key}`} style={{ color: colorOf(s) }}>
                  <path
                    d={`M${nowX},${y(Number(last[s.key]) || 0)} C${(nowX + endX) / 2},${y(Number(last[s.key]) || 0)} ${(nowX + endX) / 2},${y(s.projected)} ${endX},${y(s.projected)}`}
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeDasharray='0.5 5'
                    strokeLinecap='round'
                  />
                  <circle cx={endX} cy={y(s.projected)} r='4' fill='currentColor' stroke='var(--bg-white-0)' strokeWidth='2' />
                </g>
              ),
            )}

          {/* lines */}
          {ranked
            .slice()
            .reverse()
            .map((s) => (
              <g key={s.key} className='neli-glow' style={{ color: colorOf(s) }}>
                <path d={linePath(pts(s))} fill='none' stroke='currentColor' strokeWidth='2' strokeLinejoin='round' strokeLinecap='round' />
                {markers &&
                  pts(s).map((p, i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r='4.5' fill={fadedKey && data[i][fadedKey] ? 'var(--bg-white-0)' : 'currentColor'} stroke='currentColor' strokeWidth='2' />
                  ))}
                {!hasProj && !markers && <circle cx={x(data.length - 1)} cy={y(Number(last[s.key]) || 0)} r='4' fill='currentColor' stroke='var(--bg-white-0)' strokeWidth='2' />}
              </g>
            ))}

          {/* end-of-line value labels */}
          {endLabels.map(({ s, v, y: ly }) => (
            <text key={`l-${s.key}`} x={(hasProj ? endX : x(data.length - 1)) + 10} y={ly} dy='0.35em' className='tabular text-[12px] font-[550]' style={{ fill: textOf(s) }}>
              {format(v)}
            </text>
          ))}

          {/* hover */}
          {hover !== null && (
            <g pointerEvents='none'>
              <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + innerH} stroke='var(--text-sub-600)' strokeDasharray='2 3' />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(Number(data[hover][s.key]) || 0)} r='4.5' fill={colorOf(s)} stroke='var(--bg-white-0)' strokeWidth='2' />
              ))}
            </g>
          )}
          <rect
            x={M.left}
            y={M.top}
            width={innerW}
            height={innerH}
            fill='transparent'
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div
          className='pointer-events-none absolute z-10 min-w-48 rounded-xl bg-surface-4 p-3 shadow-surface-4'
          style={{
            top: M.top,
            left: Math.min(Math.max(x(hover) + 12, 0), width - 200),
          }}
        >
          <div className='mb-2 text-label-xs text-text-sub-600'>{String(data[hover][xKey])}</div>
          <ul className='flex flex-col gap-1.5'>
            {series
              .slice()
              .sort((a, b) => Number(data[hover][b.key]) - Number(data[hover][a.key]))
              .map((s) => (
                <li key={s.key} className='flex items-center gap-2 text-paragraph-xs text-text-sub-600'>
                  <span className='size-2 rounded-full' style={{ background: colorOf(s) }} />
                  <span className='flex-1 truncate'>{s.label}</span>
                  <span className='tabular text-label-xs text-text-strong-950'>{format(Number(data[hover][s.key]))}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v * 1.05) return m * p;
  return 10 * p;
}

/** "A vs B" subtitle with party-coloured names, as in the reference charts. */
export function VersusTitle({ title, a, b }: { title: string; a: { label: string; party: PartyCode }; b?: { label: string; party: PartyCode } }) {
  return (
    <div>
      <h3 className='text-label-lg tracking-tight text-text-strong-950'>{title}</h3>
      <p className='mt-0.5 text-paragraph-sm text-text-sub-600'>
        <span className='font-[550]' style={{ color: PARTIES[a.party].text }}>
          {a.label}
        </span>
        {b && (
          <>
            {' '}vs{' '}
            <span className='font-[550]' style={{ color: PARTIES[b.party].text }}>
              {b.label}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
