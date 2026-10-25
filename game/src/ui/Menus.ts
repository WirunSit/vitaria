import { CITY, CITY_RADIUS, DISTRICTS, mapXZ } from '../world/City';
import { GEN, GEN_SIZE, inGenovia } from '../world/Genovia';
import { FLO, FLO_SIZE, inFlorantis } from '../world/Florantis';
import { MET, MET_SIZE, inMetabolis } from '../world/Metabolis';
import { AQU, AQU_SIZE, inAquorra } from '../world/Aquorra';
import { NEU, NEU_SIZE, inNeurion } from '../world/Neurion';
import { ARB, ARB_SIZE, inRoots } from '../world/Roots';
import { ZEP, ZEP_SIZE, inZepheria } from '../world/Zepheria';
import { data } from '../core/Data';
import { ELEMENT_COLOR, ELEMENT_GLYPH, ELEMENT_TH, type CodexDef } from '../core/types';
import type { SaveData } from '../core/Save';
import { avatarPlaceholder, charArtName, elementIcon, iconSources, img, itemIcon, splashSources } from '../core/Assets';
import { sfx, setVolumes } from '../core/Audio';
import { starStr, starsFor, type Learning } from '../learning/Learning';
import type { QuestManager } from '../quest/QuestManager';
import { expToNext, levelCap, talentBonus, talentCap, talentCost, type PartyMember } from '../player/Party';
import { hasKit } from '../combat/Skills';
import { WORLD_SIZE } from '../world/Terrain';
import { esc, fmtText, getGender, h, openModal, toast } from './UI';
import { topicLabel } from './QuizUI';
import { renderRelicTab, renderWeaponTab, openInventory } from './GearUI';

export interface MenuHost {
  save: SaveData;
  learning: Learning;
  quests: QuestManager;
  member(id: string): PartyMember | null;
  partyIds(): string[];
  setParty(ids: string[]): void;
  useExp(charId: string, itemId: string): void;
  ascend(charId: string): Promise<void>;
  ascendCost(charId: string): { glucose: number; mats: { id: string; n: number }[] };
  teleport(waypointId: string): void;
  mapImage: HTMLCanvasElement;
  genoviaMap: HTMLCanvasElement;
  zepheriaMap: HTMLCanvasElement;
  florantisMap: HTMLCanvasElement;
  metabolisMap: HTMLCanvasElement;
  aquorraMap: HTMLCanvasElement;
  neurionMap: HTMLCanvasElement;
  rootsMap: HTMLCanvasElement;
  playerXZ(): { x: number; z: number };
  dailyReview(): void;
  saveNow(): void;
  quitToTitle(): void;
  settingsChanged(): void;
}

function menuShell(title: string, icon: string): { root: HTMLElement; body: HTMLElement; close: () => void } {
  const root = h(`<div class="menu-wrap"><div class="menu panel hex-bg"><button class="close-x">✕</button><h2>${icon} ${title}</h2><div class="mbody" style="flex:1;display:flex;flex-direction:column;min-height:0"></div></div></div>`);
  const close = openModal(root);
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); doClose(); } };
  const doClose = () => { window.removeEventListener('keydown', onKey); close(); };
  window.addEventListener('keydown', onKey);
  (root.querySelector('.close-x') as HTMLButtonElement).onclick = doClose;
  root.addEventListener('mousedown', (e) => { if (e.target === root) doClose(); });
  return { root, body: root.querySelector('.mbody') as HTMLElement, close: doClose };
}

// ------------------------------------------------------------------ Bio-Pedia
const CODEX_CATS: { id: CodexDef['category'] | 'ALL'; th: string }[] = [
  { id: 'ALL', th: 'ทั้งหมด' }, { id: 'CREATURE', th: 'สิ่งมีชีวิต' }, { id: 'ENEMY', th: 'ศัตรู' },
  { id: 'REACTION', th: 'ปฏิกิริยา' }, { id: 'CONCEPT', th: 'แนวคิด' }, { id: 'SCIENTIST', th: 'นักวิทยาศาสตร์' },
];

export function openCodex(host: MenuHost, focusId?: string, onTest?: (topic: string) => void) {
  const { body, close } = menuShell('Bio-Pedia สารานุกรมชีวภาพ', '📖');
  let cat: string = 'ALL';
  let sel = focusId ?? null;
  const render = () => {
    const unlocked = new Set(host.save.codex);
    const all = [...data.codex.values()].filter((c) => cat === 'ALL' || c.category === cat);
    const got = all.filter((c) => unlocked.has(c.id)).length;
    const cur = sel ? data.codex.get(sel) : null;
    body.innerHTML = `
      <div class="tabs">${CODEX_CATS.map((c) => `<button class="tab ${cat === c.id ? 'sel' : ''}" data-cat="${c.id}">${c.th}</button>`).join('')}
        <span style="margin-left:auto;opacity:.8">สะสมแล้ว ${got}/${all.length}</span></div>
      <div class="body">
        <div class="codex-grid">${all.map((c) => {
          const open = unlocked.has(c.id);
          return `<div class="codex-card ${open ? '' : 'locked'} ${sel === c.id ? 'sel' : ''}" data-id="${c.id}">
            <div class="art">${open ? img([`assets/codex/${c.id}.png`], avatarPlaceholder(c.glyph, '#3a4670')) : '❔'}</div>
            <div>${open ? esc(c.name.th) : '???'}</div></div>`;
        }).join('')}</div>
        <div class="detail">${cur && unlocked.has(cur.id) ? (() => {
          const m = cur.topic ? host.learning.mastery(cur.topic) : 0;
          return `<h3>${cur.glyph} ${esc(cur.name.th)}</h3><div class="en">${esc(cur.name.en ?? '')}${cur.topic ? ` · <span class="tagpill">#${esc(topicLabel(cur.topic))}</span>` : ''}</div>
            <p>${fmtText(cur.body.th)}</p>
            ${cur.didYouKnow ? `<div class="didyouknow">💡 <b>รู้หรือไม่?</b> ${fmtText(cur.didYouKnow.th)}</div>` : ''}
            ${cur.topic ? `<div class="row" style="margin-top:14px"><span>ความเชี่ยวชาญหัวข้อนี้</span><span class="stars">${starStr(starsFor(m))}</span><span style="opacity:.6">(${Math.round(m)}/100)</span>
              <button class="btn small" id="cdx-test" style="margin-left:auto">ทดสอบ 3 ข้อ</button></div>` : ''}`;
        })() : '<p style="opacity:.6">เลือกการ์ดเพื่ออ่านรายละเอียด · การ์ดใหม่ได้จากการสแกน (T) การทำปฏิกิริยาธาตุ และเควส</p>'}</div>
      </div>`;
    body.querySelectorAll<HTMLElement>('[data-cat]').forEach((b) => b.onclick = () => { cat = b.dataset.cat!; sfx.ui(); render(); });
    body.querySelectorAll<HTMLElement>('.codex-card').forEach((b) => b.onclick = () => { sel = b.dataset.id!; sfx.ui(); render(); });
    const t = body.querySelector('#cdx-test') as HTMLButtonElement | null;
    if (t && cur?.topic) t.onclick = () => { close(); onTest?.(cur.topic!); };
  };
  render();
}

