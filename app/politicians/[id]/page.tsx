import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IconChevronLeft, IconLost, IconUpcoming, IconWon } from '@/components/icons';
import { OFFICE_LABEL, ELECTION_TYPE_LABEL } from '@/lib/domain';
import { getPerson, listElections, listPeople } from '@/lib/repo';
import { stateByCode } from '@/lib/geo';
import { PARTIES } from '@/lib/parties';
import { currentParty, currentRole, fmt, fmtCompact, pct, personRecord, voteSources } from '@/lib/analytics';
import { Card, CardHeader, Stat } from '@/components/neli/card';
import { PageContainer } from '@/components/neli/page-header';
import { PersonAvatar } from '@/components/neli/avatar';
import { PartyTag } from '@/components/neli/party';
import { LineChart } from '@/components/neli/line-chart';
import { SourceBars } from '@/components/neli/zone-bars';
import { LiveDot } from '@/components/neli/live-dot';

export async function generateStaticParams() {
  return (await listPeople()).map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: (await getPerson(id))?.name ?? 'Politician' };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, all] = await Promise.all([getPerson(id), listElections()]);
  if (!p) notFound();
  const role = currentRole(p);
  const party = currentParty(p);
  const record = personRecord(p.id, all);
  const past = record.filter((r) => r.election.status !== 'upcoming');
  const concluded = record.filter((r) => r.election.status === 'concluded');
  const wins = concluded.filter((r) => r.won).length;
  const careerVotes = concluded.reduce((s, r) => s + r.votes, 0);
  const latest = past[0];
  const sources = latest ? voteSources(latest.election, p.id) : [];
  const chart = concluded
    .slice()
    .reverse()
    .map((r) => ({ label: `${r.election.year} ${ELECTION_TYPE_LABEL[r.election.type].replace('House of Reps', 'Reps')}`, votes: r.votes, party: r.party, won: r.won }));

  return (
    <PageContainer className='flex flex-col gap-6'>
      <Link href='/politicians' className='inline-flex w-fit items-center gap-0.5 text-label-sm text-text-sub-600 hover:text-text-strong-950'>
        <IconChevronLeft className='size-5' /> Politicians
      </Link>

      <Card className='p-4 sm:p-6'>
        <div className='flex flex-col gap-5 sm:flex-row sm:items-center'>
          <PersonAvatar name={p.name} party={party} size='xl' />
          <div className='min-w-0 flex-1'>
            <div className='mb-2 flex flex-wrap items-center gap-2'>
              {role ? (
                <span className='inline-flex h-6 items-center gap-1.5 rounded-md bg-success-lighter px-2 text-label-xs text-success-dark'>
                  <span className='size-1.5 rounded-full bg-success-base' /> In office
                </span>
              ) : (
                <span className='inline-flex h-6 items-center rounded-md bg-bg-weak-50 px-2 text-label-xs text-text-sub-600'>Not in office</span>
              )}
            </div>
            <h1 className='text-title-h5 tracking-tight text-text-strong-950 sm:text-title-h4'>{p.name}</h1>
            <p className='mt-1 text-paragraph-sm text-text-sub-600'>
              {role ? `${role.title}, since ${role.from}` : p.roles[0] ? `Former ${p.roles[0].title}` : 'Candidate'}
            </p>
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <PartyTag code={party} full />
              {p.origin && <span className='inline-flex h-6 items-center rounded-md bg-hover px-2 text-label-xs text-text-sub-600'>From {stateByCode(p.origin).name}</span>}
              {p.born && <span className='inline-flex h-6 items-center rounded-md bg-hover px-2 text-label-xs text-text-sub-600'>Age {new Date().getFullYear() - p.born}</span>}
            </div>
          </div>
        </div>
        <p className='mt-5 max-w-3xl text-paragraph-sm text-text-sub-600'>{p.bio}</p>
        <div className='mt-5 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-stroke-soft-200 pt-5 md:grid-cols-4'>
          <Stat label='Elections contested' value={concluded.length} sub={record.length > concluded.length ? `+${record.length - concluded.length} ongoing or upcoming` : undefined} />
          <Stat label='Won' value={concluded.length ? `${wins}/${concluded.length}` : '—'} sub={concluded.length ? `${pct(wins / concluded.length, 0)} win rate` : 'No elections yet'} />
          <Stat label='Career votes' value={careerVotes ? fmtCompact(careerVotes) : '—'} sub={careerVotes ? fmt(careerVotes) : undefined} />
          <Stat label='Party switches' value={p.partyHistory.length - 1} sub={p.partyHistory.map((x) => x.party).join(' → ')} />
        </div>
      </Card>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
        <div className='flex min-w-0 flex-col gap-6'>
          {chart.length > 0 && (
            <Card>
              <CardHeader title='Votes per election' description='Filled dots are wins, hollow dots are losses' />
              <div className='p-4 sm:p-5'>
                <LineChart
                  ariaLabel={`Votes per election for ${p.name}`}
                  data={chart.map((c) => ({ label: c.label, votes: c.votes, lost: c.won ? 0 : 1 }))}
                  series={[{ key: 'votes', label: 'Votes', party }]}
                  valueFormat='compact'
                  markers
                  fadedKey='lost'
                  fillBetween
                  height={240}
                />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title='Election history' description={record.length ? `${record.length} elections on record` : undefined} />
            {record.length === 0 ? (
              <p className='p-5 text-paragraph-sm text-text-sub-600'>{p.roles.some((r) => r.appointed) ? 'Appointed to office; has not contested an election on record.' : 'No elections on record yet.'}</p>
            ) : (
              <ul className='divide-y divide-stroke-soft-200'>
                {record.map((r) => (
                  <li key={r.election.id}>
                    <Link href={r.election.status === 'live' ? '/' : `/elections/${r.election.id}`} className='flex items-center gap-3 px-4 py-3.5 transition-colors duration-[80ms] hover:bg-hover sm:px-5'>
                      <span className='grid size-9 shrink-0 place-items-center rounded-full bg-bg-weak-50'>
                        {r.election.status === 'concluded' ? (
                          r.won ? (
                            <IconWon className='size-5 text-success-base' />
                          ) : (
                            <IconLost className='size-5 text-text-sub-600' />
                          )
                        ) : r.election.status === 'live' ? (
                          <LiveDot />
                        ) : (
                          <IconUpcoming className='size-5 text-information-base' />
                        )}
                      </span>
                      <div className='min-w-0 flex-1'>
                        <div className='truncate text-label-sm text-text-strong-950'>{r.election.title}</div>
                        <div className='mt-0.5 flex flex-wrap items-center gap-x-2 text-paragraph-xs text-text-sub-600'>
                          <span>{r.party}</span>
                          <span className='text-text-sub-600'>·</span>
                          <span>
                            {r.election.status === 'concluded'
                              ? r.won
                                ? 'Won'
                                : `Came ${ordinal(r.position)}`
                              : r.election.status === 'live'
                                ? `Currently ${ordinal(r.position)}`
                                : 'Upcoming'}
                          </span>
                        </div>
                      </div>
                      {r.election.status !== 'upcoming' && (
                        <div className='text-right'>
                          <div className='tabular text-label-sm text-text-strong-950'>{pct(r.share)}</div>
                          <div className='tabular text-paragraph-xs text-text-sub-600'>{fmtCompact(r.votes)} votes</div>
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className='flex min-w-0 flex-col gap-6'>
          {latest && (
            <Card>
              <CardHeader
                title='Where the votes came from'
                description={`${latest.election.title}: share of ${p.name.split(' ')[0]}'s ${fmtCompact(latest.votes)} votes by ${latest.election.level === 'national' ? 'zone' : latest.election.areaLabel.toLowerCase()}`}
              />
              <div className='p-4 sm:p-5'>
                <SourceBars rows={sources} color={PARTIES[latest.party].color} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title='Party history' />
            <ol className='relative flex flex-col gap-4 p-4 sm:p-5'>
              {p.partyHistory
                .slice()
                .reverse()
                .map((h, i) => (
                  <li key={i} className='flex items-start gap-3'>
                    <span className='mt-1 size-2.5 shrink-0 rounded-full ring-4 ring-bg-white-0' style={{ background: PARTIES[h.party].color }} />
                    <div>
                      <div className='text-label-sm text-text-strong-950'>{PARTIES[h.party].name}</div>
                      <div className='tabular text-paragraph-xs text-text-sub-600'>
                        {h.from} – {h.to ?? 'present'}
                      </div>
                    </div>
                  </li>
                ))}
            </ol>
          </Card>

          <Card>
            <CardHeader title='Offices held' />
            {p.roles.length === 0 ? (
              <p className='p-5 text-paragraph-sm text-text-sub-600'>Has not held public office.</p>
            ) : (
              <ol className='flex flex-col gap-4 p-4 sm:p-5'>
                {p.roles.map((r, i) => (
                  <li key={i} className='flex items-start gap-3'>
                    <span className='mt-1 size-2.5 shrink-0 rounded-full bg-primary-base' />
                    <div>
                      <div className='text-label-sm text-text-strong-950'>{r.title}</div>
                      <div className='tabular text-paragraph-xs text-text-sub-600'>
                        {r.from} – {r.to ?? 'present'} · {r.appointed ? 'Appointed' : `Elected${r.party ? `, ${r.party}` : ''}`} · {OFFICE_LABEL[r.office]}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
