import { newGear, type GearSave, type SlotId } from '../gear/Gear';
import { newAtp, type AtpState } from '../domain/Atp';

export interface QuestProgress {
  state: 'AVAILABLE' | 'ACTIVE' | 'COMPLETED';
  stepIndex?: number;
  progress?: number[];
  /** "objectiveIndex:targetId" already counted (so re-scanning the same thing doesn't count twice) */
  seen?: string[];
}

export interface CharSave {
  level: number;
  ascension: number;
  exp: number;
  hpFrac: number;
  geneSeq?: number; // constellation level C0–C6
  weapon?: string;   // equipped weapon uid
  relics?: Partial<Record<SlotId, string>>; // equipped Bio-Relic uids per slot
  talents?: [number, number, number];         // normal / skill / burst levels
}

export interface BannerState { pulls: number; pity5: number; pity4: number; guaranteed: boolean; done?: boolean }
export interface WishRecord { t: string; banner: string; id: string; rarity: 3 | 4 | 5 }
export interface GachaSave {
  novice: BannerState;
  standard: BannerState;
  featured: BannerState;
  history: WishRecord[];
}

export function newGacha(): GachaSave {
  const b = (): BannerState => ({ pulls: 0, pity5: 0, pity4: 0, guaranteed: false });
  return { novice: b(), standard: b(), featured: b(), history: [] };
}

export interface SaveData {
  version: 1;
  createdAt: string;
  playerName: string;
  gender: 'M' | 'F';
  rr: number;
  rrExp: number;
  inventory: Record<string, number>;
  unlockedChars: string[];
  chars: Record<string, CharSave>;
  party: string[];
  activeIndex: number;
  quests: Record<string, QuestProgress>;
  trackedQuest: string | null;
  flags: Record<string, boolean>;
  systems: string[];
  codex: string[];
  seenReactions: string[];
  mastery: Record<string, number>;
  leitner: Record<string, { box: number; due: string }>;
  lastDailyReview: string | null;
  stats: { answered: number; correct: number; playSeconds: number };
  world: { chests: string[]; orbs: string[]; waypoints: string[]; offeredOrbs: number };
  maxStamina: number;
  position: [number, number, number] | null;
  timeOfDay: number;
  gacha: GachaSave;
  gear: GearSave;
  atp: AtpState;
  settings: { mouseSens: number; invertY: boolean; shadows: boolean; playReminderMin: number; gachaEnabled: boolean; camMode: 'drag' | 'lock'; graphics: 'high' | 'medium' | 'low'; showFps?: boolean; oldGrass?: boolean; lookV2?: boolean; musicVol?: number; sfxVol?: number };
}

const KEY = 'vitaria_save_v1';

export function newSave(playerName: string, gender: 'M' | 'F'): SaveData {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    playerName,
    gender,
    rr: 1,
    rrExp: 0,
    inventory: { INSIGHT_CRYSTAL: 0, GLUCOSE: 0 },
    unlockedChars: ['SEEKER'],
    chars: { SEEKER: { level: 1, ascension: 0, exp: 0, hpFrac: 1 } },
    party: ['SEEKER'],
    activeIndex: 0,
    quests: {},
    trackedQuest: null,
    flags: {},
    systems: [],
    codex: [],
    seenReactions: [],
    mastery: {},
    leitner: {},
    lastDailyReview: null,
    stats: { answered: 0, correct: 0, playSeconds: 0 },
    world: { chests: [], orbs: [], waypoints: [], offeredOrbs: 0 },
    maxStamina: 120,
    position: null,
    timeOfDay: 8,
    gacha: newGacha(),
    gear: newGear(),
    atp: newAtp(),
    settings: { mouseSens: 1, invertY: false, shadows: true, playReminderMin: 60, gachaEnabled: true, camMode: 'drag', graphics: 'high' },
  };
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as SaveData;
    // forward-compatible defaults
    const d = newSave(s.playerName, s.gender);
    return {
      ...d, ...s,
      world: { ...d.world, ...s.world },
      settings: { ...d.settings, ...s.settings },
      stats: { ...d.stats, ...s.stats },
      gacha: { ...d.gacha, ...(s.gacha ?? {}) },
      gear: { ...d.gear, ...(s.gear ?? {}) },
      atp: { ...d.atp, ...(s.atp ?? {}) },
    };
  } catch {
    return null;
  }
}

export function writeSave(s: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function deleteSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
