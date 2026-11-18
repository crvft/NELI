import { PageContainer } from '@/components/neli/page-header';
import { ChartCardSkeleton, KpiRowSkeleton, ListCardSkeleton, PageHeaderSkeleton } from '@/components/neli/skeletons';

export default function Loading() {
  return (
    <PageContainer className='flex flex-col gap-6' aria-busy>
      <PageHeaderSkeleton />
      <KpiRowSkeleton />
      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]'>
        <ChartCardSkeleton />
        <ListCardSkeleton rows={4} />
      </div>
      <ListCardSkeleton />
    </PageContainer>
  );
}
