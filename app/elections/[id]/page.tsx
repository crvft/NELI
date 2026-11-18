import { notFound } from 'next/navigation';
import { ELECTIONS, electionById } from '@/lib/data';
import { ElectionView } from '@/components/neli/election-view';

export function generateStaticParams() {
  return ELECTIONS.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: electionById(id)?.title ?? 'Election' };
}

export default async function ElectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = electionById(id);
  if (!e) notFound();
  return <ElectionView e={e} />;
}
