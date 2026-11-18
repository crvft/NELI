import Link from 'next/link';
import {
  IconCalendar,
  IconChevronRight,
  IconInfo,
  IconScale,
} from '@/components/icons';
import { ELECTION_TYPE_LABEL, electionWhen, type Election, type Person } from '@/lib/domain';
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
  turnoutOf,
  reportingProgress,
  spreadCount,
  tally,
  totalVotes,
  zoneBreakdown,
} from '@/lib/analytics';
import { Card, CardHeader, Stat } from './card';
import { PageContainer, PageHeader } from './page-header';
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
import { ResultsTable, type ResultRow } from './results-table';


/** Election page body. `all` and `people` are passed in by the page (from the data layer). */
export function ElectionView({
  e,
  all,
  people,
}: {
  e: Election;
  all: Election[];
  people: Person[];
}) {
  if (e.status === 'upcoming')
    return <UpcomingView e={e} all={all} people={people} />;
  const live = e.status === 'live';
  const t = tally(e);
  const total = totalVotes(t);
  const reg = registeredTotal(e);
  const progress = reportingProgress(e);
  const probs = live ? liveProbabilities(e, all) : undefined;
  const national = e.level === 'national';
  const spread = national ? spreadCount(e) : undefined;
  const leader = t[0];
  const runnerUp = t[1];
  const declared = live
    ? e.areas.filter((a) => (e.reported?.[a.code] ?? 0) >= 1).length
    : e.areas.length;
  const winnerId = live ? undefined : leader.personId;
  const timeline = live ? probabilityTimeline(e, all) : undefined;
  const series = e.candidates.map((c) => ({
    key: c.personId,
    label: t.find((x) => x.personId === c.personId)!.name,
    party: c.party,
  }));
  const topProb = probs?.[0];
  const topProbName = topProb
    ? t.find((x) => x.personId === topProb.personId)!.name
    : '';
  const mapData = national ? mapPayload(e) : undefined;
  const shares = live ? shareTimeline(e) : undefined;
  const chartSeries = series;

  return (
    <PageContainer className='flex flex-col gap-6'>
      <PageHeader
        badges={
          <>
            {live ? (
              <LiveDot label />
            ) : (
              <span className='text-label-xs text-text-sub-600'>
                Final result
              </span>
            )}
            <span className='text-paragraph-xs text-text-sub-600'>·</span>
            <span className='text-paragraph-xs text-text-sub-600'>
              {ELECTION_TYPE_LABEL[e.type]}
            </span>
          </>
        }
        title={e.title}
        description={
          live
            ? `Votes counted so far, updated as INEC result sheets are uploaded. Last update ${new Date(e.updatedAt!).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })} WAT.`
            : `${e.date ? `Held on ${electionWhen(e)}` : `Held in ${e.year}`}${e.stateCode ? ` in ${stateByCode(e.stateCode).name} State` : ''}${e.constituency ? `, ${e.constituency}` : ''}.`
        }
      />

      {national && mapData && (
        <Card className='overflow-hidden'>
          <NigeriaMap
            data={mapData}
            title={
              <div className='mb-2 flex flex-wrap items-end justify-between gap-3'>
                <div>
                  <h2 className='text-title-h6 text-text-strong-950 sm:text-title-h5 tracking-tight'>
                    {live ? 'Who is leading where' : 'Who won where'}
                  </h2>
                  <p className='text-paragraph-sm text-text-sub-600 mt-1'>
                    Each state is coloured by its {live ? 'leading' : 'winning'}{' '}
                    party. Stronger colour means a bigger lead.
                  </p>
                </div>
              </div>
            }
            footer={
              <div className='border-stroke-soft-200 mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t pt-5 md:grid-cols-4'>
                {live ? (
                  <Stat
                    label='Polling units reported'
                    value={pct(progress, 0)}
                    sub={
                      <MeterBar
                        value={progress}
                        color='var(--primary-base)'
                        className='mt-1'
                      />
                    }
                  />
                ) : (
                  <Stat
                    label='Winner'
                    value={<span className='text-label-lg'>{leader.name}</span>}
                    sub={`${leader.party} · ${pct(leader.share)}`}
                  />
                )}
                <Stat
                  label={live ? 'Votes counted' : 'Total valid votes'}
                  value={fmtCompact(total)}
                  sub={`${fmt(total)} votes`}
                />
                <Stat
                  label={live ? 'Turnout so far' : 'Turnout'}
                  value={pct(
                    turnoutOf(total, reg * (live ? Math.max(progress, 0.01) : 1)),
                  )}
                  sub={reg ? `${fmtCompact(reg)} registered` : 'Register not on record'}
                />
                <Stat
                  label={
                    live ? `${e.areaLabel}s fully declared` : 'Winning margin'
                  }
                  value={
                    live
                      ? `${declared}/${e.areas.length}`
                      : fmtCompact(leader.votes - (runnerUp?.votes ?? 0))
                  }
                  sub={
                    live
                      ? `${e.areas.filter((a) => !(e.reported?.[a.code] ?? 0)).length} yet to report`
                      : `${pct(leader.share - (runnerUp?.share ?? 0))} ahead of ${runnerUp?.party}`
                  }
                />
              </div>
            }
            overview={
              <MapGuide
                data={mapData}
                spread={spread}
                names={t}
                isPresidential={e.type === 'presidential'}
              />
            }
          />
        </Card>
      )}

      {!national && (
        <Card className='grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:p-5 md:grid-cols-4'>
          {live ? (
            <Stat
              label='Polling units reported'
              value={pct(progress, 0)}
              sub={
                <MeterBar
                  value={progress}
                  color='var(--primary-base)'
                  className='mt-1'
                />
              }
            />
          ) : (
            <Stat
              label='Winner'
              value={<span className='text-label-lg'>{leader.name}</span>}
              sub={`${leader.party} · ${pct(leader.share)}`}
            />
          )}
          <Stat
            label={live ? 'Votes counted' : 'Total valid votes'}
            value={fmtCompact(total)}
            sub={`${fmt(total)} votes`}
          />
          <Stat
            label={live ? 'Turnout so far' : 'Turnout'}
            value={pct(turnoutOf(total, reg * (live ? Math.max(progress, 0.01) : 1)))}
            sub={reg ? `${fmtCompact(reg)} registered` : 'Register not on record'}
          />
          <Stat
            label={live ? `${e.areaLabel}s fully declared` : 'Winning margin'}
            value={
              live
                ? `${declared}/${e.areas.length}`
                : fmtCompact(leader.votes - (runnerUp?.votes ?? 0))
            }
            sub={
              live
                ? `${e.areas.filter((a) => !(e.reported?.[a.code] ?? 0)).length} yet to report`
                : `${pct(leader.share - (runnerUp?.share ?? 0))} ahead of ${runnerUp?.party}`
            }
          />
        </Card>
      )}

      {/* One grid, row by row: cards that sit side by side share a row, so they always
          end at the same height; on phones they stack in reading order. */}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
        <Card>
          <CardHeader
            title={live ? 'Leading candidates' : 'Results'}
            description={
              live
                ? 'Share of votes counted so far'
                : 'Share of total valid votes'
            }
            action={
              <ShareBar tally={t} className='mt-1 w-28 sm:w-40' height='h-2' />
            }
          />
          <ResultsList
            tally={t}
            probs={probs}
            winnerId={winnerId}
            spread={spread}
          />
        </Card>
        {live && probs && timeline && topProb && (
          <Card>
            <CardHeader
              title='Chance of winning'
              description='Simulated from counted votes and past results'
              icon={<IconScale className='size-5' />}
            />
            <div className='p-4 sm:p-5'>
              <div className='flex items-center gap-3'>
                <PersonAvatar
                  name={topProbName}
                  party={topProb.party}
                  size='lg'
                />
                <div>
                  <div className='tabular text-title-h4 text-text-strong-950'>
                    {pct(topProb.prob, 0)}
                  </div>
                  <div className='text-paragraph-xs text-text-sub-600'>
                    {topProbName} ({topProb.party}) wins in{' '}
                    {Math.round(topProb.prob * 100)} of 100 simulations
                  </div>
                </div>
              </div>
            </div>
            <div className='px-1 pb-2'>
              <LineChart
                ariaLabel='Chance of winning through election night'
                data={timeline}
                series={chartSeries.filter(
                  (s) =>
                    (probs.find((p) => p.personId === s.key)?.prob ?? 0) >
                      0.005 || s.key === topProb.personId,
                )}
                yDomain={[0, 100]}
                yTicks={[0, 25, 50, 75, 100]}
                fillBetween
                height={240}
              />
            </div>
            <div className='border-stroke-soft-200 flex flex-col gap-2 border-t p-4 sm:p-5'>
              <h3 className='text-label-sm text-text-strong-950'>
                Projected final share
              </h3>
              {probs.map((p) => (
                <div
                  key={p.personId}
                  className='text-paragraph-xs text-text-sub-600 flex items-center justify-between'
                >
                  <span className='flex items-center gap-1.5'>
                    <span
                      className='size-2 rounded-full'
                      style={{ background: PARTIES[p.party].color }}
                    />
                    {t.find((x) => x.personId === p.personId)!.name}
                  </span>
                  <span className='tabular text-label-xs text-text-strong-950'>
                    {pct(p.projectedShare)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {live && shares && probs && (
          <Card>
            <div className='flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5'>
              <VersusTitle
                title='Vote share as results come in'
                a={{ label: t[0].name, party: t[0].party }}
                b={t[1] && { label: t[1].name, party: t[1].party }}
              />
              <span className='bg-bg-weak-50 text-paragraph-xs text-text-sub-600 rounded-md px-2 py-1'>
                Dotted: projected final
              </span>
            </div>
            <div className='px-2 pt-2 pb-3 sm:px-3'>
              <LineChart
                ariaLabel='Vote share over election night with projected final shares'
                data={shares}
                series={chartSeries.map((s) => ({
                  ...s,
                  projected:
                    Math.round(
                      (probs.find((p) => p.personId === s.key)
                        ?.projectedShare ?? 0) * 1000,
                    ) / 10,
                }))}
                fillBetween
                projectionLabel='Final'
                height={300}
              />
            </div>
          </Card>
        )}
        {national && (
          <Card>
            <CardHeader
              title='By geopolitical zone'
              description='Vote share in each of the six zones'
            />
            <div className='p-4 sm:p-5'>
              <ZoneBars rows={zoneBreakdown(e)} />
            </div>
          </Card>
        )}
      </div>

      {/* Full width so every column (incl. votes) fits without scrolling inside the card */}
      <AreaTable e={e} />
    </PageContainer>
  );
}

function AreaTable({ e }: { e: Election }) {
  const live = e.status === 'live';
  const rows: ResultRow[] = e.areas.map((a) => {
    const v = countedVotes(e, a.code);
    const sum = Object.values(v).reduce((x, y) => x + y, 0);
    const [lead, second] = Object.entries(v).sort((x, y) => y[1] - x[1]);
    const c = lead && e.candidates.find((x) => x.personId === lead[0]);
    return {
      code: a.code,
      name: a.name,
      href: e.level === 'national' ? `/states/${a.code}` : undefined,
      votes: sum,
      reported: live ? (e.reported?.[a.code] ?? 0) : 1,
      margin: sum && second ? (lead[1] - second[1]) / sum : 0,
      lead: sum && c ? { name: c.name ?? c.personId, party: c.party, share: lead[1] / sum } : null,
    };
  });
  return <ResultsTable rows={rows} areaLabel={e.areaLabel} live={live} />;
}

function UpcomingView({
  e,
  all,
  people,
}: {
  e: Election;
  all: Election[];
  people: Person[];
}) {
  const f = forecast(e, all, people);
  const prev = previousComparable(e, all);
  return (
    <PageContainer className='flex flex-col gap-6'>
      <PageHeader
        badges={
          <>
            <span className='bg-information-lighter text-label-xs text-information-dark inline-flex h-6 items-center gap-1.5 rounded-md px-2'>
              <IconCalendar className='size-3.5' /> Upcoming · {electionWhen(e, 'short')}
            </span>
          </>
        }
        title={e.title}
        description={`Scheduled for ${electionWhen(e)}. The forecast is based on past results for this seat, incumbency and each candidate's track record.`}
      />
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
        <Card>
          <CardHeader
            title='Forecast'
            description='Chance of winning and projected vote share'
          />
          <ForecastList e={e} rows={f} />
        </Card>
        <div className='flex flex-col gap-6'>
          {prev && (
            <Card>
              <CardHeader
                title={`Last time: ${prev.year}`}
                description={prev.title}
              />
              <div className='p-4 sm:p-5'>
                <ShareBar tally={tally(prev)} />
                <ul className='mt-4 flex flex-col gap-2'>
                  {tally(prev).map((x) => (
                    <li
                      key={x.personId}
                      className='text-paragraph-xs text-text-sub-600 flex items-center justify-between gap-2'
                    >
                      <span className='flex items-center gap-1.5 truncate'>
                        <span
                          className='size-2 rounded-full'
                          style={{ background: PARTIES[x.party].color }}
                        />
                        {x.name} ({x.party})
                      </span>
                      <span className='tabular text-label-xs text-text-strong-950'>
                        {pct(x.share)}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/elections/${prev.id}`}
                  className='text-label-sm text-primary-base mt-4 inline-flex items-center gap-1 hover:underline'
                >
                  See full {prev.year} results{' '}
                  <IconChevronRight className='size-4' />
                </Link>
              </div>
            </Card>
          )}
          <Card className='p-4 sm:p-5'>
            <div className='flex items-start gap-2.5'>
              <IconInfo className='text-text-sub-600 mt-0.5 size-5 shrink-0' />
              <p className='text-paragraph-xs text-text-sub-600'>
                Forecasts are probabilities, not predictions. A 70% chance still
                loses 3 times in 10. Once voting starts, this page switches to
                live results.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

export function ForecastList({
  e,
  rows,
}: {
  e: Election;
  rows: ReturnType<typeof forecast>;
}) {
  return (
    <ul className='divide-stroke-soft-200 divide-y'>
      {rows.map((r) => {
        const name =
          e.candidates.find((c) => c.personId === r.personId)?.name ??
          r.personId;
        return (
          <li
            key={r.personId}
            className='flex flex-col gap-3 px-4 py-4 sm:px-5'
          >
            <div className='flex items-center gap-3'>
              <PersonAvatar name={name ?? ''} party={r.party} />
              <div className='min-w-0 flex-1'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Link
                    href={`/politicians/${r.personId}`}
                    className='text-label-sm text-text-strong-950 hover:underline'
                  >
                    {name}
                  </Link>
                  <PartyTag code={r.party} />
                </div>
                <div className='tabular text-paragraph-xs text-text-sub-600 mt-0.5'>
                  Projected share {pct(r.share)}
                </div>
              </div>
              <div className='text-right'>
                <div className='tabular text-label-lg text-text-strong-950'>
                  {pct(r.prob, 0)}
                </div>
                <div className='text-paragraph-xs text-text-sub-600'>
                  to win
                </div>
              </div>
            </div>
            <MeterBar value={r.prob} color={PARTIES[r.party].color} />
            {r.factors.length > 0 && (
              <div className='flex flex-wrap gap-1.5'>
                {r.factors.map((f) => (
                  <span
                    key={f}
                    className='bg-bg-weak-50 text-paragraph-xs text-text-sub-600 rounded-md px-2 py-0.5'
                  >
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
