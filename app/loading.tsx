import { PageContainer } from '@/components/neli/page-header';
import { KpiRowSkeleton, ListCardSkeleton, MapCardSkeleton, PageHeaderSkeleton } from '@/components/neli/skeletons';

/** Shown only if a page takes longer than 160ms to arrive (see .skeleton). */
export default function Loading() {
  return (
    <PageContainer className='flex flex-col gap-6' aria-busy>
      <PageHeaderSkeleton />
      <MapCardSkeleton />
      <KpiRowSkeleton />
      <ListCardSkeleton />
    </PageContainer>
  );
}
