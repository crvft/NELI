import { it, expect } from 'vitest';
import { PEOPLE } from '@/lib/sample/dataset';
import { STATES } from '@/lib/geo';
it('every state has exactly one governor (FCT: minister)', () => {
  for (const s of STATES) {
    const holders = PEOPLE.filter((p) => { const r = p.roles.find((r) => !r.to); return r && r.stateCode === s.code && (r.office === 'governor' || (s.code === 'FC' && r.office === 'minister')); });
    expect(holders.length, s.code).toBe(1);
  }
  expect(new Set(PEOPLE.map((p) => p.id)).size).toBe(PEOPLE.length);
});
