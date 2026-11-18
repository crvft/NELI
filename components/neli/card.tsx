import { cn } from '@/utils/cn';
import { AnimatedNumber } from '@/components/motion/animated-number';

/**
 * Card: surface-2 on the page (surface-1). Elevation comes from the surface's own
 * shadow (which includes its hairline), so light cards are white on #fafafa and
 * dark cards step one notch lighter than the page.
 */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn('rounded-2xl bg-surface-2 shadow-surface-2', className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-stroke-soft-200 px-4 py-3.5 sm:px-5', className)}>
      <div className='flex min-w-0 items-start gap-2.5'>
        {icon && <span className='mt-0.5 text-text-sub-600'>{icon}</span>}
        <div className='min-w-0'>
          <h2 className='text-label-md text-text-strong-950'>{title}</h2>
          {description && <p className='mt-0.5 text-paragraph-xs text-text-sub-600'>{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Key figure. String/number values roll to new values (Calligraph) when they change. */
export function Stat({ label, value, sub, className }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className='text-paragraph-xs text-text-sub-600'>{label}</span>
      <span className='tabular text-title-h6 text-text-strong-950'>
        {typeof value === 'string' || typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </span>
      {sub && <span className='text-paragraph-xs text-text-sub-600'>{sub}</span>}
    </div>
  );
}

/** Section heading inside a panel: sentence case, semibold, no eyebrow styling. */
export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-label-sm text-text-strong-950', className)}>{children}</h3>;
}
