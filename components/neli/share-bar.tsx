import { PARTIES } from '@/lib/parties';
import type { Tally } from '@/lib/analytics';
import { cn } from '@/utils/cn';

/** Horizontal stacked share bar. 2px surface gaps between segments. */
export function ShareBar({ tally, className, height = 'h-3' }: { tally: Tally[]; className?: string; height?: string }) {
  const total = tally.reduce((a, b) => a + b.votes, 0);
  if (!total) return <div className={cn('w-full rounded-full bg-bg-soft-200', height, className)} />;
  return (
    <div className={cn('flex w-full gap-0.5 overflow-hidden rounded-full', height, className)} role='img' aria-label={tally.map((t) => `${t.party} ${(t.share * 100).toFixed(1)}%`).join(', ')}>
      {tally
        .filter((t) => t.share > 0.003)
        .map((t) => (
          <div key={t.personId} title={`${t.name} (${t.party}) ${(t.share * 100).toFixed(1)}%`} style={{ width: `${t.share * 100}%`, background: PARTIES[t.party].color }} className='h-full first:rounded-l-full last:rounded-r-full' />
        ))}
    </div>
  );
}

export function MeterBar({ value, color, className }: { value: number; color: string; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-bg-soft-200', className)}>
      <div className='h-full rounded-full' style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  );
}
