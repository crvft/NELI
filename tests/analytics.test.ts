import { describe, expect, it } from 'vitest';
import { ELECTIONS, PEOPLE } from '@/lib/sample/dataset';
import { STATES } from '@/lib/geo';
import { forecast, liveProbabilities, reportingProgress, spreadCount, tally, totalVotes, zoneBreakdown } from '@/lib/analytics';
import { regionOverview } from '@/lib/region';

const live = ELECTIONS.find((e) => e.status === 'live')!;
const pres2023 = ELECTIONS.find((e) => e.id === 'pres-2023')!;
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe('tally', () => {
  it('shares sum to 1 and are sorted by votes', () => {
    for (const e of ELECTIONS.filter((x) => x.status !== 'upcoming')) {
      const t = tally(e);
      expect(close(t.reduce((s, x) => s + x.share, 0), 1, 1e-6)).toBe(true);
      for (let i = 1; i < t.length; i++) expect(t[i - 1].votes).toBeGreaterThanOrEqual(t[i].votes);
    }
  });

  it('every candidate has a display name', () => {
    for (const e of ELECTIONS) for (const c of e.candidates) expect(c.name).toBeTruthy();
  });

  it('live counts never exceed the full result', () => {
    const counted = totalVotes(tally(live));
    const full = live.areas.reduce((s, a) => s + Object.values(live.results[a.code] ?? {}).reduce((x, y) => x + y, 0), 0);
    expect(counted).toBeLessThanOrEqual(full);
    expect(reportingProgress(live)).toBeGreaterThan(0);
    expect(reportingProgress(live)).toBeLessThanOrEqual(1);
  });
});

describe('zones and states', () => {
  it('national total equals the sum of the six zones', () => {
    const zones = zoneBreakdown(pres2023);
    const zoneTotal = zones.reduce((s, z) => s + totalVotes(z.tally), 0);
    expect(zoneTotal).toBe(totalVotes(tally(pres2023)));
  });

  it('a zone overview equals the sum of its states in every cycle', () => {
    const zone = regionOverview(ELECTIONS, 'zone', 'NW');
    for (const c of zone.cycles) {
      const states = zone.areaCodes.map((code) => regionOverview(ELECTIONS, 'state', code).cycles.find((x) => x.electionId === c.electionId)!);
      expect(c.votes).toBe(states.reduce((s, x) => s + x.votes, 0));
      expect(c.registered).toBe(states.reduce((s, x) => s + x.registered, 0));
    }
  });

  it('cycles run oldest first and turnout is a proportion', () => {
    const o = regionOverview(ELECTIONS, 'zone', 'SW');
    for (let i = 1; i < o.cycles.length; i++) expect(o.cycles[i].year).toBeGreaterThan(o.cycles[i - 1].year);
    for (const c of o.cycles) {
      expect(c.turnout).toBeGreaterThanOrEqual(0);
      expect(c.turnout).toBeLessThanOrEqual(1);
    }
  });

  it('25% spread counts stay within the 37 states', () => {
    for (const n of Object.values(spreadCount(pres2023))) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(STATES.length);
    }
  });
});

describe('probabilities', () => {
  it('live win probabilities sum to 1', () => {
    const p = liveProbabilities(live, ELECTIONS, undefined, 400);
    expect(close(p.reduce((s, x) => s + x.prob, 0), 1, 1e-9)).toBe(true);
    expect(close(p.reduce((s, x) => s + x.projectedShare, 0), 1, 1e-6)).toBe(true);
  });

  it('are deterministic for the same inputs', () => {
    expect(liveProbabilities(live, ELECTIONS, undefined, 300)).toEqual(liveProbabilities(live, ELECTIONS, undefined, 300));
  });

  it('forecasts for upcoming elections sum to 1', () => {
    for (const e of ELECTIONS.filter((x) => x.status === 'upcoming')) {
      const f = forecast(e, ELECTIONS, PEOPLE);
      expect(close(f.reduce((s, x) => s + x.prob, 0), 1, 1e-9)).toBe(true);
    }
  });
});
