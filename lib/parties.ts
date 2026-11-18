import registry from './party-registry.json';

/** The parties with their own colour; any other code (100+ minor and historical parties) is valid too. */
export type MajorParty = 'APC' | 'PDP' | 'LP' | 'NNPP' | 'APGA' | 'ADC' | 'SDP' | 'A' | 'OTH';
export type PartyCode = MajorParty | (string & {});

export type Party = {
  code: PartyCode;
  name: string;
  /** Party family for continuity across mergers (e.g. ANPP, CPC, ACN -> APC) */
  lineage: string;
  /** CSS custom property holding the series colour (light/dark selected in globals.css) */
  color: string;
  /** Darker/lighter variant safe for party names set in colour */
  text: string;
};

const STYLE: Record<string, { color: string; text: string }> = {
  APC: { color: 'var(--party-apc)', text: 'var(--party-apc-text)' },
  PDP: { color: 'var(--party-pdp)', text: 'var(--party-pdp-text)' },
  LP: { color: 'var(--party-lp)', text: 'var(--party-lp-text)' },
  NNPP: { color: 'var(--party-nnpp)', text: 'var(--party-nnpp-text)' },
  APGA: { color: 'var(--party-apga)', text: 'var(--party-apga-text)' },
  ADC: { color: 'var(--party-adc)', text: 'var(--party-adc-text)' },
  SDP: { color: 'var(--party-sdp)', text: 'var(--party-sdp-text)' },
  OTH: { color: 'var(--party-oth)', text: 'var(--party-oth-text)' },
};

const NAMES: Record<string, string> = {
  APC: 'All Progressives Congress',
  PDP: 'Peoples Democratic Party',
  LP: 'Labour Party',
  NNPP: 'New Nigeria Peoples Party',
  APGA: 'All Progressives Grand Alliance',
  ADC: 'African Democratic Congress',
  SDP: 'Social Democratic Party',
  A: 'Accord',
  OTH: 'Other parties',
  'AD-APP': 'Alliance for Democracy / All People’s Party (joint ticket)',
};

const REG = registry as Record<string, { name: string | null; lineage: string }>;

const cache = new Map<string, Party>();

/**
 * Party info for any code. Historical parties take their family's colour (ANPP,
 * CPC, ACN, AD, APP -> APC blue) and every use shows the party code as text, so
 * colour is never the only cue. Minor parties share the neutral "other" colour.
 */
export function partyInfo(code: string): Party {
  let p = cache.get(code);
  if (!p) {
    const reg = REG[code];
    const lineage = reg?.lineage ?? (code in STYLE ? code : 'OTHER');
    const style = STYLE[code] ?? STYLE[lineage] ?? STYLE.OTH;
    p = { code, name: NAMES[code] ?? reg?.name ?? code, lineage, ...style };
    cache.set(code, p);
  }
  return p;
}

/** Map-style access (PARTIES[code]) for any code, including ones not listed above. */
export const PARTIES: Record<string, Party> = new Proxy({} as Record<string, Party>, {
  get: (_t, key) => (typeof key === 'string' ? partyInfo(key) : undefined),
});

export const party = (c: PartyCode) => partyInfo(c);
