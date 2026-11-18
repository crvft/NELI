import Link from 'next/link';
import type { Route } from 'next';
import { OFFICE_LABEL, type Election, type Person } from '@/lib/domain';
import { currentParty, currentRole, pct, tally } from '@/lib/analytics';
import { FluidHover } from '@/components/motion/fluid-hover';
import { IconChevronRight } from '@/components/icons';
import { Card, CardHeader } from './card';
import { PersonAvatar } from './avatar';
import { PartyTag } from './party';

/** People currently holding office in the given states. */
export function OfficeHolders({ people, stateCodes, title, empty }: { people: Person[]; stateCodes: string[]; title: string; empty: string }) {
  const holders = people
    .filter((p) => {
      const r = currentRole(p);
      return r?.stateCode && stateCodes.includes(r.stateCode);
    })
    .sort((a, b) => rank(currentRole(a)!.office) - rank(currentRole(b)!.office));
  return (
    <Card>
      <CardHeader title={title} description={holders.length ? `${holders.length} on NELI` : undefined} />
      {holders.length === 0 ? (
        <p className='p-5 text-paragraph-sm text-text-sub-600'>{empty}</p>
      ) : (
        <FluidHover as='ul' className='p-1' radius={10} gapClick={4}>
          {holders.map((p) => {
            const r = currentRole(p)!;
            return (
              <li key={p.id} data-fluid-item className='relative'>
                <Link href={`/politicians/${p.id}` as Route} className='flex items-center gap-3 rounded-[10px] px-3 py-2.5 sm:px-4'>
                  <PersonAvatar name={p.name} party={currentParty(p)} />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-label-sm text-text-strong-950'>{p.name}</div>
                    <div className='truncate text-paragraph-xs text-text-sub-600'>
                      {OFFICE_LABEL[r.office]} · {r.constituency ?? r.title.replace(/^.* of /, '')}
                    </div>
                  </div>
                  <PartyTag code={currentParty(p)} />
                </Link>
              </li>
            );
          })}
        </FluidHover>
      )}
    </Card>
  );
}

const ORDER = ['governor', 'senator', 'rep', 'assembly', 'lga-chair'];
const rank = (o: string) => (ORDER.indexOf(o) === -1 ? 99 : ORDER.indexOf(o));

/** Governorship, legislative and LGA races in the given states. */
export function LocalElections({ elections, stateCodes, title }: { elections: Election[]; stateCodes: string[]; title: string }) {
  const list = elections.filter((e) => e.stateCode && stateCodes.includes(e.stateCode)).sort((a, b) => b.date.localeCompare(a.date));
  if (!list.length) return null;
  return (
    <Card>
      <CardHeader title={title} description='Governorship, legislative and local government races' />
      <FluidHover as='ul' className='p-1' radius={10} gapClick={4}>
        {list.map((e) => {
          const t = e.status === 'upcoming' ? [] : tally(e);
          return (
            <li key={e.id} data-fluid-item className='relative'>
              <Link href={`/elections/${e.id}` as Route} className='flex items-center gap-3 rounded-[10px] px-3 py-2.5 sm:px-4'>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-label-sm text-text-strong-950'>{e.title}</div>
                  <div className='truncate text-paragraph-xs text-text-sub-600'>
                    {e.status === 'upcoming' ? 'Upcoming' : `Won by ${t[0].name} (${t[0].party}) with ${pct(t[0].share)}`}
                  </div>
                </div>
                <IconChevronRight className='size-4 text-text-sub-600' />
              </Link>
            </li>
          );
        })}
      </FluidHover>
    </Card>
  );
}
