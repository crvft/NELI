import { ELECTIONS } from '@/lib/data';
import { ElectionView } from '@/components/neli/election-view';
import { UpcomingStrip } from '@/components/neli/upcoming-strip';

export default function LivePage() {
  const live = ELECTIONS.find((e) => e.status === 'live')!;
  return (
    <>
      <ElectionView e={live} />
      <UpcomingStrip />
    </>
  );
}