// ------------------------------------------------------------------ Quest log
export function openQuestLog(host: MenuHost) {
  const { body } = menuShell('บันทึกเควส', '📜');
  let tab: 'ACTIVE' | 'DONE' = 'ACTIVE';
  let sel: string | null = host.save.trackedQuest;
  const render = () => {
    const st = host.save.quests;
    const list = [...data.quests.values()].filter((q) => (tab === 'ACTIVE' ? st[q.id]?.state === 'ACTIVE' || st[q.id]?.state === 'AVAILABLE' : st[q.id]?.state === 'COMPLETED'));
    if (sel && !list.find((q) => q.id === sel)) sel = list[0]?.id ?? null;
    const q = sel ? data.quests.get(sel) : null;
    const info = q ? host.quests.stepInfo(q.id) : null;
    body.innerHTML = `
      <div class="tabs"><button class="tab ${tab === 'ACTIVE' ? 'sel' : ''}" data-t="ACTIVE">กำลังทำ</button><button class="tab ${tab === 'DONE' ? 'sel' : ''}" data-t="DONE">เสร็จสิ้น</button></div>
      <div class="body">
        <div class="list">${list.length ? list.map((x) => `<div class="list-item ${sel === x.id ? 'sel' : ''}" data-id="${x.id}">
          <span class="qicon" style="background:${x.type === 'MAIN' ? 'var(--gold)' : '#7fb6e8'}"></span>
          <div><div>${esc(x.title.th)}</div><div class="sub">${x.type === 'MAIN' ? 'บันทึกแห่งชีวิต · บทนำ' : 'คำขอของโลก'}${host.save.trackedQuest === x.id ? ' · 📍 ติดตามอยู่' : ''}</div></div></div>`).join('') : '<div style="opacity:.6">ไม่มีเควส</div>'}</div>
        <div class="detail">${q ? `
          <h3>${esc(q.title.th)}</h3>
          <div class="en">${q.bioTopics.map((t) => `<span class="tagpill">#${esc(topicLabel(t))}</span>`).join('')}</div>
          <p>${fmtText(q.description.th)}</p>
          ${info ? `<div class="skill-desc"><b>ขั้นตอนปัจจุบัน:</b> ${esc(info.step.log.th)}<br>${info.step.objectives.map((o, i) => `▸ ${esc(host.quests.objectiveText(o, info.progress[i] ?? 0))} ${(info.progress[i] ?? 0) >= (o.count ?? 1) ? '✔' : ''}`).join('<br>')}</div>` : ''}
          <div style="margin:10px 0"><b style="color:var(--gold)">รางวัล:</b> ${q.rewards.map((r) => { const it = data.items.get(r.itemId); return `${itemIcon(r.itemId, 22)} ${esc(it?.name.th ?? r.itemId)} ×${r.count}`; }).join(' · ')}</div>
          ${tab === 'ACTIVE' && st[q.id]?.state === 'ACTIVE' ? `<button class="btn small" id="track">${host.save.trackedQuest === q.id ? 'เลิกติดตาม' : '📍 ติดตามเควสนี้'}</button>` : ''}` : ''}</div>
      </div>`;
    body.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t as 'ACTIVE' | 'DONE'; sel = null; render(); });
    body.querySelectorAll<HTMLElement>('.list-item').forEach((b) => b.onclick = () => { sel = b.dataset.id!; sfx.ui(); render(); });
    const tr = body.querySelector('#track') as HTMLButtonElement | null;
    if (tr && q) tr.onclick = () => { host.save.trackedQuest = host.save.trackedQuest === q.id ? null : q.id; sfx.ui(); render(); };
  };
  render();
}

