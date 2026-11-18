/**
 * Supabase adapter: reads the real results, politician profiles and the latest
 * Anyanwụ forecast, and shapes them into the app's domain model (lib/domain.ts).
 * Pure read access with the publishable key; row-level security only allows SELECT.
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Area, Candidate, Election, ForecastEntry, Person, Profile, Role } from '@/lib/domain';
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
type ResultRow = { election_id: string; area_code: string; candidate: string; party: string; votes: number; person_id: string | null };
type RegisterRow = { year: number; state_code: string | null; registered: number };
type SourceRow = { key: string; url: string };
type PeopleRow = {
  id: string;
  name: string;
  wiki_title: string;
  summary: string;
  born: string | null;
  died: string | null;
  birth_place: string | null;
  birth_state: string | null;
  gender: 'male' | 'female' | null;
  party: string | null;
  education: string | null;
  occupation: string | null;
  offices: { title: string; term: string }[];
  source_key: string | null;
};

// Anyanwụ payload (pipeline/anyanwu/run.py)
type PresContestant = {
  candidate: string;
  party: string;
  running_mate: string | null;
  home_state: string | null;
  first_prob: number;
  outright_prob: number;
  share_mean: number;
  share_lo: number;
  share_hi: number;
  attention_share?: number | null;
};
type StateContestant = { party: string; candidate: string; share_mean: number; win_prob: number };
type GovContestant = { candidate: string; party: string; win_prob: number; share_mean: number; share_lo: number; share_hi: number };
type ModelPayload = {
  model: string;
  version: string;
  generated_at: string;
  presidential: {
    key: string;
    title: string;
    date: string;
    runoff_prob: number;
    contestants: PresContestant[];
    states: { code: string; contestants: StateContestant[] }[];
  };
  governorship: {
    key: string;
    state: string;
    title: string;
    date: string;
    candidates_confirmed: boolean;
    incumbent: string;
    incumbent_party: string;
    incumbent_term_limited: boolean;
    open_seat: boolean;
    contestants: GovContestant[];
  }[];
};

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

async function latestModel(): Promise<ModelPayload | null> {
  const { data, error } = await db.from('model_runs').select('payload').eq('model', 'Anyanwụ').order('published_at', { ascending: false }).limit(1);
  if (error) throw new Error(`Supabase model_runs: ${error.message}`);
  return (data?.[0]?.payload as ModelPayload | undefined) ?? null;
}

export const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const nameTokens = (s: string) =>
  new Set(
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .match(/[a-z]+/g)
      ?.filter((t) => t.length > 1 && !['dr', 'chief', 'prince', 'alhaji', 'senator', 'engr', 'mrs', 'mr', 'sir', 'prof', 'hon'].includes(t)) ?? [],
  );

function personIdFor(eid: string, candidate: string, party: string, linked: string | null) {
  if (linked) return linked; // resolved to a Wikipedia article (spelling variants merge)
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
  const [elections, results, registers, sources, peopleRows, model] = await Promise.all([
    all<ElectionRow>('elections', 'id,type,year,state_code,off_cycle,coverage,registered,valid_votes,source_key'),
    all<ResultRow>('results', 'election_id,area_code,candidate,party,votes,person_id'),
    all<RegisterRow>('registered_voters', 'year,state_code,registered'),
    all<SourceRow>('sources', 'key,url'),
    all<PeopleRow>('people', 'id,name,wiki_title,summary,born,died,birth_place,birth_state,gender,party,education,occupation,offices,source_key'),
    latestModel(),
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
      const pid = personIdFor(e.id, r.candidate, r.party, r.person_id);
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

  const profiles = new Map(peopleRows.map((p) => [p.id, p]));
  if (model) out.push(...upcomingFromModel(model, out, profiles));

  out.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
  return { elections: out, people: derivePeople(out, profiles, srcUrl) };
}

// ---------------------------------------------------------------------------
// Upcoming elections from Anyanwụ
// ---------------------------------------------------------------------------

function upcomingFromModel(m: ModelPayload, held: Election[], profiles: Map<string, PeopleRow>): Election[] {
  // Known people by name tokens, to link 2027 nominees to their record
  const known: { id: string; tokens: Set<string> }[] = [];
  for (const p of profiles.values()) known.push({ id: p.id, tokens: nameTokens(p.name) });
  for (const e of held) for (const c of e.candidates) if (c.name && !c.personId.startsWith(`${e.id}-`)) known.push({ id: c.personId, tokens: nameTokens(c.name) });
  const match = (name: string) => {
    const t = nameTokens(name);
    if (t.size < 2) return undefined;
    return known.find((k) => [...t].filter((x) => k.tokens.has(x)).length >= 2)?.id;
  };
  const idFor = (key: string, candidate: string, party: string) =>
    candidate === 'Others' ? `${key}-others` : / candidate$/.test(candidate) ? `${key}-${slug(party)}` : (match(candidate) ?? slug(candidate));
  const base = { model: m.model, version: m.version, generatedAt: m.generated_at };
  const out: Election[] = [];

  // Presidential
  const p = m.presidential;
  const pid = p.contestants.map((c) => idFor(p.key, c.candidate, c.party));
  const last = held.filter((e) => e.type === 'presidential').sort((a, b) => b.year - a.year)[0];
  const areas: Area[] = STATES.map((s) => ({ code: s.code, name: s.name, zone: s.zone, registered: 0 }));
  const candidates: Candidate[] = p.contestants.map((c, i) => ({ personId: pid[i], party: c.party as PartyCode, name: c.candidate }));
  const rows: ForecastEntry[] = p.contestants.map((c, i) => ({
    personId: pid[i],
    party: c.party as PartyCode,
    share: c.share_mean,
    lo: c.share_lo,
    hi: c.share_hi,
    prob: c.first_prob,
    outright: c.outright_prob,
    attention: c.attention_share ?? null,
    factors: [
      ...(c.home_state ? [`Home state: ${stateByCode(c.home_state).name}`] : []),
      ...(c.running_mate ? [`Running mate: ${c.running_mate}`] : []),
    ],
  }));
  // Projected map: expected shares applied to each state's 2023 turnout
  const turnout = (code: string) => Object.values(last?.results[code] ?? {}).reduce((a, b) => a + b, 0);
  const projResults: Record<string, Record<string, number>> = {};
  for (const s of p.states) {
    const t = turnout(s.code);
    projResults[s.code] = Object.fromEntries(s.contestants.map((c, i) => [pid[i], Math.round(c.share_mean * t)]));
  }
  const pres: Election = {
    id: p.key,
    title: p.title,
    type: 'presidential',
    year: Number(p.date.slice(0, 4)),
    date: p.date,
    status: 'upcoming',
    level: 'national',
    areaLabel: 'State',
    areas,
    candidates,
    results: {},
    forecast: {
      ...base,
      rows,
      runoffProb: p.runoff_prob,
      candidatesConfirmed: true,
      notes: [
        'To win outright a candidate needs the most votes and at least 25% in 24 of the 37 states (counting the FCT). Otherwise there is a run-off.',
        'Built from the 2023 result in every state: each ticket inherits votes through its candidate, party and running mate, adjusted for home regions.',
      ],
    },
  };
  pres.forecast!.areas = Object.fromEntries(
    p.states.map((s) => [s.code, s.contestants.map((c, i) => ({ personId: pid[i], share: c.share_mean, prob: c.win_prob }))]),
  );
  pres.forecast!.projection = { ...pres, id: `${p.key}-projection`, status: 'concluded', results: projResults, forecast: undefined };
  out.push(pres);

  // Governorship
  for (const g of m.governorship) {
    const ids = g.contestants.map((c) => idFor(g.key, c.candidate, c.party));
    const st = stateByCode(g.state);
    out.push({
      id: g.key,
      title: g.title,
      type: 'governorship',
      year: Number(g.date.slice(0, 4)),
      date: g.date,
      status: 'upcoming',
      level: 'state',
      stateCode: g.state,
      areaLabel: 'State',
      areas: [{ code: g.state, name: st.name, zone: st.zone, registered: 0 }],
      candidates: g.contestants.map((c, i) => ({ personId: ids[i], party: c.party as PartyCode, name: c.candidate })),
      results: {},
      forecast: {
        ...base,
        candidatesConfirmed: g.candidates_confirmed,
        openSeat: g.open_seat,
        rows: g.contestants.map((c, i) => ({
          personId: ids[i],
          party: c.party as PartyCode,
          share: c.share_mean,
          lo: c.share_lo,
          hi: c.share_hi,
          prob: c.win_prob,
          factors: [
            ...(c.candidate === g.incumbent && !g.open_seat ? ['Sitting governor'] : []),
            ...(g.open_seat && c.party === g.incumbent_party ? ["Governor's party (open seat)"] : []),
          ],
        })),
        notes: [
          g.open_seat
            ? `Open seat: ${g.incumbent} has served two terms.`
            : `${g.incumbent} (${g.incumbent_party}) is eligible for a second term.`,
          ...(g.candidates_confirmed
            ? []
            : [
                "Nominees aren't confirmed on NELI's sources yet, so this forecast is by party. It assumes the governor runs again where eligible, under their current party.",
              ]),
        ],
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

function yearsBetween(from: string, to: Date) {
  const b = new Date(from.length === 4 ? `${from}-07-01T12:00:00Z` : `${from}T12:00:00Z`);
  let age = to.getUTCFullYear() - b.getUTCFullYear();
  if (to.getUTCMonth() < b.getUTCMonth() || (to.getUTCMonth() === b.getUTCMonth() && to.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/**
 * People combine their Wikipedia profile (when one is linked) with what the results
 * show: who contested, for which party, and who won. Offices on NELI's record come
 * from wins, running from the election year until someone else wins that seat.
 */
