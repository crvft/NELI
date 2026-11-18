import type { Route } from 'next';
import Link from 'next/link';
import { STATES, ZONES } from '@/lib/geo';
import { areaLeader, currentRole, pct, spreadCount, tally } from '@/lib/analytics';
import { mapPayload } from '@/lib/map-data';
import { PARTIES } from '@/lib/parties';
import { getElection, getRegionOverview, listPeople } from '@/lib/repo';
import { IconAnalytics, IconChevronRight } from '@/components/icons';
import { FluidHover } from '@/components/motion/fluid-hover';
import { Card } from '@/components/neli/card';
import { MapGuide } from '@/components/neli/map-guide';
import { NigeriaMap } from '@/components/neli/nigeria-map';
import { PageContainer, PageHeader, SampleBadge } from '@/components/neli/page-header';
import { PartyTag } from '@/components/neli/party';

export const metadata = { title: 'States' };

export default async function StatesPage() {
  const [pres, people, ...zones] = await Promise.all([getElection('pres-2023'), listPeople(), ...ZONES.map((z) => getRegionOverview('zone', z.code))]);
  if (!pres) throw new Error('2023 presidential election missing from the data layer');
  const t = tally(pres);
  const map = mapPayload(pres);

  return (
    <PageContainer className='flex flex-col gap-6'>
      <PageHeader badges={<SampleBadge />} title='States' description='All 36 states and the FCT, grouped by geopolitical zone. Open a zone or a state for its trends across elections.' />
      <Card className='overflow-hidden'>
        <NigeriaMap
          data={map}
          title={
            <div className='mb-2'>
              <h2 className='text-title-h6 tracking-tight text-text-strong-950 sm:text-title-h5'>Who won each state</h2>
              <p className='mt-1 text-paragraph-sm text-text-sub-600'>2023 presidential election. Click a state to zoom in to its local government areas.</p>
            </div>
          }
          overview={<MapGuide data={map} spread={spreadCount(pres)} names={t} isPresidential />}
        />
      </Card>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3'>
        {ZONES.map((z, i) => {
          const o = zones[i];
          const latest = o.cycles.filter((c) => !c.live).at(-1);
          const lead = latest?.parties[0];
          const states = STATES.filter((s) => s.zone === z.code);
          return (
            <Card key={z.code} className='flex flex-col overflow-hidden'>
              <Link
                href={`/zones/${z.code.toLowerCase()}` as Route}
                className='group flex items-start justify-between gap-3 border-b border-stroke-soft-200 px-4 py-4 transition-colors duration-[80ms] hover:bg-hover sm:px-5'
              >
                <div className='min-w-0'>
                  <h2 className='text-label-md text-text-strong-950'>{z.name}</h2>
                  <div className='mt-1 flex flex-col gap-1 text-paragraph-xs text-text-sub-600'>
                    <span>
                      {states.length} states
                      {lead && (
                        <>
                          {' · '}
                          <span style={{ color: PARTIES[lead.party].text }}>{lead.party}</span> led with {pct(lead.share)}
                        </>
                      )}
                    </span>
                    {latest && (
                      <span>
                        {latest.year} presidential · {pct(latest.turnout)} turnout
                      </span>
                    )}
                  </div>
                </div>
                <span className='inline-flex shrink-0 items-center gap-1 text-label-xs text-text-sub-600 transition-colors duration-[80ms] group-hover:text-text-strong-950'>
                  <IconAnalytics className='size-4' />
                  Zone analytics
                  <IconChevronRight className='size-3.5 transition-transform duration-[80ms] group-hover:translate-x-0.5' />
                </span>
              </Link>
              <FluidHover as='ul' className='p-1' radius={10} gapClick={4}>
                {states.map((s) => {
                  // Every state lists its sitting governor (the FCT is run by a minister).
                  const gov = people.find((p) => {
                    const r = currentRole(p);
                    return r?.stateCode === s.code && (r.office === 'governor' || (s.code === 'FC' && r.office === 'minister'));
                  });
                  const l = areaLeader(pres, s.code);
                  return (
                    <li key={s.code} data-fluid-item className='relative'>
                      <Link href={`/states/${s.code}` as Route} className='flex items-center gap-3 rounded-[10px] px-3 py-2 sm:px-4'>
                        <span className='grid size-8 shrink-0 place-items-center rounded-lg bg-hover text-label-xs text-text-sub-600'>{s.code}</span>
                        <div className='min-w-0 flex-1'>
                          <div className='truncate text-label-sm text-text-strong-950'>{s.name}</div>
                          <div className='truncate text-paragraph-xs text-text-sub-600'>{gov ? `${s.code === 'FC' ? 'Minister' : 'Gov.'} ${gov.name}` : 'Governor not on NELI yet'}</div>
                        </div>
                        {l && <PartyTag code={l.party} />}
                      </Link>
                    </li>
                  );
                })}
              </FluidHover>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
