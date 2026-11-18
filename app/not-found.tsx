import Link from 'next/link';
import { PageContainer } from '@/components/neli/page-header';

export default function NotFound() {
  return (
    <PageContainer className='flex min-h-[60vh] flex-col items-center justify-center text-center'>
      <p className='text-label-sm text-text-soft-400'>404</p>
      <h1 className='mt-2 text-title-h5 text-text-strong-950'>We couldn&apos;t find that page</h1>
      <p className='mt-2 text-paragraph-sm text-text-sub-600'>It may have moved, or the link is wrong.</p>
      <Link href='/' className='mt-6 inline-flex h-10 items-center rounded-10 bg-primary-base px-4 text-label-sm text-static-white'>
        Back to live results
      </Link>
    </PageContainer>
  );
}
