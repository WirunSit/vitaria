import { bus } from '../core/EventBus';
import { data } from '../core/Data';
import type { SaveData } from '../core/Save';
import type { Objective, QuestAction, QuestDef } from '../core/types';

export interface QuestApi {
  playDialogue(id: string): Promise<void>;
  runQuizSet(id: string): Promise<boolean>;
  runPuzzle(id: string): Promise<boolean>;
  spawnEnemies(a: QuestAction): void;
  clearEnemies(tag: string): void;
  unlockSystem(id: string): void;
  unlockCodex(id: string): void;
  addCharacter(id: string): void;
  giveItem(id: string, n: number): void;
  setFlag(k: string, v: boolean): void;
  toast(text: string, big?: boolean): void;
  amoeby(text: string): void;
  chapterCard(top: string, title: string): Promise<void>;
  teleport(locationId: string): void;
  fillEnergy(): void;
  questChanged(): void;
  save(): void;
}

export interface QuestTarget { x: number; z: number; label: string; radius?: number }

export class QuestManager {
  private busy = false; // running a blocking action chain
  private completing = new Set<string>(); // quests whose current step is finishing (in memory only)
  private actionQueue: Promise<void> = Promise.resolve();

  constructor(private save: () => SaveData, private api: QuestApi) {
    bus.on('EnemyDefeated', (p) => this.progress((o) => o.type === 'DEFEAT' && (o.enemyId === p.enemyId || (!!o.enemyTag && p.tags.includes(o.enemyTag)))));
    bus.on('ItemCollected', (p) => this.progress((o) => o.type === 'COLLECT' && o.itemId === p.itemId, p.count));
    bus.on('EnteredArea', (p) => this.progress((o) => o.type === 'GOTO' && o.locationId === p.locationId));
    bus.on('Scanned', (p) => this.progress((o) => o.type === 'SCAN' && (o.targetId === p.targetId || (!!o.targetTag && p.tags.includes(o.targetTag))), 1, p.targetId));
    bus.on('QuizPassed', (p) => this.progress((o) => o.type === 'QUIZ' && o.quizSetId === p.quizSetId));
    bus.on('PuzzleSolved', (p) => this.progress((o) => o.type === 'PUZZLE' && o.puzzleId === p.puzzleId));
    bus.on('Interacted', (p) => this.progress((o) => o.type === 'INTERACT' && o.objectId === p.objectId));
    bus.on('TalkedTo', (p) => this.progress((o) => o.type === 'TALK' && o.npcId === p.npcId));
    bus.on('SkillUsed', (p) => this.progress((o) => o.type === 'USE_SKILL' && (!o.skill || o.skill === p.kind)));
    bus.on('Reaction', (p) => this.progress((o) => o.type === 'REACTION' && (!o.reaction || o.reaction === p.reaction)));
    bus.on('CharacterAdded', () => this.refreshAvailability());
  }

  get state() { return this.save().quests; }
  get isBusy() { return this.busy; }

  /** Call once after loading a save. */
  start() {
    this.refreshAvailability();
    // restore spawn-type actions for active steps (enemies are not saved)
    for (const [id, p] of Object.entries(this.state)) {
      if (p.state !== 'ACTIVE') continue;
      const q = data.quests.get(id);
      const step = q?.steps[p.stepIndex ?? 0];
      if (!q || !step) continue;
      const done = step.objectives.every((o, i) => (p.progress?.[i] ?? 0) >= (o.count ?? 1));
      if (done) { this.completeStep(q); continue; } // saved mid-transition: resume
      for (const a of step.onStart ?? []) if (a.action === 'SPAWN_ENEMY') this.api.spawnEnemies(a);
      // re-offer gate-less quizzes that were interrupted
      if (step.objectives.some((o) => o.type === 'QUIZ' && !o.npcId)) this.enterStep(q, p.stepIndex ?? 0, true);
    }
    if (!this.save().trackedQuest) this.save().trackedQuest = this.activeMain()?.id ?? null;
  }

  activeMain(): QuestDef | null {
    for (const [id, p] of Object.entries(this.state)) if (p.state === 'ACTIVE' && data.quests.get(id)?.type === 'MAIN') return data.quests.get(id)!;
    return null;
  }

