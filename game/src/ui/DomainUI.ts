import { data } from '../core/Data';
import type { SaveData } from '../core/Save';
import type { DomainDef, QuestionDef } from '../core/types';
import { itemIcon } from '../core/Assets';
import { sfx } from '../core/Audio';
import { ATP_MAX, condense, fmtMs, msToNextAtp, refill, regenAtp, REFILL_CRYSTALS, REFILL_AMOUNT } from '../domain/Atp';
import { DOMAIN_COST, DOMAIN_LEVELS, DOMAIN_TIME, SERIES_TH, modifierFor, todaysSeries, type DomainController } from '../domain/DomainController';
import type { Learning } from '../learning/Learning';
import { runQuiz } from './QuizUI';
import { esc, h, openModal, toast } from './UI';

export interface DomainMenuHost {
  save: SaveData;
  learning: Learning;
  controller: DomainController;
  persist(): void;
  rewardIcon(id: string): string;
}

const TYPE_TH = { BOOK: 'ตำราทาเลนต์', ORE: 'แร่อัปเกรดอาวุธ + กลูโคส', RELIC: 'Bio-Relic' };

function rewardPreview(def: DomainDef, series: string | null): string {
  if (def.type === 'BOOK') {
    const s = series ?? 'CELL';
    return [1, 2, 3].map((t) => itemIcon(`BOOK_${s}_${t}`, 34)).join(' ');
  }
  if (def.type === 'ORE') return `${itemIcon('ORE_PHOSPHATE', 34)} ${itemIcon('ORE_CALCIUM', 34)} ${itemIcon('GLUCOSE', 34)} ${itemIcon('MAT_CALCITE', 34)}`;
  return ['ComplexEukaryote_NUCLEUS', 'PioneerProkaryote_MEMBRANE', 'SturdyPlantCell_VACUOLE', 'StemCellOrigin_FLAGELLUM']
    .map((k) => `<img src="assets/relics/RLC_${k}.png" style="width:34px;height:34px;object-fit:contain" alt="">`).join(' ');
}

function atpBar(s: SaveData): string {
  regenAtp(s);
  const next = msToNextAtp(s);
  return `<div class="row" style="gap:8px">${itemIcon('ATP', 26)} <b style="font-size:20px">${s.atp.cur}/${ATP_MAX}</b>
    <span style="opacity:.7;font-size:14px">${next ? `+1 ใน ${fmtMs(next)}` : 'เต็ม'}</span>
    <span style="margin-left:10px">${itemIcon('CREATINE', 24)} ×${s.inventory.CREATINE ?? 0}</span></div>`;
}

