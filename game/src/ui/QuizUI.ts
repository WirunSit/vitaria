import { data } from '../core/Data';
import type { QuestionDef } from '../core/types';
import { sfx } from '../core/Audio';
import { shuffle, starStr, starsFor, type Learning } from '../learning/Learning';
import { esc, fmtText, h, openModal, speaker, speakerAvatar, toast } from './UI';

export interface QuizOptions {
  questions: QuestionDef[];
  title: string;
  context: string;            // e.g. 'เควส', 'โล่ความรู้', 'ทบทวนประจำวัน'
  asker?: string;             // speaker id
  passScore?: number;
  learning: Learning;
  showResult?: boolean;
  rewardPerCorrect?: number;  // insight crystals per correct answer
  onReward?: (crystals: number) => void;
  onCodex?: (codexId: string) => void;
}

const TOPIC_TH: Record<string, string> = {
  'bio.genetics.probability': 'ความน่าจะเป็น', 'bio.genetics': 'พันธุศาสตร์', 'bio.animal.blood': 'เลือด', 'bio.animal.nervous': 'ระบบประสาท', 'bio.animal': 'ร่างกายสัตว์',
  'bio.intro': 'การศึกษาชีววิทยา', 'bio.chem': 'เคมีของสิ่งมีชีวิต', 'bio.cell': 'เซลล์', 'bio.micro': 'จุลชีววิทยา',
  'bio.animal.senses': 'อวัยวะรับความรู้สึก', 'bio.animal.movement': 'การเคลื่อนที่', 'bio.animal.endocrine': 'ต่อมไร้ท่อ', 'bio.animal.reproduction': 'การสืบพันธุ์',
  'bio.animal.behavior': 'พฤติกรรม', 'bio.animal.circulatory': 'ระบบหมุนเวียนเลือด', 'bio.animal.immune': 'ภูมิคุ้มกัน', 'bio.animal.excretion': 'ระบบขับถ่าย',
  'bio.animal.digestion': 'ระบบย่อยอาหาร', 'bio.animal.respiratory': 'ระบบหายใจ', 'bio.homeostasis': 'ดุลยภาพของร่างกาย', 'bio.plant': 'พืช', 'bio.ecology': 'ระบบนิเวศ',
  'bio.evolution': 'วิวัฒนาการ', 'bio.biodiversity': 'ความหลากหลายทางชีวภาพ',
};
export function topicLabel(topic: string): string {
  const k = Object.keys(TOPIC_TH).filter((p) => topic.startsWith(p)).sort((a, b) => b.length - a.length)[0]; // most specific label
  return k ? TOPIC_TH[k] : topic;
}

