import { notFound } from 'next/navigation';
import { ELECTIONS, electionById } from '@/lib/data';
import { ElectionView } from '@/components/neli/election-view';

export function generateStaticParams() {
  return ELECTIONS.map((e) => ({ id: e.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  return { title: electionById(params.id)?.title ?? 'Election' };
}

export default function ElectionPage({ params }: { params: { id: string } }) {
  const e = electionById(params.id);
  if (!e) notFound();
  return <ElectionView e={e} />;
}
