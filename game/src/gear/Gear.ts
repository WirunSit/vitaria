import type { L10n, WeaponType } from '../core/types';

/**
 * Weapons & Bio-Relics (docs/04 sections 3–4).
 * Pure data + math; effects that react to combat events live in GearEffects.ts.
 */
export type StatKey = 'HP' | 'ATK' | 'DEF' | 'HP%' | 'ATK%' | 'DEF%' | 'BM' | 'ER' | 'CRIT' | 'CDMG' | 'ELEM%' | 'PHYS%' | 'HEAL%';
export type SlotId = 'MEMBRANE' | 'FLAGELLUM' | 'MITOCHONDRION' | 'VACUOLE' | 'NUCLEUS';
export const SLOTS: SlotId[] = ['MEMBRANE', 'FLAGELLUM', 'MITOCHONDRION', 'VACUOLE', 'NUCLEUS'];

export const STAT_TH: Record<StatKey, string> = {
  HP: 'พลังชีวิต', ATK: 'พลังโจมตี', DEF: 'พลังป้องกัน', 'HP%': 'พลังชีวิต', 'ATK%': 'พลังโจมตี', 'DEF%': 'พลังป้องกัน',
  BM: 'ความชำนาญชีวภาพ', ER: 'ฟื้นฟูพลังงาน', CRIT: 'อัตราคริติคอล', CDMG: 'ดาเมจคริติคอล', 'ELEM%': 'โบนัสดาเมจธาตุ',
  'PHYS%': 'โบนัสดาเมจกายภาพ', 'HEAL%': 'โบนัสการรักษา',
};
const PERCENT = new Set<StatKey>(['HP%', 'ATK%', 'DEF%', 'ER', 'CRIT', 'CDMG', 'ELEM%', 'PHYS%', 'HEAL%']);
export function fmtStat(k: StatKey, v: number): string {
  return PERCENT.has(k) ? `${v.toFixed(1)}%` : Math.round(v).toLocaleString();
}

export interface WeaponDef {
  id: string;
  name: L10n;
  type: WeaponType;
  rarity: 3 | 4 | 5;
  atk: [number, number];
  sub: { stat: StatKey; v: [number, number] };
  passive: { name: L10n; desc: L10n; effect: string; values: number[] };
  image?: string;
  /** Pixel points on the 256px weapon image: where the hand grips, the tip, and (polearm/bow) the far end. */
  hold?: { grip: [number, number]; tip: [number, number]; butt?: [number, number] };
  lore: L10n;
}
export interface WeaponInst { uid: string; id: string; level: number; asc: number; exp: number; refine: number }

export interface RelicSetDef { id: string; name: L10n; bonus2: L10n; bonus4: L10n; lore: L10n }
export interface RelicData {
  slots: { id: SlotId; name: L10n; mains: StatKey[] }[];
  mainValues: Record<string, [number, number]>;
  subRolls: Record<string, number>;
  rarityScale: Record<string, number>;
  maxLevel: Record<string, number>;
  sets: RelicSetDef[];
}
export interface RelicInst {
  uid: string; set: string; slot: SlotId; rarity: 3 | 4 | 5; level: number; exp: number;
  main: StatKey; subs: { stat: StatKey; value: number }[];
}

export interface GearSave { weapons: WeaponInst[]; relics: RelicInst[]; nextUid: number }
export function newGear(): GearSave { return { weapons: [], relics: [], nextUid: 1 }; }

// ------------------------------------------------------------------ registry
export const gearData = {
  weapons: new Map<string, WeaponDef>(),
  relics: null as unknown as RelicData,
  sets: new Map<string, RelicSetDef>(),
};
export function loadGear(weapons: WeaponDef[], relics: RelicData) {
  for (const w of weapons) gearData.weapons.set(w.id, w);
  gearData.relics = relics;
  for (const s of relics.sets) gearData.sets.set(s.id, s);
}

