import { todayStr, type SaveData } from '../core/Save';

/**
 * ATP — the "Original Resin" of VITARIA (docs/04 section 6).
 * Regenerates in real time (also while the game is closed): 1 per 8 minutes, max 160.
 * ATP is the energy currency of cells, so it fuels claiming domain rewards.
 */
export const ATP_MAX = 160;
export const ATP_REGEN_MS = 8 * 60 * 1000;
export const CREATINE_COST = 40;
export const CREATINE_MAX = 5;
export const REFILL_CRYSTALS = 50;
export const REFILL_AMOUNT = 60;
export const REFILLS_PER_DAY = 3;

export interface AtpState { cur: number; last: number; refillDay: string; refills: number }
export function newAtp(): AtpState { return { cur: ATP_MAX, last: Date.now(), refillDay: '', refills: 0 }; }

/** Apply real-time regeneration. Call before reading/spending. */
export function regenAtp(s: SaveData) {
  const a = s.atp;
  const now = Date.now();
  if (a.cur >= ATP_MAX) { a.last = now; return; }
  const gained = Math.floor((now - a.last) / ATP_REGEN_MS);
  if (gained > 0) {
    a.cur = Math.min(ATP_MAX, a.cur + gained);
    a.last += gained * ATP_REGEN_MS;
    if (a.cur >= ATP_MAX) a.last = now;
  }
}

export function msToNextAtp(s: SaveData): number {
  regenAtp(s);
  if (s.atp.cur >= ATP_MAX) return 0;
  return ATP_REGEN_MS - (Date.now() - s.atp.last);
}

export function spendAtp(s: SaveData, n: number): boolean {
  regenAtp(s);
  if (s.atp.cur < n) return false;
  const wasFull = s.atp.cur >= ATP_MAX;
  s.atp.cur -= n;
  if (wasFull) s.atp.last = Date.now();
  return true;
}

/** Condense 40 ATP into one Creatine Phosphate (double domain rewards). */
export function condense(s: SaveData): string | null {
  if ((s.inventory.CREATINE ?? 0) >= CREATINE_MAX) return `เก็บครีเอทีนฟอสเฟตได้สูงสุด ${CREATINE_MAX} ชิ้น`;
  if (!spendAtp(s, CREATINE_COST)) return `ATP ไม่พอ (ต้องใช้ ${CREATINE_COST})`;
  s.inventory.CREATINE = (s.inventory.CREATINE ?? 0) + 1;
  return null;
}

/** Refill 60 ATP for 50 Insight Crystals, max 3 times a day (healthy-play limit). */
export function refill(s: SaveData): string | null {
  regenAtp(s);
  const day = todayStr();
  if (s.atp.refillDay !== day) { s.atp.refillDay = day; s.atp.refills = 0; }
  if (s.atp.refills >= REFILLS_PER_DAY) return `วันนี้เติม ATP ครบ ${REFILLS_PER_DAY} ครั้งแล้ว — พักก่อนนะ พรุ่งนี้ค่อยมาใหม่`;
  if ((s.inventory.INSIGHT_CRYSTAL ?? 0) < REFILL_CRYSTALS) return `ผลึกปัญญาไม่พอ (ต้องใช้ ${REFILL_CRYSTALS})`;
  s.inventory.INSIGHT_CRYSTAL -= REFILL_CRYSTALS;
  s.atp.cur = Math.min(ATP_MAX + REFILL_AMOUNT * REFILLS_PER_DAY, s.atp.cur + REFILL_AMOUNT);
  s.atp.refills++;
  return null;
}

export function fmtMs(ms: number) {
  const m = Math.floor(ms / 60000), sec = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