  activeQuests(): QuestDef[] {
    return Object.entries(this.state).filter(([, p]) => p.state === 'ACTIVE').map(([id]) => data.quests.get(id)!).filter(Boolean);
  }

  private prereqOk(q: QuestDef): boolean {
    const s = this.save();
    return q.prerequisites.every((p) => {
      if (p.type === 'QUEST_COMPLETED') return s.quests[String(p.value)]?.state === 'COMPLETED';
      if (p.type === 'RR_AT_LEAST') return s.rr >= Number(p.value);
      if (p.type === 'HAS_CHARACTER') return s.unlockedChars.includes(String(p.value));
      if (p.type === 'FLAG') return !!s.flags[String(p.value)];
      return true;
    });
  }

  refreshAvailability() {
    for (const q of data.quests.values()) {
      if (this.state[q.id]) continue;
      if (!this.prereqOk(q)) continue;
      if (q.autoStart) this.begin(q.id);
      else this.state[q.id] = { state: 'AVAILABLE' };
    }
  }

  begin(id: string) {
    const q = data.quests.get(id);
    if (!q) return;
    const cur = this.state[id];
    if (cur?.state === 'ACTIVE' || cur?.state === 'COMPLETED') return;
    this.state[id] = { state: 'ACTIVE', stepIndex: 0, progress: q.steps[0].objectives.map(() => 0) };
    if (q.type === 'MAIN' || !this.save().trackedQuest) this.save().trackedQuest = id;
    this.api.toast(`<span style="color:var(--gold)">เควสใหม่</span> · ${q.title.th}`, false);
    this.enterStep(q, 0);
  }

  private enterStep(q: QuestDef, i: number, resume = false) {
    const step = q.steps[i];
    this.api.questChanged();
    this.queue(async () => {
      if (!resume) for (const a of step.onStart ?? []) await this.runAction(a);
      // auto-launch quiz/puzzle objectives that have no NPC/object gate
      for (const o of step.objectives) {
        if (o.type === 'QUIZ' && !o.npcId) await this.launchQuiz(o);
      }
    });
  }

  private queue(fn: () => Promise<void>) {
    this.actionQueue = this.actionQueue.then(async () => {
      this.busy = true;
      try { await fn(); } catch (e) { console.error(e); }
      this.busy = false;
    });
  }

  private async launchQuiz(o: Objective) {
    const ok = await this.api.runQuizSet(o.quizSetId!);
    if (ok) bus.emit('QuizPassed', { quizSetId: o.quizSetId!, score: 1 });
    else if (!o.npcId) {
      this.api.amoeby('ไม่เป็นไรนะ! อ่านคำอธิบายแล้ว มาลองใหม่อีกรอบกัน');
      await new Promise((r) => setTimeout(r, 900));
      await this.launchQuiz(o);
    }
  }

  /** Current step objectives of a quest (with progress). */
  stepInfo(id: string) {
    const q = data.quests.get(id);
    const p = this.state[id];
    if (!q || !p || p.state !== 'ACTIVE') return null;
    const step = q.steps[p.stepIndex ?? 0];
    return { quest: q, step, progress: p.progress ?? [] };
  }

  private progress(match: (o: Objective) => boolean, amount = 1, uniqueKey?: string) {
    for (const [id, p] of Object.entries(this.state)) {
      if (p.state !== 'ACTIVE' || this.completing.has(id)) continue;
      const q = data.quests.get(id);
      if (!q) continue;
      const step = q.steps[p.stepIndex ?? 0];
      let changed = false;
      step.objectives.forEach((o, i) => {
        const need = o.count ?? 1;
        const cur = p.progress?.[i] ?? 0;
        if (cur < need && match(o)) {
          if (uniqueKey && need > 1) {
            const key = `${i}:${uniqueKey}`;
            p.seen ??= [];
            if (p.seen.includes(key)) return;
            p.seen.push(key);
          }
          p.progress![i] = Math.min(need, cur + amount);
          changed = true;
        }
      });
      if (changed) {
        this.api.questChanged();
        const done = step.objectives.every((o, i) => (p.progress![i] ?? 0) >= (o.count ?? 1));
        if (done) this.completeStep(q);
      }
    }
  }