// ------------------------------------------------------------------ Characters / party
export function openCharacters(host: MenuHost) {
  const { body } = menuShell('ตัวละครและทีม', '🧬');
  let sel = host.partyIds()[0];
  let tab: 'STATS' | 'WEAPON' | 'RELIC' | 'SKILLS' | 'GENE' | 'KNOW' = 'STATS';
  const render = () => {
    const party = host.partyIds();
    const def = data.characters.get(sel)!;
    const m = host.member(sel);
    const unlocked = host.save.unlockedChars.includes(sel);
    const art = charArtName(sel, getGender());
    const st = m?.stats();
    const cap = m ? levelCap(m.save.ascension) : 20;
    const cost = host.ascendCost(sel);
    const canAscend = !!m && m.level >= cap && m.save.ascension < 1;
    body.innerHTML = `
      <div class="body">
        <div class="char-list">${[...data.characters.values()].map((c) => {
          const have = host.save.unlockedChars.includes(c.id);
          const inParty = party.indexOf(c.id);
          const ph = avatarPlaceholder(c.name.th.charAt(0), ELEMENT_COLOR[c.element]);
          return `<div class="char-card ${sel === c.id ? 'sel' : ''} ${have ? '' : 'locked'}" data-id="${c.id}">
            ${img(iconSources(charArtName(c.id, getGender())), ph, 'avatar')}
            <div><div>${esc(c.name.th)}</div><div style="font-size:13px;color:${ELEMENT_COLOR[c.element]}">${elementIcon(c.element, 16)} ${'★'.repeat(c.rarity)}</div>
            <div style="font-size:12px;opacity:.7">${have ? `Lv.${host.member(c.id)?.level ?? 1}${(host.member(c.id)?.cons ?? 0) > 0 ? ` · C${host.member(c.id)!.cons}` : ''}` : c.rarity === 5 && c.id !== 'SEEKER' ? 'ได้จาก Gene Wish' : 'ยังไม่ได้รับ'}</div></div>
            ${inParty >= 0 ? `<span class="inparty">ทีม ${inParty + 1}</span>` : ''}</div>`;
        }).join('')}</div>
        <div class="detail">
          <div class="row" style="align-items:flex-start;gap:18px">
            ${img([...splashSources(art), ...iconSources(art)], avatarPlaceholder(def.name.th.charAt(0), ELEMENT_COLOR[def.element]), '', 'width:300px;height:200px;object-fit:cover;object-position:center 25%;border-radius:16px;border:2px solid var(--gold-dim)')}
            <div style="flex:1">
              <h3>${esc(def.name.th)} <span style="font-size:16px;color:var(--gold)">${'★'.repeat(def.rarity)}</span></h3>
              <div class="en">${esc(def.title.th)} · ${elementIcon(def.element, 18)} <span style="color:${ELEMENT_COLOR[def.element]}">${ELEMENT_TH[def.element]}</span> · ${def.weapon} · ${esc(def.role)}</div>
              <div style="font-size:15px;opacity:.85">🧬 แรงบันดาลใจ: ${esc(def.inspiration)}</div>
              <div style="font-size:15px;font-style:italic;margin-top:6px;opacity:.8">"${esc(def.quote.th)}"</div>
              ${unlocked ? `<div class="row" style="margin-top:10px">
                <button class="btn small" id="toggle-party">${party.includes(sel) ? 'นำออกจากทีม' : 'เพิ่มเข้าทีม'}</button>
                <span style="opacity:.6;font-size:13px">ทีมได้สูงสุด 4 คน</span></div>` : ''}
            </div>
          </div>
          <div class="tabs" style="margin-top:14px">
            <button class="tab ${tab === 'STATS' ? 'sel' : ''}" data-t="STATS">ค่าสถานะ</button>
            <button class="tab ${tab === 'WEAPON' ? 'sel' : ''}" data-t="WEAPON" ${unlocked ? '' : 'disabled'}>⚔ อาวุธ</button>
            <button class="tab ${tab === 'RELIC' ? 'sel' : ''}" data-t="RELIC" ${unlocked ? '' : 'disabled'}>🌸 Bio-Relic</button>
            <button class="tab ${tab === 'SKILLS' ? 'sel' : ''}" data-t="SKILLS">สกิล</button>
            <button class="tab ${tab === 'GENE' ? 'sel' : ''}" data-t="GENE">🧬 ลำดับยีน</button>
            <button class="tab ${tab === 'KNOW' ? 'sel' : ''}" data-t="KNOW">🧬 ความรู้</button>
          </div>
          ${tab === 'STATS' ? (m && st ? `
            <div style="font-size:20px">Lv. ${m.level} / ${cap} <span style="font-size:14px;opacity:.7">· EXP ${m.save.exp}/${expToNext(m.level)} · เลื่อนขั้น ${m.save.ascension}/6</span></div>
            <div class="stat-grid">
              <div><span>พลังชีวิต</span><b>${st.hp.toLocaleString()}</b></div><div><span>พลังโจมตี</span><b>${st.atk}</b></div>
              <div><span>พลังป้องกัน</span><b>${st.def}</b></div><div><span>ความชำนาญชีวภาพ</span><b>${st.bm}</b></div>
              <div><span>อัตราคริติคอล</span><b>${(st.critRate * 100).toFixed(1)}%</b></div><div><span>ดาเมจคริติคอล</span><b>${(st.critDmg * 100).toFixed(0)}%</b></div>
              <div><span>ฟื้นฟูพลังงาน</span><b>${(st.er * 100).toFixed(0)}%</b></div><div><span>โบนัสธาตุ</span><b>${(st.elemBonus * 100).toFixed(1)}%</b></div>
            </div>
            <div class="row">
              <button class="btn small" id="exp-mono" ${(host.save.inventory.EXP_MONO ?? 0) <= 0 || m.level >= cap ? 'disabled' : ''}>${itemIcon('EXP_MONO', 22)} ใช้น้ำตาลโมเลกุลเดี่ยว (${host.save.inventory.EXP_MONO ?? 0})</button>
              <button class="btn small" id="exp-di" ${(host.save.inventory.EXP_DI ?? 0) <= 0 || m.level >= cap ? 'disabled' : ''}>${itemIcon('EXP_DI', 22)} ใช้น้ำตาลโมเลกุลคู่ (${host.save.inventory.EXP_DI ?? 0})</button>
            </div>
            ${m.level >= cap ? `<div class="skill-desc" style="margin-top:12px"><b>การพัฒนาเซลล์ (เลื่อนขั้น)</b><br>
              ${canAscend ? `ต้องใช้: ⬡ ${cost.glucose.toLocaleString()} · ${cost.mats.map((x) => `${data.items.get(x.id)?.glyph} ${data.items.get(x.id)?.name.th} ${host.save.inventory[x.id] ?? 0}/${x.n}`).join(' · ')}<br>
              และผ่าน <b>บททดสอบเซลล์</b> 3 ข้อ (ถูกอย่างน้อย 2 ข้อ) เกี่ยวกับหัวข้อของตัวละคร<br><button class="btn small" id="ascend" style="margin-top:8px">เลื่อนขั้น</button>`
              : 'เลื่อนขั้นถัดไปจะเปิดในอัปเดตหน้า'}</div>` : ''}`
            : '<p style="opacity:.7">ยังไม่ได้รับตัวละครนี้</p>') : ''}
          ${tab === 'SKILLS' ? `
            ${[0, 1, 2].map((i) => {
              const title = i === 0 ? `โจมตีปกติ · ${esc(def.skills.normal.th)}` : i === 1 ? `สกิลธาตุ (E) · ${esc(def.skills.e.th)}` : `ท่าไม้ตาย (Q) · ${esc(def.skills.q.th)} <span style="opacity:.7">(พลังงาน ${def.burstCost})</span>`;
              const desc = i === 0 ? 'คลิกซ้ายเพื่อโจมตี กดค้างแล้วปล่อยเพื่อโจมตีหนัก' : i === 1 ? esc(def.skills.eDesc.th) : esc(def.skills.qDesc.th);
              const lv = m ? m.talent(i as 0 | 1 | 2) : 1;
              const tcap = m ? talentCap(m.save.ascension) : 3;
              const [tier, n, gl] = talentCost(lv);
              const book = `BOOK_${def.talentBook ?? 'CELL'}_${tier}`;
              const have = host.save.inventory[book] ?? 0;
              const can = !!m && lv < tcap && have >= n && (host.save.inventory.GLUCOSE ?? 0) >= gl;
              return `<div class="skill-desc"><div class="row" style="justify-content:space-between"><b>${title}</b><span class="tagpill">Lv.${lv}/${tcap} · ดาเมจ +${Math.round(talentBonus(lv) * 100)}%</span></div>${desc}
                ${m ? `<div class="row" style="margin-top:6px">${lv < tcap
                  ? `<button class="btn small" data-talent="${i}" ${can ? '' : 'disabled'}>อัปทาเลนต์</button>
                     <span style="font-size:14px;opacity:.85">${itemIcon(book, 20)} ${have}/${n} · ${itemIcon('GLUCOSE', 18)} ${gl.toLocaleString()}</span>`
                  : `<span style="font-size:14px;opacity:.7">${lv >= 10 ? 'สูงสุดแล้ว' : 'เลื่อนขั้นตัวละครเพื่อเพิ่มเลเวลสูงสุดของทาเลนต์'}</span>`}</div>` : ''}</div>`;
            }).join('')}
            <div style="font-size:13px;opacity:.65;margin-bottom:8px">📚 ตำรา "${esc(({ CELL: 'ทฤษฎีเซลล์', OBS: 'การสังเกต', HYP: 'สมมติฐาน' } as Record<string, string>)[def.talentBook ?? 'CELL'])}" ได้จากโดเมนห้องสมุดแห่งการสังเกต (แต่ละวันได้ตำราต่างกัน)</div>
            <div class="skill-desc"><b>Passive 1</b> ${esc(def.skills.a1.th)}</div>
            <div class="skill-desc"><b>Passive 2</b> ${esc(def.skills.a4.th)}</div>
            <div style="opacity:.6;font-size:14px">* Passive ปลดล็อกเมื่อเลื่อนขั้นครั้งแรก${hasKit(def.id) ? '' : ' · ชุดสกิลของตัวละครนี้กำลังพัฒนา'}</div>` : ''}
          ${tab === 'WEAPON' || tab === 'RELIC' ? '<div id="gear-tab"></div>' : ''}
          ${tab === 'GENE' ? (() => {
            const cons = m?.cons ?? 0;
            return `<div style="opacity:.8;margin-bottom:8px">ปลดลำดับยีนเมื่อได้ตัวละครนี้ซ้ำจาก Gene Wish (ปลดแล้ว ${cons}/6)</div>
              <div class="gene-seq">${(def.geneSeq ?? []).map((g, i) => `<div class="gs ${i < cons ? 'on' : ''}"><div class="c">C${i + 1}</div><div>${esc(g.th)}</div></div>`).join('')}</div>`;
          })() : ''}
          ${tab === 'KNOW' ? (() => {
            const ms = host.learning.mastery(def.topic);
            return `<div class="skill-desc"><b>หัวข้อที่ตัวละครนี้เป็นตัวแทน</b><br><span class="tagpill">#${esc(topicLabel(def.topic))}</span> ${esc(def.topic)}<br>
              ความเชี่ยวชาญ <span class="stars">${starStr(starsFor(ms))}</span> (${Math.round(ms)}/100)</div>
              <p>${esc(def.inspiration)}</p>`;
          })() : ''}
        </div>
      </div>`;
    body.querySelectorAll<HTMLElement>('.char-card').forEach((b) => b.onclick = () => { sel = b.dataset.id!; sfx.ui(); render(); });
    body.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t as typeof tab; sfx.ui(); render(); });
    const tp = body.querySelector('#toggle-party') as HTMLButtonElement | null;
    if (tp) tp.onclick = () => {
      let ids = host.partyIds();
      if (ids.includes(sel)) {
        if (ids.length <= 1) { toast('ทีมต้องมีอย่างน้อย 1 คน'); return; }
        ids = ids.filter((x) => x !== sel);
      } else {
        if (ids.length >= 4) { toast('ทีมเต็มแล้ว (4 คน)'); return; }
        if (!hasKit(sel)) { toast('ตัวละครนี้ยังไม่พร้อมใช้งาน'); return; }
        ids = [...ids, sel];
      }
      host.setParty(ids);
      sfx.ui();
      render();
    };
    const mono = body.querySelector('#exp-mono') as HTMLButtonElement | null;
    if (mono) mono.onclick = () => { host.useExp(sel, 'EXP_MONO'); render(); };
    const di = body.querySelector('#exp-di') as HTMLButtonElement | null;
    if (di) di.onclick = () => { host.useExp(sel, 'EXP_DI'); render(); };
    body.querySelectorAll<HTMLButtonElement>('[data-talent]').forEach((b) => b.onclick = () => {
      const m2 = host.member(sel);
      if (!m2) return;
      const i = Number(b.dataset.talent) as 0 | 1 | 2;
      const lv = m2.talent(i);
      const [tier, n, gl] = talentCost(lv);
      const book = `BOOK_${def.talentBook ?? 'CELL'}_${tier}`;
      if ((host.save.inventory[book] ?? 0) < n || (host.save.inventory.GLUCOSE ?? 0) < gl) return;
      host.save.inventory[book] -= n;
      host.save.inventory.GLUCOSE -= gl;
      const t = m2.save.talents ?? [1, 1, 1];
      t[i] = lv + 1;
      m2.save.talents = [t[0], t[1], t[2]];
      sfx.unlock();
      toast(`ทาเลนต์เพิ่มเป็น Lv.${lv + 1}!`);
      host.saveNow();
      render();
    });
    const gearEl = body.querySelector('#gear-tab') as HTMLElement | null;
    if (gearEl && unlocked) (tab === 'WEAPON' ? renderWeaponTab : renderRelicTab)(host, sel, gearEl, render);
    const asc = body.querySelector('#ascend') as HTMLButtonElement | null;
    if (asc) asc.onclick = async () => { await host.ascend(sel); render(); };
  };
  render();
}

