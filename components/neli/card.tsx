import { cn } from '@/utils/cn';

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn('rounded-2xl bg-bg-white-0 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action, icon, className }: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-stroke-soft-200 px-4 py-3.5 sm:px-5', className)}>
      <div className='flex min-w-0 items-start gap-2.5'>
        {icon && <span className='mt-0.5 text-text-soft-400'>{icon}</span>}
        <div className='min-w-0'>
          <h2 className='text-label-md text-text-strong-950'>{title}</h2>
          {description && <p className='mt-0.5 text-paragraph-xs text-text-sub-600'>{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className='text-paragraph-xs text-text-sub-600'>{label}</span>
      <span className='tabular text-title-h6 text-text-strong-950'>{value}</span>
      {sub && <span className='text-paragraph-xs text-text-soft-400'>{sub}</span>}
    </div>
  );
}
