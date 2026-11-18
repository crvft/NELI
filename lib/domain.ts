/**
 * Domain model for NELI. Shared by the data layer, analytics and UI.
 * Real data comes from Supabase (see lib/repo/supabase.ts); fields the sources don't
 * provide (exact dates, some registers, biographies) are optional and shown as "—".
 */
import type { ZoneCode } from './geo';
import type { PartyCode } from './parties';

export type OfficeType =
  | 'president'
  | 'vice-president'
  | 'governor'
  | 'senator'
  | 'rep'
  | 'assembly'
  | 'lga-chair'
  | 'minister';

export const OFFICE_LABEL: Record<OfficeType, string> = {
  president: 'President',
  'vice-president': 'Vice President',
  governor: 'Governor',
  senator: 'Senator',
  rep: 'House of Reps',
  assembly: 'State Assembly',
  'lga-chair': 'LGA Chairman',
  minister: 'Minister',
};

export type Role = {
  office: OfficeType;
  title: string;
  stateCode?: string;
  constituency?: string;
  from: number;
  to?: number;
  party?: PartyCode;
  appointed?: boolean;
};

export type Person = {
  id: string;
  name: string;
  gender?: 'F' | 'M';
  born?: number;
  origin?: string; // state code
  bio: string;
  roles: Role[]; // most recent first
  partyHistory: { party: PartyCode; from: number; to?: number }[]; // oldest first
};

export type ElectionType = 'presidential' | 'governorship' | 'senate' | 'reps' | 'assembly' | 'lga';
export const ELECTION_TYPE_LABEL: Record<ElectionType, string> = {
  presidential: 'Presidential',
  governorship: 'Governorship',
  senate: 'Senate',
  reps: 'House of Reps',
  assembly: 'State Assembly',
  lga: 'Local Government',
};

/** registered = 0 means the register for this area/year is not known (never estimated). */
export type Area = { code: string; name: string; zone?: ZoneCode; registered: number };

export type Candidate = { personId: string; party: PartyCode; /** Denormalised for display */ name?: string };

export type Election = {
  id: string;
  title: string;
  type: ElectionType;
  year: number;
  date?: string; // ISO; absent when only the year is known
  status: 'live' | 'concluded' | 'upcoming';
  level: 'national' | 'state' | 'constituency';
  stateCode?: string;
  constituency?: string;
  areaLabel: string; // "State", "District", "LGA"
  areas: Area[];
  /** Register for the whole election when not known per area; 0/undefined = unknown */
  registered?: number;
  candidates: Candidate[];
  /** Final (or expected-final for live) votes per area per candidate */
  results: Record<string, Record<string, number>>;
  /** Fraction of polling units reported per area (live only) */
  reported?: Record<string, number>;
  updatedAt?: string;
  /** How complete the source's result is (governorship history varies) */
  coverage?: 'all candidates' | 'top candidates only' | 'winner only';
  offCycle?: boolean;
  /** Link to the exact source revision */
  sourceUrl?: string;
};


/** Sort key: the exact date when known, else the year. */
export const dateKey = (e: Pick<Election, 'date' | 'year'>) => e.date ?? `${e.year}`;

/** "25 February 2023" when the exact date is known, otherwise just the year. */
export function electionWhen(e: Pick<Election, 'date' | 'year'>, style: 'long' | 'short' = 'long') {
  if (!e.date) return String(e.year);
  return new Date(e.date).toLocaleDateString('en-NG', { day: 'numeric', month: style === 'long' ? 'long' : 'short', year: 'numeric' });
}
