export type PartyCode = 'APC' | 'PDP' | 'LP' | 'NNPP' | 'APGA' | 'ADC' | 'SDP' | 'OTH';

export type Party = {
  code: PartyCode;
  name: string;
  /** CSS custom property holding the series colour (light/dark selected in globals.css) */
  color: string;
  /** Darker/lighter variant safe for party names set in colour */
  text: string;
};

// Series colours are validated for colour-vision deficiency; every use is paired
// with the party abbreviation so identity is never colour-alone.
export const PARTIES: Record<PartyCode, Party> = {
  APC: { code: 'APC', name: 'All Progressives Congress', color: 'var(--party-apc)', text: 'var(--party-apc-text)' },
  PDP: { code: 'PDP', name: "Peoples Democratic Party", color: 'var(--party-pdp)', text: 'var(--party-pdp-text)' },
  LP: { code: 'LP', name: 'Labour Party', color: 'var(--party-lp)', text: 'var(--party-lp-text)' },
  NNPP: { code: 'NNPP', name: 'New Nigeria Peoples Party', color: 'var(--party-nnpp)', text: 'var(--party-nnpp-text)' },
  APGA: { code: 'APGA', name: 'All Progressives Grand Alliance', color: 'var(--party-apga)', text: 'var(--party-apga-text)' },
  ADC: { code: 'ADC', name: 'African Democratic Congress', color: 'var(--party-adc)', text: 'var(--party-adc-text)' },
  SDP: { code: 'SDP', name: 'Social Democratic Party', color: 'var(--party-sdp)', text: 'var(--party-sdp-text)' },
  OTH: { code: 'OTH', name: 'Other parties', color: 'var(--party-oth)', text: 'var(--party-oth-text)' },
};

export const party = (c: PartyCode) => PARTIES[c];
