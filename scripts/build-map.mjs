// Builds lib/map-shapes.json (states, neighbours) and public/geo/lga/<STATE>.json
// (local government areas, loaded on demand when a state is opened). SVG paths for
// Nigeria's 36 states + FCT and 774 LGAs
// (GRID3 via geoBoundaries, CC BY 4.0) and neighbouring countries
// (Natural Earth via world-atlas, public domain).
// Run: node scripts/build-map.mjs
import fs from 'node:fs';
import { geoMercator, geoPath, geoArea, geoContains, geoCentroid, geoDistance } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';

const W = 1000;
const H = 820;
const nga = JSON.parse(fs.readFileSync('data/geo/nga-adm1.geojson', 'utf8'));
const world = JSON.parse(fs.readFileSync('node_modules/world-atlas/countries-50m.json', 'utf8'));
const countries = feature(world, world.objects.countries).features;

const NAME_TO_CODE = {
  Abia: 'AB', 'Abuja Federal Capital Territory': 'FC', Adamawa: 'AD', 'Akwa Ibom': 'AK', Anambra: 'AN', Bauchi: 'BA', Bayelsa: 'BY',
  Benue: 'BE', Borno: 'BO', 'Cross River': 'CR', Delta: 'DE', Ebonyi: 'EB', Edo: 'ED', Ekiti: 'EK', Enugu: 'EN', Gombe: 'GO', Imo: 'IM',
  Jigawa: 'JI', Kaduna: 'KD', Kano: 'KN', Katsina: 'KT', Kebbi: 'KE', Kogi: 'KO', Kwara: 'KW', Lagos: 'LA', Nasarawa: 'NA', Niger: 'NI',
  Ogun: 'OG', Ondo: 'ON', Osun: 'OS', Oyo: 'OY', Plateau: 'PL', Rivers: 'RI', Sokoto: 'SO', Taraba: 'TA', Yobe: 'YO', Zamfara: 'ZA',
};
const NEIGHBOURS = { 204: 'Benin', 562: 'Niger', 148: 'Chad', 120: 'Cameroon', 768: 'Togo', 288: 'Ghana', 854: 'Burkina Faso', 226: 'Eq. Guinea', 140: 'C.A.R.', 266: 'Gabon' };

// d3 expects clockwise exterior rings; GeoJSON (RFC 7946) uses the opposite.
function rewind(f) {
  if (geoArea(f) > 2 * Math.PI) {
    const rev = (poly) => poly.map((ring) => ring.slice().reverse());
    const g = f.geometry;
    if (g.type === 'Polygon') g.coordinates = rev(g.coordinates);
    else if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(rev);
  }
  return f;
}
nga.features.forEach(rewind);

// Simplify with shared borders preserved, so neighbouring states still meet.
let topo = topology({ states: nga }, 1e5);
topo = presimplify(topo);
topo = simplify(topo, quantile(topo, 0.12));
const ngaSimple = feature(topo, topo.objects.states);
ngaSimple.features.forEach(rewind);

let wtopo = presimplify(world);
wtopo = simplify(wtopo, quantile(wtopo, 0.5));
const countriesSimple = feature(wtopo, wtopo.objects.countries).features;

// Nigeria fills most of the frame; neighbours are pushed to the edges.
const EXTENT = JSON.parse(process.env.MAP_EXTENT ?? '[[118, 34], [962, 800]]');
const projection = geoMercator().fitExtent(EXTENT, nga);
projection.clipExtent([[0, 0], [W, H]]);
const path = geoPath(projection).digits(1);
const finePath = geoPath(projection).digits(2);

const states = {};
for (const f of ngaSimple.features) {
  const code = NAME_TO_CODE[f.properties.shapeName];
  if (!code) throw new Error('Unknown state ' + f.properties.shapeName);
  const [cx, cy] = path.centroid(f);
  const [[x0, y0], [x1, y1]] = path.bounds(f);
  states[code] = { d: path(f), cx: Math.round(cx), cy: Math.round(cy), box: [x0, y0, x1 - x0, y1 - y0].map((v) => Math.round(v * 10) / 10) };
}

const neighbours = countriesSimple
  .filter((c) => NEIGHBOURS[Number(c.id)])
  .map((c) => {
    const [cx, cy] = path.centroid(c);
    return { name: NEIGHBOURS[Number(c.id)], d: path(c), cx: Math.round(cx), cy: Math.round(cy) };
  })
  .filter((n) => n.d);

const nigeria = path(mesh(topo, topo.objects.states, (a, b) => a === b));

fs.writeFileSync('lib/map-shapes.json', JSON.stringify({ width: W, height: H, states, neighbours, nigeria }));

// ── LGAs ────────────────────────────────────────────────────────────────────
const adm2 = JSON.parse(fs.readFileSync('data/geo/nga-adm2.geojson', 'utf8'));
adm2.features.forEach(rewind);
let ltopo = topology({ lgas: adm2 }, 2e5);
ltopo = presimplify(ltopo);
ltopo = simplify(ltopo, quantile(ltopo, 0.3));
const lgaSimple = feature(ltopo, ltopo.objects.lgas).features;
lgaSimple.forEach(rewind);

const stateFeatures = nga.features.map((f) => ({ code: NAME_TO_CODE[f.properties.shapeName], f, c: geoCentroid(f) }));
const byState = {};
adm2.features.forEach((raw, i) => {
  const c = geoCentroid(raw);
  let home = stateFeatures.find((s) => geoContains(s.f, c));
  if (!home) home = stateFeatures.slice().sort((a, b) => geoDistance(a.c, c) - geoDistance(b.c, c))[0];
  const simple = lgaSimple[i];
  const [cx, cy] = finePath.centroid(simple);
  (byState[home.code] ??= []).push({
    id: `${home.code}-${String((byState[home.code]?.length ?? 0) + 1).padStart(2, '0')}`,
    name: raw.properties.shapeName,
    d: finePath(simple),
    cx: Math.round(cx * 10) / 10,
    cy: Math.round(cy * 10) / 10,
  });
});
fs.mkdirSync('public/geo/lga', { recursive: true });
let total = 0;
for (const [code, lgas] of Object.entries(byState)) {
  lgas.sort((a, b) => a.name.localeCompare(b.name));
  lgas.forEach((l, i) => (l.id = `${code}-${String(i + 1).padStart(2, '0')}`));
  const file = `public/geo/lga/${code}.json`;
  fs.writeFileSync(file, JSON.stringify({ state: code, lgas }));
  total += fs.statSync(file).size;
}
// Id -> name lookup for server-rendered tables (election pages); same ids as the shapes
fs.writeFileSync(
  'lib/lga-names.json',
  JSON.stringify(Object.fromEntries(Object.values(byState).flat().map((l) => [l.id, l.name]).sort())),
);
console.log('lga states', Object.keys(byState).length, 'lgas', Object.values(byState).reduce((a, b) => a + b.length, 0), 'bytes', total,
  'per-state', Object.entries(byState).map(([k, v]) => `${k}:${v.length}`).join(' '));
console.log('states', Object.keys(states).length, 'neighbours', neighbours.map((n) => n.name).join(', '), 'bytes', fs.statSync('lib/map-shapes.json').size);
