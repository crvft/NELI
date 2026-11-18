/**
 * Region analytics: a geopolitical zone or a single state, across election cycles.
 * Pure functions over the domain model, so they are unit-testable and run the same
 * on the server (from the repository) or in tests.
 */
import type { Election } from './domain';
import { STATES, ZONES, stateByCode, type ZoneCode } from './geo';
import type { PartyCode } from './parties';
import { countedVotes } from './analytics';

export type RegionKind = 'zone' | 'state';

export type PartyShare = { party: PartyCode; votes: number; share: number; candidate: string };

export type AreaRow = {
  code: string;
  name: string;
  registered: number;
  votes: number;
  turnout: number;
  reported: number;
  lead?: PartyShare;
  margin: number;
  parties: PartyShare[];
};

export type CycleSummary = {
  electionId: string;
  year: number;
  title: string;
  live: boolean;
  registered: number;
  votes: number;
  /** Turnout of reported units (live) or final turnout */
  turnout: number;
  reported: number;
  parties: PartyShare[];
  /** Number of areas (states) each party led */
  areasLed: Partial<Record<PartyCode, number>>;
  areas: AreaRow[];
  /** Governorship history varies: "winner only" cycles have no shares */
  coverage?: Election['coverage'];
  offCycle?: boolean;
};

/** Region elections the dashboard can show (others are listed but not on record yet). */
export type RegionElectionType = 'presidential' | 'governorship';

export type RegionForecast = {
  electionId: string;
  title: string;
  date?: string;
  byParty: boolean;
  rows: { personId: string; name: string; party: PartyCode; share: number; lo?: number; hi?: number; prob: number }[];
};

export type RegionOverview = {
  kind: RegionKind;
  type: RegionElectionType;
  code: string;
  name: string;
  /** Zones: the states in it. States: itself. */
  areaCodes: string[];
  cycles: CycleSummary[]; // oldest first
  /** Parties that appear in any cycle, ordered by total votes across cycles */
  parties: PartyCode[];
  /** Overall (all cycles) */
  overall: {
    cyclesLedBy: Partial<Record<PartyCode, number>>;
    averageTurnout: number;
    registeredGrowth: number; // first → latest known register, as a fraction (NaN if fewer than two known)
    registeredSince?: number;
    swingLatest?: { party: PartyCode; change: number }; // biggest share gain, previous → latest concluded
  };
  /** Anyanwụ's forecast for the next election of this type here, if published */
  forecast?: RegionForecast;
};

function partyShares(e: Election, votes: Record<string, number>): PartyShare[] {
  const total = Object.values(votes).reduce((a, b) => a + b, 0) || 1;
  const byParty = new Map<PartyCode, PartyShare>();
  for (const c of e.candidates) {
    const v = votes[c.personId] ?? 0;
    const cur = byParty.get(c.party);
    if (cur) cur.votes += v;
    else byParty.set(c.party, { party: c.party, votes: v, share: 0, candidate: c.personId });
  }
  return [...byParty.values()].map((p) => ({ ...p, share: p.votes / total })).sort((a, b) => b.votes - a.votes);
}

function sumVotes(e: Election, codes: string[]) {
  const out: Record<string, number> = {};
  for (const c of codes) for (const [k, v] of Object.entries(countedVotes(e, c))) out[k] = (out[k] ?? 0) + v;
  return out;
}

function cycleSummary(e: Election, codes: string[]): CycleSummary {
  const areas: AreaRow[] = codes.map((code) => {
    const a = e.areas.find((x) => x.code === code)!;
    const votes = countedVotes(e, code);
    const parties = partyShares(e, votes);
    const total = parties.reduce((s, p) => s + p.votes, 0);
    const reported = e.status === 'live' ? (e.reported?.[code] ?? 0) : 1;
    return {
      code,
      name: a.name,
      registered: a.registered,
      votes: total,
      turnout: reported > 0 ? (a.registered > 0 ? total / (a.registered * reported) : NaN) : 0,
      reported,
      lead: total ? parties[0] : undefined,
      margin: total && parties[1] ? parties[0].share - parties[1].share : total ? 1 : 0,
      parties,
    };
  });
  // Register unknown for any area (e.g. 2015 by state) -> unknown for the region
  const known = areas.every((a) => a.registered > 0);
  const registered = known ? areas.reduce((s, a) => s + a.registered, 0) : 0;
  const votes = areas.reduce((s, a) => s + a.votes, 0);
  const reportedRegistered = areas.reduce((s, a) => s + a.registered * a.reported, 0);
  const areasLed: Partial<Record<PartyCode, number>> = {};
  for (const a of areas) if (a.lead) areasLed[a.lead.party] = (areasLed[a.lead.party] ?? 0) + 1;
  const winnerOnly = e.coverage === 'winner only';
  const parties = partyShares(e, sumVotes(e, codes)).map((x) => (winnerOnly ? { ...x, share: NaN } : x));
  return {
    electionId: e.id,
    year: e.year,
    title: e.title,
    coverage: e.coverage,
    offCycle: e.offCycle,
    live: e.status === 'live',
    registered,
    votes,
    turnout: known && reportedRegistered ? votes / reportedRegistered : known ? 0 : NaN,
    reported: e.status !== 'live' ? 1 : registered ? reportedRegistered / registered : 0,
    parties,
    areasLed,
    areas: areas.sort((a, b) => b.votes - a.votes),
  };
}

