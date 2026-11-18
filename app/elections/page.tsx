import { ELECTION_TYPE_LABEL, dateKey } from '@/lib/domain';
import { listElections, listPeople } from '@/lib/repo';
import { stateByCode } from '@/lib/geo';
import { forecast, tally, totalVotes } from '@/lib/analytics';
import { PageContainer, PageHeader } from '@/components/neli/page-header';
import { ElectionBrowser, type ElectionSummary } from '@/components/neli/election-browser';

export const metadata = { title: 'Elections' };

export default async function ElectionsPage() {
  const [all, people] = await Promise.all([listElections(), listPeople()]);
  const items: ElectionSummary[] = all.map((e) => {
    const t = e.status === 'upcoming' ? [] : tally(e);
    const f = e.status === 'upcoming' ? forecast(e, all, people) : [];
    const top = e.status === 'upcoming' ? f[0] : t[0];
    return {
      id: e.id,
      title: e.title,
      type: e.type,
      typeLabel: ELECTION_TYPE_LABEL[e.type],
      year: e.year,
      date: e.date,
      status: e.status,
      place: e.stateCode ? stateByCode(e.stateCode).name : 'Nationwide',
      totalVotes: totalVotes(t),
      tally: t.slice(0, 4).map((x) => ({ personId: x.personId, name: x.name, party: x.party, votes: x.votes, share: x.share })),
      top: top ? { personId: top.personId, party: top.party, value: 'prob' in top ? top.prob : top.share } : undefined,
    };
  }).sort((a, b) => (a.status === 'live' ? -1 : b.status === 'live' ? 1 : dateKey(b).localeCompare(dateKey(a))));

  return (
    <PageContainer className='flex flex-col gap-6'>
      <PageHeader
        title='Elections'
        description='Every election from local government to the presidency: live, past and upcoming.'
      />
      <ElectionBrowser items={items} />
    </PageContainer>
  );
}
