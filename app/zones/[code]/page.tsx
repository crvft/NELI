import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IconChevronLeft } from '@/components/icons';
import { STATES, ZONES } from '@/lib/geo';
import { isZoneCode } from '@/lib/region';
import { getRegionOverview, listElections, listPeople } from '@/lib/repo';
import { PageContainer, PageHeader } from '@/components/neli/page-header';
import { RegionDashboard } from '@/components/neli/region-dashboard';
import { LocalElections, OfficeHolders } from '@/components/neli/region-extras';

export function generateStaticParams() {
  return ZONES.map((z) => ({ code: z.code.toLowerCase() }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: ZONES.find((z) => z.code === code.toUpperCase())?.name ?? 'Zone' };
}

export default async function ZonePage({ params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  if (!isZoneCode(code)) notFound();
  const [overview, elections, people] = await Promise.all([getRegionOverview('zone', code), listElections(), listPeople()]);
  const states = STATES.filter((s) => s.zone === code);

  return (
    <PageContainer className='flex flex-col gap-6'>
      <Link href='/states' className='hit inline-flex w-fit items-center gap-1 text-label-sm text-text-sub-600 transition-colors duration-[80ms] hover:text-text-strong-950'>
        <IconChevronLeft className='size-4' /> States
      </Link>
      <PageHeader
        title={overview.name}
        description={`Geopolitical zone · ${states.length} states: ${states.map((s) => s.name).join(', ')}.`}
      />
      <RegionDashboard overview={overview}>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
          <OfficeHolders people={people} stateCodes={overview.areaCodes} title={`Office holders in ${overview.name}`} empty="No office holders from this zone on NELI’s record yet." />
          <LocalElections elections={elections} stateCodes={overview.areaCodes} title={`Other elections in ${overview.name}`} />
        </div>
      </RegionDashboard>
    </PageContainer>
  );
}
