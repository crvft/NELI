import type { Election } from './data';
import { ZONES, stateByCode, type ZoneCode } from './geo';
import type { PartyCode } from './parties';
import { areaSummary, zoneBreakdown } from './analytics';

export type MapCandidate = { personId: string; name: string; party: PartyCode; share: number; votes: number };

export type MapState = {
  code: string;
  name: string;
  capital: string;
  zone: ZoneCode;
  zoneName: string;
  registered: number;
  reported: number;
  total: number;
  turnout: number;
  margin: number;
  candidates: MapCandidate[];
};

export type MapZone = { code: ZoneCode; name: string; total: number; lead?: MapCandidate; second?: MapCandidate; statesLed: Partial<Record<PartyCode, number>> };

export type MapPayload = {
  electionId: string;
  live: boolean;
  states: MapState[];
  zones: MapZone[];
};

/** Serializable data for the national map (client component). */
export function mapPayload(e: Election): MapPayload {
  const states = e.areas.map((a) => {
    const s = areaSummary(e, a.code);
    const st = stateByCode(a.code);
    return {
      code: a.code,
      name: st.name,
      capital: st.capital,
      zone: st.zone,
      zoneName: ZONES.find((z) => z.code === st.zone)!.name,
      registered: s.registered,
      reported: s.reported,
      total: s.total,
      turnout: s.turnout,
      margin: s.margin,
      candidates: s.tally.map((t) => ({ personId: t.personId, name: t.name, party: t.party, share: t.share, votes: t.votes })),
    };
  });
  const zones = zoneBreakdown(e).map(({ zone, tally }) => {
    const total = tally.reduce((x, y) => x + y.votes, 0);
    const statesLed: Partial<Record<PartyCode, number>> = {};
    for (const s of states.filter((x) => x.zone === zone.code && x.total > 0)) statesLed[s.candidates[0].party] = (statesLed[s.candidates[0].party] ?? 0) + 1;
    const m = (t: (typeof tally)[number] | undefined) => (t ? { personId: t.personId, name: t.name, party: t.party, share: t.share, votes: t.votes } : undefined);
    return { code: zone.code, name: zone.name, total, lead: total ? m(tally[0]) : undefined, second: total ? m(tally[1]) : undefined, statesLed };
  });
  return { electionId: e.id, live: e.status === 'live', states, zones };
}

/** How strong a lead is, for the heat-map fill. */
export function leadStrength(margin: number): 'strong' | 'clear' | 'narrow' {
  return margin >= 0.2 ? 'strong' : margin >= 0.08 ? 'clear' : 'narrow';
}
