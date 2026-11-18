import Link from 'next/link';
import { IconWon } from '@/components/icons';
import { PARTIES } from '@/lib/parties';
import { fmt, pct, type Probability, type Tally } from '@/lib/analytics';
import { PersonAvatar } from './avatar';
import { PartyTag } from './party';
import { MeterBar } from './share-bar';

export function ResultsList({ tally, probs, winnerId, spread }: { tally: Tally[]; probs?: Probability[]; winnerId?: string; spread?: Record<string, number> }) {
  return (
    <ul className='divide-y divide-stroke-soft-200'>
      {tally.map((t, i) => {
        const prob = probs?.find((p) => p.personId === t.personId);
        return (
          <li key={t.personId} className='flex items-center gap-3 px-4 py-3.5 sm:px-5'>
            <span className='tabular hidden w-4 text-label-sm text-text-sub-600 sm:inline'>{i + 1}</span>
            <PersonAvatar name={t.name} party={t.party} />
            <div className='min-w-0 flex-1'>
              <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                <Link href={`/politicians/${t.personId}`} className='truncate text-label-sm text-text-strong-950 hover:underline'>
                  {t.name}
                </Link>
                <PartyTag code={t.party} />
                {winnerId === t.personId && (
                  <span className='inline-flex items-center gap-1 text-label-xs text-success-base'>
                    <IconWon className='size-4' /> Winner
                  </span>
                )}
              </div>
              <div className='mt-2 flex items-center gap-3'>
                <MeterBar value={t.share} color={PARTIES[t.party].color} className='max-w-[320px]' />
                <span className='tabular hidden whitespace-nowrap text-paragraph-xs text-text-sub-600 sm:inline'>{fmt(t.votes)} votes</span>
              </div>
              {spread && (
                <div className='mt-1 text-paragraph-xs text-text-sub-600'>
                  25%+ in <span className='tabular text-text-sub-600'>{spread[t.personId]}</span>/37 states
                  <span className='sm:hidden'> · {fmt(t.votes)} votes</span>
                </div>
              )}
              {!spread && <div className='tabular mt-1 text-paragraph-xs text-text-sub-600 sm:hidden'>{fmt(t.votes)} votes</div>}
            </div>
            <div className='flex shrink-0 flex-col items-end gap-0.5 text-right'>
              <span className='tabular text-label-lg text-text-strong-950'>{pct(t.share)}</span>
              {prob && <span className='tabular text-paragraph-xs text-text-sub-600'>{pct(prob.prob, 0)} to win</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
