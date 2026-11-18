import { PARTIES, type PartyCode } from '@/lib/parties';
import type { MapPayload } from '@/lib/map-data';

/**
 * Right-hand column beside the map, in the spirit of an atlas "How to use" page:
 * short ruled sections that decode the map and the rules behind it.
 */
export function MapGuide({
  data,
  spread,
  names,
  isPresidential,
}: {
  data: MapPayload;
  spread?: Record<string, number>;
  names: { personId: string; name: string; party: PartyCode }[];
  isPresidential: boolean;
}) {
  const led: Partial<Record<PartyCode, number>> = {};
  for (const s of data.states) if (s.total) led[s.candidates[0].party] = (led[s.candidates[0].party] ?? 0) + 1;
  const awaiting = data.states.filter((s) => !s.total).length;
  const narrow = data.states.filter((s) => s.total && s.margin < 0.08).sort((a, b) => a.margin - b.margin);

  return (
    <div className='flex flex-col'>
      <Section title='How to read'>
        <ul className='flex flex-col gap-3'>
          <Item swatch='strong' title='Solid colour' body='A strong lead of 20 points or more.' />
          <Item swatch='clear' title='Tinted colour' body='A clear lead of 8 to 20 points.' />
          <Item swatch='narrow' title='Striped' body='Under 8 points. Too close to call, so watch these.' />
          {data.live && <Item swatch='empty' title='Dotted grey' body='No result sheets uploaded yet.' />}
        </ul>
      </Section>

      <Section title='States led'>
        <ul className='flex flex-col gap-2'>
          {(Object.entries(led) as [PartyCode, number][])
            .sort((a, b) => b[1] - a[1])
            .map(([p, n]) => (
              <li key={p} className='flex items-center gap-2.5'>
                <span className='size-3 rounded-sm' style={{ background: PARTIES[p].color }} />
                <span className='text-label-sm text-text-strong-950'>{p}</span>
                <span className='truncate text-paragraph-xs text-text-sub-600'>{PARTIES[p].name}</span>
                <span className='tabular ml-auto text-label-sm text-text-strong-950'>{n}</span>
              </li>
            ))}
          {awaiting > 0 && (
            <li className='flex items-center gap-2.5 text-paragraph-xs text-text-sub-600'>
              <span className='size-3 rounded-sm bg-[var(--map-state-empty)] ring-1 ring-inset ring-stroke-sub-300' />
              Awaiting results
              <span className='tabular ml-auto text-label-sm text-text-strong-950'>{awaiting}</span>
            </li>
          )}
        </ul>
        {narrow.length > 0 && (
          <p className='mt-3 text-paragraph-xs text-text-sub-600'>
            Closest: {narrow.slice(0, 3).map((s, i) => (
              <span key={s.code}>
                {i > 0 && ', '}
                <span className='text-text-strong-950'>{s.name}</span> ({(s.margin * 100).toFixed(1)} pts)
              </span>
            ))}
          </p>
        )}
      </Section>

      {isPresidential && spread && (
        <Section title='The 25% rule'>
          <p className='text-paragraph-sm text-text-sub-600'>
            To win outright, a candidate needs the most votes <span className='text-text-strong-950'>and</span> at least 25% of the vote in 24 of the 37
            states (two-thirds, counting the FCT). If nobody manages both, there is a run-off.
          </p>
          <ul className='mt-4 flex flex-col gap-3'>
            {names.slice(0, 4).map((c) => (
              <li key={c.personId}>
                <div className='mb-1.5 flex justify-between gap-2 text-paragraph-xs text-text-sub-600'>
                  <span className='truncate'>
                    {c.name} <span className='text-text-sub-600'>· {c.party}</span>
                  </span>
                  <span className={`tabular text-label-xs ${spread[c.personId] >= 24 ? 'text-success-base' : 'text-text-strong-950'}`}>
                    {spread[c.personId]}/24
                  </span>
                </div>
                <div className='relative h-1.5 rounded-full bg-bg-soft-200'>
                  <div className='h-full rounded-full' style={{ width: `${(spread[c.personId] / 37) * 100}%`, background: PARTIES[c.party].color }} />
                  <span className='absolute -top-1 h-3.5 w-0.5 rounded-full bg-text-strong-950' style={{ left: `${(24 / 37) * 100}%` }} aria-hidden />
                </div>
              </li>
            ))}
          </ul>
          <p className='mt-2 text-paragraph-xs text-text-sub-600'>The tick marks 24 states.</p>
        </Section>
      )}

      <Section title='Good to know'>
        <ul className='flex list-disc flex-col gap-2 pl-4 text-paragraph-xs text-text-sub-600 marker:text-text-sub-600'>
          {data.live && <li>Figures come from polling-unit result sheets (Form EC8A) as they are uploaded to INEC&apos;s result viewing portal.</li>}
          {data.live && <li>An early lead can flip. States report at different speeds, and big cities often come in late.</li>}
          <li>Zone labels around the map show the leading party and votes counted in each geopolitical zone.</li>
          <li>Percentages are shares of valid votes counted, not of registered voters.</li>
        </ul>
      </Section>
      <p className='px-4 py-4 text-center text-paragraph-xs text-text-sub-600 sm:px-5'>Boundaries: GRID3 Nigeria (CC BY 4.0), Natural Earth.</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='border-b border-stroke-soft-200 px-4 py-5 sm:px-5'>
      <h3 className='mb-3 text-label-sm text-text-strong-950'>{title}</h3>
      {children}
    </section>
  );
}

function Item({ swatch, title, body }: { swatch: 'strong' | 'clear' | 'narrow' | 'empty'; title: string; body: string }) {
  const c = 'var(--text-sub-600)';
  return (
    <li className='flex items-start gap-3'>
      <svg width='22' height='16' className='mt-0.5 shrink-0 overflow-hidden rounded' aria-hidden>
        {swatch === 'strong' && <rect width='22' height='16' fill={c} />}
        {swatch === 'clear' && <rect width='22' height='16' fill={`color-mix(in oklab, ${c} 48%, var(--bg-white-0))`} />}
        {swatch === 'narrow' && (
          <>
            <rect width='22' height='16' fill={`color-mix(in oklab, ${c} 14%, var(--bg-white-0))`} />
            {[-12, -6, 0, 6, 12, 18, 24].map((o) => (
              <line key={o} x1={o} y1='16' x2={o + 16} y2='0' stroke={c} strokeWidth='2' />
            ))}
          </>
        )}
        {swatch === 'empty' && (
          <>
            <rect width='22' height='16' fill='var(--map-state-empty)' />
            {[4, 10, 16].flatMap((x) => [4, 10].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r='0.9' fill='var(--text-soft-400)' />))}
          </>
        )}
      </svg>
      <div>
        <div className='text-label-sm text-text-strong-950'>{title}</div>
        <div className='text-paragraph-xs text-text-sub-600'>{body}</div>
      </div>
    </li>
  );
}
