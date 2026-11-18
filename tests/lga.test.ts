import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { lgaResults, type LgaShapes } from '@/lib/lga';
import { ELECTIONS } from '@/lib/sample/dataset';
import { mapPayload } from '@/lib/map-data';

const pres = ELECTIONS.find((e) => e.id === 'pres-2023')!;
const map = mapPayload(pres);

describe('LGA results', () => {
  it('add back up to the state totals (within rounding)', () => {
    for (const s of map.states) {
      const shapes = JSON.parse(fs.readFileSync(`public/geo/lga/${s.code}.json`, 'utf8')) as LgaShapes;
      const res = lgaResults(s, shapes.lgas, pres.id);
      expect(res).toHaveLength(shapes.lgas.length);
      for (const c of s.candidates) {
        const sum = res.reduce((a, l) => a + (l.candidates.find((x) => x.personId === c.personId)?.votes ?? 0), 0);
        expect(Math.abs(sum - c.votes)).toBeLessThanOrEqual(shapes.lgas.length);
      }
    }
  });

  it('is deterministic and produces local variation', () => {
    const s = map.states.find((x) => x.code === 'KN')!;
    const shapes = JSON.parse(fs.readFileSync('public/geo/lga/KN.json', 'utf8')) as LgaShapes;
    const a = lgaResults(s, shapes.lgas, pres.id);
    expect(a).toEqual(lgaResults(s, shapes.lgas, pres.id));
    expect(new Set(a.map((l) => l.candidates[0].party)).size).toBeGreaterThan(1);
  });

  it('every state has its LGA file, 774 in total', () => {
    let n = 0;
    for (const s of map.states) n += (JSON.parse(fs.readFileSync(`public/geo/lga/${s.code}.json`, 'utf8')) as LgaShapes).lgas.length;
    expect(n).toBe(774);
  });
});
