import type { PartyMember } from '../player/Party';
import type { Enemy } from '../enemies/Enemy';
import type { ReactionId } from '../combat/Elements';
import { passiveValue } from './Gear';

/**
 * Event-driven weapon passives and 4-piece Bio-Relic set bonuses.
 * Static stat bonuses (2-piece sets, ATK/HP passives) are applied in PartyMember.stats().
 */
let isDay: () => boolean = () => true;
export function setDayProvider(fn: () => boolean) { isDay = fn; }

const cooldowns = new Map<string, number>();
let now = 0;
export function tickGear(dt: number) { now += dt; }
function ready(key: string, cd: number) {
  const t = cooldowns.get(key) ?? -999;
  if (now - t < cd) return false;
  cooldowns.set(key, now);
  return true;
}

function pv(m: PartyMember, i: number) {
  const w = m.weaponInst();
  return w ? passiveValue(w, i) : 0;
}

const RANGED = new Set(['CATALYST', 'BOW']);
const DENDRO_REACTIONS = new Set<ReactionId>(['OXIDATION', 'GERMINATION', 'CATALYSIS', 'BRANCHING']);

/** Extra damage bonus / crit rate for one hit. */
export function hitModifiers(m: PartyMember, kind: 'normal' | 'charged' | undefined, e: Enemy): { dmg: number; crit: number } {
  let dmg = 0, crit = 0;
  const eff = m.weaponEffect();
  if (kind === 'normal') dmg += m.buff('normalDmg');
  if (kind === 'charged' && eff === 'CHARGED_DMG') dmg += pv(m, 0) / 100;
  if ((kind === 'normal' || kind === 'charged') && RANGED.has(m.def.weapon) && m.setCount('PioneerProkaryote') >= 4) dmg += 0.35;
  if (eff === 'DMG_HIGH_HP_ENEMY' && e.hp > e.maxHp * 0.5) dmg += pv(m, 0) / 100;
  if (eff === 'TWIN_HELIX' && (e.aura?.element === 'CRYO' || e.frozen > 0)) crit += pv(m, 1) / 100;
  return { dmg, crit };
}

/** Skill damage bonus from gear (added into the kit's skill multiplier helper). */
export function skillGearBonus(m: PartyMember): number {
  return m.weaponEffect() === 'DAY_SKILL_DMG' && isDay() ? pv(m, 0) / 100 : 0;
}

export function onHit(m: PartyMember, kind: 'normal' | 'charged' | undefined) {
  const eff = m.weaponEffect();
  if (eff === 'HIT_STACK_ATK') m.addStackBuff('w_collagen', 'atkPct', pv(m, 0) / 100, 4, 6);
  if (eff === 'NORMAL_STACK_PYRO' && kind === 'normal') m.addStackBuff('w_atp', 'pyroBonus', pv(m, 0) / 100, 4, 6);
}

export function onKill(m: PartyMember | null | undefined, e: Enemy) {
  if (!m) return;
  if (m.weaponEffect() === 'KILL_BACTERIA_ATK' && e.isBacteria) m.addBuff('w_lysozyme', 'atkPct', pv(m, 0) / 100, 10);
}

export function onReaction(m: PartyMember, r: ReactionId) {
  const eff = m.weaponEffect();
  if (eff === 'REACTION_ATK') m.addBuff('w_enzyme', 'atkPct', pv(m, 0) / 100, 10);
  if (eff === 'DENDRO_REACTION_BM' && DENDRO_REACTIONS.has(r)) m.addStackBuff('w_spore', 'bm', pv(m, 0), 2, 10);
}

export function onSkill(m: PartyMember, kind: 'E' | 'Q', party: PartyMember[]) {
  const eff = m.weaponEffect();
  if (kind === 'E') {
    if (eff === 'AXON') m.addBuff('w_axon', 'normalDmg', pv(m, 1) / 100, 6);
    if (eff === 'SKILL_NORMAL_DMG') m.addBuff('w_flagellum', 'normalDmg', pv(m, 0) / 100, 6);
  } else {
    if (eff === 'BURST_REFUND' && ready(`hormone_${m.id}`, 12)) m.addEnergy(pv(m, 0));
    if (m.setCount('ComplexEukaryote') >= 4) for (const p of party) p.addBuff('set_complex', 'elemDmg', 0.2, 12);
  }
}

export function onHeal(healer: PartyMember, party: PartyMember[]) {
  if (healer.weaponEffect() === 'BLOODLINE') healer.addBuff('w_bloodline', 'atkFlat', healer.stats().hp * pv(healer, 1) / 100, 6);
  if (healer.setCount('StemCellOrigin') >= 4) for (const p of party) { p.addBuff('set_stem_bm', 'bm', 80, 8); p.addBuff('set_stem_cr', 'critRate', 0.1, 8); }
}

/** Returns shield HP to grant when switching in (0 = none). */
export function onSwitchIn(m: PartyMember): number {
  if (m.weaponEffect() === 'SWITCH_SHIELD' && ready(`keratin_${m.id}`, 30)) return m.stats().hp * pv(m, 0) / 100;
  return 0;
}

export function shieldMult(m: PartyMember | null): number {
  return m && m.setCount('SturdyPlantCell') >= 4 ? 1.35 : 1;
}

/** Continuous effects (call every frame). */
export function gearFrame(party: PartyMember[], shielded: boolean) {
  if (!shielded) return;
  for (const p of party) if (p.setCount('SturdyPlantCell') >= 4) p.addBuff('set_sturdy', 'atkPct', 0.2, 0.25);
}
