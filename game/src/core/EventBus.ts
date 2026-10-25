export interface GameEvents {
  EnemyDefeated: { enemyId: string; tags: string[] };
  ItemCollected: { itemId: string; count: number };
  TalkedTo: { npcId: string };
  EnteredArea: { locationId: string };
  Scanned: { targetId: string; tags: string[] };
  QuizPassed: { quizSetId: string; score: number };
  PuzzleSolved: { puzzleId: string };
  Interacted: { objectId: string };
  SkillUsed: { charId: string; kind: 'E' | 'Q' };
  Reaction: { reaction: string };
  CharacterAdded: { charId: string };
  QuestCompleted: { questId: string };
  CodexUnlocked: { codexId: string };
  PartyChanged: Record<string, never>;
  SaveRequested: Record<string, never>;
}

type Handler<T> = (payload: T) => void;

class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<any>>>();

  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    this.handlers.get(type)?.forEach((fn) => fn(payload));
  }
}

export const bus = new EventBus();