/** Runs a quiz and resolves with the score. */
export function runQuiz(opt: QuizOptions): Promise<{ score: number; total: number; passed: boolean }> {
  return new Promise((resolve) => {
    const qs = opt.questions;
    const total = qs.length;
    let idx = 0, score = 0, crystals = 0;
    const root = h('<div class="quiz-wrap"></div>');
    const close = openModal(root);
    let onKey: ((e: KeyboardEvent) => void) | null = null;

    const done = () => {
      if (onKey) window.removeEventListener('keydown', onKey);
      close();
      const passed = score >= (opt.passScore ?? 0);
      if (crystals > 0) opt.onReward?.(crystals);
      resolve({ score, total, passed });
    };

    const showResult = () => {
      if (onKey) window.removeEventListener('keydown', onKey);
      const passed = score >= (opt.passScore ?? 0);
      root.innerHTML = `
        <div class="quiz-card panel hex-bg quiz-result">
          <div class="quiz-head"><span class="ctx">${esc(opt.context)}</span><span>${esc(opt.title)}</span></div>
          <div class="score">${score} / ${total}</div>
          <div style="font-size:22px;margin:6px 0 4px;font-family:var(--font-head);color:${passed ? 'var(--good)' : 'var(--bad)'}">
            ${opt.passScore ? (passed ? 'ผ่านแล้ว! ยอดเยี่ยมมาก' : `ยังไม่ผ่าน (ต้องได้อย่างน้อย ${opt.passScore} ข้อ)`) : 'จบแบบทดสอบ'}
          </div>
          ${crystals ? `<div style="margin:8px 0">ได้รับ 💎 ผลึกปัญญา ×${crystals}</div>` : ''}
          <div style="opacity:.8;font-size:16px;margin-bottom:16px">${passed ? 'ความรู้ของเธอเติบโตขึ้นอีกขั้น!' : 'ไม่เป็นไรนะ ลองอ่านคำอธิบายแล้วมาลองใหม่ได้เสมอ'}</div>
          <button class="btn" id="qdone">ตกลง</button>
        </div>`;
      (root.querySelector('#qdone') as HTMLButtonElement).onclick = () => { sfx.ui(); done(); };
    };

    const render = () => {
      if (idx >= total) return opt.showResult === false ? done() : showResult();
      const q = qs[idx];
      let hints = 0;
      let selected: string[] = [];
      let order: string[] = q.type === 'ORDER' ? shuffle(q.items ?? []) : [];
      if (q.type === 'ORDER' && JSON.stringify(order) === JSON.stringify(q.items)) order = order.slice().reverse();
      const choices = q.type === 'TF'
        ? [{ id: 'T', th: 'ถูก' }, { id: 'F', th: 'ผิด' }]
        : shuffle(q.choices ?? []);
      const eliminated = new Set<string>();
      const asker = opt.asker ? speaker(opt.asker) : null;

      const paint = (answered: null | { correct: boolean; given: string[] }) => {
        const letters = 'ABCD';
        root.innerHTML = `
          <div class="quiz-card panel hex-bg">
            <div class="quiz-head">
              <span class="ctx">${esc(opt.context)} · ${esc(opt.title)}</span>
              <span>ข้อ ${idx + 1}/${total} · <span class="tagpill">#${esc(topicLabel(q.topic))}</span></span>
            </div>
            ${asker ? `<div class="quiz-asker">${speakerAvatar(opt.asker!)}<b style="color:${asker.color}">${esc(asker.name)}</b></div>` : ''}
            <div class="quiz-stem">${fmtText(q.stem.th)}</div>
            ${q.type === 'ORDER'
              ? `<div class="quiz-order">${order.map((it, i) => `
                  <div class="item"><span class="n">${i + 1}.</span><span>${esc(it)}</span>
                    ${answered ? '' : `<span class="arrows"><button data-up="${i}">▲</button><button data-down="${i}">▼</button></span>`}
                  </div>`).join('')}</div>
                 ${answered && !answered.correct ? `<div style="margin-top:8px;color:var(--good)">ลำดับที่ถูก: ${q.items!.map(esc).join(' → ')}</div>` : ''}`
              : `<div class="quiz-choices">${choices.map((c, i) => {
                  let cls = 'quiz-choice';
                  if (answered) {
                    const isAns = q.type === 'TF' ? (q.answer?.[0] === c.id) : q.answer?.includes(c.id);
                    if (isAns) cls += ' correct';
                    else if (answered.given.includes(c.id)) cls += ' wrong';
                  } else if (selected.includes(c.id)) cls += ' sel';
                  const dis = answered || eliminated.has(c.id);
                  return `<button class="${cls}" data-id="${c.id}" ${dis ? 'disabled' : ''} style="${eliminated.has(c.id) ? 'opacity:.3' : ''}">
                    <span class="lt">${letters[i]}</span><span>${esc(c.th)}</span></button>`;
                }).join('')}</div>`}
            ${answered ? `
              <div class="quiz-explain">
                <div class="res" style="color:${answered.correct ? 'var(--good)' : 'var(--bad)'}">${answered.correct ? '✔ ถูกต้อง!' : '✘ ยังไม่ถูกนะ'}</div>
                ${fmtText(q.explanation.th)}
              </div>` : ''}
            <div class="quiz-foot">
              <div class="quiz-hint" id="hintbox">${hints > 0 ? hintText(q, hints) : ''}</div>
              <div class="row">
                ${answered
                  ? `${q.relatedCodex?.length ? '<button class="btn secondary small" id="qcodex">📖 เปิดการ์ดความรู้</button>' : ''}<button class="btn" id="qnext">${idx + 1 < total ? 'ข้อถัดไป ▶' : 'ดูผล'}</button>`
                  : `<button class="btn secondary small" id="qhint" ${hints >= 3 ? 'disabled' : ''}>💡 ถามอะมีบี้ (${3 - hints})</button>
                     <button class="btn" id="qok" ${q.type !== 'ORDER' && !selected.length ? 'disabled' : ''}>ยืนยันคำตอบ</button>`}
              </div>
            </div>
          </div>`;

        root.querySelectorAll<HTMLButtonElement>('.quiz-choice').forEach((b) => {
          b.onclick = () => {
            if (answered) return;
            sfx.ui();
            selected = [b.dataset.id!];
            paint(null);
          };
        });
        root.querySelectorAll<HTMLButtonElement>('[data-up]').forEach((b) => {
          b.onclick = () => { const i = Number(b.dataset.up); if (i > 0) { [order[i - 1], order[i]] = [order[i], order[i - 1]]; sfx.ui(); paint(null); } };
        });
        root.querySelectorAll<HTMLButtonElement>('[data-down]').forEach((b) => {
          b.onclick = () => { const i = Number(b.dataset.down); if (i < order.length - 1) { [order[i + 1], order[i]] = [order[i], order[i + 1]]; sfx.ui(); paint(null); } };
        });
        const hintBtn = root.querySelector('#qhint') as HTMLButtonElement | null;
        if (hintBtn) hintBtn.onclick = () => {
          hints++;
          if (hints === 2 && q.type !== 'ORDER') {
            const wrong = choices.filter((c) => !(q.type === 'TF' ? q.answer?.[0] === c.id : q.answer?.includes(c.id)) && !eliminated.has(c.id));
            if (wrong.length > 1 || (q.type !== 'TF' && wrong.length)) eliminated.add(wrong[0].id);
            selected = selected.filter((s) => !eliminated.has(s));
          }
          sfx.ui();
          paint(null);
        };
        const ok = root.querySelector('#qok') as HTMLButtonElement | null;
        if (ok) ok.onclick = () => {
          const given = q.type === 'ORDER' ? order : selected;
          const correct = opt.learning.checkAnswer(q, given);
          const rec = opt.learning.record(q, correct, hints);
          if (correct) {
            score++;
            sfx.correct();
            const r = opt.rewardPerCorrect ?? 0;
            crystals += hints > 0 ? Math.floor(r / 2) : r;
          } else sfx.wrong();
          if (rec.starUp) toast(`ความเชี่ยวชาญ "${topicLabel(q.topic)}" เพิ่มขึ้น ${starStr(starsFor(rec.after))}`);
          paint({ correct, given });
        };
        const next = root.querySelector('#qnext') as HTMLButtonElement | null;
        if (next) next.onclick = () => { sfx.ui(); idx++; render(); };
        const cdx = root.querySelector('#qcodex') as HTMLButtonElement | null;
        if (cdx) cdx.onclick = () => opt.onCodex?.(q.relatedCodex![0]);
      };

      if (onKey) window.removeEventListener('keydown', onKey);
      onKey = (e: KeyboardEvent) => {
        const m = /^Digit([1-4])$/.exec(e.code);
        if (m) (root.querySelectorAll<HTMLButtonElement>('.quiz-choice')[Number(m[1]) - 1])?.click();
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          ((root.querySelector('#qnext') ?? root.querySelector('#qok')) as HTMLButtonElement | null)?.click();
        }
        if (e.code === 'F1') { e.preventDefault(); (root.querySelector('#qhint') as HTMLButtonElement | null)?.click(); }
      };
      window.addEventListener('keydown', onKey);
      paint(null);
    };
    render();
  });
}

function hintText(q: QuestionDef, level: number): string {
  if (level === 1) return `💡 ${esc(q.hint?.th ?? 'ลองนึกถึงสิ่งที่เคยเห็นในการ์ดความรู้นะ!')}`;
  if (level === 2) return q.type === 'ORDER' ? `💡 ข้อแรกคือ "${esc(q.items![0])}"` : '💡 อะมีบี้ตัดตัวเลือกที่ผิดออกให้ 1 ข้อแล้ว!';
  const c = q.relatedCodex?.[0] ? data.codex.get(q.relatedCodex[0]) : null;
  return c ? `📖 ${esc(c.name.th)}: ${esc(c.body.th.slice(0, 140))}...` : '💡 อ่านโจทย์อีกครั้งช้า ๆ นะ';
}
