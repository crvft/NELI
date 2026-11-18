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
};

export type RegionOverview = {
  kind: RegionKind;
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
    registeredGrowth: number; // first → latest register, as a fraction
    swingLatest?: { party: PartyCode; change: number }; // biggest share gain, previous → latest concluded
  };
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
      turnout: reported > 0 ? total / (a.registered * reported) : 0,
      reported,
      lead: total ? parties[0] : undefined,
      margin: total && parties[1] ? parties[0].share - parties[1].share : total ? 1 : 0,
      parties,
    };
  });
  const registered = areas.reduce((s, a) => s + a.registered, 0);
  const votes = areas.reduce((s, a) => s + a.votes, 0);
  const reportedRegistered = areas.reduce((s, a) => s + a.registered * a.reported, 0);
  const areasLed: Partial<Record<PartyCode, number>> = {};
  for (const a of areas) if (a.lead) areasLed[a.lead.party] = (areasLed[a.lead.party] ?? 0) + 1;
  return {
    electionId: e.id,
    year: e.year,
    title: e.title,
    live: e.status === 'live',
    registered,
    votes,
    turnout: reportedRegistered ? votes / reportedRegistered : 0,
    reported: registered ? reportedRegistered / registered : 0,
    parties: partyShares(e, sumVotes(e, codes)),
    areasLed,
    areas: areas.sort((a, b) => b.votes - a.votes),
  };
}

/** Build the overview for a zone (NW…SS) or a state code from national elections. */
export function regionOverview(elections: Election[], kind: RegionKind, code: string): RegionOverview {
  const national = elections.filter((e) => e.level === 'national' && e.status !== 'upcoming').sort((a, b) => a.year - b.year);
  const areaCodes = kind === 'zone' ? STATES.filter((s) => s.zone === code).map((s) => s.code) : [code];
  const name = kind === 'zone' ? ZONES.find((z) => z.code === code)!.name : stateByCode(code).name;
  const cycles = national.map((e) => cycleSummary(e, areaCodes));

  const totals = new Map<PartyCode, number>();
  for (const c of cycles) for (const p of c.parties) totals.set(p.party, (totals.get(p.party) ?? 0) + p.votes);
  const parties = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([p]) => p);

  const concluded = cycles.filter((c) => !c.live);
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
    code,
    name,
    areaCodes,
    cycles,
    parties,
    overall: {
      cyclesLedBy,
      averageTurnout: concluded.length ? concluded.reduce((s, c) => s + c.turnout, 0) / concluded.length : 0,
      registeredGrowth: cycles.length >= 2 ? cycles[cycles.length - 1].registered / cycles[0].registered - 1 : 0,
      swingLatest,
    },
  };
}

export function zoneCodes(): ZoneCode[] {
  return ZONES.map((z) => z.code);
}

export function isZoneCode(code: string): code is ZoneCode {
  return ZONES.some((z) => z.code === code);
}
