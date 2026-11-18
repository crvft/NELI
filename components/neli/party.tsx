import { cn } from '@/utils/cn';
import { PARTIES, type PartyCode } from '@/lib/parties';

export function PartyDot({ code, className }: { code: PartyCode; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: PARTIES[code].color }} />;
}

export function PartyTag({ code, full = false, className }: { code: PartyCode; full?: boolean; className?: string }) {
  const p = PARTIES[code];
  return (
    <span
      title={p.name}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md bg-surface-2 px-2 text-label-xs text-text-sub-600 shadow-surface-2',
        className,
      )}
    >
      <PartyDot code={code} className='size-2' />
      {full ? p.name : code === 'OTH' ? 'Other' : code}
    </span>
  );
}
