import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IconChevronLeft, IconChevronRight } from '@/components/icons';
import { STATES, zoneName } from '@/lib/geo';
import { getRegionOverview, listElections, listPeople } from '@/lib/repo';
import { PageContainer, PageHeader } from '@/components/neli/page-header';
import { StateElections } from '@/components/neli/state-elections';
import { LocalElections, OfficeHolders } from '@/components/neli/region-extras';
import type { LegislativeYear } from '@/components/neli/legislative-view';
import { tally } from '@/lib/analytics';
import type { Election } from '@/lib/domain';

export function generateStaticParams() {
  return STATES.map((s) => ({ code: s.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: STATES.find((s) => s.code === code)?.name ?? 'State' };
}

export default async function StatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const s = STATES.find((x) => x.code === code);
  if (!s) notFound();
  const [presidential, governorship, elections, people] = await Promise.all([
    getRegionOverview('state', s.code, 'presidential'),
    getRegionOverview('state', s.code, 'governorship'),
    listElections(),
    listPeople(),
  ]);

  const legislative = { senate: legislativeYears(elections, s.code, 'senate'), reps: legislativeYears(elections, s.code, 'reps') };

  return (
    <PageContainer className='flex flex-col gap-6'>
      <nav aria-label='Breadcrumb' className='flex items-center gap-1 text-label-sm text-text-sub-600'>
        <Link href='/states' className='hit inline-flex items-center gap-1 transition-colors duration-[80ms] hover:text-text-strong-950'>
          <IconChevronLeft className='size-4' /> States
        </Link>
        <IconChevronRight className='size-3.5' />
        <Link href={`/zones/${s.zone.toLowerCase()}` as Route} className='hit transition-colors duration-[80ms] hover:text-text-strong-950'>
          {zoneName(s.zone)}
        </Link>
      </nav>
      <PageHeader title={`${s.name}${s.code === 'FC' ? '' : ' State'}`} description={`Capital: ${s.capital} · ${zoneName(s.zone)} zone`} />
      <StateElections name={s.code === 'FC' ? 'the FCT' : s.name} overviews={{ presidential, governorship }} legislative={legislative}>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <OfficeHolders people={people} stateCodes={[s.code]} title='Current office holders' empty={`No office holders from ${s.name} on NELI’s record yet.`} />
          <LocalElections elections={elections} stateCodes={[s.code]} title={`Elections in ${s.name}`} />
        </div>
      </StateElections>
    </PageContainer>
  );
}

function legislativeYears(all: Election[], code: string, chamber: 'senate' | 'reps'): LegislativeYear[] {
  const byYear = new Map<number, LegislativeYear>();
  for (const e of all) {
    if (e.type !== chamber || e.stateCode !== code || e.status !== 'concluded') continue;
    const t = tally(e);
    if (!t[0]) continue;
    const hasVotes = e.coverage !== 'winner only' && t[0].votes > 0;
    const y = byYear.get(e.year) ?? { year: e.year, races: [] };
    y.races.push({
      id: e.id,
      district: e.constituency ?? e.title,
      winner: t[0].name,
      party: t[0].party,
      share: hasVotes ? t[0].share : undefined,
      margin: hasVotes && t[1] ? t[0].share - t[1].share : undefined,
      coverage: e.coverage ?? 'winner only',
      conflict: e.conflict,
    });
    byYear.set(e.year, y);
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}
