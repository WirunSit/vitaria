import type {
  CharacterDef, CodexDef, DialogueDef, DomainDef, EnemyDef, ItemDef, LocationDef, NpcDef, QuestDef, QuestionDef, QuizSetDef,
} from './types';
import { registerItemGlyph } from './Assets';
import { loadGear } from '../gear/Gear';
import { loadModelManifest } from '../models/ModelLibrary';

/** All game content, loaded from /public/data/*.json at boot (editable without rebuilding). */
export class DataRegistry {
  characters = new Map<string, CharacterDef>();
  quests = new Map<string, QuestDef>();
  dialogues = new Map<string, DialogueDef>();
  questions = new Map<string, QuestionDef>();
  quizSets = new Map<string, QuizSetDef>();
  codex = new Map<string, CodexDef>();
  enemies = new Map<string, EnemyDef>();
  items = new Map<string, ItemDef>();
  locations = new Map<string, LocationDef>();
  npcs = new Map<string, NpcDef>();
  speakers = new Map<string, { name: string; portrait?: string; color?: string }>();
  domains = new Map<string, DomainDef>();

  async load(onProgress?: (p: number) => void) {
    const files = [
      'characters', 'quests', 'dialogues', 'questions', 'quizsets', 'codex', 'enemies', 'items', 'locations', 'npcs', 'weapons', 'relics', 'domains',
    ];
    let done = 0;
    const results = await Promise.all(
      files.map(async (f) => {
        const res = await fetch(`data/${f}.json`);
        if (!res.ok) throw new Error(`โหลด data/${f}.json ไม่สำเร็จ`);
        const json = await res.json();
        done++;
        onProgress?.(done / files.length);
        return json;
      }),
    );
    const [chars, quests, dialogues, questions, quizsets, codex, enemies, items, locations, npcs, weapons, relics, domains] = results;
    for (const d of domains as DomainDef[]) this.domains.set(d.id, d);
    loadGear(weapons, relics);
    await loadModelManifest();
    for (const c of chars as CharacterDef[]) this.characters.set(c.id, c);
    for (const q of quests as QuestDef[]) this.quests.set(q.id, q);
    for (const d of dialogues as DialogueDef[]) this.dialogues.set(d.id, d);
    for (const q of questions as QuestionDef[]) this.questions.set(q.id, q);
    for (const q of quizsets as QuizSetDef[]) this.quizSets.set(q.id, q);
    for (const c of codex as CodexDef[]) this.codex.set(c.id, c);
    for (const e of enemies as EnemyDef[]) this.enemies.set(e.id, e);
    for (const i of items as ItemDef[]) { this.items.set(i.id, i); registerItemGlyph(i.id, i.glyph); }
    for (const l of locations as LocationDef[]) this.locations.set(l.id, l);
    for (const n of npcs as NpcDef[]) this.npcs.set(n.id, n);
  }

  questionsByTopic(prefix: string): QuestionDef[] {
    return [...this.questions.values()].filter((q) => q.topic.startsWith(prefix));
  }
}

export const data = new DataRegistry();
