/**
 * NELI sample data.
 *
 * Every person and every vote figure in this file is FICTIONAL and exists only to
 * design the interface. Parties, states and zones are real. Real 2023 data will
 * replace this layer (see README → Data roadmap).
 */
import { STATES, stateByCode, type State, type ZoneCode } from './geo';
import type { PartyCode } from './parties';

export const IS_SAMPLE_DATA = true;

// ---------------------------------------------------------------------------
// Deterministic RNG so server and client always agree
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
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
  gender: 'F' | 'M';
  born: number;
  origin: string; // state code
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

export type Area = { code: string; name: string; zone?: ZoneCode; registered: number };

export type Candidate = { personId: string; party: PartyCode };

export type Election = {
  id: string;
  title: string;
  type: ElectionType;
  year: number;
  date: string; // ISO
  status: 'live' | 'concluded' | 'upcoming';
  level: 'national' | 'state' | 'constituency';
  stateCode?: string;
  constituency?: string;
  areaLabel: string; // "State", "District", "LGA"
  areas: Area[];
  candidates: Candidate[];
  /** Final (or expected-final for live) votes per area per candidate */
  results: Record<string, Record<string, number>>;
  /** Fraction of polling units reported per area (live only) */
  reported?: Record<string, number>;
  updatedAt?: string;
};

// ---------------------------------------------------------------------------
// People (fictional)
// ---------------------------------------------------------------------------
const P = (p: Person) => p;

