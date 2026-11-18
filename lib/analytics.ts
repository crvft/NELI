import type { Election, Person } from './domain';
import { STATES, ZONES, type ZoneCode } from './geo';
import type { PartyCode } from './parties';

export type Tally = {
  personId: string;
  party: PartyCode;
  name: string;
  votes: number;
  share: number;
};

/** Votes counted so far (live elections are scaled by reporting fraction). */
export function countedVotes(e: Election, areaCode: string): Record<string, number> {
  const full = e.results[areaCode] ?? {};
  const f = e.status === 'live' ? (e.reported?.[areaCode] ?? 0) : 1;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(full)) out[k] = Math.round(v * f);
  return out;
}

export function tally(e: Election, areaCodes?: string[]): Tally[] {
  const codes = areaCodes ?? e.areas.map((a) => a.code);
  const totals: Record<string, number> = {};
  for (const c of codes) {
    const v = countedVotes(e, c);
    for (const [k, n] of Object.entries(v)) totals[k] = (totals[k] ?? 0) + n;
  }
  const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
  return e.candidates
    .map((c) => ({
      personId: c.personId,
      party: c.party,
      name: c.name ?? c.personId,
      votes: totals[c.personId] ?? 0,
      share: (totals[c.personId] ?? 0) / sum,
    }))
    .sort((a, b) => b.votes - a.votes);
}

export const totalVotes = (t: Tally[]) => t.reduce((a, b) => a + b.votes, 0);

/** Registered voters for the whole election; 0 when unknown. */
export function registeredTotal(e: Election) {
  if (e.areas.every((a) => a.registered > 0)) return e.areas.reduce((a, b) => a + b.registered, 0);
  return e.registered ?? 0;
}

/** Turnout, or NaN when the register is unknown (shown as a dash, never estimated). */
export const turnoutOf = (votes: number, registered: number) => (registered > 0 ? votes / registered : NaN);

export function areaLeader(e: Election, areaCode: string): { personId: string; party: PartyCode; share: number } | null {
  const v = countedVotes(e, areaCode);
  const sum = Object.values(v).reduce((a, b) => a + b, 0);
  if (!sum) return null;
  const [pid, n] = Object.entries(v).sort((a, b) => b[1] - a[1])[0];
  const party = e.candidates.find((c) => c.personId === pid)!.party;
  return { personId: pid, party, share: n / sum };
}

export function zoneBreakdown(e: Election) {
  return ZONES.map((z) => {
    const codes = e.areas.filter((a) => a.zone === z.code).map((a) => a.code);
    return { zone: z, tally: tally(e, codes) };
  });
}

/** Share of a candidate's total votes that came from each zone (or area for sub-national races). */
export function voteSources(e: Election, personId: string) {
  const total = tally(e).find((t) => t.personId === personId)?.votes || 1;
  if (e.level === 'national') {
    return ZONES.map((z) => {
      const v = e.areas
        .filter((a) => a.zone === z.code)
        .reduce((s, a) => s + (countedVotes(e, a.code)[personId] ?? 0), 0);
      return { key: z.code, label: z.name, votes: v, pct: v / total };
    });
  }
  return e.areas.map((a) => {
    const v = countedVotes(e, a.code)[personId] ?? 0;
    return { key: a.code, label: a.name, votes: v, pct: v / total };
  });
}

export function reportingProgress(e: Election) {
  if (e.status !== 'live') return 1;
  const reg = registeredTotal(e);
  return e.areas.reduce((s, a) => s + a.registered * (e.reported?.[a.code] ?? 0), 0) / reg;
}

