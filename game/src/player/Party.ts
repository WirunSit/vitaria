import type { CharacterDef, Element } from '../core/types';
import type { CharSave } from '../core/Save';
import { addStat, relicStats, weaponAtk, weaponSub, passiveValue, gearData, type RelicInst, type WeaponInst, type SlotId } from '../gear/Gear';

export interface Stats {
  hp: number; atk: number; def: number;
  critRate: number; critDmg: number; er: number; bm: number;
  elemBonus: number; // % dmg bonus for own element
  physBonus: number;
  healBonus: number;
}

/** Resolves gear uids → instances (set by Game once the save is loaded). */
export const gearLookup: { weapon: (uid: string) => WeaponInst | undefined; relic: (uid: string) => RelicInst | undefined } = {
  weapon: () => undefined,
  relic: () => undefined,
};

export type BuffStat = 'critRate' | 'atkPct' | 'atkFlat' | 'dr' | 'hydroBonus' | 'pyroBonus' | 'dmgBonus' | 'normalDmg' | 'elemDmg' | 'bm';
interface Buff { id: string; stat: BuffStat; v: number; t: number; stacks?: number }

export const ASC_CAPS = [20, 40, 50, 60, 70, 80, 90];
/** Talent level → additive damage bonus (≈ Genshin multiplier growth). */
const TALENT_BONUS = [0, 0.075, 0.15, 0.25, 0.35, 0.45, 0.6, 0.75, 0.9, 1.05];
export function talentBonus(lv: number) { return TALENT_BONUS[Math.max(1, Math.min(10, lv)) - 1]; }
/** Max talent level for an ascension phase (vertical slice: phase 0 → 3, phase 1 → 6). */
export function talentCap(asc: number) { return Math.min(10, 3 + asc * 3); }
/** Cost to raise a talent from `lv` to `lv + 1`: [book tier, count, glucose]. */
export function talentCost(lv: number): [number, number, number] {
  const table: [number, number, number][] = [[1, 3, 12500], [2, 2, 17500], [2, 4, 25000], [2, 6, 30000], [2, 9, 37500], [3, 4, 120000], [3, 6, 260000], [3, 12, 450000], [3, 16, 700000]];
  return table[Math.max(1, Math.min(9, lv)) - 1];
}
export function levelCap(asc: number) { return ASC_CAPS[Math.min(asc, 6)]; }
export function expToNext(lv: number) { return 200 + lv * 120; }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Runtime state of one character in the party. */
export class PartyMember {
  hp: number;
  energy = 0;
  cdE = 0;
  cdQ = 0;
  atpStacks = 0;
  normalHits = 0;
  bmBuff = 0;
  bmBuffT = 0;
  /** Neuros: depolarization stacks (0–100) and refractory timer */
  stacks = 0;
  refractoryT = 0;
  /** Multi-use skills (Neuros E): remaining charges inside an open window */
  charges = 0;
  windowT = 0;
  private buffs: Buff[] = [];

  constructor(public def: CharacterDef, public save: CharSave) {
    this.hp = this.stats().hp * (save.hpFrac ?? 1);
  }

  get id() { return this.def.id; }
  get element(): Element { return this.def.element; }
  get level() { return this.save.level; }
  get alive() { return this.hp > 0; }
  /** Gene Sequence (constellation) level 0–6. */
  get cons() { return this.save.geneSeq ?? 0; }
  /** Passive talents unlock at the first Differentiation (simplified for the vertical slice). */
  get passives() { return this.save.ascension >= 1; }
  /** 0 = normal attack, 1 = elemental skill, 2 = burst */
  talent(i: 0 | 1 | 2): number { return this.save.talents?.[i] ?? 1; }

  addBuff(id: string, stat: BuffStat, v: number, t: number) {
    const b = this.buffs.find((x) => x.id === id);
    if (b) { b.v = v; b.t = t; } else this.buffs.push({ id, stat, v, t });
  }
  /** Stacking buff: each call adds one stack (up to max) and refreshes the timer. */
  addStackBuff(id: string, stat: BuffStat, per: number, max: number, t: number) {
    const b = this.buffs.find((x) => x.id === id);
    if (b) { b.stacks = Math.min(max, (b.stacks ?? 1) + 1); b.v = per * b.stacks; b.t = t; }
    else this.buffs.push({ id, stat, v: per, t, stacks: 1 });
  }

  weaponInst(): WeaponInst | undefined { return this.save.weapon ? gearLookup.weapon(this.save.weapon) : undefined; }
  relicInsts(): RelicInst[] {
    const out: RelicInst[] = [];
    for (const uid of Object.values(this.save.relics ?? {})) {
      const r = uid ? gearLookup.relic(uid) : undefined;
      if (r) out.push(r);
    }
    return out;
  }
  relicIn(slot: SlotId): RelicInst | undefined {
    const uid = this.save.relics?.[slot];
    return uid ? gearLookup.relic(uid) : undefined;
  }
  setCount(set: string): number { return this.relicInsts().filter((r) => r.set === set).length; }
  /** The equipped weapon's passive effect id (or null). */
  weaponEffect(): string | null {
    const w = this.weaponInst();
    return w ? gearData.weapons.get(w.id)?.passive.effect ?? null : null;
  }

