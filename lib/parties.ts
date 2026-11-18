export type PartyCode = 'APC' | 'PDP' | 'LP' | 'NNPP' | 'APGA' | 'ADC' | 'SDP' | 'OTH';

export type Party = {
  code: PartyCode;
  name: string;
  /** CSS custom property holding the series colour (light/dark selected in globals.css) */
  color: string;
};

// Series colours are validated for colour-vision deficiency; every use is paired
// with the party abbreviation so identity is never colour-alone.
export const PARTIES: Record<PartyCode, Party> = {
  APC: { code: 'APC', name: 'All Progressives Congress', color: 'var(--party-apc)' },
  PDP: { code: 'PDP', name: "Peoples Democratic Party", color: 'var(--party-pdp)' },
  LP: { code: 'LP', name: 'Labour Party', color: 'var(--party-lp)' },
  NNPP: { code: 'NNPP', name: 'New Nigeria Peoples Party', color: 'var(--party-nnpp)' },
  APGA: { code: 'APGA', name: 'All Progressives Grand Alliance', color: 'var(--party-apga)' },
  ADC: { code: 'ADC', name: 'African Democratic Congress', color: 'var(--party-adc)' },
  SDP: { code: 'SDP', name: 'Social Democratic Party', color: 'var(--party-sdp)' },
  OTH: { code: 'OTH', name: 'Other parties', color: 'var(--party-oth)' },
};

export const party = (c: PartyCode) => PARTIES[c];
