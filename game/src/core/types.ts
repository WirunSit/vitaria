export type Element = 'PYRO' | 'HYDRO' | 'ANEMO' | 'ELECTRO' | 'DENDRO' | 'CRYO' | 'GEO' | 'PHYSICAL';
export type WeaponType = 'SWORD' | 'CLAYMORE' | 'POLEARM' | 'BOW' | 'CATALYST';
export type L10n = { th: string; en?: string };

export const ELEMENT_COLOR: Record<Element, string> = {
  PYRO: '#e8553a', HYDRO: '#3da5f4', ANEMO: '#5fd4b0', ELECTRO: '#a65fe0',
  DENDRO: '#8bc34a', CRYO: '#9fe3f0', GEO: '#e8b54a', PHYSICAL: '#e6e6e6',
};
export const ELEMENT_TH: Record<Element, string> = {
  PYRO: 'ไฟ', HYDRO: 'น้ำ', ANEMO: 'ลม', ELECTRO: 'ไฟฟ้า', DENDRO: 'พฤกษา', CRYO: 'น้ำแข็ง', GEO: 'ศิลา', PHYSICAL: 'กายภาพ',
};
export const ELEMENT_GLYPH: Record<Element, string> = {
  PYRO: '🔥', HYDRO: '💧', ANEMO: '🌀', ELECTRO: '⚡', DENDRO: '🌿', CRYO: '❄️', GEO: '⬢', PHYSICAL: '⚔️',
};

export interface Appearance {
  skin: string; hair: string; hairTip?: string; eyes: string;
  outfit: string; outfit2: string; accent: string;
  hairStyle: 'short' | 'long' | 'twintail' | 'ponytail' | 'fluffy' | 'braids' | 'halfup';
  height: number; // scale relative to 1
  skirt?: boolean; coat?: boolean; hat?: 'straw' | 'goggles' | 'monocle' | null; cape?: boolean;
}

export interface CharacterDef {
  id: string;
  name: L10n;
  title: L10n;
  element: Element;
  weapon: WeaponType;
  rarity: 4 | 5;
  role: string;
  inspiration: string;
  topic: string;
  base: { hp1: number; hp90: number; atk1: number; atk90: number; def1: number; def90: number };
  ascStat?: { stat: 'ATK%' | 'HP%' | 'CRIT' | 'ER' | 'BM' | 'ELEM%'; max: number };
  burstCost: number;
  skills: { normal: L10n; e: L10n; q: L10n; eDesc: L10n; qDesc: L10n; a1: L10n; a4: L10n };
  appearance: Appearance;
  appearanceF?: Appearance;
  quote: L10n;
  playable?: boolean;
  geneSeq?: L10n[];
  talentBook?: string;
}

export interface QuestionDef {
  id: string;
  topic: string;
  bloom: string;
  difficulty: number;
  type: 'MCQ' | 'TF' | 'ORDER';
  stem: L10n;
  choices?: { id: string; th: string; en?: string }[];
  items?: string[]; // for ORDER (correct order)
  answer?: string[];
  explanation: L10n;
  hint?: L10n;
  relatedCodex?: string[];
  reviewed_by?: string | null;
}

export interface CodexDef {
  id: string;
  category: 'CREATURE' | 'ENEMY' | 'REACTION' | 'CONCEPT' | 'SCIENTIST';
  name: L10n;
  glyph: string;
  image?: string;
  topic?: string;
  body: L10n;
  didYouKnow?: L10n;
}

export interface Objective {
  type: 'TALK' | 'GOTO' | 'COLLECT' | 'DEFEAT' | 'SCAN' | 'QUIZ' | 'PUZZLE' | 'INTERACT' | 'USE_SKILL' | 'REACTION' | 'DELIVER';
  npcId?: string; dialogueId?: string; locationId?: string; radius?: number;
  itemId?: string; enemyId?: string; enemyTag?: string; targetId?: string; targetTag?: string;
  quizSetId?: string; puzzleId?: string; objectId?: string; skill?: 'E' | 'Q'; reaction?: string;
  count?: number; label?: L10n;
}

export interface QuestAction {
  action: string;
  [k: string]: unknown;
}

export interface QuestStep {
  id: string;
  log: L10n;
  objectives: Objective[];
  onStart?: QuestAction[];
  onComplete?: QuestAction[];
}

export interface QuestDef {
  id: string;
  type: 'MAIN' | 'CHARACTER' | 'WORLD' | 'DAILY' | 'TUTORIAL';
  chapter?: string;
  title: L10n;
  description: L10n;
  bioTopics: string[];
  prerequisites: { type: string; value: string | number }[];
  autoStart?: boolean;
  steps: QuestStep[];
  rewards: { itemId: string; count: number }[];
  nextQuest?: string | null;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  emotion?: string;
  text?: L10n;
  type?: 'CHOICE';
  choices?: { text: L10n; next: string }[];
  next?: string;
}
export interface DialogueDef { id: string; nodes: DialogueNode[] }

export interface QuizSetDef {
  id: string;
  questionPool: string[];
  drawCount: number;
  passScore: number;
  asker?: string;
  title?: L10n;
}

export interface LocationDef { id: string; name: L10n; x: number; z: number; type?: string }

export interface NpcDef {
  id: string;
  name: L10n;
  title?: L10n;
  location: string;
  model: 'amoeby' | 'human' | 'char';
  charId?: string;
  appearance?: Appearance;
  showFlag?: string; hideFlag?: string;
  art?: string;
  talkDialogue?: string;
}

export interface EnemyDef {
  id: string;
  name: L10n;
  family: string;
  tags: string[];
  kind: 'coccus' | 'bacillus' | 'phage' | 'dummy' | 'boss_king' | 'trooper' | 'machine' | 'tumor' | 'boss_golem' | 'gunner' | 'boss_chimera' | 'caster' | 'boss_virus' | 'boss_spore' | 'boss_cyano' | 'boss_superbug' | 'boss_medusa' | 'boss_herald';
  base: { hp: number; atk: number; def: number };
  speed: number;
  codexId: string;
  /** quizSetIds: optional different question pool for each shield (falls back to quizSetId) */
  boss?: { title: L10n; shields: number[]; quizSetId: string; quizSetIds?: string[] };
  /** optional .glb in assets/models/enemies (without extension) */
  model?: string;
  modelYaw?: number;
  /** the download is modelled upside down: turn it over (the Neuro-Medusa's jellyfish) */
  modelFlip?: boolean;
  /** float this far above the ground (m) */
  modelLift?: number;
}

export interface DomainDef {
  id: string;
  type: 'BOOK' | 'ORE' | 'RELIC';
  name: L10n;
  desc: L10n;
  topic: string;
  art: string;
  enemies: string[];
}

export interface ItemDef { id: string; name: L10n; glyph: string; desc: L10n; image?: string }
