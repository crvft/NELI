// Builds lib/map-shapes.json: SVG paths for Nigeria's 36 states + FCT
// (GRID3 via geoBoundaries, CC BY 4.0) and neighbouring countries
// (Natural Earth via world-atlas, public domain).
// Run: node scripts/build-map.mjs
import fs from 'node:fs';
import { geoMercator, geoPath, geoArea } from 'd3-geo';
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

const projection = geoMercator().fitExtent([[205, 95], [W - 135, H - 75]], nga);
projection.clipExtent([[0, 0], [W, H]]);
const path = geoPath(projection).digits(0);

const states = {};
for (const f of ngaSimple.features) {
  const code = NAME_TO_CODE[f.properties.shapeName];
  if (!code) throw new Error('Unknown state ' + f.properties.shapeName);
  const [cx, cy] = path.centroid(f);
  states[code] = { d: path(f), cx: Math.round(cx), cy: Math.round(cy) };
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
console.log('states', Object.keys(states).length, 'neighbours', neighbours.map((n) => n.name).join(', '), 'bytes', fs.statSync('lib/map-shapes.json').size);