  buff(stat: BuffStat): number {
    let s = 0;
    for (const b of this.buffs) if (b.stat === stat) s += b.v;
    return s;
  }

  stats(isDay = true): Stats {
    const lv = this.save.level;
    const t = (lv - 1) / 89;
    const ascT = this.save.ascension / 6;
    const b = this.def.base;
    const w = this.weaponInst();
    const wAtk = w ? weaponAtk(w) : lerp(39, 401, t);
    const s: Stats = {
      hp: Math.round(lerp(b.hp1, b.hp90, t) * (1 + 0.08 * this.save.ascension)),
      atk: Math.round((lerp(b.atk1, b.atk90, t) * (1 + 0.08 * this.save.ascension) + wAtk)),
      def: Math.round(lerp(b.def1, b.def90, t) * (1 + 0.08 * this.save.ascension)),
      critRate: 0.05, critDmg: 0.5, er: 1, bm: 0, elemBonus: 0, physBonus: 0, healBonus: 0,
    };
    const asc = this.def.ascStat;
    if (asc && this.save.ascension >= 2) {
      const v = asc.max * ascT;
      if (asc.stat === 'ATK%') s.atk = Math.round(s.atk * (1 + v / 100));
      if (asc.stat === 'HP%') s.hp = Math.round(s.hp * (1 + v / 100));
      if (asc.stat === 'CRIT') s.critRate += v / 100;
      if (asc.stat === 'ER') s.er += v / 100;
      if (asc.stat === 'BM') s.bm += v;
      if (asc.stat === 'ELEM%') s.elemBonus += v / 100;
    }
    // passives & gene sequences
    const id = this.def.id;
    if (id === 'MITORA') {
      s.elemBonus += this.atpStacks * 0.005;
      if (this.cons >= 4 && this.hp !== undefined && this.hp < s.hp * 0.5) s.atk = Math.round(s.atk * 1.2);
    }
    if (id === 'CHLOREN' && isDay) s.bm += 60;
    if (id === 'HEMA' && this.passives) s.hp = Math.round(s.hp * 1.15);
    if (id === 'NEUROS' && this.passives) s.elemBonus += Math.floor(this.stacks / 10) * 0.02;
    // ---- weapon + Bio-Relics
    const g = relicStats(this.relicInsts());
    if (w) {
      const sub = weaponSub(w);
      addStat(g, sub.stat, sub.value);
      const eff = gearData.weapons.get(w.id)?.passive.effect;
      if (eff === 'TWIN_HELIX') g.pct.ATK += passiveValue(w, 0) / 100;
      if (eff === 'BLOODLINE') g.pct.HP += passiveValue(w, 0) / 100;
      if (eff === 'AXON' && this.def.element === 'ELECTRO') g.ELEM += passiveValue(w, 0) / 100;
    }
    s.hp = Math.round(s.hp * (1 + g.pct.HP) + g.flat.HP);
    if (w && gearData.weapons.get(w.id)?.passive.effect === 'ATK_HIGH_HP' && this.hp !== undefined && this.hp > s.hp * 0.9) g.pct.ATK += passiveValue(w, 0) / 100;
    s.atk = Math.round(s.atk * (1 + g.pct.ATK + this.buff('atkPct')) + g.flat.ATK + this.buff('atkFlat'));
    s.def = Math.round(s.def * (1 + g.pct.DEF) + g.flat.DEF);
    s.critRate += g.CRIT + this.buff('critRate');
    s.critDmg += g.CDMG;
    s.er += g.ER;
    s.bm += g.BM + this.bmBuff + this.buff('bm');
    s.elemBonus += g.ELEM + this.buff('elemDmg');
    s.physBonus += g.PHYS;
    s.healBonus += g.HEAL;
    return s;
  }

  update(dt: number) {
    if (this.cdE > 0) this.cdE = Math.max(0, this.cdE - dt);
    if (this.cdQ > 0) this.cdQ = Math.max(0, this.cdQ - dt);
    if (this.bmBuffT > 0) {
      this.bmBuffT -= dt;
      if (this.bmBuffT <= 0) this.bmBuff = 0;
    }
    if (this.refractoryT > 0) this.refractoryT -= dt;
    if (this.windowT > 0) {
      this.windowT -= dt;
      if (this.windowT <= 0 && this.charges > 0) { this.charges = 0; this.cdE = 9; }
    }
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      this.buffs[i].t -= dt;
      if (this.buffs[i].t <= 0) this.buffs.splice(i, 1);
    }
  }

  heal(amount: number) {
    const max = this.stats().hp;
    const before = this.hp;
    if (this.hp <= 0) return 0;
    this.hp = Math.min(max, this.hp + amount);
    return this.hp - before;
  }

  addEnergy(n: number) {
    const s = this.stats();
    this.energy = Math.min(this.def.burstCost, this.energy + n * s.er);
  }

  /** Neuros A1: gain depolarization stacks unless refractory. */
  addStacks(n: number) {
    if (this.refractoryT > 0) return;
    this.stacks = Math.min(100, this.stacks + n);
  }

  get burstReady() { return this.energy >= this.def.burstCost && this.cdQ <= 0; }

  persist() {
    this.save.hpFrac = Math.max(0, this.hp / this.stats().hp);
  }
}
