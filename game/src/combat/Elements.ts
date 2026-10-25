import type { Element } from '../core/types';

/** Bio-reaction catalogue (see docs/02_ธาตุและระบบต่อสู้.md). */
export type ReactionId =
  | 'THERMOREGULATION' | 'DENATURATION' | 'FEVER_SHOCK' | 'OXIDATION' | 'CRYOSTASIS'
  | 'ELECTROLYTE' | 'GERMINATION' | 'SYNAPTIC_BLOCK' | 'CATALYSIS' | 'ENZYME_SURGE' | 'BRANCHING'
  | 'DIFFUSION' | 'MEMBRANE_SHIELD' | 'LYSIS';

export const REACTION_INFO: Record<ReactionId, { th: string; en: string; color: string; codex: string }> = {
  THERMOREGULATION: { th: 'ระเหยคลายร้อน', en: 'Thermoregulation', color: '#ffb36b', codex: 'CDX_R_THERMO' },
  DENATURATION: { th: 'เสียสภาพ', en: 'Denaturation', color: '#ffc28a', codex: 'CDX_R_DENATURE' },
  FEVER_SHOCK: { th: 'ไข้ช็อก', en: 'Fever Shock', color: '#ff7aa8', codex: 'CDX_R_FEVER' },
  OXIDATION: { th: 'ออกซิเดชัน', en: 'Oxidation', color: '#ff8a3a', codex: 'CDX_R_OXIDATION' },
  CRYOSTASIS: { th: 'ภาวะหยุดนิ่ง', en: 'Cryostasis', color: '#9fe3f0', codex: 'CDX_R_CRYOSTASIS' },
  ELECTROLYTE: { th: 'นำไฟฟ้าอิเล็กโทรไลต์', en: 'Electrolyte Conduction', color: '#c08bff', codex: 'CDX_R_ELECTROLYTE' },
  GERMINATION: { th: 'การงอก', en: 'Germination', color: '#8be06a', codex: 'CDX_R_GERMINATION' },
  SYNAPTIC_BLOCK: { th: 'ยับยั้งไซแนปส์', en: 'Synaptic Block', color: '#b8b0ff', codex: 'CDX_R_SYNAPTIC' },
  CATALYSIS: { th: 'เร่งปฏิกิริยา', en: 'Catalysis', color: '#a8e05a', codex: 'CDX_R_CATALYSIS' },
  ENZYME_SURGE: { th: 'เอนไซม์กระตุ้น', en: 'Enzyme Surge', color: '#c08bff', codex: 'CDX_R_CATALYSIS' },
  BRANCHING: { th: 'แตกแขนง', en: 'Branching Growth', color: '#8bc34a', codex: 'CDX_R_CATALYSIS' },
  DIFFUSION: { th: 'การแพร่', en: 'Diffusion', color: '#5fd4b0', codex: 'CDX_R_DIFFUSION' },
  MEMBRANE_SHIELD: { th: 'เยื่อหุ้มป้องกัน', en: 'Membrane Shield', color: '#e8b54a', codex: 'CDX_R_MEMBRANE' },
  LYSIS: { th: 'สลายเซลล์', en: 'Lysis', color: '#dff6ff', codex: 'CDX_R_LYSIS' },
};

export interface Aura { element: Element; units: number; decay: number }

/** Things that can carry an elemental aura. */
export interface AuraHolder {
  aura: Aura | null;
  frozen: number;     // seconds remaining
  catalyzed: number;  // seconds remaining
  permanentElement?: Element | null; // elemental slimes re-apply their own element
}

export interface ReactionResult {
  reaction?: ReactionId;
  /** amplifying multiplier (Thermoregulation / Denaturation) */
  amp?: number;
  /** transformative damage: coefficient × level base, of element */
  transform?: { coef: number; element: Element; aoe: number };
  /** the element absorbed by Diffusion / Membrane Shield */
  absorbed?: Element;
  /** flat bonus multiplier of level base (Catalysis family) */
  flatCoef?: number;
  freeze?: number;
  burn?: boolean;
  electrolyte?: boolean;
  seed?: boolean;
  resDown?: boolean;
}

const AURA_TAX = 0.8;
const isAuraElement = (e: Element) => e !== 'ANEMO' && e !== 'GEO' && e !== 'PHYSICAL';

export function decayAura(h: AuraHolder, dt: number) {
  if (h.aura) {
    h.aura.units -= h.aura.decay * dt;
    if (h.aura.units <= 0) h.aura = null;
  }
  if (h.frozen > 0) h.frozen = Math.max(0, h.frozen - dt);
  if (h.catalyzed > 0) h.catalyzed = Math.max(0, h.catalyzed - dt);
}

function setAura(h: AuraHolder, el: Element, units: number) {
  const u = units * AURA_TAX;
  const dur = 2.5 * units + 7;
  if (h.aura && h.aura.element === el) {
    h.aura.units = Math.max(h.aura.units, u);
  } else {
    h.aura = { element: el, units: u, decay: u / dur };
  }
}

