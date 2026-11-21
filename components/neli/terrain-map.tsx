'use client';

import * as React from 'react';
import * as THREE from 'three';
import shapes from '@/lib/map-shapes.json';
import { PARTIES, type PartyCode } from '@/lib/parties';
import type { MapState } from '@/lib/map-data';
import { PLASMA } from './terrain-scale';

/**
 * 3D "terrain" view of one party's vote across Nigeria (desktop only).
 *
 * A grid of vertical lines covers the country. Each line's height is the party's share
 * of the vote, and its colour runs up the "plasma" scale (deep purple at the base to
 * bright yellow at 100%), like the Manhattan roof-height map. Heights blend smoothly
 * between neighbouring states (a Gaussian smoothing of each state's exact figure);
 * hovering shows the exact state figure and dims every other state.
 *
 * Camera: drag to tilt (up/down) and rotate (left/right), scroll to zoom, or use the
 * Top / From the south / From the north buttons.
 */

const S = shapes as unknown as {
  width: number;
  height: number;
  states: Record<
    string,
    { d: string; cx: number; cy: number; box: [number, number, number, number] }
  >;
};

const PLASMA_RGB = PLASMA.map((h) => new THREE.Color(h));

export function plasma(t: number, out = new THREE.Color()) {
  const x = Math.max(0, Math.min(1, t)) * (PLASMA_RGB.length - 1);
  const i = Math.min(PLASMA_RGB.length - 2, Math.floor(x));
  return out.copy(PLASMA_RGB[i]).lerp(PLASMA_RGB[i + 1], x - i);
}

const STEP = 5; // map units between lines
const FOV = 11; // degrees; narrow lens so top-down reads like a flat map
// Point sprites are sized as size * (viewport half-height / distance), so a size of
// STEP / tan(FOV/2) makes each tip cover one grid cell at any zoom
const MAX_H = 170; // world height of a 100% share
const CX = S.width / 2;
const CY = S.height / 2;

type Grid = {
  n: number;
  x: Float32Array;
  y: Float32Array;
  state: Int16Array;
  gi: Int32Array;
  cols: number;
  rows: number;
  codes: string[];
};

/** Which state each grid point falls in (once per page; uses the browser's path hit-testing). */
function buildGrid(): Grid {
  const ctx = document.createElement('canvas').getContext('2d')!;
  const codes = Object.keys(S.states);
  const paths = codes.map((c) => new Path2D(S.states[c].d));
  const boxes = codes.map((c) => S.states[c].box);
  const cols = Math.floor(S.width / STEP) + 1;
  const rows = Math.floor(S.height / STEP) + 1;
  const xs: number[] = [];
  const ys: number[] = [];
  const st: number[] = [];
  const gi: number[] = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * STEP;
      const y = j * STEP;
      for (let k = 0; k < codes.length; k++) {
        const b = boxes[k];
        if (x < b[0] || y < b[1] || x > b[0] + b[2] || y > b[1] + b[3])
          continue;
        if (ctx.isPointInPath(paths[k], x, y)) {
          xs.push(x);
          ys.push(y);
          st.push(k);
          gi.push(j * cols + i);
          break;
        }
      }
    }
  }
  return {
    n: xs.length,
    x: Float32Array.from(xs),
    y: Float32Array.from(ys),
    state: Int16Array.from(st),
    gi: Int32Array.from(gi),
    cols,
    rows,
    codes,
  };
}

/** Smoothed share at every grid point: Gaussian blur of the per-state values, inside Nigeria only. */
function heights(grid: Grid, value: (code: string) => number): Float32Array {
  const { cols, rows } = grid;
  const f = new Float32Array(cols * rows);
  const m = new Float32Array(cols * rows);
  const vals = grid.codes.map(value);
  for (let p = 0; p < grid.n; p++) {
    f[grid.gi[p]] = vals[grid.state[p]];
    m[grid.gi[p]] = 1;
  }
  const sigma = 2.6; // grid cells (~13 map units)
  const r = Math.ceil(sigma * 3);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) =>
    Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)),
  );
  const blur = (a: Float32Array) => {
    const t = new Float32Array(a.length);
    const o = new Float32Array(a.length);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        let s = 0;
        for (let d = -r; d <= r; d++) {
          const ii = i + d;
          if (ii >= 0 && ii < cols) s += a[j * cols + ii] * k[d + r];
        }
        t[j * cols + i] = s;
      }
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        let s = 0;
        for (let d = -r; d <= r; d++) {
          const jj = j + d;
          if (jj >= 0 && jj < rows) s += t[jj * cols + i] * k[d + r];
        }
        o[j * cols + i] = s;
      }
    return o;
  };
  const bf = blur(f.map((v, i) => v * m[i]));
  const bm = blur(m);
  const out = new Float32Array(grid.n);
  for (let p = 0; p < grid.n; p++) {
    const g = grid.gi[p];
    out[p] = bm[g] > 1e-6 ? bf[g] / bm[g] : 0;
  }
  return out;
}

