import Link from 'next/link';
import { IconChevronRight } from '@/components/icons';
import { ELECTION_TYPE_LABEL, dateKey, electionWhen } from '@/lib/domain';
import { listElections, listPeople } from '@/lib/repo';
import { stateByCode } from '@/lib/geo';
import { forecast } from '@/lib/analytics';
import { Card, CardHeader } from '@/components/neli/card';
import { PageContainer, PageHeader } from '@/components/neli/page-header';
import { ForecastList } from '@/components/neli/election-view';

export const metadata = { title: 'Forecasts' };

export default async function ForecastsPage() {
  const [all, people] = await Promise.all([listElections(), listPeople()]);
  const up = all.filter((e) => e.status === 'upcoming').sort((a, b) => dateKey(a).localeCompare(dateKey(b)));
  return (
    <PageContainer className='flex flex-col gap-6'>
      <PageHeader
        title='Forecasts'
        description='Who is likely to win upcoming elections, based on past results for each seat, incumbency and candidate track records.'
      />
      {!up.length && (
        <Card className='flex flex-col items-start gap-1.5 p-5'>
          <h2 className='text-label-md text-text-strong-950'>No forecasts yet</h2>
          <p className='max-w-prose text-paragraph-sm text-text-sub-600'>
            Forecasts arrive with Anyanwụ, NELI’s election model. It is trained on every presidential and governorship
            result on record and tested on past elections before any forecast is shown here.
          </p>
        </Card>
      )}
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
        {up.map((e) => (
          <Card key={e.id}>
            <CardHeader
              title={e.title}
              description={`${ELECTION_TYPE_LABEL[e.type]} · ${e.stateCode ? stateByCode(e.stateCode).name : 'Nationwide'} · ${electionWhen(e)}`}
              action={
                <Link href={`/elections/${e.id}`} className='inline-flex items-center text-label-sm text-text-sub-600 hover:text-text-strong-950'>
                  Details <IconChevronRight className='size-4' />
                </Link>
              }
            />
            <ForecastList e={e} rows={forecast(e, all, people)} />
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