export const STARTER_WEAPON: Record<WeaponType, string> = {
  SWORD: 'TRAINING_SWORD', CLAYMORE: 'KERATIN_GREATSWORD', POLEARM: 'TRAINING_POLEARM', BOW: 'CILIA_BOW', CATALYST: 'ENZYME_CODEX',
};
/** Signature weapons handed to characters when they join (docs/04 table 3.2). */
export const SIGNATURE_ON_JOIN: Record<string, string> = { MITORA: 'ATP_LANTERN', CHLOREN: 'LIVING_BAMBOO_BOW' };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ------------------------------------------------------------------ weapons
export const WEAPON_CAPS = [20, 40, 50, 60, 70, 80, 90];
export function weaponCap(w: WeaponInst) { return WEAPON_CAPS[Math.min(w.asc, 6)]; }
export function weaponExpToNext(level: number, rarity: number) { return Math.round((120 + level * 60) * (rarity === 5 ? 1.5 : rarity === 4 ? 1.2 : 1)); }
export const ORE_EXP: Record<string, number> = { ORE_CALCIUM: 400, ORE_PHOSPHATE: 2000 };
export const FODDER_WEAPON_EXP: Record<number, number> = { 3: 400, 4: 1200, 5: 3000 };

export function weaponAtk(w: WeaponInst): number {
  const d = gearData.weapons.get(w.id)!;
  return Math.round(lerp(d.atk[0], d.atk[1], (w.level - 1) / 89) * (1 + 0.06 * w.asc));
}
export function weaponSub(w: WeaponInst): { stat: StatKey; value: number } {
  const d = gearData.weapons.get(w.id)!;
  return { stat: d.sub.stat, value: lerp(d.sub.v[0], d.sub.v[1], (w.level - 1) / 89) };
}
/** Passive value scaled by refinement (R1 = 100%, each rank +25%). */
export function passiveValue(w: WeaponInst, i: number): number {
  const d = gearData.weapons.get(w.id)!;
  return d.passive.values[i] * (1 + 0.25 * (w.refine - 1));
}
export function passiveText(w: WeaponInst): string {
  const d = gearData.weapons.get(w.id)!;
  return d.passive.desc.th.replace(/\{(\d)\}/g, (_, i) => String(Math.round(passiveValue(w, Number(i)) * 10) / 10));
}

/** Adds EXP and levels the weapon up to its current cap. Returns levels gained. */
export function addWeaponExp(w: WeaponInst, exp: number): number {
  const d = gearData.weapons.get(w.id)!;
  const before = w.level;
  w.exp += exp;
  while (w.level < weaponCap(w) && w.exp >= weaponExpToNext(w.level, d.rarity)) {
    w.exp -= weaponExpToNext(w.level, d.rarity);
    w.level++;
  }
  if (w.level >= weaponCap(w)) w.exp = Math.min(w.exp, weaponExpToNext(w.level, d.rarity));
  return w.level - before;
}

// ------------------------------------------------------------------ relics
function rnd<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)]; }

export function relicMax(r: RelicInst) { return gearData.relics.maxLevel[String(r.rarity)]; }
export function relicMainValue(r: RelicInst): number {
  const v = gearData.relics.mainValues[r.main];
  return lerp(v[0], v[1], r.level / relicMax(r)) * gearData.relics.rarityScale[String(r.rarity)];
}
export function relicExpToNext(r: RelicInst) { return Math.round((300 + r.level * 220) * (r.rarity === 5 ? 1.4 : r.rarity === 4 ? 1.1 : 0.8)); }
export const RELIC_FODDER_EXP: Record<number, number> = { 3: 420, 4: 1260, 5: 3000 };
export const GROWTH_FACTOR_EXP = 1000;

function subRoll(stat: StatKey, rarity: number): number {
  const base = gearData.relics.subRolls[stat] * gearData.relics.rarityScale[String(rarity)];
  return base * rnd([0.7, 0.8, 0.9, 1.0]);
}

export function rollRelic(uid: string, rarity: 3 | 4 | 5, set?: string, slot?: SlotId): RelicInst {
  const D = gearData.relics;
  const s = set ?? rnd(D.sets).id;
  const sl = slot ?? rnd(SLOTS);
  const slotDef = D.slots.find((x) => x.id === sl)!;
  const main = rnd(slotDef.mains);
  const pool = Object.keys(D.subRolls).filter((k) => k !== main) as StatKey[];
  const count = rarity === 5 ? (Math.random() < 0.25 ? 4 : 3) : rarity === 4 ? (Math.random() < 0.25 ? 3 : 2) : 1;
  const subs: RelicInst['subs'] = [];
  while (subs.length < count) {
    const st = rnd(pool);
    if (subs.some((x) => x.stat === st)) continue;
    subs.push({ stat: st, value: subRoll(st, rarity) });
  }
  return { uid, set: s, slot: sl, rarity, level: 0, exp: 0, main, subs };
}

