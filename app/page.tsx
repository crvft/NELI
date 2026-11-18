import { notFound } from 'next/navigation';
import { getLiveElection, listElections, listPeople } from '@/lib/repo';
import { ElectionView } from '@/components/neli/election-view';
import { UpcomingStrip } from '@/components/neli/upcoming-strip';

export default async function LivePage() {
  const [live, all, people] = await Promise.all([getLiveElection(), listElections(), listPeople()]);
  if (!live) notFound();
  return (
    <>
      <ElectionView e={live} all={all} people={people} />
      <UpcomingStrip all={all} people={people} />
    </>
  );
}
