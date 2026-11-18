import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getElection, listElections, listPeople } from '@/lib/repo';
import { ElectionView } from '@/components/neli/election-view';

export async function generateStaticParams() {
  return (await listElections()).map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getElection(id))?.title ?? 'Election' };
}

export default async function ElectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [e, all, people] = await Promise.all([getElection(id), listElections(), listPeople()]);
  if (!e) notFound();
  return <ElectionView e={e} all={all} people={people} />;
}