export const PEOPLE: Person[] = [
  P({
    id: 'babatunde-adeyemi-cole', name: 'Babatunde Adeyemi-Cole', gender: 'M', born: 1958, origin: 'LA',
    bio: 'Former two-term governor of Lagos State who won the 2023 presidential election and is seeking re-election in 2027.',
    roles: [
      { office: 'president', title: 'President of the Federal Republic', from: 2023, party: 'APC' },
      { office: 'governor', title: 'Governor of Lagos State', stateCode: 'LA', from: 2011, to: 2019, party: 'APC' },
      { office: 'senator', title: 'Senator, Lagos West', stateCode: 'LA', constituency: 'Lagos West', from: 2007, to: 2011, party: 'APC' },
    ],
    partyHistory: [{ party: 'ADC', from: 2003, to: 2006 }, { party: 'APC', from: 2006 }],
  }),
  P({
    id: 'aminu-bello-sarki', name: 'Aminu Bello Sarki', gender: 'M', born: 1952, origin: 'AD',
    bio: 'Businessman and former vice president. Has contested every presidential election since 2019 on the PDP platform.',
    roles: [
      { office: 'vice-president', title: 'Vice President', from: 2007, to: 2015, party: 'PDP' },
      { office: 'governor', title: 'Governor of Adamawa State', stateCode: 'AD', from: 1999, to: 2007, party: 'PDP' },
    ],
    partyHistory: [{ party: 'PDP', from: 1998, to: 2013 }, { party: 'APC', from: 2013, to: 2017 }, { party: 'PDP', from: 2017 }],
  }),
  P({
    id: 'ngozi-okafor-eze', name: 'Ngozi Okafor-Eze', gender: 'F', born: 1966, origin: 'AN',
    bio: 'Economist and former governor of Anambra State. Built a large youth following as the Labour Party flag-bearer in 2023.',
    roles: [
      { office: 'governor', title: 'Governor of Anambra State', stateCode: 'AN', from: 2010, to: 2018, party: 'APGA' },
    ],
    partyHistory: [{ party: 'APGA', from: 2006, to: 2018 }, { party: 'PDP', from: 2018, to: 2022 }, { party: 'LP', from: 2022 }],
  }),
  P({
    id: 'yusuf-danjuma', name: 'Yusuf Danjuma', gender: 'M', born: 1960, origin: 'KN',
    bio: 'Former Kano governor and minister of defence, with a strong grassroots base in the North West.',
    roles: [
      { office: 'senator', title: 'Senator, Kano Central', stateCode: 'KN', constituency: 'Kano Central', from: 2019, to: 2023, party: 'PDP' },
      { office: 'governor', title: 'Governor of Kano State', stateCode: 'KN', from: 2011, to: 2015, party: 'PDP' },
      { office: 'minister', title: 'Minister of Defence', from: 2003, to: 2007, appointed: true },
    ],
    partyHistory: [{ party: 'PDP', from: 1999, to: 2022 }, { party: 'NNPP', from: 2022 }],
  }),
  P({
    id: 'halima-abdullahi', name: 'Halima Abdullahi', gender: 'F', born: 1971, origin: 'KW',
    bio: 'Lawyer and former senator for Kwara Central, running for president for the first time.',
    roles: [
      { office: 'senator', title: 'Senator, Kwara Central', stateCode: 'KW', constituency: 'Kwara Central', from: 2015, to: 2023, party: 'APC' },
    ],
    partyHistory: [{ party: 'APC', from: 2014, to: 2025 }, { party: 'ADC', from: 2025 }],
  }),
  P({
    id: 'garba-musa-tanko', name: 'Garba Musa Tanko', gender: 'M', born: 1946, origin: 'KT',
    bio: 'Retired general who served two terms as president from 2015 to 2023.',
    roles: [{ office: 'president', title: 'President of the Federal Republic', from: 2015, to: 2023, party: 'APC' }],
    partyHistory: [{ party: 'OTH', from: 2003, to: 2013 }, { party: 'APC', from: 2013 }],
  }),
  P({
    id: 'ebiere-alagoa', name: 'Ebiere Alagoa', gender: 'M', born: 1957, origin: 'BY',
    bio: 'Zoologist and former president who lost his re-election bid in 2015.',
    roles: [
      { office: 'president', title: 'President of the Federal Republic', from: 2010, to: 2015, party: 'PDP' },
      { office: 'governor', title: 'Governor of Bayelsa State', stateCode: 'BY', from: 2005, to: 2007, party: 'PDP' },
    ],
    partyHistory: [{ party: 'PDP', from: 1998 }],
  }),
  // Lagos
  P({
    id: 'oluwaseun-bakare', name: 'Oluwaseun Bakare', gender: 'M', born: 1965, origin: 'LA',
    bio: 'Estate surveyor and current governor of Lagos State, serving his second term.',
    roles: [{ office: 'governor', title: 'Governor of Lagos State', stateCode: 'LA', from: 2019, party: 'APC' }],
    partyHistory: [{ party: 'APC', from: 2014 }],
  }),
  P({
    id: 'gbenga-ilori', name: 'Gbenga Ilori', gender: 'M', born: 1983, origin: 'LA',
    bio: 'Architect and the Labour Party governorship candidate in Lagos in 2023.',
    roles: [],
    partyHistory: [{ party: 'PDP', from: 2018, to: 2022 }, { party: 'LP', from: 2022 }],
  }),
  P({
    id: 'adewale-sanni', name: 'Adewale Sanni', gender: 'M', born: 1961, origin: 'LA',
    bio: 'Veteran opposition politician who has run for governor of Lagos three times.',
    roles: [],
    partyHistory: [{ party: 'PDP', from: 2010 }],
  }),
  P({
    id: 'folake-adeniran', name: 'Folake Adeniran', gender: 'F', born: 1972, origin: 'LA',
    bio: 'Banker turned legislator who chairs the Senate Committee on Banking.',
    roles: [{ office: 'senator', title: 'Senator, Lagos Central', stateCode: 'LA', constituency: 'Lagos Central', from: 2019, party: 'APC' }],
    partyHistory: [{ party: 'APC', from: 2015 }],
  }),
  P({
    id: 'chidinma-uzor', name: 'Chidinma Uzor', gender: 'F', born: 1988, origin: 'IM',
    bio: 'Tech founder who contested the Lagos Central Senate seat in 2023.',
    roles: [],
    partyHistory: [{ party: 'LP', from: 2022 }],
  }),
  P({
    id: 'tunde-oyelaran', name: 'Tunde Oyelaran', gender: 'M', born: 1976, origin: 'LA',
    bio: 'Member of the House of Representatives for Surulere I.',
    roles: [{ office: 'rep', title: 'Member, House of Reps (Surulere I)', stateCode: 'LA', constituency: 'Surulere I', from: 2015, party: 'APC' }],
    partyHistory: [{ party: 'APC', from: 2014 }],
  }),
  P({
    id: 'kehinde-alabi', name: 'Kehinde Alabi', gender: 'F', born: 1980, origin: 'LA',
    bio: 'Lagos State House of Assembly member for Ikeja I and deputy majority leader.',
    roles: [{ office: 'assembly', title: 'Member, Lagos State House of Assembly (Ikeja I)', stateCode: 'LA', constituency: 'Ikeja I', from: 2019, party: 'APC' }],
    partyHistory: [{ party: 'APC', from: 2016 }],
  }),
  P({
    id: 'samuel-ademola', name: 'Samuel Ademola', gender: 'M', born: 1979, origin: 'LA',
    bio: 'Executive chairman of Ikeja Local Government.',
    roles: [{ office: 'lga-chair', title: 'Chairman, Ikeja LGA', stateCode: 'LA', constituency: 'Ikeja', from: 2021, party: 'APC' }],
    partyHistory: [{ party: 'APC', from: 2014 }],
  }),
  // Kano
  P({
    id: 'sani-lawan-dala', name: 'Sani Lawan Dala', gender: 'M', born: 1963, origin: 'KN',
    bio: 'Engineer and current governor of Kano State, a close ally of Yusuf Danjuma.',
    roles: [{ office: 'governor', title: 'Governor of Kano State', stateCode: 'KN', from: 2023, party: 'NNPP' }],
    partyHistory: [{ party: 'PDP', from: 2003, to: 2022 }, { party: 'NNPP', from: 2022 }],
  }),
  P({
    id: 'nasiru-tijjani', name: 'Nasiru Tijjani', gender: 'M', born: 1969, origin: 'KN',
    bio: 'Former deputy governor and the APC governorship candidate in Kano in 2023.',
    roles: [],
    partyHistory: [{ party: 'APC', from: 2014 }],
  }),
  P({
    id: 'aisha-garba-bichi', name: 'Aisha Garba Bichi', gender: 'F', born: 1975, origin: 'KN',
    bio: 'Senator for Kano North and a vocal advocate for girl-child education.',
    roles: [{ office: 'senator', title: 'Senator, Kano North', stateCode: 'KN', constituency: 'Kano North', from: 2023, party: 'NNPP' }],
    partyHistory: [{ party: 'APC', from: 2015, to: 2022 }, { party: 'NNPP', from: 2022 }],
  }),
  // Rivers
  P({
    id: 'tamuno-briggs', name: 'Tamuno Briggs', gender: 'M', born: 1967, origin: 'RI',
    bio: 'Lawyer and former local government chairman, now governor of Rivers State.',
    roles: [
      { office: 'governor', title: 'Governor of Rivers State', stateCode: 'RI', from: 2023, party: 'PDP' },
      { office: 'lga-chair', title: 'Chairman, Obio/Akpor LGA', stateCode: 'RI', constituency: 'Obio/Akpor', from: 2015, to: 2019, party: 'PDP' },
    ],
    partyHistory: [{ party: 'PDP', from: 2006 }],
  }),
  P({
    id: 'ibinabo-georgewill', name: 'Ibinabo Georgewill', gender: 'F', born: 1970, origin: 'RI',
    bio: 'Former commissioner for finance and the APC governorship candidate in Rivers in 2023.',
    roles: [],
    partyHistory: [{ party: 'PDP', from: 2008, to: 2018 }, { party: 'APC', from: 2018 }],
  }),
  // Anambra
  P({
    id: 'obinna-nwachukwu', name: 'Obinna Nwachukwu', gender: 'M', born: 1974, origin: 'AN',
    bio: 'Pharmacist and first-term senator for Anambra South.',
    roles: [{ office: 'senator', title: 'Senator, Anambra South', stateCode: 'AN', constituency: 'Anambra South', from: 2023, party: 'LP' }],
    partyHistory: [{ party: 'APGA', from: 2013, to: 2022 }, { party: 'LP', from: 2022 }],
  }),
  P({
    id: 'chukwudi-anyanwu', name: 'Chukwudi Anyanwu', gender: 'M', born: 1962, origin: 'AN',
    bio: 'Two-term senator who lost the Anambra South seat in 2023.',
    roles: [{ office: 'senator', title: 'Senator, Anambra South', stateCode: 'AN', constituency: 'Anambra South', from: 2015, to: 2023, party: 'APGA' }],
    partyHistory: [{ party: 'APGA', from: 2009 }],
  }),
  // Kaduna
  P({
    id: 'ibrahim-zubairu', name: 'Ibrahim Zubairu', gender: 'M', born: 1968, origin: 'KD',
    bio: 'Economist and governor of Kaduna State.',
    roles: [{ office: 'governor', title: 'Governor of Kaduna State', stateCode: 'KD', from: 2023, party: 'APC' }],
    partyHistory: [{ party: 'APC', from: 2014 }],
  }),
  P({
    id: 'mary-yakubu', name: 'Mary Yakubu', gender: 'F', born: 1973, origin: 'KD',
    bio: 'Former member of the House of Reps and PDP governorship candidate in Kaduna.',
    roles: [{ office: 'rep', title: 'Member, House of Reps (Kaura)', stateCode: 'KD', constituency: 'Kaura', from: 2015, to: 2023, party: 'PDP' }],
    partyHistory: [{ party: 'PDP', from: 2010 }],
  }),
  // Appointees
  P({
    id: 'kemi-adedoyin', name: 'Kemi Adedoyin', gender: 'F', born: 1974, origin: 'OG',
    bio: 'Former investment banker appointed Minister of Finance in 2023.',
    roles: [{ office: 'minister', title: 'Minister of Finance', from: 2023, appointed: true }],
    partyHistory: [{ party: 'APC', from: 2019 }],
  }),
  P({
    id: 'emeka-obi', name: 'Emeka Obi', gender: 'M', born: 1969, origin: 'EN',
    bio: 'Civil engineer appointed Minister of Works in 2023.',
    roles: [{ office: 'minister', title: 'Minister of Works', from: 2023, appointed: true }],
    partyHistory: [{ party: 'PDP', from: 2006, to: 2021 }, { party: 'APC', from: 2021 }],
  }),
  P({
    id: 'zainab-mohammed', name: 'Zainab Mohammed', gender: 'F', born: 1977, origin: 'BO',
    bio: 'Public-health physician appointed Minister of Health in 2023.',
    roles: [{ office: 'minister', title: 'Minister of Health', from: 2023, appointed: true }],
    partyHistory: [{ party: 'APC', from: 2018 }],
  }),
  P({
    id: 'kashim-ali', name: 'Kashim Ali', gender: 'M', born: 1966, origin: 'BO',
    bio: 'Former governor of Borno State and the current vice president.',
    roles: [
      { office: 'vice-president', title: 'Vice President', from: 2023, party: 'APC' },
      { office: 'governor', title: 'Governor of Borno State', stateCode: 'BO', from: 2011, to: 2019, party: 'APC' },
    ],
    partyHistory: [{ party: 'OTH', from: 2007, to: 2013 }, { party: 'APC', from: 2013 }],
  }),
];