export function openDomainMenu(host: DomainMenuHost, def: DomainDef) {
  const root = h('<div class="menu-wrap"><div class="menu panel hex-bg domain-menu"><button class="close-x">✕</button><div class="dbody"></div></div></div>');
  const close = openModal(root);
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); fin(); } };
  const fin = () => { window.removeEventListener('keydown', onKey); close(); };
  window.addEventListener('keydown', onKey);
  (root.querySelector('.close-x') as HTMLButtonElement).onclick = fin;
  const body = root.querySelector('.dbody') as HTMLElement;
  let levelIdx = 0;
  let series = todaysSeries() ?? 'CELL';
  const chooseSeries = todaysSeries() === null;
  const mod = modifierFor(def.id);

  const render = () => {
    const s = host.save;
    body.innerHTML = `
      <div class="domain-hero" style="background-image:linear-gradient(90deg, rgba(10,14,32,.95) 35%, rgba(10,14,32,.3)), url(assets/environment/${def.art}.jpg)">
        <div style="font-size:14px;color:var(--gold);letter-spacing:2px">LAB DOMAIN · ${TYPE_TH[def.type]}</div>
        <h2 style="margin:4px 0">${esc(def.name.th)}</h2>
        <p style="max-width:540px;opacity:.9">${esc(def.desc.th)}</p>
        ${def.type === 'BOOK' ? `<div style="margin:6px 0">ตำราวันนี้: ${chooseSeries
          ? Object.keys(SERIES_TH).map((k) => `<button class="tab ${series === k ? 'sel' : ''}" data-series="${k}">${SERIES_TH[k]}</button>`).join(' ') + ' <span style="opacity:.7">(วันอาทิตย์เลือกได้)</span>'
          : `<b>${SERIES_TH[series]}</b> <span style="opacity:.7">(จันทร์/พฤหัส = ทฤษฎีเซลล์ · อังคาร/ศุกร์ = การสังเกต · พุธ/เสาร์ = สมมติฐาน · อาทิตย์ = เลือกเอง)</span>`}</div>` : ''}
      </div>
      <div class="row" style="align-items:flex-start;gap:20px;margin-top:12px">
        <div style="flex:1;min-width:300px">
          <div style="font-family:var(--font-head);margin-bottom:6px">ระดับความยาก</div>
          <div class="row">${DOMAIN_LEVELS.map((l, i) => {
            const locked = s.rr < l.rr;
            return `<button class="tab ${i === levelIdx ? 'sel' : ''}" data-lv="${i}" ${locked ? 'disabled' : ''}>ระดับ ${l.label} · ศัตรู Lv.${l.enemyLevel}${locked ? ` 🔒RR${l.rr}` : ''}</button>`;
          }).join('')}</div>
          <div class="skill-desc" style="margin-top:10px"><b style="color:#ffb36b">⚠ สภาพแวดล้อมผิดปกติวันนี้: ${esc(mod.th)}</b><br>${esc(mod.effect)}
            <div style="font-size:14px;opacity:.8;margin-top:4px">🔬 ${esc(mod.why)}</div></div>
          <div style="margin-top:6px;opacity:.8;font-size:15px">กำจัดศัตรู 2 คลื่นภายใน ${Math.floor(DOMAIN_TIME / 60)}:${String(DOMAIN_TIME % 60).padStart(2, '0')} นาที · ใช้ ATP ${DOMAIN_COST} ตอนรับรางวัล (ล้มเหลวไม่เสีย)</div>
        </div>
        <div style="flex:1;min-width:260px">
          <div style="font-family:var(--font-head);margin-bottom:6px">รางวัลที่เป็นไปได้</div>
          <div>${rewardPreview(def, series)}</div>
          <div style="margin-top:14px">${atpBar(s)}</div>
          <div class="row" style="margin-top:8px">
            <button class="btn secondary small" id="d-cond">อัดเป็นครีเอทีน (ATP 40)</button>
            <button class="btn secondary small" id="d-ref">เติม ATP +${REFILL_AMOUNT} (${itemIcon('INSIGHT_CRYSTAL', 16)}${REFILL_CRYSTALS})</button>
          </div>
        </div>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:14px;gap:10px">
        <span style="opacity:.75;font-size:14px">🧠 Lab Pre-check: ตอบคำถาม 1 ข้อก่อนเข้า ถ้าถูกได้รางวัลเพิ่ม +1</span>
        <button class="btn secondary" id="d-skip">เข้าเลย</button>
        <button class="btn" id="d-check">ตอบ Pre-check แล้วเข้า</button>
      </div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-lv]').forEach((b) => b.onclick = () => { levelIdx = Number(b.dataset.lv); sfx.ui(); render(); });
    body.querySelectorAll<HTMLButtonElement>('[data-series]').forEach((b) => b.onclick = () => { series = b.dataset.series!; sfx.ui(); render(); });
    (body.querySelector('#d-cond') as HTMLButtonElement).onclick = () => { const err = condense(host.save); if (err) toast(err); else { sfx.pickup(); toast('ได้รับครีเอทีนฟอสเฟต ×1'); host.persist(); } render(); };
    (body.querySelector('#d-ref') as HTMLButtonElement).onclick = () => { const err = refill(host.save); if (err) toast(err); else { sfx.pickup(); host.persist(); } render(); };
    const start = (pre: boolean) => { fin(); host.controller.enter(def, levelIdx, def.type === 'BOOK' ? series : null, pre); };
    (body.querySelector('#d-skip') as HTMLButtonElement).onclick = () => start(false);
    (body.querySelector('#d-check') as HTMLButtonElement).onclick = async () => {
      const q = host.learning.pickByTopic(def.topic, 1);
      fin();
      const res = await runQuiz({ questions: q as QuestionDef[], title: 'Lab Pre-check', context: `🧪 ${def.name.th}`, asker: 'LYSO', learning: host.learning, showResult: false });
      if (res.score > 0) toast('Pre-check ผ่าน! รางวัลเพิ่ม +1');
      host.controller.enter(def, levelIdx, def.type === 'BOOK' ? series : null, res.score > 0);
    };
  };
  render();
}

/** Shown at the reward pedestal after clearing (or on failure). */
export function openDomainResult(host: DomainMenuHost) {
  const c = host.controller;
  const r = c.run;
  if (!r) return;
  const root = h('<div class="quiz-wrap"><div class="quiz-card panel hex-bg" style="text-align:center"><div class="rbody"></div></div></div>');
  const close = openModal(root);
  const body = root.querySelector('.rbody') as HTMLElement;
  let claimed = false;
  const render = () => {
    const s = host.save;
    body.innerHTML = r.state === 'failed'
      ? `<h2 style="font-family:var(--font-head);color:var(--bad)">การทดลองล้มเหลว</h2><p>ไม่เสีย ATP — ปรับทีมหรือลดระดับความยากแล้วลองใหม่ได้</p>
         <div class="row" style="justify-content:center"><button class="btn secondary" id="r-exit">ออกจากโดเมน</button><button class="btn" id="r-retry">ลองอีกครั้ง</button></div>`
      : claimed
        ? `<h2 style="font-family:var(--font-head);color:var(--gold)">รับรางวัลแล้ว!</h2>${atpBar(s)}
           <div class="row" style="justify-content:center;margin-top:14px"><button class="btn secondary" id="r-exit">ออกจากโดเมน</button><button class="btn" id="r-retry">ท้าทายอีกครั้ง</button></div>`
        : `<h2 style="font-family:var(--font-head);color:var(--gold)">🧪 รับรางวัลการทดลอง</h2>
           <div style="margin:8px 0">${rewardPreview(r.def, r.series)}</div>${r.precheck ? '<div style="color:var(--good)">✔ Pre-check ผ่าน: รางวัลเพิ่ม +1</div>' : ''}
           <div style="display:flex;justify-content:center;margin:10px 0">${atpBar(s)}</div>
           <div class="row" style="justify-content:center">
             <button class="btn" id="r-atp">ใช้ ATP ${DOMAIN_COST}</button>
             <button class="btn" id="r-cre" ${(s.inventory.CREATINE ?? 0) <= 0 ? 'disabled' : ''}>ใช้ครีเอทีนฟอสเฟต (รางวัล ×2)</button>
             <button class="btn secondary" id="r-no">ไม่รับ</button>
           </div>`;
    const bind = (id: string, fn: () => void) => { const b = body.querySelector(id) as HTMLButtonElement | null; if (b) b.onclick = fn; };
    bind('#r-exit', () => { close(); c.exit(); });
    bind('#r-retry', () => { close(); c.retry(); });
    bind('#r-no', () => { close(); c.exit(); });
    const pay = (cre: boolean) => { const err = c.claim(cre); if (err) { toast(err); return; } claimed = true; sfx.unlock(); host.persist(); render(); };
    bind('#r-atp', () => pay(false));
    bind('#r-cre', () => pay(true));
  };
  render();
}

export function domainDef(id: string) { return data.domains.get(id)!; }
