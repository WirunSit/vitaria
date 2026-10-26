import * as THREE from 'three';
import { toonGradient } from './Materials';

/**
 * look v3: the paved circle in the start plaza, laid out like a cell seen under a microscope — irregular
 * flagstones (cytoplasm), a ring of blue-grey stones (membrane) and a teal stone disc in the middle (nucleus).
 * Stones near the rim break up and drop out so the paving fades into the dirt instead of ending on a hard edge.
 * Drawn once into a canvas texture (Voronoi flagstones with mortar), then laid on the ground as a flat disc.
 */
const SIZE = 512;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function paving(): THREE.CanvasTexture {
  const r = rng(7);
  const sites: { x: number; y: number; c: [number, number, number]; drop: boolean }[] = [];
  const cells = 15, step = SIZE / cells;
  const stone = (d: number): [number, number, number] => {
    // nucleus · membrane · cytoplasm, each with a little per-stone variation
    const v = (r() - 0.5) * 18;
    if (d < 0.2) return [118 + v, 158 + v, 148 + v];
    if (d > 0.62 && d < 0.74) return [138 + v, 150 + v, 162 + v];
    const warm = r() < 0.3 ? 10 : 0;
    return [186 + v + warm, 174 + v + warm * 0.6, 150 + v];
  };
  for (let j = 0; j <= cells; j++) for (let i = 0; i <= cells; i++) {
    const x = (i + 0.15 + r() * 0.7) * step, y = (j + 0.15 + r() * 0.7) * step;
    const d = Math.hypot(x - SIZE / 2, y - SIZE / 2) / (SIZE / 2);
    sites.push({ x, y, c: stone(d), drop: d > 0.84 && r() < (d - 0.84) / 0.12 });
  }
  // a denser ring of small stones on the membrane, so it reads as one band
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2, rr = 0.68 * SIZE / 2;
    sites.push({ x: SIZE / 2 + Math.cos(a) * rr, y: SIZE / 2 + Math.sin(a) * rr, c: stone(0.68), drop: false });
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const g = cv.getContext('2d')!;
  const img = g.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let d1 = 1e9, d2 = 1e9, best = 0;
    for (let k = 0; k < sites.length; k++) {
      const dx = sites[k].x - x, dy = sites[k].y - y;
      if (dx > 60 || dx < -60 || dy > 60 || dy < -60) continue;
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; best = k; } else if (d < d2) d2 = d;
    }
    const edge = Math.sqrt(d2) - Math.sqrt(d1); // distance to the mortar line, in px
    const s = sites[best];
    const rad = Math.hypot(x - SIZE / 2, y - SIZE / 2) / (SIZE / 2);
    const o = (y * SIZE + x) * 4;
    const bevel = Math.min(1, edge / 4); // stones darken a little toward their edges
    const mortar = edge < 1.6;
    img.data[o] = mortar ? 104 : s.c[0] * (0.86 + 0.14 * bevel);
    img.data[o + 1] = mortar ? 95 : s.c[1] * (0.86 + 0.14 * bevel);
    img.data[o + 2] = mortar ? 80 : s.c[2] * (0.86 + 0.14 * bevel);
    const fade = rad > 0.97 ? 0 : 1;
    img.data[o + 3] = s.drop || rad > 0.985 ? 0 : 255 * fade * (mortar ? 0.85 : 1);
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Paved disc of the given radius, lying on flat ground at height y. */
export function buildPavedCircle(x: number, y: number, z: number, radius: number): THREE.Mesh {
  const mat = new THREE.MeshToonMaterial({
    map: paving(), gradientMap: toonGradient(), alphaTest: 0.5,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const m = new THREE.Mesh(new THREE.CircleGeometry(radius, 64).rotateX(-Math.PI / 2), mat);
  m.position.set(x, y + 0.03, z);
  m.receiveShadow = true;
  m.userData.noOutline = true;
  m.name = 'start-plaza-paving';
  return m;
}
