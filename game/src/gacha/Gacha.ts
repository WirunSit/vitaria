import type { BannerState, GachaSave } from '../core/Save';

/**
 * Gene Wish — gacha rules (docs/04 section 5). No real money: currency is earned by playing/learning.
 *  - 5★ base 1.2%, soft pity from pull 51 (+8%/pull), hard pity 60
 *  - 4★ base 5.1%, guaranteed at least one every 10 pulls
 *  - Featured banner: 50/50 for the featured 5★; losing guarantees it next time
 */
export type BannerId = 'novice' | 'standard' | 'featured';

export interface BannerDef {
  id: BannerId;
  name: string;
  subtitle: string;
  featured5: string[];
  pool5: string[];
  pool4: string[];
  cost1: number;
  cost10: number;
  maxPulls?: number;
  tenOnly?: boolean;
  color: string;
}

export const BASE5 = 0.012;
export const BASE4 = 0.051;
export const SOFT_PITY = 50;
export const HARD_PITY = 60;
export const PITY4 = 10;
export const SEED_PRICE = 160;          // Insight Crystals per Gene Seed
export const STARGLITTER_PER_SEED = 5;  // Starglitter exchange

export const POOL4 = ['MITORA', 'ALVI', 'CHLOREN'];
/** ★4 / ★3 weapons in the character banners (★4 results are 50% character / 50% weapon). */
export const POOL4_WEAPONS = ['LYSOZYME_BLADE', 'COLLAGEN_GREATSWORD', 'FLAGELLUM_SPEAR', 'SPORE_BOW', 'LIVING_BAMBOO_BOW', 'ATP_LANTERN', 'HORMONE_ORB'];
export const POOL3_WEAPONS = ['TRAINING_SWORD', 'KERATIN_GREATSWORD', 'TRAINING_POLEARM', 'CILIA_BOW', 'ENZYME_CODEX'];

export const BANNERS: BannerDef[] = [
  { id: 'novice', name: 'พรของนักเรียนใหม่', subtitle: 'สุ่ม 10 ครั้ง ลด 20% · การันตี ★5 ฮีม่า ภายใน 20 ครั้ง', featured5: ['HEMA'], pool5: ['HEMA'], pool4: POOL4, cost1: 1, cost10: 8, maxPulls: 20, tenOnly: true, color: '#3da5f4' },
  { id: 'featured', name: 'ศักย์ทำงานแห่งสายฟ้า', subtitle: 'โอกาสพิเศษ: ★5 นิวรอส (Electro)', featured5: ['NEUROS'], pool5: ['HEMA', 'HELIX'], pool4: POOL4, cost1: 1, cost10: 10, color: '#a65fe0' },
  { id: 'standard', name: 'คลังพันธุกรรมถาวร', subtitle: '★5: ฮีม่า · เฮลิกซ์', featured5: [], pool5: ['HEMA', 'HELIX'], pool4: POOL4, cost1: 1, cost10: 10, color: '#e8c468' },
];

/** 3★ results are materials until the weapon system exists. */
export const POOL3: { id: string; n: number; w: number }[] = [
  { id: 'EXP_MONO', n: 2, w: 5 },
  { id: 'GLUCOSE', n: 1500, w: 4 },
  { id: 'MAT_BAC_SLIME', n: 2, w: 2 },
  { id: 'MAT_CALCITE', n: 1, w: 1 },
];

export interface PullResult {
  rarity: 3 | 4 | 5;
  kind: 'char' | 'item' | 'weapon';
  id: string;
  count: number;
  featured?: boolean;
  lost5050?: boolean;
}

export function rate5(pity: number): number {
  // pity = number of the pull being made since the last 5★ (1-based)
  if (pity >= HARD_PITY) return 1;
  if (pity > SOFT_PITY) return Math.min(1, BASE5 + 0.08 * (pity - SOFT_PITY));
  return BASE5;
}

