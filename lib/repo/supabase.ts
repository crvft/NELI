/**
 * Supabase adapter: reads the real results and shapes them into the app's domain
 * model (lib/domain.ts). Pure read access with the publishable key; the database's
 * row-level security only allows SELECT.
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Area, Candidate, Election, Person, Role } from '@/lib/domain';
import { STATES, stateByCode } from '@/lib/geo';
import type { PartyCode } from '@/lib/parties';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://vlorfizyvsirjhgrrfrt.supabase.co';
// Publishable (public, read-only) key: safe to ship; RLS permits SELECT only.
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_UX0irQWhn2QXz8q7PANk3A_ad7LkErs';

const db = createClient(URL, KEY, { auth: { persistSession: false } });

type ElectionRow = {
  id: string;
  type: 'presidential' | 'governorship';
  year: number;
  state_code: string | null;
  off_cycle: boolean;
  coverage: 'all candidates' | 'top candidates only' | 'winner only';
  registered: number | null;
  valid_votes: number | null;
  source_key: string | null;
};
type ResultRow = { election_id: string; area_code: string; candidate: string; party: string; votes: number };
type RegisterRow = { year: number; state_code: string | null; registered: number };
type SourceRow = { key: string; url: string };

/** PostgREST returns at most 1,000 rows per request; page through. */
async function all<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from(table)
      .select(columns)
      .range(from, from + 999);
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return out;
  }
}

export const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function personIdFor(eid: string, candidate: string, party: string) {
  if (!candidate) return `${eid}-${slug(party)}`; // unnamed in the source (e.g. joint tickets)
  if (candidate === 'Others') return `${eid}-others`;
  return slug(candidate);
}

/** Polling day of each presidential election (INEC). Governorship dates are not on record yet. */
const PRESIDENTIAL_DATES: Record<number, string> = {
  1999: '1999-02-27',
  2003: '2003-04-19',
  2007: '2007-04-21',
  2011: '2011-04-16',
  2015: '2015-03-28',
  2019: '2019-02-23',
  2023: '2023-02-25',
};

export type RealData = { elections: Election[]; people: Person[] };

export async function loadRealData(): Promise<RealData> {
  const [elections, results, registers, sources] = await Promise.all([
    all<ElectionRow>('elections', 'id,type,year,state_code,off_cycle,coverage,registered,valid_votes,source_key'),
    all<ResultRow>('results', 'election_id,area_code,candidate,party,votes'),
    all<RegisterRow>('registered_voters', 'year,state_code,registered'),
    all<SourceRow>('sources', 'key,url'),
  ]);
  const srcUrl = new Map(sources.map((s) => [s.key, s.url]));
  const reg = new Map(registers.map((r) => [`${r.year}:${r.state_code ?? ''}`, r.registered]));
  const byElection = new Map<string, ResultRow[]>();
  for (const r of results) {
    const list = byElection.get(r.election_id) ?? [];
    list.push(r);
    byElection.set(r.election_id, list);
  }

  const out: Election[] = [];
  for (const e of elections) {
    const rows = byElection.get(e.id) ?? [];
    const candidates: Candidate[] = [];
    const seen = new Set<string>();
    const res: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const pid = personIdFor(e.id, r.candidate, r.party);
      if (!seen.has(pid)) {
        seen.add(pid);
        candidates.push({ personId: pid, party: r.party as PartyCode, name: r.candidate || `${r.party} candidate` });
      }
      (res[r.area_code] ??= {})[pid] = (res[r.area_code]?.[pid] ?? 0) + r.votes;
    }
    const national = e.type === 'presidential';
    const areas: Area[] = national
      ? STATES.map((s) => ({ code: s.code, name: s.name, zone: s.zone, registered: reg.get(`${e.year}:${s.code}`) ?? 0 }))
      : [
          {
            code: e.state_code!,
            name: stateByCode(e.state_code!).name,
            zone: stateByCode(e.state_code!).zone,
            registered: e.registered ?? reg.get(`${e.year}:${e.state_code}`) ?? 0,
          },
        ];
    out.push({
      id: e.id,
      title: national ? `${e.year} Presidential Election` : `${stateByCode(e.state_code!).name} Governorship ${e.year}`,
      type: e.type,
      year: e.year,
      date: national ? PRESIDENTIAL_DATES[e.year] : undefined,
      status: 'concluded',
      level: national ? 'national' : 'state',
      stateCode: e.state_code ?? undefined,
      areaLabel: 'State',
      areas,
      registered: e.registered ?? undefined,
      candidates,
      results: res,
      coverage: e.coverage,
      offCycle: e.off_cycle,
      sourceUrl: e.source_key ? srcUrl.get(e.source_key) : undefined,
    });
  }
  out.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  return { elections: out, people: derivePeople(out) };
}