  private completeStep(q: QuestDef) {
    const p = this.state[q.id];
    const i = p.stepIndex ?? 0;
    const step = q.steps[i];
    if (this.completing.has(q.id)) return;
    this.completing.add(q.id); // further events must not double-complete this step
    this.queue(async () => {
      for (const a of step.onComplete ?? []) await this.runAction(a);
      this.completing.delete(q.id);
      if (i + 1 < q.steps.length) {
        p.stepIndex = i + 1;
        p.progress = q.steps[i + 1].objectives.map(() => 0);
        p.seen = [];
        this.api.save();
        this.enterStep(q, i + 1);
      } else {
        this.finishQuest(q);
      }
    });
  }

  private finishQuest(q: QuestDef) {
    this.state[q.id] = { state: 'COMPLETED' };
    const parts: string[] = [];
    for (const r of q.rewards) {
      this.api.giveItem(r.itemId, r.count);
      const it = data.items.get(r.itemId);
      parts.push(`${it?.glyph ?? ''} ${it?.name.th ?? r.itemId} ×${r.count}`);
    }
    this.api.toast(`<div>เควสสำเร็จ · ${q.title.th}</div><div style="font-size:16px;color:var(--cream)">${parts.join(' &nbsp; ')}</div>`, true, );
    bus.emit('QuestCompleted', { questId: q.id });
    if (this.save().trackedQuest === q.id) this.save().trackedQuest = null;
    if (q.nextQuest) {
      const nq = data.quests.get(q.nextQuest);
      if (nq && this.prereqOk(nq)) this.begin(nq.id);
    }
    this.refreshAvailability();
    if (!this.save().trackedQuest) this.save().trackedQuest = this.activeMain()?.id ?? this.activeQuests()[0]?.id ?? null;
    this.api.questChanged();
    this.api.save();
  }

  private async runAction(a: QuestAction) {
    const api = this.api;
    switch (a.action) {
      case 'PLAY_DIALOGUE': await api.playDialogue(String(a.dialogueId)); break;
      case 'UNLOCK_SYSTEM': api.unlockSystem(String(a.systemId)); break;
      case 'UNLOCK_CODEX': api.unlockCodex(String(a.codexId)); break;
      case 'ADD_CHARACTER': api.addCharacter(String(a.charId)); break;
      case 'GIVE_ITEM': api.giveItem(String(a.itemId), Number(a.count ?? 1)); break;
      case 'SET_FLAG': api.setFlag(String(a.flag), a.value !== false); break;
      case 'SPAWN_ENEMY': api.spawnEnemies(a); break;
      case 'CLEAR_ENEMIES': api.clearEnemies(String(a.tag)); break;
      case 'TOAST': api.toast(String(a.text), !!a.big); break;
      case 'AMOEBY': api.amoeby(String(a.text)); break;
      case 'CHAPTER_CARD': await api.chapterCard(String(a.top), String(a.title)); break;
      case 'TELEPORT': api.teleport(String(a.locationId)); break;
      case 'FILL_ENERGY': api.fillEnergy(); break;
      case 'START_QUEST': this.begin(String(a.questId)); break;
      case 'WAIT': await new Promise((r) => setTimeout(r, Number(a.ms ?? 500))); break;
      default: console.warn('unknown action', a);
    }
  }

  /**
   * Player pressed F on an NPC/object. Returns true if a quest consumed it.
   */
  async interact(kind: 'npc' | 'object', id: string): Promise<boolean> {
    if (this.busy) return true;
    for (const [qid, p] of Object.entries(this.state)) {
      if (p.state !== 'ACTIVE') continue;
      const q = data.quests.get(qid)!;
      const step = q.steps[p.stepIndex ?? 0];
      for (let i = 0; i < step.objectives.length; i++) {
        const o = step.objectives[i];
        if ((p.progress?.[i] ?? 0) >= (o.count ?? 1)) continue;
        if (kind === 'npc' && o.type === 'TALK' && o.npcId === id) {
          this.queue(async () => {
            if (o.dialogueId) await this.api.playDialogue(o.dialogueId);
            bus.emit('TalkedTo', { npcId: id });
          });
          return true;
        }
        if (kind === 'npc' && o.type === 'QUIZ' && o.npcId === id) {
          this.queue(async () => {
            if (o.dialogueId) await this.api.playDialogue(o.dialogueId);
            await this.launchQuiz(o);
          });
          return true;
        }
        if (kind === 'object' && o.type === 'INTERACT' && o.objectId === id) {
          bus.emit('Interacted', { objectId: id });
          return true;
        }
        if (kind === 'object' && o.type === 'PUZZLE' && o.objectId === id) {
          this.queue(async () => {
            const ok = await this.api.runPuzzle(o.puzzleId!);
            if (ok) bus.emit('PuzzleSolved', { puzzleId: o.puzzleId! });
          });
          return true;
        }
      }
    }
    return false;
  }

