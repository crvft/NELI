import Link from 'next/link';
import { RiArrowRightSLine, RiCalendarLine, RiInformationLine, RiScales3Line } from '@remixicon/react';
import { ELECTION_TYPE_LABEL, personById, type Election } from '@/lib/data';
import { stateByCode } from '@/lib/geo';
import { PARTIES } from '@/lib/parties';
import {
  countedVotes,
  fmt,
  fmtCompact,
  forecast,
  liveProbabilities,
  pct,
  previousComparable,
  probabilityTimeline,
  shareTimeline,
  registeredTotal,
  reportingProgress,
  spreadCount,
  tally,
  totalVotes,
  zoneBreakdown,
} from '@/lib/analytics';
import { Card, CardHeader, Stat } from './card';
import { PageContainer, PageHeader, SampleBadge } from './page-header';
import { LiveDot } from './live-dot';
import { ResultsList } from './results-list';
import { NigeriaMap } from './nigeria-map';
import { MapGuide } from './map-guide';
import { LineChart, VersusTitle } from './line-chart';
import { mapPayload } from '@/lib/map-data';
import { ZoneBars } from './zone-bars';
import { ShareBar, MeterBar } from './share-bar';
import { PartyTag } from './party';
import { PersonAvatar } from './avatar';
import { ExpandableCard } from './expandable-card';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function ElectionView({ e }: { e: Election }) {
  if (e.status === 'upcoming') return <UpcomingView e={e} />;
  const live = e.status === 'live';
  const t = tally(e);
  const total = totalVotes(t);
  const reg = registeredTotal(e);
  const progress = reportingProgress(e);
  const probs = live ? liveProbabilities(e) : undefined;
  const national = e.level === 'national';
  const spread = national ? spreadCount(e) : undefined;
  const leader = t[0];
  const runnerUp = t[1];
  const declared = live ? e.areas.filter((a) => (e.reported?.[a.code] ?? 0) >= 1).length : e.areas.length;
  const winnerId = live ? undefined : leader.personId;
  const timeline = live ? probabilityTimeline(e) : undefined;
  const series = e.candidates.map((c) => ({ key: c.personId, label: t.find((x) => x.personId === c.personId)!.name, party: c.party }));
  const topProb = probs?.[0];
  const topProbName = topProb ? t.find((x) => x.personId === topProb.personId)!.name : '';
  const mapData = national ? mapPayload(e) : undefined;
  const shares = live ? shareTimeline(e) : undefined;
  const chartSeries = series;

  return (
    <PageContainer className='flex flex-col gap-6'>
      <PageHeader
        eyebrow={
          <>
            {live ? <LiveDot label /> : <span className='text-label-xs uppercase tracking-wide text-text-soft-400'>Final result</span>}
            <span className='text-paragraph-xs text-text-soft-400'>·</span>
            <span className='text-paragraph-xs text-text-sub-600'>{ELECTION_TYPE_LABEL[e.type]}</span>
            <SampleBadge />
          </>
        }
        title={e.title}
        description={
          live
            ? `Votes counted so far, updated as INEC result sheets are uploaded. Last update ${new Date(e.updatedAt!).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })} WAT.`
            : `Held on ${formatDate(e.date)}${e.stateCode ? ` in ${stateByCode(e.stateCode).name} State` : ''}${e.constituency ? `, ${e.constituency}` : ''}.`
        }
      />

      {national && mapData && (
        <Card className='overflow-hidden'>
          <NigeriaMap
            data={mapData}
            title={
              <div className='mb-2 flex flex-wrap items-end justify-between gap-3'>
                <div>
                  <div className='text-subheading-xs uppercase tracking-[0.1em] text-text-soft-400'>{live ? 'Live map' : 'Result map'} · {e.year}</div>
                  <h2 className='mt-1 text-title-h6 tracking-tight text-text-strong-950 sm:text-title-h5'>Who is leading where</h2>
                  <p className='mt-1 text-paragraph-sm text-text-sub-600'>Each state is coloured by its leading party. Stronger colour means a bigger lead.</p>
                </div>
              </div>
            }
            footer={<div className='mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-stroke-soft-200 pt-5 md:grid-cols-4'>
        {live ? (
          <Stat label='Polling units reported' value={pct(progress, 0)} sub={<MeterBar value={progress} color='var(--primary-base)' className='mt-1' />} />
        ) : (
          <Stat label='Winner' value={<span className='text-label-lg'>{leader.name}</span>} sub={`${leader.party} · ${pct(leader.share)}`} />
        )}
        <Stat label={live ? 'Votes counted' : 'Total valid votes'} value={fmtCompact(total)} sub={`${fmt(total)} votes`} />
        <Stat label={live ? 'Turnout so far' : 'Turnout'} value={pct(total / reg / (live ? Math.max(progress, 0.01) : 1))} sub={`${fmtCompact(reg)} registered`} />
        <Stat
          label={live ? `${e.areaLabel}s fully declared` : 'Winning margin'}
          value={live ? `${declared}/${e.areas.length}` : fmtCompact(leader.votes - (runnerUp?.votes ?? 0))}
          sub={live ? `${e.areas.filter((a) => !(e.reported?.[a.code] ?? 0)).length} yet to report` : `${pct(leader.share - (runnerUp?.share ?? 0))} ahead of ${runnerUp?.party}`}
        />
      </div>}
            overview={<MapGuide data={mapData} spread={spread} names={t} isPresidential={e.type === 'presidential'} />}
          />
        </Card>
      )}

      {!national && (
        <Card className='grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:p-5 md:grid-cols-4'>
        {live ? (
          <Stat label='Polling units reported' value={pct(progress, 0)} sub={<MeterBar value={progress} color='var(--primary-base)' className='mt-1' />} />
        ) : (
          <Stat label='Winner' value={<span className='text-label-lg'>{leader.name}</span>} sub={`${leader.party} · ${pct(leader.share)}`} />
        )}
        <Stat label={live ? 'Votes counted' : 'Total valid votes'} value={fmtCompact(total)} sub={`${fmt(total)} votes`} />
        <Stat label={live ? 'Turnout so far' : 'Turnout'} value={pct(total / reg / (live ? Math.max(progress, 0.01) : 1))} sub={`${fmtCompact(reg)} registered`} />
        <Stat
          label={live ? `${e.areaLabel}s fully declared` : 'Winning margin'}
          value={live ? `${declared}/${e.areas.length}` : fmtCompact(leader.votes - (runnerUp?.votes ?? 0))}
          sub={live ? `${e.areas.filter((a) => !(e.reported?.[a.code] ?? 0)).length} yet to report` : `${pct(leader.share - (runnerUp?.share ?? 0))} ahead of ${runnerUp?.party}`}
        />
      </Card>
      )}

      <div className='flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_380px]'>
        <div className='contents min-w-0 flex-col gap-6 lg:flex'>
          <Card className='order-1'>
            <CardHeader
              title={live ? 'Leading candidates' : 'Results'}
              description={live ? 'Share of votes counted so far' : 'Share of total valid votes'}
              action={<ShareBar tally={t} className='mt-1 w-28 sm:w-40' height='h-2' />}
            />
            <ResultsList tally={t} probs={probs} winnerId={winnerId} spread={spread} />
          </Card>

          {live && shares && probs && (
            <Card className='order-3'>
              <div className='flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5'>
                <VersusTitle title='Vote share as results come in' a={{ label: t[0].name, party: t[0].party }} b={t[1] && { label: t[1].name, party: t[1].party }} />
                <span className='rounded-md bg-bg-weak-50 px-2 py-1 text-paragraph-xs text-text-sub-600'>Dotted: projected final</span>
              </div>
              <div className='px-2 pb-3 pt-2 sm:px-3'>
                <LineChart
                  ariaLabel='Vote share over election night with projected final shares'
                  data={shares}
                  series={chartSeries.map((s) => ({ ...s, projected: Math.round((probs.find((p) => p.personId === s.key)?.projectedShare ?? 0) * 1000) / 10 }))}
                  fillBetween
                  projectionLabel='Final'
                  height={300}
                />
              </div>
            </Card>
          )}

          <div className='order-5'>
            <AreaTable e={e} />
          </div>
        </div>

        <div className='contents min-w-0 flex-col gap-6 lg:flex'>
          {live && probs && timeline && topProb && (
            <Card className='order-2'>
              <CardHeader title='Chance of winning' description='Simulated from counted votes and past results' icon={<RiScales3Line className='size-5' />} />
              <div className='p-4 sm:p-5'>
                <div className='flex items-center gap-3'>
                  <PersonAvatar name={topProbName} party={topProb.party} size='lg' />
                  <div>
                    <div className='tabular text-title-h4 text-text-strong-950'>{pct(topProb.prob, 0)}</div>
                    <div className='text-paragraph-xs text-text-sub-600'>
                      {topProbName} ({topProb.party}) wins in {Math.round(topProb.prob * 100)} of 100 simulations
                    </div>
                  </div>
                </div>
              </div>
              <div className='px-1 pb-2'>
                <LineChart
                  ariaLabel='Chance of winning through election night'
                  data={timeline}
                  series={chartSeries.filter((s) => (probs.find((p) => p.personId === s.key)?.prob ?? 0) > 0.005 || s.key === topProb.personId)}
                  yDomain={[0, 100]}
                  yTicks={[0, 25, 50, 75, 100]}
                  fillBetween
                  height={240}
                />
              </div>
              <div className='flex flex-col gap-2 border-t border-stroke-soft-200 p-4 sm:p-5'>
                <div className='text-subheading-xs uppercase tracking-[0.1em] text-text-soft-400'>Projected final share</div>
                {probs.map((p) => (
                  <div key={p.personId} className='flex items-center justify-between text-paragraph-xs text-text-sub-600'>
                    <span className='flex items-center gap-1.5'>
                      <span className='size-2 rounded-full' style={{ background: PARTIES[p.party].color }} />
                      {t.find((x) => x.personId === p.personId)!.name}
                    </span>
                    <span className='tabular text-label-xs text-text-strong-950'>{pct(p.projectedShare)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {national && (
            <Card className='order-4'>
              <CardHeader title='By geopolitical zone' description='Vote share in each of the six zones' />
              <div className='p-4 sm:p-5'>
                <ZoneBars rows={zoneBreakdown(e)} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function AreaTable({ e }: { e: Election }) {
  const t = tally(e);
  const name = (id: string) => t.find((x) => x.personId === id)!.name;
  const rows = e.areas
    .map((a) => {
      const v = countedVotes(e, a.code);
      const sum = Object.values(v).reduce((x, y) => x + y, 0);
      const sorted = Object.entries(v).sort((x, y) => y[1] - x[1]);
      const lead = sorted[0];
      const second = sorted[1];
      return {
        a,
        sum,
        lead: sum ? { id: lead[0], party: e.candidates.find((c) => c.personId === lead[0])!.party, share: lead[1] / sum } : null,
        margin: sum && second ? (lead[1] - second[1]) / sum : 0,
        reported: e.status === 'live' ? (e.reported?.[a.code] ?? 0) : 1,
      };
    })
    .sort((x, y) => y.sum - x.sum);
  return (
    <ExpandableCard total={rows.length} limit={10} noun={e.areaLabel.toLowerCase()}>
      <CardHeader title={`Results by ${e.areaLabel.toLowerCase()}`} description={`${e.areas.length} ${e.areaLabel.toLowerCase()}s, sorted by votes counted`} />
      <div className='overflow-x-auto'>
        <table className='w-full min-w-[560px] text-left'>
          <thead>
            <tr className='text-label-xs text-text-sub-600'>
              <th className='bg-bg-weak-50 px-4 py-2 font-medium sm:px-5'>{e.areaLabel}</th>
              {e.status === 'live' && <th className='bg-bg-weak-50 px-3 py-2 font-medium'>Reported</th>}
              <th className='bg-bg-weak-50 px-3 py-2 font-medium'>Leading</th>
              <th className='bg-bg-weak-50 px-3 py-2 text-right font-medium'>Share</th>
              <th className='bg-bg-weak-50 px-3 py-2 text-right font-medium'>Margin</th>
              <th className='bg-bg-weak-50 px-4 py-2 text-right font-medium sm:px-5'>Votes</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-stroke-soft-200'>
            {rows.map((r, i) => (
              <tr key={r.a.code} className={`${i >= 10 ? 'group-data-[collapsed=true]/tbl:hidden' : ''} text-paragraph-sm text-text-strong-950 transition hover:bg-bg-weak-50`}>
                <td className='px-4 py-2.5 sm:px-5'>
                  {e.level === 'national' ? (
                    <Link href={`/states/${r.a.code}`} className='hover:underline'>
                      {r.a.name}
                    </Link>
                  ) : (
                    r.a.name
                  )}
                </td>
                {e.status === 'live' && (
                  <td className='px-3 py-2.5'>
                    <div className='flex items-center gap-2'>
                      <MeterBar value={r.reported} color='var(--text-sub-600)' className='w-14' />
                      <span className='tabular text-paragraph-xs text-text-sub-600'>{Math.round(r.reported * 100)}%</span>
                    </div>
                  </td>
                )}
                <td className='px-3 py-2.5'>
                  {r.lead ? (
                    <span className='flex items-center gap-2'>
                      <PartyTag code={r.lead.party} />
                      <span className='hidden truncate text-paragraph-xs text-text-sub-600 md:inline'>{name(r.lead.id)}</span>
                    </span>
                  ) : (
                    <span className='text-paragraph-xs text-text-soft-400'>Awaiting</span>
                  )}
                </td>
                <td className='tabular px-3 py-2.5 text-right'>{r.lead ? pct(r.lead.share) : '—'}</td>
                <td className='tabular px-3 py-2.5 text-right text-text-sub-600'>{r.lead ? `+${pct(r.margin)}` : '—'}</td>
                <td className='tabular px-4 py-2.5 text-right sm:px-5'>{r.sum ? fmt(r.sum) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ExpandableCard>
  );
}

function UpcomingView({ e }: { e: Election }) {
  const f = forecast(e);
  const prev = previousComparable(e);
  const days = Math.ceil((new Date(e.date).getTime() - new Date('2026-11-18').getTime()) / 86400000);
  return (
    <PageContainer className='flex flex-col gap-6'>
      <PageHeader
        eyebrow={
          <>
            <span className='inline-flex h-6 items-center gap-1.5 rounded-md bg-information-lighter px-2 text-label-xs text-information-dark'>
              <RiCalendarLine className='size-3.5' /> Upcoming · in {days} days
            </span>
            <SampleBadge />
          </>
        }
        title={e.title}
        description={`Scheduled for ${formatDate(e.date)}. The forecast is based on past results for this seat, incumbency and each candidate's track record.`}
      />
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
        <Card>
          <CardHeader title='Forecast' description='Chance of winning and projected vote share' />
          <ForecastList e={e} rows={f} />
        </Card>
        <div className='flex flex-col gap-6'>
          {prev && (
            <Card>
              <CardHeader title={`Last time: ${prev.year}`} description={prev.title} />
              <div className='p-4 sm:p-5'>
                <ShareBar tally={tally(prev)} />
                <ul className='mt-4 flex flex-col gap-2'>
                  {tally(prev).map((x) => (
                    <li key={x.personId} className='flex items-center justify-between gap-2 text-paragraph-xs text-text-sub-600'>
                      <span className='flex items-center gap-1.5 truncate'>
                        <span className='size-2 rounded-full' style={{ background: PARTIES[x.party].color }} />
                        {x.name} ({x.party})
                      </span>
                      <span className='tabular text-label-xs text-text-strong-950'>{pct(x.share)}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/elections/${prev.id}`} className='mt-4 inline-flex items-center gap-1 text-label-sm text-primary-base hover:underline'>
                  See full {prev.year} results <RiArrowRightSLine className='size-4' />
                </Link>
              </div>
            </Card>
          )}
          <Card className='p-4 sm:p-5'>
            <div className='flex items-start gap-2.5'>
              <RiInformationLine className='mt-0.5 size-5 shrink-0 text-text-soft-400' />
              <p className='text-paragraph-xs text-text-sub-600'>
                Forecasts are probabilities, not predictions. A 70% chance still loses 3 times in 10. Once voting starts, this page switches to live results.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

export function ForecastList({ e, rows }: { e: Election; rows: ReturnType<typeof forecast> }) {
  return (
    <ul className='divide-y divide-stroke-soft-200'>
      {rows.map((r) => {
        const name = e.candidates.find((c) => c.personId === r.personId) && personName(r.personId);
        return (
          <li key={r.personId} className='flex flex-col gap-3 px-4 py-4 sm:px-5'>
            <div className='flex items-center gap-3'>
              <PersonAvatar name={name ?? ''} party={r.party} />
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Link href={`/politicians/${r.personId}`} className='text-label-sm text-text-strong-950 hover:underline'>
                    {name}
                  </Link>
                  <PartyTag code={r.party} />
                </div>
                <div className='tabular mt-0.5 text-paragraph-xs text-text-sub-600'>Projected share {pct(r.share)}</div>
              </div>
              <div className='text-right'>
                <div className='tabular text-label-lg text-text-strong-950'>{pct(r.prob, 0)}</div>
                <div className='text-paragraph-xs text-text-soft-400'>to win</div>
              </div>
            </div>
            <MeterBar value={r.prob} color={PARTIES[r.party].color} />
            {r.factors.length > 0 && (
              <div className='flex flex-wrap gap-1.5'>
                {r.factors.map((f) => (
                  <span key={f} className='rounded-md bg-bg-weak-50 px-2 py-0.5 text-paragraph-xs text-text-sub-600'>
                    {f}
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function personName(id: string) {
  return personById(id)?.name ?? id;
}
