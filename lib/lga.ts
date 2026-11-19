/**
 * LGA-level results for the state zoom view.
 *
 * SAMPLE DATA: until real polling-unit results are imported, a state's counted
 * votes are spread across its LGAs deterministically. Iterative proportional
 * fitting makes the LGA figures add back up to the state's totals, so the zoomed
 * map never disagrees with the national one.
 */
import type { PartyCode } from './parties';

export type LgaShape = { id: string; name: string; d: string; cx: number; cy: number };
export type LgaShapes = { state: string; lgas: LgaShape[] };

export type LgaCandidate = { personId: string; name: string; party: PartyCode; votes: number; share: number };
export type LgaResult = { id: string; name: string; votes: number; margin: number; candidates: LgaCandidate[] };

type StateInput = { code: string; candidates: { personId: string; name: string; party: PartyCode; votes: number }[] };

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function lgaResults(state: StateInput, lgas: { id: string; name: string }[], seedKey = ''): LgaResult[] {
  const cands = state.candidates.filter((c) => c.votes > 0);
  const total = cands.reduce((s, c) => s + c.votes, 0);
  if (!total || !lgas.length) {
    return lgas.map((l) => ({ id: l.id, name: l.name, votes: 0, margin: 0, candidates: [] }));
  }
  const r = rng(hash(state.code + seedKey));
  // LGA size weights and local lean per candidate
  const size = lgas.map(() => 0.35 + r() * 1.3);
  const sizeSum = size.reduce((a, b) => a + b, 0);
  const rowTarget = size.map((w) => (w / sizeSum) * total);
  const colTarget = cands.map((c) => c.votes);
  // Start from state shares with strong local variation
  let m = lgas.map(() => cands.map((c) => (c.votes / total) * Math.exp((r() - 0.5) * 1.6)));
  for (let iter = 0; iter < 40; iter++) {
    m = m.map((row, i) => {
      const s = row.reduce((a, b) => a + b, 0) || 1;
      return row.map((v) => (v / s) * rowTarget[i]);
    });
    const colSum = cands.map((_, j) => m.reduce((a, row) => a + row[j], 0) || 1);
    m = m.map((row) => row.map((v, j) => (v / colSum[j]) * colTarget[j]));
  }
  return lgas.map((l, i) => {
    const votes = m[i].map((v) => Math.round(v));
    const sum = votes.reduce((a, b) => a + b, 0) || 1;
    const candidates = cands
      .map((c, j) => ({ personId: c.personId, name: c.name, party: c.party, votes: votes[j], share: votes[j] / sum }))
      .sort((a, b) => b.votes - a.votes);
    return { id: l.id, name: l.name, votes: sum, margin: candidates[1] ? candidates[0].share - candidates[1].share : 1, candidates };
  });
}

/** Loads one state's LGA shapes once per session (they live in /public/geo/lga). */
const cache = new Map<string, Promise<LgaShapes>>();
export function loadLgaShapes(code: string): Promise<LgaShapes> {
  let p = cache.get(code);
  if (!p) {
    p = fetch(`/geo/lga/${code}.json`).then((r) => {
      if (!r.ok) throw new Error(`LGA shapes for ${code}: ${r.status}`);
      return r.json() as Promise<LgaShapes>;
    });
    p.catch(() => cache.delete(code));
    cache.set(code, p);
  }
  return p;
}

/** Official LGA results (where on record), in the same shape as the estimate. */
export function officialLgaResults(
  state: StateInput & { lga?: Record<string, Record<string, number>> },
  lgas: { id: string; name: string }[],
): LgaResult[] {
  return lgas.map((l) => {
    const v = state.lga?.[l.id] ?? {};
    const sum = Object.values(v).reduce((a, b) => a + b, 0);
    const candidates = state.candidates
      .filter((c) => (v[c.personId] ?? 0) > 0)
      .map((c) => ({ personId: c.personId, name: c.name, party: c.party, votes: v[c.personId], share: sum ? v[c.personId] / sum : 0 }))
      .sort((a, b) => b.votes - a.votes);
    return { id: l.id, name: l.name, votes: sum, margin: candidates[1] ? candidates[0].share - candidates[1].share : candidates.length ? 1 : 0, candidates };
  });
}
