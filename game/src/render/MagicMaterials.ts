import * as THREE from 'three';
import { toonGradient } from '../world/Materials';

/**
 * Materials for skill constructs, so they read as conjured light and crystal instead of painted clay:
 *  - crystalMaterial: faceted gem — colour runs root → tip, every facet catches the light differently, a sharp
 *    glint, a glowing rim and a slow inner pulse (Geo amber, Cryo ice)
 *  - edgeGlow: thin additive lines along a mesh's hard edges (the bright facet edges of a cut crystal)
 *  - energyMaterial: additive fresnel shell — clear in the middle, bright at the silhouette, optional bands that
 *    flow along the surface (bubbles, membranes, energy rings, projectile cores)
 *  - groundDecal: soft painted disc on the ground (scorched earth, a blooming garden) instead of a flat circle
 * Colours go above 1 so the bloom pass picks them up; without bloom (low graphics) they still read as light.
 */
export const MAGIC_TIME = { value: 0 };
/** call once a frame */
export function tickMagic(dt: number) { MAGIC_TIME.value += dt; }

export interface CrystalLook { root: string; mid: string; tip: string; rim: string; glint?: number; opacity?: number }

const crystalCache = new Map<string, THREE.MeshToonMaterial>();
export function crystalMaterial(look: CrystalLook): THREE.MeshToonMaterial {
  const key = JSON.stringify(look);
  const hit = crystalCache.get(key);
  if (hit) return hit;
  const op = look.opacity ?? 1;
  const m = new THREE.MeshToonMaterial({ color: look.mid, gradientMap: toonGradient(), emissive: new THREE.Color(look.rim).multiplyScalar(0.15), transparent: op < 1, opacity: op });
  const v3 = (c: string) => { const k = new THREE.Color(c); return `vec3(${k.r.toFixed(3)}, ${k.g.toFixed(3)}, ${k.b.toFixed(3)})`; };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = MAGIC_TIME;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCH;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCH = position.y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vCH;
        uniform float uTime;
        float facetHash(vec3 n) { return fract(sin(dot(floor(n * 7.0 + 0.5), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float h = clamp(vCH, 0.0, 1.0);
        diffuseColor.rgb = mix(mix(${v3(look.root)}, ${v3(look.mid)}, smoothstep(0.0, 0.5, h)), ${v3(look.tip)}, smoothstep(0.5, 1.0, h));
        // each flat facet sits at its own angle to the light: vary its brightness like a cut gem
        diffuseColor.rgb *= 0.78 + 0.44 * facetHash(normalize(vNormal));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 nv = normalize(vNormal), vv = normalize(vViewPosition);
        float facing = abs(dot(nv, vv));
        float rim = pow(1.0 - facing, 2.0);
        // a hard glint where a facet mirrors the sky toward the camera, and light caught inside the crystal
        float glint = pow(max(0.0, dot(reflect(-vv, nv), normalize(vec3(0.3, 0.9, 0.35)))), 24.0) * ${(look.glint ?? 1.6).toFixed(2)};
        float inner = (0.12 + 0.08 * sin(uTime * 2.4 + vCH * 3.0)) * smoothstep(0.1, 1.0, vCH);
        totalEmissiveRadiance += ${v3(look.rim)} * (rim * 0.75 + inner) + vec3(glint);`);
  };
  m.customProgramCacheKey = () => `crystal|${key}`;
  crystalCache.set(key, m);
  return m;
}

const edgeCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();
const lineMats = new Map<string, THREE.LineBasicMaterial>();
/** Bright additive lines on the edges of `geo` sharper than `angle` degrees (shared per geometry/colour). */
export function edgeGlow(geo: THREE.BufferGeometry, color: string, intensity = 1.6, opacity = 0.75, angle = 25): THREE.LineSegments {
  let e = edgeCache.get(geo);
  if (!e) { e = new THREE.EdgesGeometry(geo, angle); edgeCache.set(geo, e); }
  const k = `${color}|${intensity}|${opacity}`;
  let mat = lineMats.get(k);
  if (!mat) {
    mat = new THREE.LineBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    lineMats.set(k, mat);
  }
  const l = new THREE.LineSegments(e, mat);
  l.raycast = () => {};
  return l;
}

export interface EnergyLook {
  color: string;
  /** brightness at the silhouette / in the middle */
  rim?: number;
  core?: number;
  power?: number;
  /** bands flowing along the surface: count around, speed (uv.x per second) */
  bands?: number;
  flow?: number;
  /** thin-film rainbow at the rim (soap bubbles) */
  iridescent?: boolean;
}

/** Additive fresnel shell. Each call returns its own material (opacity is animated per effect via `uFade`). */
export function energyMaterial(look: EnergyLook): THREE.ShaderMaterial {
  const c = new THREE.Color(look.color);
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: c }, uTime: MAGIC_TIME, uFade: { value: 1 },
      uRim: { value: look.rim ?? 2.2 }, uCore: { value: look.core ?? 0.15 }, uPow: { value: look.power ?? 2.2 },
      uBands: { value: look.bands ?? 0 }, uFlow: { value: look.flow ?? 0 }, uIri: { value: look.iridescent ? 1 : 0 },
    },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uTime, uFade, uRim, uCore, uPow, uBands, uFlow, uIri;
      varying vec3 vN; varying vec3 vV; varying vec2 vUv;
      void main() {
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
        float a = uCore + uRim * f;
        if (uBands > 0.0) {
          float b = 0.5 + 0.5 * sin((vUv.x * uBands - uTime * uFlow) * 6.2832);
          a *= 0.35 + 0.9 * smoothstep(0.35, 1.0, b);
        }
        vec3 col = uColor;
        if (uIri > 0.5) col = mix(col, 0.6 + 0.5 * cos(6.2832 * (f * 1.4 + vec3(0.0, 0.33, 0.67))), smoothstep(0.2, 0.9, f));
        gl_FragColor = vec4(col * a * uFade, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
}

/**
 * Soft round ground decal: transparent rim, a brighter band near the edge and speckles (embers, petals, motes).
 * Canvas textures are made once per style.
 */
const decalTex = new Map<string, THREE.CanvasTexture>();
export function groundDecal(radius: number, style: 'scorch' | 'garden'): THREE.Mesh {
  let tex = decalTex.get(style);
  if (!tex) {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const ctr = S / 2;
    let seed = style === 'scorch' ? 3 : 11;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    if (style === 'scorch') {
      const grad = g.createRadialGradient(ctr, ctr, 0, ctr, ctr, ctr);
      grad.addColorStop(0, 'rgba(255,210,120,0.55)');
      grad.addColorStop(0.45, 'rgba(255,120,40,0.45)');
      grad.addColorStop(0.8, 'rgba(200,50,20,0.35)');
      grad.addColorStop(1, 'rgba(120,20,10,0)');
      g.fillStyle = grad; g.fillRect(0, 0, S, S);
      // glowing cracks and embers
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 70; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * ctr * 0.9, s = 1 + rnd() * 3;
        g.fillStyle = `rgba(255,${150 + rnd() * 90},${60 + rnd() * 60},${0.4 + rnd() * 0.5})`;
        g.beginPath(); g.arc(ctr + Math.cos(a) * r, ctr + Math.sin(a) * r, s, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = 'rgba(255,190,90,0.5)'; g.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) {
        let a = rnd() * Math.PI * 2, r = ctr * 0.1;
        g.beginPath(); g.moveTo(ctr + Math.cos(a) * r, ctr + Math.sin(a) * r);
        for (let k = 0; k < 6; k++) { a += (rnd() - 0.5) * 0.5; r += ctr * 0.13; g.lineTo(ctr + Math.cos(a) * r, ctr + Math.sin(a) * r); }
        g.stroke();
      }
    } else {
      const grad = g.createRadialGradient(ctr, ctr, 0, ctr, ctr, ctr);
      grad.addColorStop(0, 'rgba(200,255,150,0.28)');
      grad.addColorStop(0.75, 'rgba(140,230,90,0.32)');
      grad.addColorStop(0.9, 'rgba(210,255,140,0.55)');
      grad.addColorStop(1, 'rgba(120,220,80,0)');
      g.fillStyle = grad; g.fillRect(0, 0, S, S);
      g.globalCompositeOperation = 'lighter';
      // drifting motes of light
      for (let i = 0; i < 60; i++) {
        const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * ctr * 0.9;
        g.fillStyle = `rgba(${220 + rnd() * 35},255,${150 + rnd() * 80},${0.3 + rnd() * 0.5})`;
        g.beginPath(); g.arc(ctr + Math.cos(a) * r, ctr + Math.sin(a) * r, 1 + rnd() * 2.5, 0, Math.PI * 2); g.fill();
      }
    }
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    decalTex.set(style, tex);
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: style === 'scorch' ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false, color: style === 'scorch' ? 0xb0b0b0 : 0xffffff, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2), mat);
  m.renderOrder = 1;
  return m;
}

const haloTex = new Map<string, THREE.CanvasTexture>();
/** Additive glow sprite (a soft star of light) — suns, cores, sparkles. */
export function haloSprite(color: string, size: number, intensity = 2): THREE.Sprite {
  let tex = haloTex.get('halo');
  if (!tex) {
    const S = 128, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.18, 'rgba(255,255,255,0.75)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    // four soft rays
    g.globalCompositeOperation = 'lighter';
    for (const [w, h] of [[S, 5], [5, S]]) {
      const r = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      r.addColorStop(0, 'rgba(255,255,255,0.7)'); r.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = r; g.fillRect((S - w) / 2, (S - h) / 2, w, h);
    }
    tex = new THREE.CanvasTexture(c);
    haloTex.set('halo', tex);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(color).multiplyScalar(intensity), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  s.scale.setScalar(size);
  return s;
}