function consume(h: AuraHolder, amount: number) {
  if (!h.aura) return;
  h.aura.units -= amount;
  if (h.aura.units <= 0.01) h.aura = null;
}

/**
 * Apply `el` with `units` gauge onto holder. Mutates aura state and returns what reaction happened.
 * `heavy` = blunt/heavy attack (claymore, plunge) for Lysis.
 */
export function applyElement(h: AuraHolder, el: Element, units: number, heavy = false): ReactionResult {
  // Lysis: frozen target hit by Geo or heavy physical
  if (h.frozen > 0 && (el === 'GEO' || (heavy && el === 'PHYSICAL'))) {
    h.frozen = 0;
    if (h.aura?.element === 'CRYO') consume(h, 0.5);
    return { reaction: 'LYSIS', transform: { coef: 1.5, element: 'PHYSICAL', aoe: 0 } };
  }
  if (el === 'PHYSICAL') return {};

  // Catalyzed bonuses
  if (h.catalyzed > 0 && (el === 'ELECTRO' || el === 'DENDRO')) {
    const res: ReactionResult = el === 'ELECTRO' ? { reaction: 'ENZYME_SURGE', flatCoef: 1.15 } : { reaction: 'BRANCHING', flatCoef: 1.25 };
    return res;
  }

  const a = h.aura;
  if (el === 'ANEMO' || el === 'GEO') {
    if (a && (a.element === 'PYRO' || a.element === 'HYDRO' || a.element === 'ELECTRO' || a.element === 'CRYO')) {
      const absorbed = a.element;
      consume(h, 0.5 * units);
      if (el === 'ANEMO') return { reaction: 'DIFFUSION', absorbed, transform: { coef: 0.6, element: absorbed, aoe: 5 } };
      return { reaction: 'MEMBRANE_SHIELD', absorbed };
    }
    return {};
  }

  if (!a) {
    if (isAuraElement(el)) setAura(h, el, units);
    return {};
  }
  if (a.element === el) {
    setAura(h, el, units);
    return {};
  }

  const pair = (x: Element, y: Element) => (a.element === x && el === y) || (a.element === y && el === x);

  if (pair('PYRO', 'HYDRO')) {
    const strong = el === 'HYDRO';
    consume(h, strong ? 2 * units : 0.5 * units);
    return { reaction: 'THERMOREGULATION', amp: strong ? 2 : 1.5 };
  }
  if (pair('PYRO', 'CRYO')) {
    const strong = el === 'PYRO';
    consume(h, strong ? 2 * units : 0.5 * units);
    return { reaction: 'DENATURATION', amp: strong ? 2 : 1.5 };
  }
  if (pair('PYRO', 'ELECTRO')) {
    consume(h, units);
    return { reaction: 'FEVER_SHOCK', transform: { coef: 2.0, element: 'PYRO', aoe: 3.5 } };
  }
  if (pair('PYRO', 'DENDRO')) {
    consume(h, units * 0.5);
    return { reaction: 'OXIDATION', burn: true };
  }
  if (pair('HYDRO', 'CRYO')) {
    consume(h, units);
    h.frozen = Math.max(h.frozen, 2 + units * 1.5);
    return { reaction: 'CRYOSTASIS', freeze: 2 + units * 1.5 };
  }
  if (pair('HYDRO', 'ELECTRO')) {
    // both co-exist briefly in the original; we simplify to a 3-tick conduction
    consume(h, 0.4 * units);
    return { reaction: 'ELECTROLYTE', electrolyte: true };
  }
  if (pair('HYDRO', 'DENDRO')) {
    consume(h, units * 0.5);
    return { reaction: 'GERMINATION', seed: true };
  }
  if (pair('ELECTRO', 'CRYO')) {
    consume(h, units);
    return { reaction: 'SYNAPTIC_BLOCK', transform: { coef: 0.5, element: 'CRYO', aoe: 3 }, resDown: true };
  }
  if (pair('ELECTRO', 'DENDRO')) {
    consume(h, units);
    h.catalyzed = 12;
    return { reaction: 'CATALYSIS' };
  }
  setAura(h, el, units);
  return {};
}

/** Approximate per-level base for transformative reactions. */
const LEVEL_BASE: [number, number][] = [[1, 17], [10, 34], [20, 80], [30, 136], [40, 207], [50, 323], [60, 492], [70, 765], [80, 1077], [90, 1447]];
export function levelBase(lv: number): number {
  for (let i = 1; i < LEVEL_BASE.length; i++) {
    const [l1, v1] = LEVEL_BASE[i - 1], [l2, v2] = LEVEL_BASE[i];
    if (lv <= l2) return v1 + ((v2 - v1) * (lv - l1)) / (l2 - l1);
  }
  return 1447;
}

export function emAmp(bm: number) { return (2.78 * bm) / (bm + 1400); }
export function emTransform(bm: number) { return (16 * bm) / (bm + 2000); }