// ------------------------------------------------------------------ Map
export function openMap(host: MenuHost) {
  const pNow = host.playerXZ();
  const gen = inGenovia(pNow.x, pNow.z), zep = inZepheria(pNow.x, pNow.z), flo = inFlorantis(pNow.x, pNow.z), met = inMetabolis(pNow.x, pNow.z), aqu = inAquorra(pNow.x, pNow.z), neu = inNeurion(pNow.x, pNow.z), arb = inRoots(pNow.x, pNow.z);
  const region = zep ? 'zep' : gen ? 'gen' : flo ? 'flo' : met ? 'met' : aqu ? 'aqu' : neu ? 'neu' : arb ? 'arb' : 'cyto';
  const inRegion = (x: number, z: number) => (inZepheria(x, z) ? 'zep' : inGenovia(x, z) ? 'gen' : inFlorantis(x, z) ? 'flo' : inMetabolis(x, z) ? 'met' : inAquorra(x, z) ? 'aqu' : inNeurion(x, z) ? 'neu' : inRoots(x, z) ? 'arb' : 'cyto') === region;
  const { body, close } = menuShell(zep ? 'แผนที่ · ซีเฟอเรีย' : gen ? 'แผนที่ · เจโนเวีย' : flo ? 'แผนที่ · ฟลอแรนทิส' : met ? 'แผนที่ · เมแทบอลิส' : aqu ? 'แผนที่ · อควอร์รา' : neu ? 'แผนที่ · นิวรีออน' : arb ? 'แผนที่ · รากต้นไม้แห่งชีวิต' : 'แผนที่ · หุบเซลล์', '🗺️');
  body.innerHTML = `<div class="mapview"><canvas></canvas></div><div style="margin-top:8px;opacity:.75;font-size:14px">คลิกจุดซินแนปส์ที่เปิดใช้งานแล้ว (สีฟ้า) เพื่อวาร์ป · จุดที่ยังไม่เปิดต้องเดินไปแตะก่อน</div>`;
  const view = body.querySelector('.mapview') as HTMLElement;
  const canvas = view.querySelector('canvas') as HTMLCanvasElement;
  const draw = () => {
    const r = view.getBoundingClientRect();
    canvas.width = r.width;
    canvas.height = r.height;
    const g = canvas.getContext('2d')!;
    const size = Math.min(r.width, r.height);
    const ox = (r.width - size) / 2, oy = (r.height - size) / 2;
    g.fillStyle = '#0d1530';
    g.fillRect(0, 0, r.width, r.height);
    g.drawImage(zep ? host.zepheriaMap : gen ? host.genoviaMap : flo ? host.florantisMap : met ? host.metabolisMap : aqu ? host.aquorraMap : neu ? host.neurionMap : arb ? host.rootsMap : host.mapImage, ox, oy, size, size);
    const toPx = zep
      ? (x: number, z: number) => [ox + ((x - ZEP.x) / ZEP_SIZE + 0.5) * size, oy + ((z - ZEP.z) / ZEP_SIZE + 0.5) * size]
      : gen
      ? (x: number, z: number) => [ox + ((x - GEN.x) / GEN_SIZE + 0.5) * size, oy + ((z - GEN.z) / GEN_SIZE + 0.5) * size]
      : flo
      ? (x: number, z: number) => [ox + ((x - FLO.x) / FLO_SIZE + 0.5) * size, oy + ((z - FLO.z) / FLO_SIZE + 0.5) * size]
      : met
      ? (x: number, z: number) => [ox + ((x - MET.x) / MET_SIZE + 0.5) * size, oy + ((z - MET.z) / MET_SIZE + 0.5) * size]
      : aqu
      ? (x: number, z: number) => [ox + ((x - AQU.x) / AQU_SIZE + 0.5) * size, oy + ((z - AQU.z) / AQU_SIZE + 0.5) * size]
      : neu
      ? (x: number, z: number) => [ox + ((x - NEU.x) / NEU_SIZE + 0.5) * size, oy + ((z - NEU.z) / NEU_SIZE + 0.5) * size]
      : arb
      ? (x: number, z: number) => [ox + ((x - ARB.x) / ARB_SIZE + 0.5) * size, oy + ((z - ARB.z) / ARB_SIZE + 0.5) * size]
      : (x0: number, z0: number) => { const { x, z } = mapXZ(x0, z0); return [ox + (x / WORLD_SIZE + 0.5) * size, oy + (z / WORLD_SIZE + 0.5) * size]; };
    // inset for Cellaria (drawn north of the gate)
    if (region === 'cyto') {
      const [cx, cy] = toPx(CITY.x, CITY.z);
      const rr = (CITY_RADIUS * 0.3 / WORLD_SIZE) * size;
      g.fillStyle = 'rgba(205,238,255,.55)'; g.strokeStyle = '#e8c468'; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill(); g.stroke();
      for (const d of DISTRICTS) {
        const [dx, dy] = toPx(CITY.x + d.x, CITY.z + d.z);
        g.fillStyle = d.color; g.beginPath(); g.arc(dx, dy, Math.max(2, (d.r * 0.3 / WORLD_SIZE) * size), 0, Math.PI * 2); g.fill();
      }
    }
    view.querySelectorAll('.map-pin').forEach((n) => n.remove());
    const pin = (x: number, z: number, icon: string, label: string, color: string, onClick?: () => void) => {
      const [px, py] = toPx(x, z);
      const el = h(`<div class="map-pin" style="left:${px}px;top:${py}px"><div class="ic" style="background:${color}">${icon}</div><div>${esc(label)}</div></div>`);
      if (onClick) el.onclick = onClick; else el.style.cursor = 'default';
      view.appendChild(el);
    };
    for (const l of data.locations.values()) {
      if (!inRegion(l.x, l.z)) continue;
      if (l.type === 'waypoint') {
        const on = host.save.world.waypoints.includes(l.id);
        pin(l.x, l.z, '⟡', l.name.th.replace('จุดซินแนปส์: ', ''), on ? '#2a8fa8' : '#555c70', on ? () => { close(); host.teleport(l.id); } : undefined);
      }
    }
    if (region === 'cyto') {
      const st = data.locations.get('LOC_STATUE');
      if (st) pin(st.x, st.z, '🌳', 'รูปปั้น', '#a8802a');
      const gate = data.locations.get('LOC_CELLARIA_GATE');
      if (gate) pin(gate.x, gate.z, '🏛️', 'นครเซลลาเรีย', '#6a4a9a');
    } else if (region === 'gen') {
      for (const [id, icon] of [['LOC_GEN_LIBRARY', '📚'], ['LOC_GEN_GREENHOUSE', '🌱'], ['LOC_GEN_VILLAGE', '🏘️'], ['LOC_GEN_CAVE', '🧬'], ['LOC_GEN_FORT', '🏴']] as const) {
        const l = data.locations.get(id);
        if (l) pin(l.x, l.z, icon, l.name.th, '#3a6a9a');
      }
    }
    if (region === 'zep') {
      for (const [id, icon] of [['LOC_ZEP_FINCH', '🐦'], ['LOC_ZEP_FOSSIL', '🦴'], ['LOC_ZEP_TAXON', '🍄'], ['LOC_ZEP_WEB', '🕸️'], ['LOC_ZEP_FADE', '🌪️']] as const) {
        const l = data.locations.get(id);
        if (l) pin(l.x, l.z, icon, l.name.th, '#3a7a6a');
      }
    }
    for (const t of host.quests.targets()) if (inRegion(t.x, t.z)) pin(t.x, t.z, '◆', t.label, '#c8a040');
    const p = host.playerXZ();
    pin(p.x, p.z, '▲', 'เธอ', '#e85a4a');
  };
  requestAnimationFrame(draw);
}