function derivePeople(elections: Election[], profiles: Map<string, PeopleRow>, srcUrl: Map<string, string>): Person[] {
  const people = new Map<string, Person & { contests: { year: number; party: PartyCode; held: boolean }[] }>();
  const winners = new Map<string, { seat: string; year: number; office: Role['office']; stateCode?: string; party: PartyCode }[]>();
  const seatHistory = new Map<string, { year: number; personId: string }[]>();

  for (const e of [...elections].sort((a, b) => a.year - b.year)) {
    const held = e.status === 'concluded';
    if (held) {
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
    }
    for (const c of e.candidates) {
      if (!c.name || c.name === 'Others' || c.personId.startsWith(`${e.id}-`)) continue;
      const p = people.get(c.personId) ?? { id: c.personId, name: c.name, bio: '', roles: [], partyHistory: [], contests: [] };
      p.contests.push({ year: e.year, party: c.party, held });
      people.set(c.personId, p);
    }
  }

  for (const list of seatHistory.values()) list.sort((a, b) => a.year - b.year);

  for (const p of people.values()) {
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
    const contests = p.contests.sort((a, b) => a.year - b.year);
    const hist: Person['partyHistory'] = [];
    for (const c of contests) {
      const last = hist[hist.length - 1];
      if (last && last.party === c.party) continue;
      if (last) last.to = c.year;
      hist.push({ party: c.party, from: c.year });
    }
    p.partyHistory = hist;
    const done = contests.filter((c) => c.held);
    const years = done.map((c) => c.year);
    const won = (winners.get(p.id) ?? []).length;
    const upcoming = contests.filter((c) => !c.held);
    p.bio = done.length
      ? `Contested ${done.length} election${done.length === 1 ? '' : 's'} on NELI's record (${Math.min(...years)}${
          years.length > 1 ? `–${Math.max(...years)}` : ''
        }), winning ${won}.`
      : upcoming.length
        ? `Candidate in ${upcoming[0].year}.`
        : '';

    const row = profiles.get(p.id);
    if (row) {
      const profile: Profile = {
        summary: row.summary,
        wikiTitle: row.wiki_title,
        sourceUrl: row.source_key ? srcUrl.get(row.source_key) : undefined,
        born: row.born ?? undefined,
        died: row.died ?? undefined,
        birthPlace: row.birth_place ?? undefined,
        birthState: row.birth_state ?? undefined,
        party: row.party ?? undefined,
        education: row.education ?? undefined,
        occupation: row.occupation ?? undefined,
        offices: Array.isArray(row.offices) ? row.offices : [],
        age: row.born ? yearsBetween(row.born, row.died ? new Date(`${row.died}T12:00:00Z`) : new Date()) : undefined,
      };
      p.profile = profile;
      p.name = row.name;
      if (row.born) p.born = Number(row.born.slice(0, 4));
      if (row.birth_state) p.origin = row.birth_state;
      if (row.gender) p.gender = row.gender === 'female' ? 'F' : 'M';
    }
  }
  return [...people.values()].map(({ contests: _c, ...p }) => p);
}
