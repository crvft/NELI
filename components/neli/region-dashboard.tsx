'use client';

import * as React from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import * as SegmentedControl from '@/components/ui/segmented-control';
import {
  AnimatedNumber,
  AnimatedText,
} from '@/components/motion/animated-number';
import { FluidHover } from '@/components/motion/fluid-hover';
import { IconChevronRight } from '@/components/icons';
import { PARTIES, partyInfo, type PartyCode } from '@/lib/parties';
import type { AreaRow, CycleSummary, RegionOverview } from '@/lib/region';
import { SortMenu, useSorted, type SortOption } from './sort-menu';
import { cn } from '@/utils/cn';
import { Card, CardHeader } from './card';
import { LineChart } from './line-chart';
import { LiveDot } from './live-dot';
import { PartyTag } from './party';

const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : '—');
const compact = (n: number) =>
  n >= 1e6
    ? `${(n / 1e6).toFixed(2)}M`
    : n >= 1e3
      ? `${Math.round(n / 1e3)}K`
      : String(n);
const fmt = (n: number) => n.toLocaleString('en-NG');

type Cycle = 'all' | string; // 'all' or an election id

const subscribeNoop = () => () => {};
const readCycleParam = () =>
  new URLSearchParams(window.location.search).get('cycle');

/**
 * Analytics for a geopolitical zone or a state across election cycles.
 * "All cycles" shows trends; picking a cycle shows that election in detail.
 * The selection lives in the URL (?cycle=2023) so a view can be shared.
 */
