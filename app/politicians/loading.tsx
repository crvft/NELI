import { PageContainer } from '@/components/neli/page-header';
import { GridSkeleton, PageHeaderSkeleton } from '@/components/neli/skeletons';

export default function Loading() {
  return (
    <PageContainer className='flex flex-col gap-6' aria-busy>
      <PageHeaderSkeleton />
      <GridSkeleton />
    </PageContainer>
  );
}
