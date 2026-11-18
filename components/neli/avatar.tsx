import { cn } from '@/utils/cn';
import { PARTIES, type PartyCode } from '@/lib/parties';

const SIZES = {
  sm: 'size-8 text-label-xs',
  md: 'size-10 text-label-sm',
  lg: 'size-14 text-label-lg',
  xl: 'size-20 text-title-h5',
} as const;

export function PersonAvatar({ name, party, size = 'md', className }: { name: string; party?: PartyCode; size?: keyof typeof SIZES; className?: string }) {
  const initials = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  const c = party ? PARTIES[party].color : 'var(--neutral-400)';
  return (
    <span
      aria-hidden
      className={cn('relative grid shrink-0 place-items-center rounded-full font-[550] text-text-strong-950', SIZES[size], className)}
      style={{ background: `color-mix(in oklab, ${c} 18%, var(--bg-white-0))`, boxShadow: `inset 0 0 0 1.5px color-mix(in oklab, ${c} 55%, transparent)` }}
    >
      {initials}
    </span>
  );
}
