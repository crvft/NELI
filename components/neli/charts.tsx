'use client';

import * as React from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Bar, BarChart } from 'recharts';
import { PARTIES, type PartyCode } from '@/lib/parties';

type Series = { key: string; label: string; party: PartyCode };

function ChartTooltip({ active, payload, label, series, unit }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; series: Series[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const rows = payload.slice().sort((a, b) => b.value - a.value);
  return (
    <div className='min-w-44 rounded-xl bg-bg-white-0 p-3 shadow-regular-md ring-1 ring-stroke-soft-200'>
      <div className='mb-2 text-label-xs text-text-sub-600'>{label}</div>
      <ul className='flex flex-col gap-1.5'>
        {rows.map((r) => {
          const s = series.find((x) => x.key === r.dataKey)!;
          return (
            <li key={r.dataKey} className='flex items-center gap-2 text-paragraph-xs text-text-sub-600'>
              <span className='size-2 rounded-full' style={{ background: PARTIES[s.party].color }} />
              <span className='flex-1 truncate'>{s.label}</span>
              <span className='tabular text-label-xs text-text-strong-950'>
                {r.value.toLocaleString('en-NG', { maximumFractionDigits: 1 })}
                {unit}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const axisTick = { fill: 'var(--text-soft-400)', fontSize: 12 };

export function ProbabilityChart({ data, series }: { data: Record<string, number | string>[]; series: Series[] }) {
  const last = data[data.length - 1];
  return (
    <div>
      <div className='h-64 w-full sm:h-72'>
        <ResponsiveContainer width='100%' height='100%'>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke='var(--stroke-soft-200)' />
            <XAxis dataKey='label' tick={axisTick} tickLine={false} axisLine={false} interval='preserveStartEnd' minTickGap={24} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} />
            <Tooltip cursor={{ stroke: 'var(--stroke-sub-300)', strokeWidth: 1 }} content={<ChartTooltip series={series} unit='%' />} />
            {series.map((s) => (
              <Line
                key={s.key}
                type='monotone'
                dataKey={s.key}
                stroke={PARTIES[s.party].color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--bg-white-0)' }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <Legend series={series} values={Object.fromEntries(series.map((s) => [s.key, `${last[s.key]}%`]))} />
    </div>
  );
}

export function Legend({ series, values }: { series: Series[]; values?: Record<string, string> }) {
  return (
    <ul className='mt-3 flex flex-wrap gap-x-4 gap-y-2'>
      {series.map((s) => (
        <li key={s.key} className='inline-flex items-center gap-1.5 text-paragraph-xs text-text-sub-600'>
          <span className='h-0.5 w-3 rounded-full' style={{ background: PARTIES[s.party].color }} />
          {s.label}
          {values && <span className='tabular text-label-xs text-text-strong-950'>{values[s.key]}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Votes per election across a politician's career — one series, so no legend. */
export function CareerVotesChart({ data }: { data: { label: string; votes: number; party: PartyCode; won: boolean }[] }) {
  return (
    <div className='h-56 w-full'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }} barCategoryGap='28%' maxBarSize={56}>
          <CartesianGrid vertical={false} stroke='var(--stroke-soft-200)' />
          <XAxis dataKey='label' tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v))}
          />
          <Tooltip
            cursor={{ fill: 'var(--bg-weak-50)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as (typeof data)[number];
              return (
                <div className='rounded-xl bg-bg-white-0 p-3 shadow-regular-md ring-1 ring-stroke-soft-200'>
                  <div className='text-label-xs text-text-sub-600'>{d.label}</div>
                  <div className='tabular mt-1 text-label-sm text-text-strong-950'>{d.votes.toLocaleString('en-NG')} votes</div>
                  <div className='mt-0.5 text-paragraph-xs text-text-sub-600'>
                    {d.party} · {d.won ? 'Won' : 'Lost'}
                  </div>
                </div>
              );
            }}
          />
          <Bar
            dataKey='votes'
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            shape={(props: unknown) => {
              const p = props as { x: number; y: number; width: number; height: number; payload: (typeof data)[number] };
              const r = Math.min(4, p.width / 2, p.height);
              const { x, y, width: w, height: h } = p;
              return (
                <path
                  d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`}
                  fill={PARTIES[p.payload.party].color}
                  opacity={p.payload.won ? 1 : 0.45}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