// ---------------------------------------------------------------------------
// Win probability (live) — Monte Carlo over unreported votes
// ---------------------------------------------------------------------------
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
function gauss(r: () => number) {
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export type Probability = { personId: string; party: PartyCode; prob: number; projectedShare: number };

/**
 * Nigeria's constitutional rule: the winner needs the most votes AND at least 25%
 * in two-thirds of the 36 states + FCT (24). We model the unreported part of each
 * state using prior strength (previous comparable election) blended with the
 * already-counted share, with uncertainty that shrinks as reporting rises.
 */
export function liveProbabilities(e: Election, all: Election[], reportedOverride?: Record<string, number>, sims = 1500): Probability[] {
  const reported = reportedOverride ?? e.reported ?? {};
  const prior = previousComparable(e, all);
  const ids = e.candidates.map((c) => c.personId);
  const wins: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
  const projected: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
  const r = rng(42);

  // Precompute per-area expectations
  const areaInfo = e.areas.map((a) => {
    const f = reported[a.code] ?? 0;
    const full = e.results[a.code] ?? {};
    const fullSum = Object.values(full).reduce((x, y) => x + y, 0) || 1;
    const counted: Record<string, number> = {};
    for (const id of ids) counted[id] = (full[id] ?? 0) * f;
    const countedSum = Object.values(counted).reduce((x, y) => x + y, 0);
    const priorShares: Record<string, number> = {};
    const priorRes = prior?.results[a.code];
    const priorSum = priorRes ? Object.values(priorRes).reduce((x, y) => x + y, 0) : 0;
    for (const id of ids) {
      const p = priorRes && priorSum ? (priorRes[id] ?? 0) / priorSum : 1 / ids.length;
      const c = countedSum ? counted[id] / countedSum : p;
      // weight counted share by how much has reported
      priorShares[id] = f > 0 ? c * Math.min(1, 0.4 + f) + p * (1 - Math.min(1, 0.4 + f)) : p;
    }
    return { code: a.code, f, counted, remaining: fullSum * (1 - f), expShare: priorShares };
  });

  for (let s = 0; s < sims; s++) {
    const national: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
    const over25: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
    const swing: Record<string, number> = Object.fromEntries(ids.map((i) => [i, gauss(r) * 0.09]));
    for (const a of areaInfo) {
      const sd = 0.06 + 0.18 * (1 - a.f);
      let sum = 0;
      const w: Record<string, number> = {};
      for (const id of ids) {
        w[id] = Math.max(0.0001, a.expShare[id] * (1 + swing[id] + gauss(r) * sd));
        sum += w[id];
      }
      let areaTotal = 0;
      const areaVotes: Record<string, number> = {};
      for (const id of ids) {
        areaVotes[id] = a.counted[id] + (w[id] / sum) * a.remaining;
        areaTotal += areaVotes[id];
      }
      for (const id of ids) {
        national[id] += areaVotes[id];
        if (areaTotal && areaVotes[id] / areaTotal >= 0.25) over25[id]++;
      }
    }
    const sorted = ids.slice().sort((x, y) => national[y] - national[x]);
    const top = sorted[0];
    // If the leader misses the 25% spread, it goes to a run-off; count as half-win for top two
    if (e.type !== 'presidential' || over25[top] >= 24) wins[top]++;
    else {
      wins[top] += 0.5;
      wins[sorted[1]] += 0.5;
    }
    const tot = Object.values(national).reduce((x, y) => x + y, 0);
    for (const id of ids) projected[id] += national[id] / tot / sims;
  }
  return e.candidates
    .map((c) => ({ personId: c.personId, party: c.party, prob: wins[c.personId] / sims, projectedShare: projected[c.personId] }))
    .sort((a, b) => b.prob - a.prob);
}

/**
 * Reporting snapshots through election night. Each area starts reporting at its own
 * (deterministic) time and climbs to its current level, so early leads can shift.
 */
export function reportingSnapshots(e: Election, steps = 12) {
  const r = rng(7);
  const plan = e.areas.map((a) => {
    const start = r() * 0.55;
    return { code: a.code, start, dur: 0.25 + r() * 0.45, final: e.reported?.[a.code] ?? 1 };
  });
  const base = new Date(e.updatedAt ?? e.date ?? Date.UTC(e.year, 1, 25)).getTime() - 16 * 3600_000;
  return Array.from({ length: steps }, (_, i) => {
    const t = 0.18 + (0.82 * (i + 1)) / steps;
    const rep: Record<string, number> = {};
    for (const p of plan) rep[p.code] = p.final * Math.max(0, Math.min(1, (t - p.start) / p.dur));
    const time = new Date(base + 16 * 3600_000 * t);
    return {
      rep,
      label: time.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Lagos' }),
    };
  });
}

/** Win probability at each snapshot (percent, 0-100). */
export function probabilityTimeline(e: Election, all: Election[]) {
  return reportingSnapshots(e, 10).map(({ rep, label }) => {
    const probs = liveProbabilities(e, all, rep, 500);
    const row: Record<string, number | string> = { label };
    for (const p of probs) row[p.personId] = Math.round(p.prob * 1000) / 10;
    return row;
  });
}

/** Vote share of counted votes at each snapshot (percent). */
export function shareTimeline(e: Election) {
  return reportingSnapshots(e, 12).map(({ rep, label }) => {
    const totals: Record<string, number> = {};
    for (const a of e.areas) {
      const full = e.results[a.code] ?? {};
      for (const [k, v] of Object.entries(full)) totals[k] = (totals[k] ?? 0) + v * (rep[a.code] ?? 0);
    }
    const sum = Object.values(totals).reduce((x, y) => x + y, 0) || 1;
    const row: Record<string, number | string> = { label };
    for (const c of e.candidates) row[c.personId] = Math.round(((totals[c.personId] ?? 0) / sum) * 1000) / 10;
    return row;
  });
}

/** Per-area summary used by the map tooltip and state panel. */
export function areaSummary(e: Election, areaCode: string) {
  const t = tally(e, [areaCode]);
  const total = totalVotes(t);
  const area = e.areas.find((a) => a.code === areaCode)!;
  const reported = e.status === 'live' ? (e.reported?.[areaCode] ?? 0) : 1;
  return {
    code: areaCode,
    name: area.name,
    zone: area.zone,
    registered: area.registered,
    reported,
    total,
    turnout: reported > 0 ? turnoutOf(total, area.registered * reported) : 0,
    margin: t.length > 1 && total ? t[0].share - t[1].share : 0,
    tally: t,
  };
}

/** States where each candidate has at least 25% (counted so far). */
export function spreadCount(e: Election) {
  const out: Record<string, number> = {};
  for (const c of e.candidates) out[c.personId] = 0;
  for (const a of e.areas) {
    const v = countedVotes(e, a.code);
    const sum = Object.values(v).reduce((x, y) => x + y, 0);
    if (!sum) continue;
    for (const c of e.candidates) if ((v[c.personId] ?? 0) / sum >= 0.25) out[c.personId]++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Forecasts for upcoming elections
// ---------------------------------------------------------------------------
export function previousComparable(e: Election, all: Election[]) {
  return all.filter(
    (x) => x.id !== e.id && x.type === e.type && x.stateCode === e.stateCode && x.constituency === e.constituency && x.year < e.year && x.status === 'concluded',
  ).sort((a, b) => b.year - a.year)[0];
}

export type ForecastRow = { personId: string; party: PartyCode; prob: number; share: number; factors: string[]; lo?: number; hi?: number; outright?: number };

export function forecast(e: Election, all: Election[], people: Person[]): ForecastRow[] {
  // Anyanwụ's published forecast when there is one
  if (e.forecast) return [...e.forecast.rows].sort((a, b) => b.prob - a.prob);
  const prev = previousComparable(e, all);
  const prevTally = prev ? tally(prev) : [];
  const raw = e.candidates.map((c) => {
    const person = people.find((p) => p.id === c.personId)!;
    const sameParty = prevTally.find((t) => t.party === c.party);
    let base = sameParty?.share ?? 0.25;
    const factors: string[] = [];
    if (sameParty) factors.push(`${c.party} won ${(sameParty.share * 100).toFixed(0)}% here in ${prev!.year}`);
    const incumbent = person.roles.find((r) => !r.to && r.office === officeFor(e.type) && r.stateCode === e.stateCode);
    if (incumbent) {
      base *= 1.12;
      factors.push('Incumbent');
    }
    const ranBefore = prevTally.find((t) => t.personId === c.personId);
    if (ranBefore) factors.push(`Ran in ${prev!.year}: ${(ranBefore.share * 100).toFixed(0)}%`);
    const switched = person.partyHistory.length > 1;
    if (switched) factors.push(`Changed party ${person.partyHistory.length - 1}×`);
    return { personId: c.personId, party: c.party, base, factors };
  });
  const sum = raw.reduce((a, b) => a + b.base, 0);
  const shares = raw.map((r) => ({ ...r, share: r.base / sum }));
  // Convert share lead into probability with a logistic on margin
  const exps = shares.map((s) => Math.exp(s.share * 8));
  const es = exps.reduce((a, b) => a + b, 0);
  return shares
    .map((s, i) => ({ personId: s.personId, party: s.party, share: s.share, prob: exps[i] / es, factors: s.factors }))
    .sort((a, b) => b.prob - a.prob);
}

function officeFor(t: Election['type']) {
  return ({ presidential: 'president', governorship: 'governor', senate: 'senator', reps: 'rep', assembly: 'assembly', lga: 'lga-chair' } as const)[t];
}

// ---------------------------------------------------------------------------
// People helpers
// ---------------------------------------------------------------------------
export function electionsFor(personId: string, all: Election[]) {
  return all.filter((e) => e.candidates.some((c) => c.personId === personId))
    .filter((e) => e.status !== 'upcoming' || true)
    .sort((a, b) => b.year - a.year || (b.date ?? '').localeCompare(a.date ?? ''));
}

export function personRecord(personId: string, all: Election[]) {
  return electionsFor(personId, all).map((e) => {
    const t = e.status === 'upcoming' ? [] : tally(e);
    const idx = t.findIndex((x) => x.personId === personId);
    const me = t[idx];
    return {
      election: e,
      party: e.candidates.find((c) => c.personId === personId)!.party,
      votes: me?.votes ?? 0,
      share: me?.share ?? 0,
      position: idx + 1,
      won: e.status === 'concluded' && idx === 0,
    };
  });
}

export function currentRole(p: Person) {
  return p.roles.find((r) => !r.to);
}
export function currentParty(p: Person) {
  return p.partyHistory[p.partyHistory.length - 1].party;
}

export function officeHolders(people: Person[]) {
  return people.filter((p) => currentRole(p));
}

export function zoneOfState(code: string): ZoneCode | undefined {
  return STATES.find((s) => s.code === code)?.zone;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
export const fmt = (n: number) => n.toLocaleString('en-NG');
export const fmtCompact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K` : String(n);
export const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)}%` : '—');
