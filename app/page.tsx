import { notFound } from 'next/navigation';
import { getLiveElection, listElections, listPeople } from '@/lib/repo';
import { ElectionView } from '@/components/neli/election-view';
import { UpcomingStrip } from '@/components/neli/upcoming-strip';

export default async function LivePage() {
  const [live, all, people] = await Promise.all([getLiveElection(), listElections(), listPeople()]);
  // No count in progress: lead with the most recent presidential result
  const shown = live ?? all.find((e) => e.type === 'presidential' && e.status === 'concluded');
  if (!shown) notFound();
  return (
    <>
      <ElectionView e={shown} all={all} people={people} />
      <UpcomingStrip all={all} people={people} />
    </>
  );
}
