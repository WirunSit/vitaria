import { data } from '../core/Data';
import type { QuestionDef } from '../core/types';
import { addDays, todayStr, type SaveData } from '../core/Save';

const LEITNER_DAYS = [1, 2, 4, 8, 16];

export function shuffle<T>(a: T[]): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function starsFor(score: number): number {
  return score >= 85 ? 3 : score >= 60 ? 2 : score >= 30 ? 1 : 0;
}
export function starStr(n: number) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

/** Mastery (Elo-like), Leitner spaced repetition and question picking. See docs/07. */
export class Learning {
  constructor(private save: () => SaveData) {}

  mastery(topic: string): number { return this.save().mastery[topic] ?? 0; }

  /** Average mastery over all leaf topics starting with prefix that have been touched. */
  masteryPrefix(prefix: string): number {
    const m = this.save().mastery;
    const keys = Object.keys(m).filter((k) => k.startsWith(prefix));
    if (!keys.length) return 0;
    return keys.reduce((s, k) => s + m[k], 0) / keys.length;
  }

  pickFromPool(pool: string[], n: number): QuestionDef[] {
    const qs = pool.map((id) => data.questions.get(id)).filter((q): q is QuestionDef => !!q);
    return shuffle(qs).slice(0, n);
  }

  pickByTopic(prefix: string, n: number): QuestionDef[] {
    const qs = data.questionsByTopic(prefix);
    // prefer lower difficulty when mastery is low
    const m = this.masteryPrefix(prefix);
    const maxDiff = m < 30 ? 2 : m < 60 ? 3 : 5;
    const fit = qs.filter((q) => q.difficulty <= maxDiff);
    return shuffle(fit.length >= n ? fit : qs).slice(0, n);
  }

  /** Daily review: due Leitner items first, then weakest topics. */
  pickDaily(n = 5): QuestionDef[] {
    const s = this.save();
    const today = todayStr();
    const due = Object.entries(s.leitner)
      .filter(([, v]) => v.due <= today)
      .sort((a, b) => a[1].box - b[1].box)
      .map(([id]) => data.questions.get(id))
      .filter((q): q is QuestionDef => !!q);
    const picked = shuffle(due).slice(0, n);
    if (picked.length < n) {
      const seen = new Set(picked.map((q) => q.id));
      const weak = [...data.questions.values()]
        .filter((q) => !seen.has(q.id))
        .sort((a, b) => this.mastery(a.topic) - this.mastery(b.topic) + (Math.random() - 0.5) * 20);
      picked.push(...weak.slice(0, n - picked.length));
    }
    return picked;
  }

  canDailyReview(): boolean {
    return this.save().lastDailyReview !== todayStr();
  }

  /** Records an answer. Returns star change info. */
  record(q: QuestionDef, correct: boolean, hintsUsed: number): { before: number; after: number; starUp: boolean } {
    const s = this.save();
    const before = s.mastery[q.topic] ?? 0;
    const K = 12;
    const expected = 1 / (1 + Math.pow(10, (q.difficulty * 20 - before) / 40));
    let after = before;
    if (correct) after += K * (1 - expected) * (hintsUsed > 0 ? 0.5 : 1);
    else after -= K * expected * 0.6;
    after = Math.max(0, Math.min(100, after));
    s.mastery[q.topic] = Math.round(after * 10) / 10;
    s.stats.answered++;
    if (correct) s.stats.correct++;
    // Leitner
    const today = todayStr();
    const box = correct ? Math.min(5, (s.leitner[q.id]?.box ?? 0) + 1) : 1;
    s.leitner[q.id] = { box, due: addDays(today, LEITNER_DAYS[box - 1]) };
    return { before, after, starUp: starsFor(after) > starsFor(before) };
  }

  checkAnswer(q: QuestionDef, given: string[]): boolean {
    if (q.type === 'ORDER') return JSON.stringify(given) === JSON.stringify(q.items);
    const ans = [...(q.answer ?? [])].sort();
    return JSON.stringify([...given].sort()) === JSON.stringify(ans);
  }
}