// ------------------------------------------------------------------ Esc menu
export function openEscMenu(host: MenuHost, actions: { codex: () => void; quests: () => void; chars: () => void; map: () => void; help: () => void; progress: () => void; wish: () => void }) {
  const root = h(`<div class="menu-wrap"><div class="esc-menu panel hex-bg">
    <h2>เมนูอะมีบี้</h2>
    <button class="btn" data-a="resume">▶ เล่นต่อ</button>
    <button class="btn secondary" data-a="daily">🧠 ทบทวนประจำวัน ${host.learning.canDailyReview() ? '<span style="color:var(--gold)">(พร้อม!)</span>' : '(ทำแล้ววันนี้)'}</button>
    <button class="btn secondary" data-a="progress">📊 รายงานการเรียนรู้</button>
    ${host.save.systems.includes('GENE_WISH') ? '<button class="btn secondary" data-a="wish">✨ Gene Wish (G)</button>' : ''}
    <button class="btn secondary" data-a="chars">🧬 ตัวละคร (C)</button>
    <button class="btn secondary" data-a="inv">🎒 กระเป๋า (B)</button>
    <button class="btn secondary" data-a="quests">📜 เควส (J)</button>
    <button class="btn secondary" data-a="codex">📖 Bio-Pedia (K)</button>
    <button class="btn secondary" data-a="map">🗺️ แผนที่ (M)</button>
    <button class="btn secondary" data-a="help">❓ วิธีเล่น (H)</button>
    <button class="btn secondary" data-a="credits">🙏 เครดิตโมเดล 3D</button>
    <div class="row" style="justify-content:space-between;margin-top:6px">
      <label style="font-size:15px">ความไวเมาส์ <input type="range" min="0.3" max="2.5" step="0.1" value="${host.save.settings.mouseSens}" id="sens"></label>
      <label style="font-size:15px"><input type="checkbox" id="shadows" ${host.save.settings.shadows ? 'checked' : ''}> เงา</label>
      <label style="font-size:15px"><input type="checkbox" id="showfps" ${host.save.settings.showFps ? 'checked' : ''}> แสดง FPS</label>
      <label style="font-size:15px">เพลง <input type="range" min="0" max="1" step="0.05" value="${host.save.settings.musicVol ?? 0.5}" id="musicvol"></label>
      <label style="font-size:15px">เสียงเอฟเฟกต์ <input type="range" min="0" max="1" step="0.05" value="${host.save.settings.sfxVol ?? 0.75}" id="sfxvol"></label>
      <label style="font-size:15px"><input type="checkbox" id="newgrass" ${host.save.settings.oldGrass ? '' : 'checked'}> หญ้าแบบใหม่</label>
      <label style="font-size:15px"><input type="checkbox" id="lookv2" ${host.save.settings.lookV2 === false ? '' : 'checked'}> ภาพแบบใหม่ (สีธรรมชาติ น้ำ ภูเขาไกล · มีผลหลังโหลดเกมใหม่)</label>
    </div>
    <label style="font-size:15px">หมุนกล้อง
      <select id="cammode">
        <option value="drag" ${host.save.settings.camMode !== 'lock' ? 'selected' : ''}>กดเมาส์ขวาค้างแล้วลาก</option>
        <option value="lock" ${host.save.settings.camMode === 'lock' ? 'selected' : ''}>ล็อกเมาส์ (แบบ Genshin บน PC)</option>
      </select></label>
    <label style="font-size:15px">คุณภาพกราฟิก
      <select id="gfx">
        <option value="high" ${(host.save.settings.graphics ?? 'high') === 'high' ? 'selected' : ''}>สูง (แสงฟุ้ง)</option>
        <option value="medium" ${host.save.settings.graphics === 'medium' ? 'selected' : ''}>กลาง</option>
        <option value="low" ${host.save.settings.graphics === 'low' ? 'selected' : ''}>ต่ำ (เครื่องช้า)</option>
      </select></label>
    <label style="font-size:14px;opacity:.85"><input type="checkbox" id="gacha" ${host.save.settings.gachaEnabled ? 'checked' : ''}> เปิดระบบสุ่ม Gene Wish <span style="opacity:.7">(ปิด = แลกตัวละครด้วยราคาคงที่ · โหมดห้องเรียน)</span></label>
    <div class="row" style="justify-content:space-between">
      <button class="btn secondary small" data-a="save">💾 บันทึก</button>
      <button class="btn secondary small" data-a="title">🏠 กลับหน้าแรก</button>
    </div>
  </div></div>`);
  const close = openModal(root);
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); done(); } };
  const done = () => { window.removeEventListener('keydown', onKey); close(); };
  setTimeout(() => window.addEventListener('keydown', onKey), 0);
  root.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((b) => b.onclick = () => {
    sfx.ui();
    const a = b.dataset.a!;
    if (a === 'resume') return done();
    if (a === 'save') { host.saveNow(); toast('บันทึกเกมแล้ว 💾'); return; }
    if (a === 'title') { done(); host.quitToTitle(); return; }
    done();
    if (a === 'daily') host.dailyReview();
    if (a === 'progress') actions.progress();
    if (a === 'chars') actions.chars();
    if (a === 'quests') actions.quests();
    if (a === 'codex') actions.codex();
    if (a === 'map') actions.map();
    if (a === 'help') actions.help();
    if (a === 'wish') actions.wish();
    if (a === 'inv') openInventory(host);
    if (a === 'credits') openCredits();
  });
  (root.querySelector('#sens') as HTMLInputElement).oninput = (e) => { host.save.settings.mouseSens = Number((e.target as HTMLInputElement).value); host.settingsChanged(); };
  (root.querySelector('#gfx') as HTMLSelectElement).onchange = (e) => { host.save.settings.graphics = (e.target as HTMLSelectElement).value as 'high' | 'medium' | 'low'; host.settingsChanged(); host.saveNow(); };
  (root.querySelector('#cammode') as HTMLSelectElement).onchange = (e) => { host.save.settings.camMode = (e.target as HTMLSelectElement).value as 'drag' | 'lock'; host.settingsChanged(); host.saveNow(); };
  const vol = () => { const st = host.save.settings; setVolumes({ music: st.musicVol ?? 0.5, sfx: st.sfxVol ?? 0.75, amb: (st.sfxVol ?? 0.75) * 0.8 }); };
  (root.querySelector('#musicvol') as HTMLInputElement).oninput = (e) => { host.save.settings.musicVol = +(e.target as HTMLInputElement).value; vol(); };
  (root.querySelector('#sfxvol') as HTMLInputElement).oninput = (e) => { host.save.settings.sfxVol = +(e.target as HTMLInputElement).value; vol(); sfx.ui(); };
  (root.querySelector('#lookv2') as HTMLInputElement).onchange = (e) => { host.save.settings.lookV2 = (e.target as HTMLInputElement).checked; host.saveNow(); toast('จะเปลี่ยนเมื่อโหลดเกมใหม่ (กด F5)'); };
  (root.querySelector('#newgrass') as HTMLInputElement).onchange = (e) => { host.save.settings.oldGrass = !(e.target as HTMLInputElement).checked; host.settingsChanged(); host.saveNow(); };
  (root.querySelector('#showfps') as HTMLInputElement).onchange = (e) => { host.save.settings.showFps = (e.target as HTMLInputElement).checked; host.settingsChanged(); host.saveNow(); };
  (root.querySelector('#shadows') as HTMLInputElement).onchange = (e) => { host.save.settings.shadows = (e.target as HTMLInputElement).checked; host.settingsChanged(); };
  (root.querySelector('#gacha') as HTMLInputElement).onchange = (e) => { host.save.settings.gachaEnabled = (e.target as HTMLInputElement).checked; host.saveNow(); };
}