export function RegionDashboard({
  overview,
  children,
}: {
  overview: RegionOverview;
  children?: React.ReactNode;
}) {
  const cycles = overview.cycles;
  // The URL (?cycle=2023) seeds the view; after that the user's pick wins.
  const urlYear = React.useSyncExternalStore(
    subscribeNoop,
    readCycleParam,
    () => null,
  );
  const [picked, setPicked] = React.useState<Cycle | null>(null);
  const cycle: Cycle =
    picked ??
    cycles.find((c) => String(c.year) === urlYear)?.electionId ??
    'all';

  function choose(v: string) {
    setPicked(v);
    const url = new URL(window.location.href);
    const c = cycles.find((x) => x.electionId === v);
    if (c) url.searchParams.set('cycle', String(c.year));
    else url.searchParams.delete('cycle');
    window.history.replaceState(null, '', url);
  }

  const selected = cycles.find((c) => c.electionId === cycle);
  const isZone = overview.kind === 'zone';

  // Chart by party family so a line continues through mergers
  // (AD, APP, ANPP, ACN, CPC -> APC); minor parties are left out.
  const familyShare = (c: CycleSummary, fam: string) =>
    c.parties.filter((x) => partyInfo(x.party).lineage === fam).reduce((s, x) => s + x.share, 0);
  const familyTotals = new Map<string, number>();
  const familyMembers = new Map<string, Set<string>>();
  for (const c of cycles)
    for (const x of c.parties) {
      const fam = partyInfo(x.party).lineage;
      if (fam === 'OTHER') continue;
      familyTotals.set(fam, (familyTotals.get(fam) ?? 0) + x.votes);
      if (x.party !== fam && x.votes > 0) (familyMembers.get(fam) ?? familyMembers.set(fam, new Set()).get(fam)!).add(x.party);
    }
  const families = [...familyTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([f]) => f);
  const merged = families.filter((f) => familyMembers.get(f)?.size);
  const shareData = cycles.map((c) => ({
    label: c.live ? `${c.year} (live)` : String(c.year),
    ...Object.fromEntries(families.map((f) => [f, Math.round(familyShare(c, f) * 1000) / 10])),
  }));
  // Years without a known register are left out rather than drawn as zero
  const turnoutData = cycles.filter((c) => Number.isFinite(c.turnout)).map((c) => ({
    label: c.live ? `${c.year} (live)` : String(c.year),
    turnout: Math.round(c.turnout * 1000) / 10,
  }));
  const registerData = cycles.filter((c) => c.registered > 0).map((c) => ({
    label: String(c.year),
    registered: c.registered,
  }));

  return (
    <div className='flex flex-col gap-6'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='text-paragraph-sm text-text-sub-600'>
          {selected
            ? `${selected.title}${selected.live ? ', results so far' : ''}.`
            : `Presidential elections ${cycles[0]?.year}–${cycles[cycles.length - 1]?.year}.`}
        </p>
        <SegmentedControl.Root
          value={cycle}
          onValueChange={choose}
          className='sm:w-auto'
        >
          <SegmentedControl.List
            className='sm:w-[420px]'
            aria-label='Election cycle'
          >
            <SegmentedControl.Trigger value='all' className='px-2'>
              All cycles
            </SegmentedControl.Trigger>
            {cycles.map((c) => (
              <SegmentedControl.Trigger
                key={c.electionId}
                value={c.electionId}
                className='gap-1 px-2'
              >
                {c.year}
                {c.live && <LiveDot />}
              </SegmentedControl.Trigger>
            ))}
          </SegmentedControl.List>
        </SegmentedControl.Root>
      </div>

      <Card className='grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:p-5 md:grid-cols-4'>
        {(selected ? cycleKpis(selected, isZone) : overallKpis(overview)).map(
          (k, i) => (
            // Stable slots so values roll (Calligraph) instead of remounting on a filter change
            <Kpi key={i} {...k} />
          ),
        )}
      </Card>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
        <Card>
          <CardHeader
            title='Party vote share by cycle'
            description={`Share of valid votes in ${overview.name}, presidential elections${
              merged.length
                ? `. ${merged.map((f) => `${f} includes ${[...familyMembers.get(f)!].join(', ')}`).join('; ')}`
                : ''
            }`}
          />
          <div className='px-2 pt-3 pb-3 sm:px-3'>
            <LineChart
              ariaLabel={`Party vote share in ${overview.name} by election cycle`}
              data={shareData}
              series={families.map((f) => ({ key: f, label: f, party: f }))}
              markers
              fillBetween
              height={260}
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title={
              selected ? `Result in ${selected.year}` : 'Who led each cycle'
            }
            description={
              selected ? 'Share of valid votes' : 'Leading party and its share'
            }
          />
          {selected ? (
            <PartyBars c={selected} />
          ) : (
            <LeadersByCycle cycles={cycles} />
          )}
        </Card>
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader
            title='Turnout'
            description='Votes cast as a share of registered voters'
          />
          <div className='px-2 pt-3 pb-3 sm:px-3'>
            <LineChart
              ariaLabel={`Turnout in ${overview.name} by cycle`}
              data={turnoutData}
              series={[
                {
                  key: 'turnout',
                  label: 'Turnout',
                  color: 'var(--primary-base)',
                  textColor: 'var(--text-strong-950)',
                },
              ]}
              yDomain={[0, 60]}
              yTicks={[0, 20, 40, 60]}
              markers
              fillBetween
              height={200}
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title='Registered voters'
            description='Size of the voter register at each election'
          />
          <div className='px-2 pt-3 pb-3 sm:px-3'>
            <LineChart
              ariaLabel={`Registered voters in ${overview.name} by cycle`}
              data={registerData}
              series={[
                {
                  key: 'registered',
                  label: 'Registered',
                  color: 'var(--information-base)',
                  textColor: 'var(--text-strong-950)',
                },
              ]}
              valueFormat='compact'
              markers
              fillBetween
              height={200}
            />
          </div>
        </Card>
      </div>

      {isZone &&
        (selected ? (
          <StatesTable c={selected} name={overview.name} />
        ) : (
          <StatesMatrix o={overview} />
        ))}

      {children}
    </div>
  );
}

type KpiData = {
  label: string;
  value: string;
  sub?: string;
  party?: PartyCode;
};