/**
 * Build the overview for a zone (NW…SS) or a state, from presidential elections or,
 * for a state, its governorship elections (including off-cycle ones).
 */
export function regionOverview(elections: Election[], kind: RegionKind, code: string, type: RegionElectionType = 'presidential'): RegionOverview {
  const areaCodes = kind === 'zone' ? STATES.filter((s) => s.zone === code).map((s) => s.code) : [code];
  const name = kind === 'zone' ? ZONES.find((z) => z.code === code)!.name : stateByCode(code).name;
  const ofType = (e: Election) =>
    type === 'presidential' ? e.level === 'national' && e.type === 'presidential' : e.type === 'governorship' && kind === 'state' && e.stateCode === code;
  const held = elections.filter((e) => ofType(e) && e.status !== 'upcoming').sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
  const cycles = held.map((e) => cycleSummary(e, areaCodes));
  const next = elections.filter((e) => ofType(e) && e.status === 'upcoming' && e.forecast).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))[0];

  const totals = new Map<PartyCode, number>();
  for (const c of cycles) for (const p of c.parties) totals.set(p.party, (totals.get(p.party) ?? 0) + p.votes);
  const parties = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);

  const concluded = cycles.filter((c) => !c.live && c.coverage !== 'winner only');
  const cyclesLedBy: Partial<Record<PartyCode, number>> = {};
  for (const c of concluded) if (c.parties[0]) cyclesLedBy[c.parties[0].party] = (cyclesLedBy[c.parties[0].party] ?? 0) + 1;

  let swingLatest: RegionOverview['overall']['swingLatest'];
  if (concluded.length >= 2) {
    const [prev, last] = concluded.slice(-2);
    for (const p of last.parties) {
      const before = prev.parties.find((x) => x.party === p.party)?.share ?? 0;
      const change = p.share - before;
      if (!swingLatest || change > swingLatest.change) swingLatest = { party: p.party, change };
    }
  }

  return {
    kind,
    type,
    forecast: next ? regionForecast(next, kind, areaCodes) : undefined,
    code,
    name,
    areaCodes,
    cycles,
    parties,
    overall: {
      cyclesLedBy,
      averageTurnout: mean(concluded.map((c) => c.turnout).filter(Number.isFinite)),
      ...registerSpan(cycles),
      swingLatest,
    },
  };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** Register growth between the first and latest cycles whose register is known. */
function registerSpan(cycles: CycleSummary[]) {
  const known = cycles.filter((c) => c.registered > 0);
  const first = known[0];
  const last = known[known.length - 1];
  return {
    registeredGrowth: first && last && first !== last ? last.registered / first.registered - 1 : NaN,
    registeredSince: first && last && first !== last ? first.year : undefined,
  };
}

function regionForecast(e: Election, kind: RegionKind, areaCodes: string[]): RegionForecast | undefined {
  const f = e.forecast!;
  const name = (id: string) => e.candidates.find((c) => c.personId === id)?.name ?? id;
  if (e.level === 'national') {
    // A state's slice of the presidential forecast
    if (kind !== 'state') return undefined;
    const rows = f.areas?.[areaCodes[0]];
    if (!rows) return undefined;
    return {
      electionId: e.id,
      title: e.title,
      date: e.date,
      byParty: false,
      rows: rows.map((r) => ({ ...r, name: name(r.personId), party: e.candidates.find((c) => c.personId === r.personId)!.party })).sort((a, b) => b.prob - a.prob),
    };
  }
  return {
    electionId: e.id,
    title: e.title,
    date: e.date,
    byParty: !f.candidatesConfirmed,
    rows: f.rows.map((r) => ({ personId: r.personId, name: name(r.personId), party: r.party, share: r.share, lo: r.lo, hi: r.hi, prob: r.prob })).sort((a, b) => b.prob - a.prob),
  };
}

export function zoneCodes(): ZoneCode[] {
  return ZONES.map((z) => z.code);
}

export function isZoneCode(code: string): code is ZoneCode {
  return ZONES.some((z) => z.code === code);
}