  /** NPC ids that currently have a quest objective (for "!" markers). */
  npcsWithObjectives(): Set<string> {
    const set = new Set<string>();
    for (const q of this.activeQuests()) {
      const info = this.stepInfo(q.id);
      info?.step.objectives.forEach((o, i) => { if (o.npcId && (info.progress[i] ?? 0) < (o.count ?? 1)) set.add(o.npcId); });
    }
    return set;
  }
  objectsWithObjectives(): Set<string> {
    const set = new Set<string>();
    for (const q of this.activeQuests()) {
      const info = this.stepInfo(q.id);
      info?.step.objectives.forEach((o, i) => { if (o.objectId && (info.progress[i] ?? 0) < (o.count ?? 1)) set.add(o.objectId); });
    }
    return set;
  }

  /** GOTO checks — call each frame with player position. */
  checkAreas(x: number, z: number) {
    for (const q of this.activeQuests()) {
      const info = this.stepInfo(q.id);
      if (!info) continue;
      info.step.objectives.forEach((o, i) => {
        if (o.type !== 'GOTO' || (info.progress[i] ?? 0) >= 1) return;
        const l = data.locations.get(o.locationId!);
        if (l && Math.hypot(l.x - x, l.z - z) < (o.radius ?? 6)) bus.emit('EnteredArea', { locationId: l.id });
      });
    }
  }

  /** Where the tracked quest wants the player to go. */
  targets(): QuestTarget[] {
    const id = this.save().trackedQuest;
    if (!id) return [];
    const info = this.stepInfo(id);
    if (!info) return [];
    const out: QuestTarget[] = [];
    info.step.objectives.forEach((o, i) => {
      if ((info.progress[i] ?? 0) >= (o.count ?? 1)) return;
      let locId = o.locationId;
      if (!locId && o.npcId) locId = data.npcs.get(o.npcId)?.location;
      if (!locId && o.objectId) locId = o.objectId;
      const l = locId ? data.locations.get(locId) : null;
      if (l) out.push({ x: l.x, z: l.z, label: l.name.th, radius: o.type === 'DEFEAT' || o.type === 'SCAN' ? 10 : undefined });
    });
    return out;
  }

  objectiveText(o: Objective, prog: number): string {
    const n = o.count ?? 1;
    const base = o.label?.th ?? defaultLabel(o);
    return n > 1 ? `${base} (${Math.min(prog, n)}/${n})` : base;
  }
}

function defaultLabel(o: Objective): string {
  switch (o.type) {
    case 'TALK': return `คุยกับ ${data.npcs.get(o.npcId!)?.name.th ?? o.npcId}`;
    case 'GOTO': return `ไปที่ ${data.locations.get(o.locationId!)?.name.th ?? ''}`;
    case 'DEFEAT': return 'กำจัดศัตรู';
    case 'SCAN': return 'สแกนด้วย Bio-Scanner (กด T)';
    case 'QUIZ': return 'ตอบคำถาม';
    case 'PUZZLE': return 'แก้ปริศนา';
    case 'INTERACT': return 'ตรวจสอบ';
    case 'USE_SKILL': return o.skill === 'Q' ? 'ใช้ท่าไม้ตาย (Q)' : 'ใช้สกิลธาตุ (E)';
    case 'REACTION': return 'ทำปฏิกิริยาธาตุ';
    case 'COLLECT': return `เก็บ ${data.items.get(o.itemId!)?.name.th ?? ''}`;
    default: return o.type;
  }
}