/** State outlines as line segments on the ground (paths are M/L/Z only). */
function outlineSegments(): Float32Array {
  const pts: number[] = [];
  for (const s of Object.values(S.states)) {
    for (const ring of s.d.split(/[Mm]/).filter(Boolean)) {
      const nums = ring
        .replace(/[Zz]/g, '')
        .split(/[L,\s]+/)
        .filter(Boolean)
        .map(Number);
      for (let i = 0; i + 3 < nums.length; i += 2)
        pts.push(
          nums[i] - CX,
          0,
          nums[i + 1] - CY,
          nums[i + 2] - CX,
          0,
          nums[i + 3] - CY,
        );
      if (nums.length >= 4)
        pts.push(
          nums[nums.length - 2] - CX,
          0,
          nums[nums.length - 1] - CY,
          nums[0] - CX,
          0,
          nums[1] - CY,
        );
    }
  }
  return Float32Array.from(pts);
}

type View = { theta: number; phi: number; radius: number };
const VIEWS: Record<'top' | 'south' | 'north', View> = {
  top: { theta: 0, phi: 0.02, radius: 4350 },
  south: { theta: 0, phi: 1.18, radius: 4300 },
  north: { theta: Math.PI, phi: 1.18, radius: 4300 },
};

function isDark() {
  const root = document.documentElement;
  if (root.dataset.theme === 'dark') return true;
  if (root.dataset.theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function TerrainMap({
  states,
  party,
  live,
}: {
  states: MapState[];
  party: PartyCode;
  live: boolean;
}) {
  const wrap = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<{
    code: string;
    x: number;
    y: number;
  } | null>(null);
  const api = React.useRef<{
    go: (v: View) => void;
    setHeights: (h: Float32Array) => void;
    dim: (code: string | null) => void;
  } | null>(null);
  const gridRef = React.useRef<Grid | null>(null);
  const byCode = React.useMemo(
    () => Object.fromEntries(states.map((s) => [s.code, s])),
    [states],
  );

  // Scene setup (once)
  React.useEffect(() => {
    const el = wrap.current!;
    const grid = (gridRef.current ??= buildGrid());
    const dark = isDark();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    const scene = new THREE.Scene();
    // Narrow lens (near-orthographic): top-down reads like a flat map, not a starburst
    const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 30000);

    // Ground outlines
    const og = new THREE.BufferGeometry();
    og.setAttribute(
      'position',
      new THREE.BufferAttribute(outlineSegments(), 3),
    );
    scene.add(
      new THREE.LineSegments(
        og,
        new THREE.LineBasicMaterial({ color: dark ? 0x45455a : 0xc4c4d2 }),
      ),
    );

    // Lines: base at 0, top at height; colour runs up the plasma scale
    const pos = new Float32Array(grid.n * 6);
    const col = new Float32Array(grid.n * 6);
    const base = new Float32Array(grid.n * 6); // undimmed colours
    for (let p = 0; p < grid.n; p++) {
      pos[p * 6] = pos[p * 6 + 3] = grid.x[p] - CX;
      pos[p * 6 + 2] = pos[p * 6 + 5] = grid.y[p] - CY;
    }
    const lg = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3);
    const colAttr = new THREE.BufferAttribute(col, 3);
    lg.setAttribute('position', posAttr);
    lg.setAttribute('color', colAttr);
    const lines = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: dark ? 0.95 : 0.9,
      }),
    );
    lines.frustumCulled = false;
    scene.add(lines);
    // A square at each line's tip: top-down this reads as a heat map (like the
    // Manhattan reference); from the side, a bright tip on every line
    const tipPos = new Float32Array(grid.n * 3);
    const tipCol = new Float32Array(grid.n * 3);
    for (let p = 0; p < grid.n; p++) {
      tipPos[p * 3] = grid.x[p] - CX;
      tipPos[p * 3 + 2] = grid.y[p] - CY;
    }
    const tg = new THREE.BufferGeometry();
    const tipPosAttr = new THREE.BufferAttribute(tipPos, 3);
    const tipColAttr = new THREE.BufferAttribute(tipCol, 3);
    tg.setAttribute('position', tipPosAttr);
    tg.setAttribute('color', tipColAttr);
    const TIP_FULL = (STEP * 0.95) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const tipMat = new THREE.PointsMaterial({ size: TIP_FULL, vertexColors: true, sizeAttenuation: true });
    const tips = new THREE.Points(tg, tipMat);
    tips.frustumCulled = false;
    scene.add(tips);
    const bg = new THREE.Color(dark ? 0x1c1c1c : 0xffffff);
    const tmp = new THREE.Color();
    let dimmed: string | null = null;

    const paint = () => {
      const k = dimmed == null ? -1 : grid.codes.indexOf(dimmed);
      for (let p = 0; p < grid.n; p++) {
        const off = k >= 0 && grid.state[p] !== k;
        for (let v = 0; v < 2; v++) {
          const o = p * 6 + v * 3;
          tmp.setRGB(base[o], base[o + 1], base[o + 2]);
          if (off) tmp.lerp(bg, 0.86);
          col[o] = tmp.r;
          col[o + 1] = tmp.g;
          col[o + 2] = tmp.b;
        }
        // tip takes the top colour
        tipCol[p * 3] = col[p * 6 + 3];
        tipCol[p * 3 + 1] = col[p * 6 + 4];
        tipCol[p * 3 + 2] = col[p * 6 + 5];
      }
      colAttr.needsUpdate = true;
      tipColAttr.needsUpdate = true;
      dirty = true;
    };

    const setHeights = (h: Float32Array) => {
      const bottom = plasma(0);
      for (let p = 0; p < grid.n; p++) {
        pos[p * 6 + 4] = Math.max(0.8, h[p] * MAX_H);
        tipPos[p * 3 + 1] = pos[p * 6 + 4];
        const top = plasma(h[p], tmp);
        base[p * 6] = bottom.r;
        base[p * 6 + 1] = bottom.g;
        base[p * 6 + 2] = bottom.b;
        base[p * 6 + 3] = top.r;
        base[p * 6 + 4] = top.g;
        base[p * 6 + 5] = top.b;
      }
      posAttr.needsUpdate = true;
      tipPosAttr.needsUpdate = true;
      paint();
    };

    // Camera: spherical orbit around the map centre
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const cur: View = { ...VIEWS.top };
    const target: View = { ...VIEWS.top };
    let dirty = true;
    const place = () => {
      camera.position.set(
        cur.radius * Math.sin(cur.phi) * Math.sin(cur.theta),
        cur.radius * Math.cos(cur.phi),
        cur.radius * Math.sin(cur.phi) * Math.cos(cur.theta),
      );
      camera.lookAt(0, 0, 0);
    };
    const resize = () => {
      const w = el.clientWidth;
      const h = Math.round((w * S.height) / S.width);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf = 0;
    const loop = () => {
      let moving = false;
      for (const key of ['theta', 'phi', 'radius'] as const) {
        const d = target[key] - cur[key];
        if (Math.abs(d) > 1e-4) {
          cur[key] += reduced ? d : d * 0.14;
          moving = true;
        } else cur[key] = target[key];
      }
      if (moving || dirty) {
        // Tips fill their cell top-down and shrink to small points as the view tilts,
        // so the side view shows lines rather than a solid surface
        const t = Math.min(1, Math.max(0, (cur.phi - 0.12) / 0.6));
        tipMat.size = TIP_FULL * (1 - 0.8 * t * t * (3 - 2 * t));
        place();
        renderer.render(scene, camera);
        dirty = false;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    // Pointer: drag to orbit; hover to pick a state
    const ctx = document.createElement('canvas').getContext('2d')!;
    const paths = grid.codes.map((c) => new Path2D(S.states[c].d));
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let drag: { x: number; y: number } | null = null;
    const pick = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((ev.clientX - r.left) / r.width) * 2 - 1,
        -((ev.clientY - r.top) / r.height) * 2 + 1,
      );
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      const mx = hit.x + CX;
      const my = hit.z + CY;
      const k = paths.findIndex((p, i) => {
        const b = S.states[grid.codes[i]].box;
        return (
          mx >= b[0] &&
          my >= b[1] &&
          mx <= b[0] + b[2] &&
          my <= b[1] + b[3] &&
          ctx.isPointInPath(p, mx, my)
        );
      });
      return k >= 0
        ? { code: grid.codes[k], x: ev.clientX - r.left, y: ev.clientY - r.top }
        : null;
    };
    const onDown = (ev: PointerEvent) => {
      drag = { x: ev.clientX, y: ev.clientY };
      renderer.domElement.setPointerCapture(ev.pointerId);
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onMove = (ev: PointerEvent) => {
      if (drag) {
        target.theta -= (ev.clientX - drag.x) * 0.006;
        target.phi = Math.max(
          0.02,
          Math.min(1.4, target.phi + (ev.clientY - drag.y) * 0.005),
        );
        cur.theta = target.theta;
        cur.phi = target.phi;
        drag = { x: ev.clientX, y: ev.clientY };
        dirty = true;
        setHover(null);
        return;
      }
      const h = pick(ev);
      setHover(h);
      if ((h?.code ?? null) !== dimmed) {
        dimmed = h?.code ?? null;
        paint();
      }
    };
    const onUp = (ev: PointerEvent) => {
      drag = null;
      renderer.domElement.releasePointerCapture(ev.pointerId);
      renderer.domElement.style.cursor = 'grab';
    };
    const onLeave = () => {
      if (drag) return;
      setHover(null);
      if (dimmed) {
        dimmed = null;
        paint();
      }
    };
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      target.radius = Math.max(
        520,
        Math.min(2400, target.radius * (1 + ev.deltaY * 0.0012)),
      );
    };
    const c = renderer.domElement;
    c.style.cursor = 'grab';
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointerleave', onLeave);
    c.addEventListener('wheel', onWheel, { passive: false });

    api.current = {
      go: (v) => Object.assign(target, v),
      setHeights,
      dim: (code) => {
        dimmed = code;
        paint();
      },
    };

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointerleave', onLeave);
      c.removeEventListener('wheel', onWheel);
      lg.dispose();
      tg.dispose();
      tipMat.dispose();
      og.dispose();
      renderer.dispose();
      c.remove();
      api.current = null;
    };
  }, []);

  // Heights for the selected party
  React.useEffect(() => {
    const grid = gridRef.current;
    if (!grid || !api.current) return;
    api.current.setHeights(
      heights(grid, (code) => {
        const s = byCode[code];
        return s?.total
          ? (s.candidates.find((c) => c.party === party)?.share ?? 0)
          : 0;
      }),
    );
  }, [party, byCode]);

  const hs = hover ? byCode[hover.code] : null;
  const row = hs?.candidates.find((c) => c.party === party);
  const rank =
    hs && row ? hs.candidates.findIndex((c) => c.party === party) + 1 : 0;

  return (
    <div className='relative'>
      <div
        ref={wrap}
        className='w-full select-none'
        aria-label={`3D terrain of ${PARTIES[party].name}'s vote share by state`}
        role='img'
      />
      <div className='absolute top-0 right-0 flex gap-1'>
        {(
          [
            ['top', 'Top'],
            ['south', 'From the south'],
            ['north', 'From the north'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type='button'
            onClick={() => api.current?.go(VIEWS[k])}
            className='hit bg-surface-2 text-label-xs text-text-sub-600 shadow-surface-2 hover:bg-hover hover:text-text-strong-950 h-7 rounded-lg px-2.5 transition-colors duration-[80ms]'
          >
            {label}
          </button>
        ))}
      </div>
      {hover && hs && (
        <div
          className='bg-surface-4 shadow-surface-4 pointer-events-none absolute z-20 w-64 rounded-xl p-3.5'
          style={{
            left: `clamp(0px, calc(${hover.x}px - 8rem), calc(100% - 16rem))`,
            top: hover.y + 22,
          }}
          role='tooltip'
        >
          <div className='flex items-baseline justify-between gap-2'>
            <span className='text-label-sm text-text-strong-950'>
              {hs.name}
            </span>
            <span className='text-paragraph-xs text-text-sub-600'>
              {hs.zoneName}
            </span>
          </div>
          {hs.total && row ? (
            <>
              <div className='mt-2.5 flex items-center gap-2'>
                <span
                  className='size-2.5 rounded-full'
                  style={{ background: PARTIES[party].color }}
                />
                <span className='text-label-sm text-text-strong-950 truncate'>
                  {row.name}
                </span>
                <span className='tabular text-label-sm text-text-strong-950 ml-auto'>
                  {(row.share * 100).toFixed(1)}%
                </span>
              </div>
              <div className='text-paragraph-xs text-text-sub-600 mt-1'>
                {party} · {row.votes.toLocaleString('en-NG')} votes ·{' '}
                {ordinal(rank)} of {hs.candidates.length}
              </div>
            </>
          ) : (
            <p className='text-paragraph-xs text-text-sub-600 mt-2'>
              {hs.total
                ? `${party} has no votes on record here.`
                : live
                  ? 'No polling-unit results uploaded yet.'
                  : 'Data missing: results for this state are not on NELI’s record.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
