import { cn } from '@/utils/cn';

/**
 * Skeletons only appear when data is genuinely slow: `.skeleton` stays invisible
 * for 160ms, so anything that lands sooner never flashes a placeholder. Each one
 * is built at the size of the real block, so nothing shifts when data arrives.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

function CardShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-2xl bg-surface-2 shadow-surface-2', className)}>{children}</div>;
}

export function PageHeaderSkeleton() {
  return (
    <div className='flex flex-col gap-3'>
      <Skeleton className='h-8 w-72 max-w-full' />
      <Skeleton className='h-5 w-[28rem] max-w-full' />
    </div>
  );
}

export function KpiRowSkeleton() {
  return (
    <CardShell className='grid grid-cols-2 gap-x-4 gap-y-5 p-4 sm:p-5 md:grid-cols-4'>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className='flex flex-col gap-2'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-6 w-20' />
          <Skeleton className='h-4 w-28' />
        </div>
      ))}
    </CardShell>
  );
}

export function ChartCardSkeleton({ height = 260 }: { height?: number }) {
  return (
    <CardShell>
      <div className='flex flex-col gap-2 border-b border-stroke-soft-200 px-4 py-3.5 sm:px-5'>
        <Skeleton className='h-5 w-48' />
        <Skeleton className='h-4 w-64 max-w-full' />
      </div>
      <div className='p-4 sm:p-5'>
        <div className='skeleton w-full' style={{ height }} aria-hidden />
      </div>
    </CardShell>
  );
}

export function ListCardSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <CardShell>
      <div className='flex flex-col gap-2 border-b border-stroke-soft-200 px-4 py-3.5 sm:px-5'>
        <Skeleton className='h-5 w-40' />
      </div>
      <div className='flex flex-col gap-1 p-2'>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className='flex items-center gap-3 px-2 py-2'>
            <Skeleton className='size-10 rounded-full' />
            <div className='flex flex-1 flex-col gap-1.5'>
              <Skeleton className='h-4 w-1/2' />
              <Skeleton className='h-3.5 w-1/3' />
            </div>
            <Skeleton className='h-6 w-14' />
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export function MapCardSkeleton() {
  return (
    <CardShell className='grid grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]'>
      <div className='flex flex-col gap-3 p-4 sm:p-6'>
        <Skeleton className='h-7 w-64' />
        <Skeleton className='h-5 w-96 max-w-full' />
        <div className='skeleton mt-2 aspect-[1000/820] w-full rounded-2xl' aria-hidden />
      </div>
      <div className='flex flex-col gap-4 border-t border-stroke-soft-200 p-5 lg:border-l lg:border-t-0'>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className='h-10 w-full' />
        ))}
      </div>
    </CardShell>
  );
}

export function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3'>
      {Array.from({ length: count }, (_, i) => (
        <CardShell key={i} className='flex flex-col gap-4 p-4'>
          <div className='flex items-start gap-3'>
            <Skeleton className='size-14 rounded-full' />
            <div className='flex flex-1 flex-col gap-2'>
              <Skeleton className='h-5 w-2/3' />
              <Skeleton className='h-4 w-1/2' />
            </div>
          </div>
          <Skeleton className='h-6 w-1/2' />
        </CardShell>
      ))}
    </div>
  );
}
