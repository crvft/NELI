import { cn } from '@/utils/cn';

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className='min-w-0'>
        {eyebrow && <div className='mb-2 flex flex-wrap items-center gap-2'>{eyebrow}</div>}
        <h1 className='text-title-h5 tracking-tight text-text-strong-950 sm:text-title-h4'>{title}</h1>
        {description && <p className='mt-1.5 max-w-2xl text-paragraph-sm text-text-sub-600'>{description}</p>}
      </div>
      {actions && <div className='flex shrink-0 flex-wrap gap-2'>{actions}</div>}
    </div>
  );
}

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8', className)}>{children}</div>;
}

export function SampleBadge() {
  return (
    <span className='inline-flex h-6 items-center gap-1.5 rounded-md bg-away-lighter px-2 text-label-xs text-away-dark'>
      <span className='size-1.5 rounded-full bg-away-base' />
      Sample data
    </span>
  );
}
