import { isTouch } from './Device';
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
  /** ISO time of the last write (shown on the title screen). */
  savedAt?: string;
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
  settings: { mouseSens: number; invertY: boolean; shadows: boolean; playReminderMin: number; gachaEnabled: boolean; camMode: 'drag' | 'lock'; graphics: 'high' | 'medium' | 'low'; showFps?: boolean; oldGrass?: boolean; lookV2?: boolean; lookV3?: boolean; musicVol?: number; sfxVol?: number };
}

const KEY = 'vitaria_save_v1';
/** The previous good save — used if the main one is ever corrupted (e.g. the phone killed the tab mid-write). */
const BACKUP_KEY = 'vitaria_save_v1_backup';

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
    // phones/tablets start on lighter graphics; players can raise it in the menu
    settings: { mouseSens: 1, invertY: false, shadows: !isTouch, playReminderMin: 60, gachaEnabled: true, camMode: 'drag', graphics: isTouch ? 'low' : 'high' },
  };
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(KEY) || !!localStorage.getItem(BACKUP_KEY); } catch { return false; }
}

/** Parse + upgrade a save from JSON text; null if it isn't a VITARIA save. */
export function parseSave(raw: string): SaveData | null {
  try {
    const s = JSON.parse(raw) as SaveData;
    if (!s || typeof s !== 'object' || s.version !== 1 || typeof s.playerName !== 'string' || !s.chars || !s.quests) return null;
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

export function loadSave(): SaveData | null {
  try {
    const main = localStorage.getItem(KEY);
    const s = main ? parseSave(main) : null;
    if (s) return s;
    const bak = localStorage.getItem(BACKUP_KEY);
    return bak ? parseSave(bak) : null;
  } catch {
    return null;
  }
}

export function writeSave(s: SaveData): boolean {
  try {
    s.savedAt = new Date().toISOString();
    const prev = localStorage.getItem(KEY);
    if (prev && prev.length > 2) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function deleteSave() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(BACKUP_KEY); } catch { /* ignore */ }
}

/** Ask the browser not to clear our storage when the device runs low on space (best effort, silent). */
export function requestPersistentStorage() {
  try { void navigator.storage?.persist?.(); } catch { /* ignore */ }
}

/** Short description of a save for the title screen / import confirmation. */
export function saveSummary(s: SaveData): string {
  const hrs = Math.floor(s.stats.playSeconds / 3600), mins = Math.floor((s.stats.playSeconds % 3600) / 60);
  const play = hrs > 0 ? `${hrs} ชม. ${mins} นาที` : `${mins} นาที`;
  const when = s.savedAt ? new Date(s.savedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const done = Object.values(s.quests).filter((q) => q.state === 'COMPLETED').length;
  return `${s.playerName} · RR ${s.rr} · เควสสำเร็จ ${done} · เล่นไป ${play}${when ? ` · บันทึกล่าสุด ${when}` : ''}`;
}

/** Download the save as a file (to keep a copy or move it to another device). */
export function exportSaveFile(s: SaveData) {
  const blob = new Blob([JSON.stringify(s)], { type: 'application/json' });
  const a = document.createElement('a');
  const day = todayStr();
  a.href = URL.createObjectURL(blob);
  a.download = `vitaria-save-${s.playerName.replace(/[^\p{L}\p{N}_-]+/gu, '') || 'player'}-${day}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Let the player pick a save file; resolves with the parsed save (or null if cancelled / not a save). */
export function pickSaveFile(): Promise<SaveData | null | 'invalid'> {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      resolve(parseSave(await f.text()) ?? 'invalid');
    };
    inp.click();
  });
}

/** Replace the stored save with an imported one. */
export function importSave(s: SaveData): boolean {
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
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