// ------------------------------------------------------------------ Credits
/** Free models used in the game (CC BY requires naming the creators); written by tools/import_downloads.py. */
export function openCredits() {
  const { body } = menuShell('เครดิตโมเดล 3D', '🙏');
  body.innerHTML = '<div class="body"><div class="detail">กำลังโหลด…</div></div>';
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
  fetch('data/credits.json').then((r) => r.json()).then((list: { title: string; author: string; license: string; src: string; url: string }[]) => {
    body.innerHTML = `<div class="body"><div class="detail" style="overflow:auto">
      <p style="opacity:.8;margin-top:0">ขอบคุณผู้สร้างโมเดลที่เปิดให้ใช้ฟรีทุกท่าน</p>
      ${list.map((c) => `<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)">
        <b>${esc(c.title)}</b> — ${esc(c.author)}<br><span style="font-size:13px;opacity:.75">${esc(c.license)} · ${esc(c.src)} · ${esc(c.url)}</span></div>`).join('')}
    </div></div>`;
  }).catch(() => { body.innerHTML = '<div class="body"><div class="detail">ยังไม่มีรายการเครดิต</div></div>'; });
}

// ------------------------------------------------------------------ Help
export function openHelp() {
  const { body } = menuShell('วิธีเล่น', '❓');
  body.innerHTML = `<div class="body"><div class="detail">
    <div class="help-grid">
      <span class="k">W A S D / ลูกศร</span><span>เดิน (กดค้าง Shift = วิ่งเร็ว)</span>
      <span class="k">เมาส์ขวาค้าง + ลาก</span><span>หมุนกล้อง (ปุ่มกลางก็ได้) · ล้อเมาส์ = ซูม · เปลี่ยนเป็นแบบล็อกเมาส์ได้ในเมนู Esc</span>
      <span class="k">Space</span><span>กระโดด · กดอีกครั้งกลางอากาศ = ร่อน (เมื่อได้ปีกซามารา)</span>
      <span class="k">Shift / คลิกขวา</span><span>หลบ (ใช้ความอึด มีช่วงอมตะสั้น ๆ)</span>
      <span class="k">คลิกซ้าย</span><span>โจมตี · กดค้างแล้วปล่อย = โจมตีหนัก</span>
      <span class="k">E</span><span>สกิลธาตุ (ได้ลูกแสง ATP เติมพลังงาน)</span>
      <span class="k">Q</span><span>ท่าไม้ตาย (เมื่อพลังงานเต็ม)</span>
      <span class="k">1–4</span><span>สลับตัวละคร</span>
      <span class="k">F</span><span>คุย / ตรวจสอบ / เปิดหีบ / เก็บของ</span>
      <span class="k">T</span><span>Bio-Scanner — สแกนสิ่งมีชีวิตเพื่อปลดการ์ดความรู้</span>
      <span class="k">Z</span><span>ขว้างยาปฏิชีวนะ (ได้ผลกับแบคทีเรียเท่านั้น!)</span>
      <span class="k">J / K / C / M</span><span>เควส / Bio-Pedia / ตัวละคร / แผนที่</span>
      <span class="k">B / G</span><span>กระเป๋า (ไอเทม อาวุธ Bio-Relic) / Gene Wish</span>
      <span class="k">Esc</span><span>เมนู (ทบทวนประจำวัน, บันทึก)</span>
    </div>
    <div class="didyouknow" style="margin-top:16px">💡 <b>ปฏิกิริยาธาตุ</b>: โจมตีด้วยธาตุหนึ่งให้ศัตรูติดสถานะ (ไอคอนเหนือหัว) แล้วตามด้วยอีกธาตุ เช่น ไฟ → ศิลา = เยื่อหุ้มป้องกัน (ได้โล่), ไฟ → ลม = การแพร่ ทุกปฏิกิริยาสอนแนวคิดชีววิทยาจริง ลองหาให้ครบ!</div>
  </div></div>`;
}

