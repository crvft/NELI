import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';
import { STATES, zoneName } from '@/lib/geo';
import { ELECTIONS, PEOPLE, OFFICE_LABEL } from '@/lib/data';
import { countedVotes, currentParty, currentRole, fmt, fmtCompact, pct, tally } from '@/lib/analytics';
import { PageContainer, PageHeader, SampleBadge } from '@/components/neli/page-header';
import { Card, CardHeader, Stat } from '@/components/neli/card';
import { PersonAvatar } from '@/components/neli/avatar';
import { PartyTag } from '@/components/neli/party';
import { ShareBar } from '@/components/neli/share-bar';
import { LiveDot } from '@/components/neli/live-dot';
import { personById } from '@/lib/data';

export function generateStaticParams() {
  return STATES.map((s) => ({ code: s.code }));
}
export function generateMetadata({ params }: { params: { code: string } }) {
  return { title: STATES.find((s) => s.code === params.code)?.name ?? 'State' };
}

export default function StatePage({ params }: { params: { code: string } }) {
  const s = STATES.find((x) => x.code === params.code);
  if (!s) notFound();
  const holders = PEOPLE.filter((p) => {
    const r = currentRole(p);
    return r && r.stateCode === s.code;
  });
  const national = ELECTIONS.filter((e) => e.level === 'national').sort((a, b) => b.year - a.year);
  const local = ELECTIONS.filter((e) => e.stateCode === s.code).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <PageContainer className='flex flex-col gap-6'>
      <Link href='/states' className='inline-flex w-fit items-center gap-0.5 text-label-sm text-text-sub-600 hover:text-text-strong-950'>
        <RiArrowLeftSLine className='size-5' /> States
      </Link>
      <PageHeader eyebrow={<SampleBadge />} title={`${s.name}${s.code === 'FC' ? '' : ' State'}`} description={`${zoneName(s.zone)} · Capital: ${s.capital}`} />
      <Card className='grid grid-cols-2 gap-4 p-4 sm:p-5 md:grid-cols-3'>
        <Stat label='Registered voters' value={fmtCompact(s.registered)} sub={fmt(s.registered)} />
        <Stat label='Geopolitical zone' value={<span className='text-label-lg'>{zoneName(s.zone)}</span>} />
        <Stat label='Office holders on NELI' value={holders.length} />
      </Card>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        <Card>
          <CardHeader title='Presidential results in this state' />
          <ul className='divide-y divide-stroke-soft-200'>
            {national.map((e) => {
              const v = countedVotes(e, s.code);
              const sum = Object.values(v).reduce((a, b) => a + b, 0);
              const t = tally(e, [s.code]);
              return (
                <li key={e.id}>
                  <Link href={e.status === 'live' ? '/' : `/elections/${e.id}`} className='flex flex-col gap-2 px-4 py-3.5 transition hover:bg-bg-weak-50 sm:px-5'>
                    <div className='flex items-center justify-between gap-2'>
                      <span className='flex items-center gap-2 text-label-sm text-text-strong-950'>
                        {e.year} {e.status === 'live' && <LiveDot label />}
                      </span>
                      {sum > 0 ? (
                        <span className='flex items-center gap-2 text-paragraph-xs text-text-sub-600'>
                          <PartyTag code={t[0].party} /> <span className='tabular'>{pct(t[0].share)}</span>
                        </span>
                      ) : (
                        <span className='text-paragraph-xs text-text-soft-400'>Awaiting results</span>
                      )}
                    </div>
                    <ShareBar tally={t} height='h-2' />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title='Current office holders' />
          {holders.length === 0 ? (
            <p className='p-5 text-paragraph-sm text-text-sub-600'>No office holders from {s.name} in the sample data yet.</p>
          ) : (
            <ul className='divide-y divide-stroke-soft-200'>
              {holders.map((p) => (
                <li key={p.id}>
                  <Link href={`/politicians/${p.id}`} className='flex items-center gap-3 px-4 py-3 transition hover:bg-bg-weak-50 sm:px-5'>
                    <PersonAvatar name={p.name} party={currentParty(p)} />
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-label-sm text-text-strong-950'>{p.name}</div>
                      <div className='truncate text-paragraph-xs text-text-sub-600'>{OFFICE_LABEL[currentRole(p)!.office]} · {currentRole(p)!.constituency ?? s.name}</div>
                    </div>
                    <PartyTag code={currentParty(p)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {local.length > 0 && (
        <Card>
          <CardHeader title={`Elections in ${s.name}`} description='Governorship, legislative and local government races' />
          <ul className='divide-y divide-stroke-soft-200'>
            {local.map((e) => {
              const t = e.status === 'upcoming' ? [] : tally(e);
              return (
                <li key={e.id}>
                  <Link href={`/elections/${e.id}`} className='flex items-center gap-3 px-4 py-3 transition hover:bg-bg-weak-50 sm:px-5'>
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-label-sm text-text-strong-950'>{e.title}</div>
                      <div className='text-paragraph-xs text-text-sub-600'>{e.status === 'upcoming' ? 'Upcoming' : `Won by ${personById(t[0].personId)?.name} (${t[0].party}) with ${pct(t[0].share)}`}</div>
                    </div>
                    <RiArrowRightSLine className='size-5 text-text-soft-400' />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </PageContainer>
  );
}