export const personById = (id: string) => PEOPLE.find((p) => p.id === id);

// ---------------------------------------------------------------------------
// Result generation
// ---------------------------------------------------------------------------
type ZoneStrength = Partial<Record<ZoneCode, number>>;

/** Build per-state votes for a national election from zone-level strengths. */
function nationalResults(
  seed: string,
  turnout: number,
  strengths: Record<string, ZoneStrength>,
  homeBoost: Record<string, string> = {},
) {
  const rnd = mulberry32(hash(seed));
  const results: Election['results'] = {};
  for (const s of STATES) {
    const weights: Record<string, number> = {};
    let sum = 0;
    for (const [pid, z] of Object.entries(strengths)) {
      let w = (z[s.zone] ?? 0.02) * (0.7 + rnd() * 0.6);
      if (homeBoost[pid] === s.code) w *= 2.2;
      weights[pid] = w;
      sum += w;
    }
    const cast = Math.round(s.registered * turnout * (0.8 + rnd() * 0.4));
    results[s.code] = {};
    for (const pid of Object.keys(weights)) {
      results[s.code][pid] = Math.round((weights[pid] / sum) * cast);
    }
  }
  return results;
}

function districtAreas(state: State, names: string[]): Area[] {
  return names.map((n, i) => ({
    code: `${state.code}-${i}`,
    name: n,
    registered: Math.round(state.registered / names.length),
  }));
}