// ------------------------------------------------------------------ Learning report
export function openProgress(host: MenuHost) {
  const { body } = menuShell('รายงานการเรียนรู้', '📊');
  const s = host.save;
  const groups = [
    { p: 'bio.intro', th: 'การศึกษาชีววิทยา' }, { p: 'bio.chem', th: 'เคมีของสิ่งมีชีวิต' }, { p: 'bio.cell', th: 'เซลล์' },
    { p: 'bio.genetics', th: 'พันธุศาสตร์' }, { p: 'bio.evolution', th: 'วิวัฒนาการ' }, { p: 'bio.biodiversity', th: 'ความหลากหลายทางชีวภาพ' },
    { p: 'bio.ecology', th: 'ระบบนิเวศ' }, { p: 'bio.plant', th: 'พืช' }, { p: 'bio.animal', th: 'ร่างกายสัตว์และมนุษย์' }, { p: 'bio.homeostasis', th: 'ดุลยภาพของร่างกาย' },
  ];
  const leaf = Object.entries(s.mastery).sort((a, b) => a[1] - b[1]);
  const acc = s.stats.answered ? Math.round((s.stats.correct / s.stats.answered) * 100) : 0;
  body.innerHTML = `<div class="body"><div class="detail">
    <div class="stat-grid">
      <div><span>ตอบคำถามทั้งหมด</span><b>${s.stats.answered} ข้อ</b></div>
      <div><span>ตอบถูก</span><b>${s.stats.correct} ข้อ (${acc}%)</b></div>
      <div><span>การ์ด Bio-Pedia</span><b>${s.codex.length}/${data.codex.size}</b></div>
      <div><span>ปฏิกิริยาที่ค้นพบ</span><b>${s.seenReactions.length}/12</b></div>
      <div><span>เวลาเล่น</span><b>${Math.floor(s.stats.playSeconds / 60)} นาที</b></div>
      <div><span>คำถามรอทบทวน</span><b>${Object.keys(s.leitner).length} ข้อ</b></div>
    </div>
    <h3 style="margin-top:16px">ความเชี่ยวชาญตามหมวด</h3>
    ${groups.map((g) => { const v = host.learning.masteryPrefix(g.p); return `<div class="row" style="margin:8px 0"><span style="width:200px">${g.th}</span>
      <div style="flex:1;height:12px;background:rgba(255,255,255,.1);border-radius:6px;overflow:hidden"><div style="height:100%;width:${v}%;background:linear-gradient(90deg,#e8c468,#7ddc8a)"></div></div>
      <span class="stars" style="width:70px;text-align:right">${starStr(starsFor(v))}</span></div>`; }).join('')}
    <h3 style="margin-top:16px">หัวข้อที่ควรทบทวน</h3>
    ${leaf.length ? leaf.slice(0, 5).map(([t, v]) => `<div>▸ ${esc(topicLabel(t))} <span style="opacity:.6">(${esc(t)})</span> — ${Math.round(v)}/100</div>`).join('') : '<p style="opacity:.6">ยังไม่มีข้อมูล ลองตอบคำถามในเกมก่อนนะ</p>'}
  </div></div>`;
}

