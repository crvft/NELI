import Link from 'next/link';
import type { Route } from 'next';
import { IconChevronRight } from '@/components/icons';
import { ELECTION_TYPE_LABEL, dateKey, electionWhen, type Election } from '@/lib/domain';
import { listElections, listPeople } from '@/lib/repo';
import { stateByCode } from '@/lib/geo';
import { forecast, pct } from '@/lib/analytics';
import { Card, CardHeader } from '@/components/neli/card';
import { PageContainer, PageHeader } from '@/components/neli/page-header';
import { ForecastList } from '@/components/neli/election-view';

export const metadata = { title: 'Forecasts' };

export default async function ForecastsPage() {
  const [all, people] = await Promise.all([listElections(), listPeople()]);
  const up = all
    .filter((e) => e.status === 'upcoming')
    .sort((a, b) => (a.type === 'presidential' ? -1 : b.type === 'presidential' ? 1 : dateKey(a).localeCompare(dateKey(b)) || a.title.localeCompare(b.title)));
  const model = up.find((e) => e.forecast)?.forecast;
  const [pres, ...rest] = up;

  const card = (e: Election, limit?: number) => {
    const rows = forecast(e, all, people);
    return (
      <Card key={e.id}>
        <CardHeader
          title={e.title}
          description={`${ELECTION_TYPE_LABEL[e.type]} · ${e.stateCode ? stateByCode(e.stateCode).name : 'Nationwide'} · ${electionWhen(e)}${
            e.forecast && !e.forecast.candidatesConfirmed ? ' · by party' : ''
          }`}
          action={
            <Link href={`/elections/${e.id}` as Route} className='inline-flex items-center text-label-sm text-text-sub-600 hover:text-text-strong-950'>
              Details <IconChevronRight className='size-4' />
            </Link>
          }
        />
        <ForecastList e={e} rows={limit ? rows.slice(0, limit) : rows} people={people} />
      </Card>
    );
  };

  return (
    <PageContainer className='flex flex-col gap-6'>
      <PageHeader
        title='Forecasts'
        description={
          model
            ? `Anyanwụ's chances for the 2027 elections, updated ${new Date(model.generatedAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}.`
            : 'Forecasts for upcoming elections.'
        }
      />
      {!up.length && (
        <Card className='flex flex-col items-start gap-1.5 p-5'>
          <h2 className='text-label-md text-text-strong-950'>No forecasts yet</h2>
          <p className='max-w-prose text-paragraph-sm text-text-sub-600'>Forecasts appear here once Anyanwụ has published a run.</p>
        </Card>
      )}
      {pres && (
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]'>
          {card(pres)}
          <Card>
            <CardHeader title='How Anyanwụ works' />
            <div className='flex flex-col gap-3 p-4 text-paragraph-sm text-text-sub-600 sm:p-5'>
              <p>
                Every state&rsquo;s last result is split into vote pools that follow candidates, parties and running mates to this election. That is how Obi&rsquo;s 2023 Labour vote follows him to
                the NDC, and Atiku&rsquo;s PDP vote to the ADC. Candidates gain at home and in their home zone.
              </p>
              <p>
                Thousands of simulated elections add national, zonal and state-level surprises of the size seen in past elections, then apply the 25%-in-24-states rule.
              </p>
              <p>
                Each part was tested by forecasting every past election using only what came before it.
                {pres.forecast?.runoffProb != null && ` This time it sees a ${pct(pres.forecast.runoffProb, 0)} chance of a run-off.`}
              </p>
            </div>
          </Card>
        </div>
      )}
      {rest.length > 0 && (
        <>
          <h2 className='text-label-md text-text-strong-950'>Governorship, {electionWhen(rest[0])}</h2>
          <div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>{rest.map((e) => card(e, 3))}</div>
        </>
      )}
    </PageContainer>
  );
}
