import Link from 'next/link';
import { STATES, ZONES } from '@/lib/geo';
import { ELECTIONS, PEOPLE } from '@/lib/data';
import { areaLeader, currentRole, tally } from '@/lib/analytics';
import { PageContainer, PageHeader, SampleBadge } from '@/components/neli/page-header';
import { Card, CardHeader } from '@/components/neli/card';
import { TileMap } from '@/components/neli/tile-map';
import { PartyTag } from '@/components/neli/party';

export const metadata = { title: 'States' };

export default function StatesPage() {
  const pres = ELECTIONS.find((e) => e.id === 'pres-2023')!;
  const t = tally(pres);
  return (
    <PageContainer className='flex flex-col gap-6'>
      <PageHeader eyebrow={<SampleBadge />} title='States' description='All 36 states and the FCT, grouped by geopolitical zone.' />
      <Card>
        <CardHeader title='2023 presidential result by state' description='Pick a state to see its office holders and election history.' />
        <div className='p-4 sm:p-5'>
          <TileMap
            tiles={STATES.map((s) => {
              const l = areaLeader(pres, s.code);
              return { code: s.code, href: `/states/${s.code}`, leader: l ? { name: t.find((x) => x.personId === l.personId)!.name, party: l.party, share: l.share } : undefined };
            })}
          />
        </div>
      </Card>
      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3'>
        {ZONES.map((z) => (
          <Card key={z.code}>
            <CardHeader title={z.name} description={`${STATES.filter((s) => s.zone === z.code).length} states`} />
            <ul className='divide-y divide-stroke-soft-200'>
              {STATES.filter((s) => s.zone === z.code).map((s) => {
                const gov = PEOPLE.find((p) => currentRole(p)?.office === 'governor' && currentRole(p)?.stateCode === s.code);
                const l = areaLeader(pres, s.code);
                return (
                  <li key={s.code}>
                    <Link href={`/states/${s.code}`} className='flex items-center gap-3 px-4 py-2.5 transition hover:bg-bg-weak-50 sm:px-5'>
                      <span className='grid size-8 shrink-0 place-items-center rounded-lg bg-bg-weak-50 text-label-xs text-text-sub-600'>{s.code}</span>
                      <div className='min-w-0 flex-1'>
                        <div className='truncate text-label-sm text-text-strong-950'>{s.name}</div>
                        <div className='truncate text-paragraph-xs text-text-sub-600'>{gov ? `Gov. ${gov.name}` : `Capital: ${s.capital}`}</div>
                      </div>
                      {l && <PartyTag code={l.party} />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