function overallKpis(o: RegionOverview): KpiData[] {
  const latestRegister = [...o.cycles].reverse().find((c) => c.registered > 0);
  const led = (Object.entries(o.overall.cyclesLedBy) as [PartyCode, number][]).sort((a, b) => b[1] - a[1])[0] as
    | [PartyCode, number]
    | undefined;
  const concluded = o.cycles.filter((c) => !c.live).length;
  const sw = o.overall.swingLatest;
  return [
    {
      label: 'Most often ahead',
      value: led ? led[0] : '—',
      sub: led ? `Led ${led[1]} of ${concluded} elections` : undefined,
      party: led?.[0],
    },
    {
      label: 'Registered voters',
      value: latestRegister ? compact(latestRegister.registered) : '—',
      sub: latestRegister
        ? Number.isFinite(o.overall.registeredGrowth)
          ? `${o.overall.registeredGrowth >= 0 ? '+' : ''}${pct(o.overall.registeredGrowth, 0)} since ${o.overall.registeredSince}`
          : `${latestRegister.year} register`
        : 'Not on record by state',
    },
    {
      label: 'Average turnout',
      value: pct(o.overall.averageTurnout),
      sub: `Across ${o.cycles.filter((c) => !c.live && Number.isFinite(c.turnout)).length} elections with a known register`,
    },
    {
      label: 'Biggest swing',
      value: sw
        ? `${sw.change >= 0 ? '+' : ''}${(sw.change * 100).toFixed(1)} pts`
        : '—',
      sub: sw ? `${sw.party}, last two completed elections` : undefined,
    },
  ];
}