function localResults(seed: string, areas: Area[], turnout: number, base: Record<string, number>) {
  const rnd = mulberry32(hash(seed));
  const results: Election['results'] = {};
  for (const a of areas) {
    const cast = Math.round(a.registered * turnout * (0.8 + rnd() * 0.4));
    let sum = 0;
    const w: Record<string, number> = {};
    for (const [pid, b] of Object.entries(base)) {
      w[pid] = b * (0.65 + rnd() * 0.7);
      sum += w[pid];
    }
    results[a.code] = {};
    for (const pid of Object.keys(w)) results[a.code][pid] = Math.round((w[pid] / sum) * cast);
  }
  return results;
}

const nationalAreas: Area[] = STATES.map((s) => ({ code: s.code, name: s.name, zone: s.zone, registered: s.registered }));

const SENATORIAL = (st: string) => {
  const s = stateByCode(st);
  const n = s.name.replace(' Abuja', '');
  return districtAreas(s, [`${n} Central`, `${n} North`, `${n} South`]);
};

// Live reporting: deterministic, uneven across the country
function liveReporting(seed: string): Record<string, number> {
  const rnd = mulberry32(hash(seed));
  const r: Record<string, number> = {};
  for (const s of STATES) {
    const x = rnd();
    r[s.code] = x < 0.22 ? 1 : x < 0.3 ? 0 : Math.round((0.25 + rnd() * 0.7) * 100) / 100;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Elections
// ---------------------------------------------------------------------------
const pres2027Strengths = {
  'babatunde-adeyemi-cole': { NW: 0.37, NE: 0.36, NC: 0.33, SW: 0.47, SE: 0.08, SS: 0.23 },
  'aminu-bello-sarki': { NW: 0.36, NE: 0.45, NC: 0.32, SW: 0.18, SE: 0.08, SS: 0.29 },
  'ngozi-okafor-eze': { NW: 0.05, NE: 0.05, NC: 0.24, SW: 0.2, SE: 0.8, SS: 0.42 },
  'yusuf-danjuma': { NW: 0.17, NE: 0.08, NC: 0.04, SW: 0.01, SE: 0.01, SS: 0.01 },
  'halima-abdullahi': { NW: 0.03, NE: 0.04, NC: 0.07, SW: 0.06, SE: 0.02, SS: 0.03 },
};

export const ELECTIONS: Election[] = [
  {
    id: 'pres-2027',
    title: '2027 Presidential Election',
    type: 'presidential',
    year: 2027,
    date: '2027-02-20',
    status: 'live',
    level: 'national',
    areaLabel: 'State',
    areas: nationalAreas,
    candidates: [
      { personId: 'babatunde-adeyemi-cole', party: 'APC' },
      { personId: 'aminu-bello-sarki', party: 'PDP' },
      { personId: 'ngozi-okafor-eze', party: 'LP' },
      { personId: 'yusuf-danjuma', party: 'NNPP' },
      { personId: 'halima-abdullahi', party: 'ADC' },
    ],
    results: nationalResults('pres-2027', 0.29, pres2027Strengths, {
      'babatunde-adeyemi-cole': 'LA',
      'aminu-bello-sarki': 'AD',
      'ngozi-okafor-eze': 'AN',
      'yusuf-danjuma': 'KN',
      'halima-abdullahi': 'KW',
    }),
    reported: liveReporting('pres-2027-live'),
    updatedAt: '2027-02-21T14:32:00+01:00',
  },
  {
    id: 'pres-2023',
    title: '2023 Presidential Election',
    type: 'presidential',
    year: 2023,
    date: '2023-02-25',
    status: 'concluded',
    level: 'national',
    areaLabel: 'State',
    areas: nationalAreas,
    candidates: [
      { personId: 'babatunde-adeyemi-cole', party: 'APC' },
      { personId: 'aminu-bello-sarki', party: 'PDP' },
      { personId: 'ngozi-okafor-eze', party: 'LP' },
      { personId: 'yusuf-danjuma', party: 'NNPP' },
    ],
    results: nationalResults(
      'pres-2023',
      0.27,
      {
        'babatunde-adeyemi-cole': { NW: 0.4, NE: 0.38, NC: 0.36, SW: 0.55, SE: 0.06, SS: 0.25 },
        'aminu-bello-sarki': { NW: 0.33, NE: 0.45, NC: 0.3, SW: 0.2, SE: 0.08, SS: 0.3 },
        'ngozi-okafor-eze': { NW: 0.05, NE: 0.04, NC: 0.25, SW: 0.2, SE: 0.82, SS: 0.42 },
        'yusuf-danjuma': { NW: 0.2, NE: 0.08, NC: 0.04, SW: 0.01, SE: 0.01, SS: 0.01 },
      },
      { 'babatunde-adeyemi-cole': 'LA', 'aminu-bello-sarki': 'AD', 'ngozi-okafor-eze': 'AN', 'yusuf-danjuma': 'KN' },
    ),
  },
  {
    id: 'pres-2019',
    title: '2019 Presidential Election',
    type: 'presidential',
    year: 2019,
    date: '2019-02-23',
    status: 'concluded',
    level: 'national',
    areaLabel: 'State',
    areas: nationalAreas,
    candidates: [
      { personId: 'garba-musa-tanko', party: 'APC' },
      { personId: 'aminu-bello-sarki', party: 'PDP' },
    ],
    results: nationalResults('pres-2019', 0.35, {
      'garba-musa-tanko': { NW: 0.7, NE: 0.68, NC: 0.5, SW: 0.52, SE: 0.2, SS: 0.3 },
      'aminu-bello-sarki': { NW: 0.28, NE: 0.3, NC: 0.48, SW: 0.45, SE: 0.78, SS: 0.68 },
    }),
  },
  {
    id: 'pres-2015',
    title: '2015 Presidential Election',
    type: 'presidential',
    year: 2015,
    date: '2015-03-28',
    status: 'concluded',
    level: 'national',
    areaLabel: 'State',
    areas: nationalAreas,
    candidates: [
      { personId: 'garba-musa-tanko', party: 'APC' },
      { personId: 'ebiere-alagoa', party: 'PDP' },
    ],
    results: nationalResults(
      'pres-2015',
      0.44,
      {
        'garba-musa-tanko': { NW: 0.8, NE: 0.76, NC: 0.5, SW: 0.55, SE: 0.06, SS: 0.12 },
        'ebiere-alagoa': { NW: 0.18, NE: 0.22, NC: 0.48, SW: 0.42, SE: 0.92, SS: 0.86 },
      },
      { 'ebiere-alagoa': 'BY' },
    ),
  },
  ...(() => {
    const areas = SENATORIAL('LA');
    return [
      {
        id: 'gov-lagos-2023',
        title: 'Lagos Governorship 2023',
        type: 'governorship' as const,
        year: 2023,
        date: '2023-03-18',
        status: 'concluded' as const,
        level: 'state' as const,
        stateCode: 'LA',
        areaLabel: 'District',
        areas,
        candidates: [
          { personId: 'oluwaseun-bakare', party: 'APC' as const },
          { personId: 'gbenga-ilori', party: 'LP' as const },
          { personId: 'adewale-sanni', party: 'PDP' as const },
        ],
        results: localResults('gov-la-23', areas, 0.18, {
          'oluwaseun-bakare': 0.62,
          'gbenga-ilori': 0.28,
          'adewale-sanni': 0.1,
        }),
      },
      {
        id: 'gov-lagos-2019',
        title: 'Lagos Governorship 2019',
        type: 'governorship' as const,
        year: 2019,
        date: '2019-03-09',
        status: 'concluded' as const,
        level: 'state' as const,
        stateCode: 'LA',
        areaLabel: 'District',
        areas,
        candidates: [
          { personId: 'oluwaseun-bakare', party: 'APC' as const },
          { personId: 'adewale-sanni', party: 'PDP' as const },
        ],
        results: localResults('gov-la-19', areas, 0.2, { 'oluwaseun-bakare': 0.76, 'adewale-sanni': 0.24 }),
      },
      {
        id: 'gov-lagos-2027',
        title: 'Lagos Governorship 2027',
        type: 'governorship' as const,
        year: 2027,
        date: '2027-03-06',
        status: 'upcoming' as const,
        level: 'state' as const,
        stateCode: 'LA',
        areaLabel: 'District',
        areas,
        candidates: [
          { personId: 'folake-adeniran', party: 'APC' as const },
          { personId: 'gbenga-ilori', party: 'LP' as const },
          { personId: 'adewale-sanni', party: 'PDP' as const },
        ],
        results: {},
      },
      {
        id: 'sen-lagos-central-2023',
        title: 'Lagos Central Senatorial 2023',
        type: 'senate' as const,
        year: 2023,
        date: '2023-02-25',
        status: 'concluded' as const,
        level: 'constituency' as const,
        stateCode: 'LA',
        constituency: 'Lagos Central',
        areaLabel: 'LGA',
        areas: districtAreas(stateByCode('LA'), ['Lagos Island', 'Lagos Mainland', 'Surulere', 'Eti-Osa', 'Apapa']).map(
          (a) => ({ ...a, registered: Math.round(a.registered * 0.32) }),
        ),
        candidates: [
          { personId: 'folake-adeniran', party: 'APC' as const },
          { personId: 'chidinma-uzor', party: 'LP' as const },
        ],
        results: {},
      },
      {
        id: 'reps-surulere-2023',
        title: 'Surulere I Federal Constituency 2023',
        type: 'reps' as const,
        year: 2023,
        date: '2023-02-25',
        status: 'concluded' as const,
        level: 'constituency' as const,
        stateCode: 'LA',
        constituency: 'Surulere I',
        areaLabel: 'Ward',
        areas: Array.from({ length: 6 }, (_, i) => ({ code: `SU-${i}`, name: `Ward ${String.fromCharCode(65 + i)}`, registered: 42000 })),
        candidates: [
          { personId: 'tunde-oyelaran', party: 'APC' as const },
          { personId: 'chidinma-uzor', party: 'LP' as const },
        ],
        results: {},
      },
      {
        id: 'assembly-ikeja-2023',
        title: 'Ikeja I State Constituency 2023',
        type: 'assembly' as const,
        year: 2023,
        date: '2023-03-18',
        status: 'concluded' as const,
        level: 'constituency' as const,
        stateCode: 'LA',
        constituency: 'Ikeja I',
        areaLabel: 'Ward',
        areas: Array.from({ length: 5 }, (_, i) => ({ code: `IK-${i}`, name: `Ward ${String.fromCharCode(65 + i)}`, registered: 31000 })),
        candidates: [
          { personId: 'kehinde-alabi', party: 'APC' as const },
          { personId: 'gbenga-ilori', party: 'LP' as const },
        ],
        results: {},
      },
      {
        id: 'lga-ikeja-2025',
        title: 'Ikeja LGA Chairmanship 2025',
        type: 'lga' as const,
        year: 2025,
        date: '2025-07-12',
        status: 'concluded' as const,
        level: 'constituency' as const,
        stateCode: 'LA',
        constituency: 'Ikeja',
        areaLabel: 'Ward',
        areas: Array.from({ length: 10 }, (_, i) => ({ code: `IKL-${i}`, name: `Ward ${String(i + 1).padStart(2, '0')}`, registered: 28000 })),
        candidates: [
          { personId: 'samuel-ademola', party: 'APC' as const },
          { personId: 'adewale-sanni', party: 'PDP' as const },
        ],
        results: {},
      },
    ];
  })(),
  ...(() => {
    const areas = SENATORIAL('KN');
    return [
      {
        id: 'gov-kano-2023',
        title: 'Kano Governorship 2023',
        type: 'governorship' as const,
        year: 2023,
        date: '2023-03-18',
        status: 'concluded' as const,
        level: 'state' as const,
        stateCode: 'KN',
        areaLabel: 'District',
        areas,
        candidates: [
          { personId: 'sani-lawan-dala', party: 'NNPP' as const },
          { personId: 'nasiru-tijjani', party: 'APC' as const },
        ],
        results: localResults('gov-kn-23', areas, 0.33, { 'sani-lawan-dala': 0.53, 'nasiru-tijjani': 0.47 }),
      },
      {
        id: 'gov-kano-2027',
        title: 'Kano Governorship 2027',
        type: 'governorship' as const,
        year: 2027,
        date: '2027-03-06',
        status: 'upcoming' as const,
        level: 'state' as const,
        stateCode: 'KN',
        areaLabel: 'District',
        areas,
        candidates: [
          { personId: 'sani-lawan-dala', party: 'NNPP' as const },
          { personId: 'nasiru-tijjani', party: 'APC' as const },
        ],
        results: {},
      },
      {
        id: 'sen-kano-north-2023',
        title: 'Kano North Senatorial 2023',
        type: 'senate' as const,
        year: 2023,
        date: '2023-02-25',
        status: 'concluded' as const,
        level: 'constituency' as const,
        stateCode: 'KN',
        constituency: 'Kano North',
        areaLabel: 'LGA',
        areas: districtAreas(stateByCode('KN'), ['Bichi', 'Dambatta', 'Kunchi', 'Tsanyawa', 'Bagwai', 'Gwarzo']).map((a) => ({
          ...a,
          registered: Math.round(a.registered * 0.3),
        })),
        candidates: [
          { personId: 'aisha-garba-bichi', party: 'NNPP' as const },
          { personId: 'nasiru-tijjani', party: 'APC' as const },
        ],
        results: {},
      },
    ];
  })(),
  ...(() => {
    const areas = SENATORIAL('RI');
    return [
      {
        id: 'gov-rivers-2023',
        title: 'Rivers Governorship 2023',
        type: 'governorship' as const,
        year: 2023,
        date: '2023-03-18',
        status: 'concluded' as const,
        level: 'state' as const,
        stateCode: 'RI',
        areaLabel: 'District',
        areas,
        candidates: [
          { personId: 'tamuno-briggs', party: 'PDP' as const },
          { personId: 'ibinabo-georgewill', party: 'APC' as const },
        ],
        results: localResults('gov-ri-23', areas, 0.22, { 'tamuno-briggs': 0.6, 'ibinabo-georgewill': 0.4 }),
      },
      {
        id: 'gov-rivers-2027',
        title: 'Rivers Governorship 2027',
        type: 'governorship' as const,
        year: 2027,
        date: '2027-03-06',
        status: 'upcoming' as const,
        level: 'state' as const,
        stateCode: 'RI',
        areaLabel: 'District',
        areas,
        candidates: [
          { personId: 'tamuno-briggs', party: 'PDP' as const },
          { personId: 'ibinabo-georgewill', party: 'APC' as const },
        ],
        results: {},
      },
    ];
  })(),
  ...(() => {
    const areas = SENATORIAL('KD');
    return [
      {
        id: 'gov-kaduna-2023',
        title: 'Kaduna Governorship 2023',
        type: 'governorship' as const,
        year: 2023,
        date: '2023-03-18',
        status: 'concluded' as const,
        level: 'state' as const,
        stateCode: 'KD',
        areaLabel: 'District',
        areas,
        candidates: [
          { personId: 'ibrahim-zubairu', party: 'APC' as const },
          { personId: 'mary-yakubu', party: 'PDP' as const },
        ],
        results: localResults('gov-kd-23', areas, 0.3, { 'ibrahim-zubairu': 0.56, 'mary-yakubu': 0.44 }),
      },
      {
        id: 'gov-kaduna-2027',
        title: 'Kaduna Governorship 2027',
        type: 'governorship' as const,
        year: 2027,
        date: '2027-03-06',
        status: 'upcoming' as const,
        level: 'state' as const,
        stateCode: 'KD',
        areaLabel: 'District',
        areas,
        candidates: [
          { personId: 'ibrahim-zubairu', party: 'APC' as const },
          { personId: 'mary-yakubu', party: 'PDP' as const },
        ],
        results: {},
      },
    ];
  })(),
  {
    id: 'sen-anambra-south-2023',
    title: 'Anambra South Senatorial 2023',
    type: 'senate',
    year: 2023,
    date: '2023-02-25',
    status: 'concluded',
    level: 'constituency',
    stateCode: 'AN',
    constituency: 'Anambra South',
    areaLabel: 'LGA',
    areas: districtAreas(stateByCode('AN'), ['Nnewi North', 'Nnewi South', 'Ekwusigo', 'Ihiala', 'Orumba North', 'Orumba South', 'Aguata']).map(
      (a) => ({ ...a, registered: Math.round(a.registered * 0.33) }),
    ),
    candidates: [
      { personId: 'obinna-nwachukwu', party: 'LP' },
      { personId: 'chukwudi-anyanwu', party: 'APGA' },
    ],
    results: {},
  },
];

// Fill constituency-level results that were left empty above.
const CONSTITUENCY_BASE: Record<string, [number, Record<string, number>]> = {
  'sen-lagos-central-2023': [0.2, { 'folake-adeniran': 0.56, 'chidinma-uzor': 0.44 }],
  'reps-surulere-2023': [0.22, { 'tunde-oyelaran': 0.58, 'chidinma-uzor': 0.42 }],
  'assembly-ikeja-2023': [0.19, { 'kehinde-alabi': 0.64, 'gbenga-ilori': 0.36 }],
  'lga-ikeja-2025': [0.14, { 'samuel-ademola': 0.71, 'adewale-sanni': 0.29 }],
  'sen-kano-north-2023': [0.34, { 'aisha-garba-bichi': 0.55, 'nasiru-tijjani': 0.45 }],
  'sen-anambra-south-2023': [0.24, { 'obinna-nwachukwu': 0.6, 'chukwudi-anyanwu': 0.4 }],
};
for (const e of ELECTIONS) {
  const b = CONSTITUENCY_BASE[e.id];
  if (b) e.results = localResults(e.id, e.areas, b[0], b[1]);
}

export const electionById = (id: string) => ELECTIONS.find((e) => e.id === id);