/** Adds EXP; every 4 levels a new substat appears (or a random one grows). Returns log lines. */
export function addRelicExp(r: RelicInst, exp: number): string[] {
  const log: string[] = [];
  r.exp += exp;
  while (r.level < relicMax(r) && r.exp >= relicExpToNext(r)) {
    r.exp -= relicExpToNext(r);
    r.level++;
    if (r.level % 4 === 0) {
      const pool = (Object.keys(gearData.relics.subRolls) as StatKey[]).filter((k) => k !== r.main && !r.subs.some((x) => x.stat === k));
      if (r.subs.length < 4 && pool.length) {
        const st = rnd(pool);
        r.subs.push({ stat: st, value: subRoll(st, r.rarity) });
        log.push(`+ ${STAT_TH[st]}${st.endsWith('%') ? '%' : ''} ใหม่`);
      } else {
        const sub = rnd(r.subs);
        sub.value += subRoll(sub.stat, r.rarity);
        log.push(`↑ ${STAT_TH[sub.stat]}`);
      }
    }
  }
  if (r.level >= relicMax(r)) r.exp = 0;
  return log;
}

export function relicName(r: RelicInst): string {
  const set = gearData.sets.get(r.set);
  const slot = gearData.relics.slots.find((s) => s.id === r.slot);
  return `${slot?.name.th ?? r.slot} · ${set?.name.th ?? r.set}`;
}
export function relicImage(r: RelicInst) { return `assets/relics/RLC_${r.set}_${r.slot}.png`; }
export function weaponImage(id: string) {
  const d = gearData.weapons.get(id);
  return `assets/weapons/${d?.image ?? `WPN_${id}`}.png`;
}

// ------------------------------------------------------------------ aggregation
export interface GearStats {
  flat: { HP: number; ATK: number; DEF: number };
  pct: { HP: number; ATK: number; DEF: number };
  BM: number; ER: number; CRIT: number; CDMG: number; ELEM: number; PHYS: number; HEAL: number;
  sets: Record<string, number>;
}

export function emptyGearStats(): GearStats {
  return { flat: { HP: 0, ATK: 0, DEF: 0 }, pct: { HP: 0, ATK: 0, DEF: 0 }, BM: 0, ER: 0, CRIT: 0, CDMG: 0, ELEM: 0, PHYS: 0, HEAL: 0, sets: {} };
}

export function addStat(g: GearStats, k: StatKey, v: number) {
  switch (k) {
    case 'HP': g.flat.HP += v; break;
    case 'ATK': g.flat.ATK += v; break;
    case 'DEF': g.flat.DEF += v; break;
    case 'HP%': g.pct.HP += v / 100; break;
    case 'ATK%': g.pct.ATK += v / 100; break;
    case 'DEF%': g.pct.DEF += v / 100; break;
    case 'BM': g.BM += v; break;
    case 'ER': g.ER += v / 100; break;
    case 'CRIT': g.CRIT += v / 100; break;
    case 'CDMG': g.CDMG += v / 100; break;
    case 'ELEM%': g.ELEM += v / 100; break;
    case 'PHYS%': g.PHYS += v / 100; break;
    case 'HEAL%': g.HEAL += v / 100; break;
  }
}

export function relicStats(relics: RelicInst[]): GearStats {
  const g = emptyGearStats();
  for (const r of relics) {
    addStat(g, r.main, relicMainValue(r));
    for (const s of r.subs) addStat(g, s.stat, s.value);
    g.sets[r.set] = (g.sets[r.set] ?? 0) + 1;
  }
  // 2-piece bonuses (static)
  if ((g.sets.PioneerProkaryote ?? 0) >= 2) g.pct.ATK += 0.18;
  if ((g.sets.ComplexEukaryote ?? 0) >= 2) g.ELEM += 0.15;
  if ((g.sets.SturdyPlantCell ?? 0) >= 2) g.pct.DEF += 0.3;
  if ((g.sets.StemCellOrigin ?? 0) >= 2) g.HEAL += 0.15;
  return g;
}