/**
 * People are derived only from what the results show: who contested, for which
 * party, and who won. Offices come from wins (president, governor), running from the
 * election year until someone else wins that seat. No biographical details are invented.
 */
function derivePeople(elections: Election[]): Person[] {
  const people = new Map<string, Person & { contests: { year: number; party: PartyCode }[] }>();
  const winners = new Map<string, { seat: string; year: number; office: Role['office']; stateCode?: string; party: PartyCode }[]>();
  const seatHistory = new Map<string, { year: number; personId: string }[]>();

  for (const e of elections) {
    const totals = e.candidates
      .map((c) => ({ c, votes: Object.values(e.results).reduce((s, area) => s + (area[c.personId] ?? 0), 0) }))
      .sort((a, b) => b.votes - a.votes);
    const seat = e.type === 'presidential' ? 'president' : `governor:${e.stateCode}`;
    if (totals[0]) {
      const w = totals[0].c;
      const list = seatHistory.get(seat) ?? [];
      list.push({ year: e.year, personId: w.personId });
      seatHistory.set(seat, list);
      const ws = winners.get(w.personId) ?? [];
      ws.push({ seat, year: e.year, office: e.type === 'presidential' ? 'president' : 'governor', stateCode: e.stateCode, party: w.party });
      winners.set(w.personId, ws);
    }
    for (const c of e.candidates) {
      if (!c.name || c.name === 'Others' || c.personId.startsWith(`${e.id}-`)) continue;
      const p = people.get(c.personId) ?? {
        id: c.personId,
        name: c.name,
        bio: '',
        roles: [],
        partyHistory: [],
        contests: [],
      };
      p.contests.push({ year: e.year, party: c.party });
      people.set(c.personId, p);
    }
  }

  for (const list of seatHistory.values()) list.sort((a, b) => a.year - b.year);

  for (const p of people.values()) {
    // Offices from wins; a term runs until the seat's next election won by someone else
    const roles: Role[] = [];
    for (const w of (winners.get(p.id) ?? []).sort((a, b) => a.year - b.year)) {
      const hist = seatHistory.get(w.seat)!;
      const next = hist.find((h) => h.year > w.year && h.personId !== p.id);
      const prev = roles.find((r) => r.office === w.office && r.stateCode === w.stateCode && r.to === undefined);
      if (prev) continue; // re-elected: same continuous term
      roles.push({
        office: w.office,
        title: w.office === 'president' ? 'President of the Federal Republic' : `Governor of ${stateByCode(w.stateCode!).name} State`,
        stateCode: w.stateCode,
        from: w.year,
        to: next?.year,
        party: w.party,
      });
    }
    p.roles = roles.sort((a, b) => b.from - a.from);
    // Party history from the tickets they ran on
    const contests = p.contests.sort((a, b) => a.year - b.year);
    const hist: Person['partyHistory'] = [];
    for (const c of contests) {
      const last = hist[hist.length - 1];
      if (last && last.party === c.party) continue;
      if (last) last.to = c.year;
      hist.push({ party: c.party, from: c.year });
    }
    p.partyHistory = hist;
    const years = contests.map((c) => c.year);
    const won = (winners.get(p.id) ?? []).length;
    p.bio = `Contested ${contests.length} election${contests.length === 1 ? '' : 's'} on NELI's record (${Math.min(...years)}${
      years.length > 1 ? `–${Math.max(...years)}` : ''
    }), winning ${won}.`;
  }
  return [...people.values()].map(({ contests: _c, ...p }) => p);
}
