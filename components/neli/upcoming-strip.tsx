import Link from 'next/link';
import type { Route } from 'next';
import { FluidHover } from '@/components/motion/fluid-hover';
import { IconChevronRight } from '@/components/icons';
import type { Election, Person } from '@/lib/domain';
import { forecast } from '@/lib/analytics';
import { PARTIES } from '@/lib/parties';
import { PageContainer } from './page-header';
import { Card } from './card';

export function UpcomingStrip({ all, people }: { all: Election[]; people: Person[] }) {
  const up = all.filter((e) => e.status === 'upcoming');
  return (
    <PageContainer className='pt-0 lg:pt-0'>
      <div className='mb-3 flex items-center justify-between'>
        <h2 className='text-label-md text-text-strong-950'>Coming up next</h2>
        <Link href='/forecasts' className='inline-flex items-center gap-0.5 text-label-sm text-text-sub-600 hover:text-text-strong-950'>
          All forecasts <IconChevronRight className='size-4' />
        </Link>
      </div>
      <FluidHover layer='over' radius={16} gapClick={16} className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {up.map((e) => {
          const f = forecast(e, all, people)[0];
          return (
            <Link key={e.id} href={`/elections/${e.id}` as Route} data-fluid-item className='relative block'>
              <Card className='h-full p-4'>
                <div className='text-paragraph-xs text-text-sub-600'>
                  {new Date(e.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <div className='mt-1 text-label-sm text-text-strong-950'>{e.title}</div>
                <div className='mt-3 flex items-center gap-2 text-paragraph-xs text-text-sub-600'>
                  <span className='size-2 rounded-full' style={{ background: PARTIES[f.party].color }} />
                  <span className='truncate'>{e.candidates.find((c) => c.personId === f.personId)?.name}</span>
                  <span className='tabular ml-auto text-label-xs text-text-strong-950'>{Math.round(f.prob * 100)}%</span>
                </div>
              </Card>
            </Link>
          );
        })}
      </FluidHover>
    </PageContainer>
  );
}