// ------------------------------------------------------------------ Puzzle: plant experiment
/** Which plots (0..2) the player chose to water — the world shows those plants recovering. */
export let lastWateredPlots: number[] = [1];
export function runPlantExperiment(): Promise<boolean> {
  return new Promise((resolve) => {
    const root = h(`<div class="quiz-wrap"><div class="quiz-card panel hex-bg" style="width:min(980px,94vw)">
      <div class="quiz-head"><span class="ctx">ปริศนา · ออกแบบการทดลอง</span><span>สมมติฐาน: "ถ้าต้นไม้ได้รับน้ำเพียงพอ ต้นไม้จะกลับมาตั้งตรง"</span></div>
      <div class="quiz-stem" style="font-size:19px">กำหนดเงื่อนไขของแต่ละแปลงเพื่อทดสอบสมมติฐาน — <b style="color:var(--gold)">เปลี่ยนเฉพาะตัวแปรต้น (น้ำ)</b> ให้มีทั้งแปลงที่ได้น้ำและไม่ได้น้ำ ส่วนตัวแปรอื่นต้องเท่ากันทุกแปลง</div>
      <div class="puzzle-plots">${[1, 2, 3].map((i) => `<div class="plot"><h4>แปลงที่ ${i}</h4>
        <label>💧 น้ำ</label><select data-k="water" data-i="${i}"><option value="none">ไม่รดน้ำ</option><option value="yes">รดน้ำ</option></select>
        <label>☀️ แสง</label><select data-k="light" data-i="${i}"><option value="sun">แดดเต็มวัน</option><option value="shade">ร่มรำไร</option></select>
        <label>🪴 ดิน</label><select data-k="soil" data-i="${i}"><option value="loam">ดินร่วน</option><option value="sand">ดินทราย</option></select>
      </div>`).join('')}</div>
      <div class="quiz-explain" id="pz-msg" style="display:none"></div>
      <div class="quiz-foot"><div class="quiz-hint">💡 การทดลองที่ดีต้องมี "ชุดควบคุม" ด้วย</div>
        <div class="row"><button class="btn secondary small" id="pz-cancel">ไว้ทีหลัง</button><button class="btn" id="pz-ok">เริ่มการทดลอง</button></div></div>
    </div></div>`);
    const close = openModal(root);
    const val = (k: string, i: number) => (root.querySelector(`select[data-k="${k}"][data-i="${i}"]`) as HTMLSelectElement).value;
    (root.querySelector('#pz-cancel') as HTMLButtonElement).onclick = () => { close(); resolve(false); };
    (root.querySelector('#pz-ok') as HTMLButtonElement).onclick = () => {
      const msg = root.querySelector('#pz-msg') as HTMLElement;
      msg.style.display = '';
      const lights = new Set([1, 2, 3].map((i) => val('light', i)));
      const soils = new Set([1, 2, 3].map((i) => val('soil', i)));
      const waters = [1, 2, 3].map((i) => val('water', i));
      const watered = waters.filter((w) => w === 'yes').length;
      if (lights.size > 1 || soils.size > 1) {
        sfx.wrong();
        msg.innerHTML = '<div class="res" style="color:var(--bad)">✘ ยังไม่ใช่</div>แสงหรือดินของแต่ละแปลงไม่เท่ากัน ถ้าผลต่างกัน เราจะไม่รู้ว่าเกิดจากน้ำ แสง หรือดิน — <b>ตัวแปรควบคุม</b> ต้องเท่ากันทุกแปลง';
        return;
      }
      if (watered === 0 || watered === 3) {
        sfx.wrong();
        msg.innerHTML = `<div class="res" style="color:var(--bad)">✘ ยังไม่ใช่</div>${watered === 0 ? 'ไม่มีแปลงไหนได้รับน้ำเลย' : 'ทุกแปลงได้รับน้ำเหมือนกัน'} เราจึงเปรียบเทียบผลของน้ำไม่ได้ ต้องมีทั้งแปลงที่ <b>ได้น้ำ</b> และ <b>ไม่ได้น้ำ (ชุดควบคุม)</b>`;
        return;
      }
      lastWateredPlots = waters.map((w, i) => (w === 'yes' ? i : -1)).filter((i) => i >= 0);
      sfx.correct();
      msg.innerHTML = '<div class="res" style="color:var(--good)">✔ ออกแบบการทดลองได้ถูกต้อง!</div>เปลี่ยนตัวแปรต้นเพียงตัวเดียว (น้ำ) และควบคุมแสงกับดินให้เท่ากัน มีทั้งชุดทดลองและชุดควบคุม — ไปดูผลกันเลย!';
      (root.querySelector('#pz-ok') as HTMLButtonElement).textContent = 'ดูผลการทดลอง ▶';
      (root.querySelector('#pz-ok') as HTMLButtonElement).onclick = () => { close(); resolve(true); };
    };
  });
}