function cycleKpis(c: CycleSummary, isZone: boolean): KpiData[] {
  const lead = c.parties[0];
  const second = c.parties[1];
  return [
    {
      label: c.live ? 'Leading' : 'Won by',
      value: lead?.party ?? '—',
      sub: lead
        ? `${pct(lead.share)}${second ? `, +${((lead.share - second.share) * 100).toFixed(1)} pts` : ''}`
        : undefined,
      party: lead?.party,
    },
    {
      label: c.live ? 'Votes counted' : 'Votes cast',
      value: compact(c.votes),
      sub: c.registered ? `${compact(c.registered)} registered` : 'Register not on record',
    },
    {
      label: c.live ? 'Turnout so far' : 'Turnout',
      value: pct(c.turnout),
      sub: c.live
        ? `${pct(c.reported, 0)} of units reported`
        : `${fmt(c.votes)} votes`,
    },
    isZone
      ? {
          label: 'States led',
          value: lead
            ? `${c.areasLed[lead.party] ?? 0}/${c.areas.length}`
            : '—',
          sub: (Object.entries(c.areasLed) as [PartyCode, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([p, n]) => `${p} ${n}`)
            .join(' · '),
        }
      : {
          label: 'Margin',
          value:
            lead && second
              ? `${((lead.share - second.share) * 100).toFixed(1)} pts`
              : '—',
          sub: second ? `Over ${second.party}` : undefined,
        },
  ];
}

function Kpi({ label, value, sub, party }: KpiData) {
  return (
    <div className='flex min-w-0 flex-col gap-1'>
      <span className='text-paragraph-xs text-text-sub-600'>{label}</span>
      <span className='text-title-h6 text-text-strong-950 flex items-center gap-2'>
        {party && (
          <span
            className='size-2.5 shrink-0 rounded-full'
            style={{ background: PARTIES[party].color }}
            aria-hidden
          />
        )}
        {/^[A-Z]+$/.test(value) ? (
          <AnimatedText value={value} />
        ) : (
          <AnimatedNumber value={value} />
        )}
      </span>
      {sub && (
        <span className='text-paragraph-xs text-text-sub-600 truncate'>
          {sub}
        </span>
      )}
    </div>
  );
}

function PartyBars({ c }: { c: CycleSummary }) {
  return (
    <ul
      className='reveal-items flex flex-col gap-3.5 p-4 sm:p-5'
      key={c.electionId}
    >
      {c.parties.map((p) => (
        <li key={p.party}>
          <div className='flex items-baseline justify-between gap-2'>
            <span className='text-label-sm text-text-strong-950 flex items-center gap-2'>
              <span
                className='size-2.5 rounded-full'
                style={{ background: PARTIES[p.party].color }}
                aria-hidden
              />
              {p.party}
              <span className='text-paragraph-xs text-text-sub-600 font-normal'>
                {PARTIES[p.party].name}
              </span>
            </span>
            <AnimatedNumber
              value={pct(p.share)}
              className='text-label-sm text-text-strong-950'
            />
          </div>
          <div className='bg-hover mt-1.5 h-1.5 overflow-hidden rounded-full'>
            <div
              className='h-full rounded-full transition-[width] duration-[240ms]'
              style={{
                width: `${p.share * 100}%`,
                background: PARTIES[p.party].color,
                transitionTimingFunction: 'var(--ease-slow)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function LeadersByCycle({ cycles }: { cycles: CycleSummary[] }) {
  return (
    <ul className='divide-stroke-soft-200 divide-y'>
      {cycles
        .slice()
        .reverse()
        .map((c) => {
          const lead = c.parties[0];
          return (
            <li
              key={c.electionId}
              className='flex items-center gap-3 px-4 py-3 sm:px-5'
            >
              <span className='tabular text-label-sm text-text-strong-950 w-12'>
                {c.year}
              </span>
              {lead && <PartyTag code={lead.party} />}
              <span className='text-paragraph-xs text-text-sub-600 flex-1'>
                {c.live ? 'leading so far' : 'won'}
              </span>
              <span className='tabular text-label-sm text-text-strong-950'>
                {lead ? pct(lead.share) : '—'}
              </span>
            </li>
          );
        })}
    </ul>
  );
}

type StateSort = 'votes' | 'reported' | 'name' | 'turnout' | 'margin';
const STATE_SORTERS: Record<StateSort, (a: AreaRow, b: AreaRow) => number> = {
  votes: (a, b) => b.votes - a.votes,
  reported: (a, b) => b.reported - a.reported || b.votes - a.votes,
  name: (a, b) => a.name.localeCompare(b.name),
  turnout: (a, b) => (Number.isFinite(b.turnout) ? b.turnout : -1) - (Number.isFinite(a.turnout) ? a.turnout : -1),
  margin: (a, b) => (a.lead ? a.margin : 2) - (b.lead ? b.margin : 2),
};

function StatesTable({ c, name }: { c: CycleSummary; name: string }) {
  const [sort, setSort] = React.useState<StateSort>('votes');
  const rows = useSorted(c.areas, sort, STATE_SORTERS);
  const options: SortOption<StateSort>[] = [
    { value: 'votes', label: 'Votes' },
    ...(c.live ? [{ value: 'reported' as const, label: 'Reported' }] : []),
    { value: 'name', label: 'Alphabetical' },
    { value: 'turnout', label: 'Turnout' },
    { value: 'margin', label: 'Closest race' },
  ];
  return (
    <Card>
      <CardHeader
        title={`States in ${name}, ${c.year}`}
        description='Click a state for its own analytics'
        action={<SortMenu value={sort} onChange={setSort} options={options} />}
      />
      <div className='overflow-x-auto'>
        <div className='min-w-[640px]'>
          <div className='bg-hover text-label-xs text-text-sub-600 grid grid-cols-[minmax(0,1.4fr)_1fr_0.8fr_0.8fr_0.9fr_1fr_20px] gap-3 px-4 py-2 sm:px-5'>
            <span>State</span>
            <span>{c.live ? 'Leading' : 'Won by'}</span>
            <span className='text-right'>Share</span>
            <span className='text-right'>Margin</span>
            <span className='text-right'>Turnout</span>
            <span className='text-right'>Votes</span>
            <span />
          </div>
          <FluidHover
            as='ul'
            className='reveal-items p-1'
            radius={10}
            gapClick={4}
            key={c.electionId}
          >
            {rows.map((a) => (
              <li key={a.code} data-fluid-item className='relative'>
                <Link
                  href={`/states/${a.code}?cycle=${c.year}` as Route}
                  className='text-paragraph-sm text-text-strong-950 grid grid-cols-[minmax(0,1.4fr)_1fr_0.8fr_0.8fr_0.9fr_1fr_20px] items-center gap-3 rounded-[10px] px-3 py-2.5 sm:px-4'
                >
                  <span className='truncate'>{a.name}</span>
                  <span>
                    {a.lead ? (
                      <PartyTag code={a.lead.party} />
                    ) : (
                      <span className='text-paragraph-xs text-text-sub-600'>
                        Awaiting
                      </span>
                    )}
                  </span>
                  <span className='tabular text-right'>
                    {a.lead ? pct(a.lead.share) : '—'}
                  </span>
                  <span className='tabular text-text-sub-600 text-right'>
                    {a.lead ? `+${(a.margin * 100).toFixed(1)}` : '—'}
                  </span>
                  <span className='tabular text-text-sub-600 text-right'>
                    {a.votes ? pct(a.turnout) : '—'}
                  </span>
                  <span className='tabular text-right'>
                    {a.votes ? compact(a.votes) : '—'}
                  </span>
                  <IconChevronRight className='text-text-sub-600 size-4' />
                </Link>
              </li>
            ))}
          </FluidHover>
        </div>
      </div>
    </Card>
  );
}

/** All cycles: one row per state, one column per cycle, leading party in each cell. */
function StatesMatrix({ o }: { o: RegionOverview }) {
  return (
    <Card>
      <CardHeader
        title={`States in ${o.name}, every cycle`}
        description='Leading party and share in each state. Click a state for its own analytics.'
      />
      <div className='overflow-x-auto'>
        <div className='min-w-[560px]'>
          <div
            className='bg-hover text-label-xs text-text-sub-600 grid gap-3 px-4 py-2 sm:px-5'
            style={{
              gridTemplateColumns: `minmax(0,1.3fr) repeat(${o.cycles.length}, minmax(0,1fr)) 20px`,
            }}
          >
            <span>State</span>
            {o.cycles.map((c) => (
              <span key={c.electionId} className='flex items-center gap-1.5'>
                {c.year}
                {c.live && <LiveDot />}
              </span>
            ))}
            <span />
          </div>
          <FluidHover as='ul' className='p-1' radius={10} gapClick={4}>
            {o.areaCodes.map((code) => {
              const name = o.cycles[0].areas.find((a) => a.code === code)!.name;
              return (
                <li key={code} data-fluid-item className='relative'>
                  <Link
                    href={`/states/${code}` as Route}
                    className='text-paragraph-sm text-text-strong-950 grid items-center gap-3 rounded-[10px] px-3 py-2.5 sm:px-4'
                    style={{
                      gridTemplateColumns: `minmax(0,1.3fr) repeat(${o.cycles.length}, minmax(0,1fr)) 20px`,
                    }}
                  >
                    <span className='truncate'>{name}</span>
                    {o.cycles.map((c) => {
                      const a = c.areas.find((x) => x.code === code)!;
                      return (
                        <span
                          key={c.electionId}
                          className={cn(
                            'flex items-center gap-1.5',
                            !a.lead && 'text-text-sub-600',
                          )}
                        >
                          {a.lead ? (
                            <>
                              <span
                                className='size-2 shrink-0 rounded-full'
                                style={{
                                  background: PARTIES[a.lead.party].color,
                                }}
                                aria-hidden
                              />
                              <span className='text-label-xs'>
                                {a.lead.party}
                              </span>
                              <span className='tabular text-paragraph-xs text-text-sub-600'>
                                {pct(a.lead.share, 0)}
                              </span>
                            </>
                          ) : (
                            <span className='text-paragraph-xs'>—</span>
                          )}
                        </span>
                      );
                    })}
                    <IconChevronRight className='text-text-sub-600 size-4' />
                  </Link>
                </li>
              );
            })}
          </FluidHover>
        </div>
      </div>
    </Card>
  );
}