function pick<T>(a: T[], rnd: () => number): T { return a[Math.floor(rnd() * a.length)]; }

function pick3(rnd: () => number): { id: string; n: number } {
  const total = POOL3.reduce((s, x) => s + x.w, 0);
  let r = rnd() * total;
  for (const x of POOL3) { r -= x.w; if (r <= 0) return x; }
  return POOL3[0];
}

export function bannerState(g: GachaSave, id: BannerId): BannerState { return g[id]; }

export function isBannerOpen(g: GachaSave, b: BannerDef): boolean {
  if (b.id !== 'novice') return true;
  return g.novice.pulls < (b.maxPulls ?? 20);
}

/** Performs one pull and mutates the banner state. */
export function pullOnce(g: GachaSave, b: BannerDef, rnd: () => number = Math.random): PullResult {
  const st = g[b.id];
  st.pulls++;
  st.pity5++;
  st.pity4++;
  let p5 = rate5(st.pity5);
  // novice: the 20th pull is always the 5★ if it hasn't appeared
  if (b.id === 'novice' && !st.done && st.pulls >= (b.maxPulls ?? 20)) p5 = 1;
  const r = rnd();
  let res: PullResult;
  if (r < p5) {
    st.pity5 = 0;
    let id: string;
    let featured = false, lost = false;
    if (b.featured5.length && b.id === 'featured') {
      if (st.guaranteed || rnd() < 0.5) { id = pick(b.featured5, rnd); featured = true; st.guaranteed = false; }
      else { id = pick(b.pool5, rnd); lost = true; st.guaranteed = true; }
    } else {
      id = pick(b.pool5, rnd);
      featured = b.featured5.includes(id);
    }
    if (b.id === 'novice') st.done = true;
    res = { rarity: 5, kind: 'char', id, count: 1, featured, lost5050: lost };
  } else if (st.pity4 >= PITY4 || r < p5 + BASE4) {
    st.pity4 = 0;
    res = rnd() < 0.5
      ? { rarity: 4, kind: 'char', id: pick(b.pool4, rnd), count: 1 }
      : { rarity: 4, kind: 'weapon', id: pick(POOL4_WEAPONS, rnd), count: 1 };
  } else if (rnd() < 0.75) {
    res = { rarity: 3, kind: 'weapon', id: pick(POOL3_WEAPONS, rnd), count: 1 };
  } else {
    const it = pick3(rnd);
    res = { rarity: 3, kind: 'item', id: it.id, count: it.n };
  }
  g.history.unshift({ t: new Date().toISOString(), banner: b.id, id: res.id, rarity: res.rarity });
  if (g.history.length > 100) g.history.length = 100;
  return res;
}

export function pullMany(g: GachaSave, b: BannerDef, n: number, rnd: () => number = Math.random): PullResult[] {
  const out: PullResult[] = [];
  for (let i = 0; i < n; i++) {
    // a paid 10-pull always completes; the novice banner only stops at its pull limit
    if (b.id === 'novice' && g.novice.pulls >= (b.maxPulls ?? 20)) break;
    out.push(pullOnce(g, b, rnd));
  }
  return out;
}

/** Probability of getting at least one 5★ within n pulls if there were NO pity (for the lesson panel). */
export function atLeastOneNoPity(n: number, p = BASE5): number { return 1 - Math.pow(1 - p, n); }

/** Exact probability (with soft/hard pity) of the first 5★ landing within n pulls, from 0 pity. */
export function withinNWithPity(n: number): number {
  let none = 1;
  for (let k = 1; k <= Math.min(n, HARD_PITY); k++) none *= 1 - rate5(k);
  return 1 - none;
}

/** Expected pulls to the first 5★ with pity rules. */
export function expectedPulls(): number {
  let e = 0, none = 1;
  for (let k = 1; k <= HARD_PITY; k++) {
    const p = rate5(k);
    e += k * none * p;
    none *= 1 - p;
  }
  return e;
}
