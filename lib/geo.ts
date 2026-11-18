export type ZoneCode = 'NW' | 'NE' | 'NC' | 'SW' | 'SE' | 'SS';

export const ZONES: { code: ZoneCode; name: string; short: string }[] = [
  { code: 'NW', name: 'North West', short: 'N. West' },
  { code: 'NE', name: 'North East', short: 'N. East' },
  { code: 'NC', name: 'North Central', short: 'N. Central' },
  { code: 'SW', name: 'South West', short: 'S. West' },
  { code: 'SE', name: 'South East', short: 'S. East' },
  { code: 'SS', name: 'South South', short: 'S. South' },
];

export const zoneName = (z: ZoneCode) => ZONES.find((x) => x.code === z)!.name;

export type State = {
  code: string;
  name: string;
  capital: string;
  zone: ZoneCode;
  /** Registered voters (sample, millions-scale) */
  registered: number;
  /** Tile-grid position for the cartogram (approximate geography) */
  col: number;
  row: number;
};

// prettier-ignore
export const STATES: State[] = [
  { code: 'SO', name: 'Sokoto', capital: 'Sokoto', zone: 'NW', registered: 2172056, col: 1, row: 0 },
  { code: 'KT', name: 'Katsina', capital: 'Katsina', zone: 'NW', registered: 3516719, col: 2, row: 0 },
  { code: 'KN', name: 'Kano', capital: 'Kano', zone: 'NW', registered: 5921370, col: 3, row: 0 },
  { code: 'JI', name: 'Jigawa', capital: 'Dutse', zone: 'NW', registered: 2351298, col: 4, row: 0 },
  { code: 'YO', name: 'Yobe', capital: 'Damaturu', zone: 'NE', registered: 1485146, col: 5, row: 0 },
  { code: 'BO', name: 'Borno', capital: 'Maiduguri', zone: 'NE', registered: 2513281, col: 6, row: 0 },
  { code: 'KE', name: 'Kebbi', capital: 'Birnin Kebbi', zone: 'NW', registered: 2032041, col: 0, row: 1 },
  { code: 'ZA', name: 'Zamfara', capital: 'Gusau', zone: 'NW', registered: 1926870, col: 1, row: 1 },
  { code: 'KD', name: 'Kaduna', capital: 'Kaduna', zone: 'NW', registered: 4335208, col: 2, row: 1 },
  { code: 'BA', name: 'Bauchi', capital: 'Bauchi', zone: 'NE', registered: 2749268, col: 3, row: 1 },
  { code: 'GO', name: 'Gombe', capital: 'Gombe', zone: 'NE', registered: 1575794, col: 4, row: 1 },
  { code: 'AD', name: 'Adamawa', capital: 'Yola', zone: 'NE', registered: 2196566, col: 5, row: 1 },
  { code: 'NI', name: 'Niger', capital: 'Minna', zone: 'NC', registered: 2698344, col: 1, row: 2 },
  { code: 'FC', name: 'FCT Abuja', capital: 'Abuja', zone: 'NC', registered: 1570307, col: 2, row: 2 },
  { code: 'NA', name: 'Nasarawa', capital: 'Lafia', zone: 'NC', registered: 1899244, col: 3, row: 2 },
  { code: 'PL', name: 'Plateau', capital: 'Jos', zone: 'NC', registered: 2789528, col: 4, row: 2 },
  { code: 'TA', name: 'Taraba', capital: 'Jalingo', zone: 'NE', registered: 2022374, col: 5, row: 2 },
  { code: 'OY', name: 'Oyo', capital: 'Ibadan', zone: 'SW', registered: 3276675, col: 0, row: 3 },
  { code: 'KW', name: 'Kwara', capital: 'Ilorin', zone: 'NC', registered: 1695927, col: 1, row: 3 },
  { code: 'KO', name: 'Kogi', capital: 'Lokoja', zone: 'NC', registered: 1932654, col: 2, row: 3 },
  { code: 'BE', name: 'Benue', capital: 'Makurdi', zone: 'NC', registered: 2777727, col: 3, row: 3 },
  { code: 'OG', name: 'Ogun', capital: 'Abeokuta', zone: 'SW', registered: 2688305, col: 0, row: 4 },
  { code: 'OS', name: 'Osun', capital: 'Osogbo', zone: 'SW', registered: 1954800, col: 1, row: 4 },
  { code: 'EK', name: 'Ekiti', capital: 'Ado-Ekiti', zone: 'SW', registered: 987647, col: 2, row: 4 },
  { code: 'EN', name: 'Enugu', capital: 'Enugu', zone: 'SE', registered: 2112793, col: 3, row: 4 },
  { code: 'EB', name: 'Ebonyi', capital: 'Abakaliki', zone: 'SE', registered: 1597646, col: 4, row: 4 },
  { code: 'CR', name: 'Cross River', capital: 'Calabar', zone: 'SS', registered: 1766466, col: 5, row: 4 },
  { code: 'LA', name: 'Lagos', capital: 'Ikeja', zone: 'SW', registered: 7060195, col: 0, row: 5 },
  { code: 'ON', name: 'Ondo', capital: 'Akure', zone: 'SW', registered: 1991344, col: 1, row: 5 },
  { code: 'ED', name: 'Edo', capital: 'Benin City', zone: 'SS', registered: 2501081, col: 2, row: 5 },
  { code: 'AN', name: 'Anambra', capital: 'Awka', zone: 'SE', registered: 2656437, col: 3, row: 5 },
  { code: 'AB', name: 'Abia', capital: 'Umuahia', zone: 'SE', registered: 2120808, col: 4, row: 5 },
  { code: 'AK', name: 'Akwa Ibom', capital: 'Uyo', zone: 'SS', registered: 2357418, col: 5, row: 5 },
  { code: 'DE', name: 'Delta', capital: 'Asaba', zone: 'SS', registered: 3221697, col: 1, row: 6 },
  { code: 'BY', name: 'Bayelsa', capital: 'Yenagoa', zone: 'SS', registered: 1056862, col: 2, row: 6 },
  { code: 'IM', name: 'Imo', capital: 'Owerri', zone: 'SE', registered: 2419922, col: 3, row: 6 },
  { code: 'RI', name: 'Rivers', capital: 'Port Harcourt', zone: 'SS', registered: 3537190, col: 4, row: 6 },
];

export const stateByCode = (code: string) => STATES.find((s) => s.code === code)!;
