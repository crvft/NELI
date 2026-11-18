import { cn } from '@/utils/cn';

/** Page title block. Status chips sit beside the title, never as an eyebrow above it. */
export function PageHeader({
  badges,
  title,
  description,
  actions,
  className,
}: {
  badges?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className='min-w-0'>
        <div className='flex flex-wrap items-center gap-x-3 gap-y-2'>
          <h1 className='text-title-h5 tracking-tight text-text-strong-950 sm:text-title-h4'>{title}</h1>
          {badges && <div className='flex flex-wrap items-center gap-2'>{badges}</div>}
        </div>
        {description && <p className='mt-1.5 max-w-2xl text-paragraph-sm text-text-sub-600'>{description}</p>}
      </div>
      {actions && <div className='flex shrink-0 flex-wrap gap-2'>{actions}</div>}
    </div>
  );
}

/** Page body. `reveal-product` fades each block in on first paint, 60ms apart, no travel. */
export function PageContainer({ children, className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('reveal-product mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8', className)} {...rest}>
      {children}
    </div>
  );
}

export function SampleBadge() {
  return (
    <span className='inline-flex h-6 items-center gap-1.5 rounded-md bg-away-lighter px-2 text-label-xs text-away-dark'>
      <span className='size-1.5 rounded-full bg-away-base' />
      Sample data
    </span>
  );
}

/** Small neutral chip: election type, region, status. */
export function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-md bg-hover px-2 text-label-xs text-text-sub-600', className)}>{children}</span>;
}
