import { data } from '../core/Data';
import { ELEMENT_COLOR, ELEMENT_GLYPH } from '../core/types';
import type { SaveData } from '../core/Save';
import { avatarPlaceholder, charArtName, elementIcon, iconSources, img, itemIcon, portraitPlaceholder, splashSources } from '../core/Assets';
import { sfx } from '../core/Audio';
import {
  BANNERS, BASE4, BASE5, HARD_PITY, PITY4, SEED_PRICE, SOFT_PITY, STARGLITTER_PER_SEED,
  atLeastOneNoPity, expectedPulls, isBannerOpen, pullMany, withinNWithPity, type BannerDef, type PullResult,
} from '../gacha/Gacha';
import { esc, getGender, h, openModal, toast } from './UI';
import { gearData, weaponImage } from '../gear/Gear';

export interface ResultInfo { isNew: boolean; cons: number; starglitter: number }

export interface WishHost {
  save: SaveData;
  applyResults(res: PullResult[]): ResultInfo[];
  probabilityQuiz(): Promise<void>;
  buyCharacter(id: string): void;
  persist(): void;
}

const RARITY_COLOR: Record<number, string> = { 3: '#6fb6ff', 4: '#c58bff', 5: '#ffcf5a' };
const SHOP_PRICE: Record<number, number> = { 4: 1600, 5: 8000 };

function inv(host: WishHost, id: string) { return host.save.inventory[id] ?? 0; }

function bannerArt(b: BannerDef): string {
  const file = b.id.charAt(0).toUpperCase() + b.id.slice(1);
  const featured = b.featured5[0] ?? b.pool5[0];
  const art = charArtName(featured, getGender());
  const def = data.characters.get(featured)!;
  return img(
    [`assets/ui/UI_Banner_${file}.jpg`, ...splashSources(art), `assets/characters/CHR_${art}_Portrait_Happy.webp`],
    portraitPlaceholder(ELEMENT_COLOR[def.element], def.appearance.hair),
    'wish-art',
  );
}

// ======================================================================= main screen
export function openWish(host: WishHost) {
  const root = h('<div class="menu-wrap"><div class="menu panel hex-bg wish-menu"><button class="close-x">✕</button><div class="wish-body"></div></div></div>');
  const close = openModal(root);
  const body = root.querySelector('.wish-body') as HTMLElement;
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape' && !document.querySelector('.wish-anim,.wish-sub')) { e.preventDefault(); done(); } };
  const done = () => { window.removeEventListener('keydown', onKey); close(); };
  window.addEventListener('keydown', onKey);
  (root.querySelector('.close-x') as HTMLButtonElement).onclick = done;

  if (!host.save.settings.gachaEnabled) { renderShop(host, body); return; }

  let sel: BannerDef = BANNERS.find((b) => isBannerOpen(host.save.gacha, b)) ?? BANNERS[1];

  const render = () => {
    const g = host.save.gacha;
    const open = BANNERS.filter((b) => isBannerOpen(g, b));
    if (!open.includes(sel)) sel = open[0];
    const st = g[sel.id];
    const seeds = inv(host, 'GENE_SEED');
    const left = sel.id === 'novice' ? (sel.maxPulls ?? 20) - st.pulls : HARD_PITY - st.pity5;
    const featuredLine = sel.featured5.length
      ? sel.featured5.map((id) => { const c = data.characters.get(id)!; return `<span style="color:${ELEMENT_COLOR[c.element]}">${elementIcon(c.element, 20)} ${esc(c.name.th)} ★5</span>`; }).join(' ')
      : sel.pool5.map((id) => esc(data.characters.get(id)!.name.th)).join(' · ') + ' (★5)';
    body.innerHTML = `
      <div class="wish-top">
        <h2>🧬 Gene Wish <span style="font-size:15px;color:var(--cream-dim);font-family:var(--font)">การสุ่มพันธุกรรม · ไม่ใช้เงินจริง</span></h2>
        <div class="row">
          <div class="hud-chip">${itemIcon('GENE_SEED')} ${seeds}</div><div class="hud-chip">${itemIcon('INSIGHT_CRYSTAL')} ${inv(host, 'INSIGHT_CRYSTAL').toLocaleString()}</div><div class="hud-chip">${itemIcon('STARGLITTER')} ${inv(host, 'STARGLITTER')}</div>
          <button class="btn secondary small" id="w-ex">＋ แลกเมล็ด</button>
        </div>
      </div>
      <div class="wish-main">
        <div class="wish-tabs">${open.map((b) => `<div class="wish-tab ${b === sel ? 'sel' : ''}" data-b="${b.id}" style="--bc:${b.color}"><b>${esc(b.name)}</b><span>${b.id === 'novice' ? 'มือใหม่' : b.id === 'featured' ? 'แบนเนอร์' : 'ถาวร'}</span></div>`).join('')}</div>
        <div class="wish-banner" style="--bc:${sel.color}">
          ${bannerArt(sel)}
          <div class="wish-info">
            <div class="wish-title">${esc(sel.name)}</div>
            <div class="wish-sub-t">${esc(sel.subtitle)}</div>
            <div style="margin-top:8px">${featuredLine}</div>
            <div style="font-size:14px;opacity:.85;margin-top:4px">★4: ${sel.pool4.map((id) => esc(data.characters.get(id)!.name.th)).join(' · ')}</div>
          </div>
          <div class="wish-pity">
            ${sel.id === 'novice'
              ? `เหลือ ${left} ครั้ง · การันตี ★5 ฮีม่า ภายในครั้งที่ 20`
              : `สุ่มมาแล้ว <b>${st.pity5}</b> ครั้งนับจาก ★5 ล่าสุด · การันตี ★5 ภายในอีก <b>${left}</b> ครั้ง${sel.id === 'featured' ? ` · ${st.guaranteed ? '<span style="color:var(--gold)">ครั้งหน้าการันตีตัวเด่น!</span>' : 'โอกาสได้ตัวเด่น 50%'}` : ''}`}
            <div class="pitybar"><div style="width:${sel.id === 'novice' ? (st.pulls / (sel.maxPulls ?? 20)) * 100 : (st.pity5 / HARD_PITY) * 100}%;background:${sel.color}"></div></div>
          </div>
        </div>
      </div>
      <div class="wish-foot">
        <div class="row">
          <button class="btn secondary small" id="w-rates">📋 รายละเอียด</button>
          <button class="btn secondary small" id="w-hist">🕘 ประวัติ</button>
          <button class="btn secondary small" id="w-why" style="color:var(--gold)">🎲 ทำไมถึงเป็นอัตรานี้?</button>
        </div>
        <div class="row">
          ${sel.tenOnly ? '' : `<button class="btn wish-btn" id="w-1">สุ่ม 1 ครั้ง<small>${itemIcon('GENE_SEED', 18)} × ${sel.cost1}</small></button>`}
          <button class="btn wish-btn" id="w-10">สุ่ม 10 ครั้ง<small>${itemIcon('GENE_SEED', 18)} × ${sel.cost10}</small></button>
        </div>
      </div>`;
    body.querySelectorAll<HTMLElement>('.wish-tab').forEach((t) => t.onclick = () => { sel = BANNERS.find((b) => b.id === t.dataset.b)!; sfx.ui(); render(); });
    (body.querySelector('#w-ex') as HTMLButtonElement).onclick = () => exchange(host, render);
    (body.querySelector('#w-rates') as HTMLButtonElement).onclick = () => rates(sel);
    (body.querySelector('#w-hist') as HTMLButtonElement).onclick = () => history(host);
    (body.querySelector('#w-why') as HTMLButtonElement).onclick = () => probabilityLab(host);
    const doPull = async (n: number, cost: number) => {
      if (inv(host, 'GENE_SEED') < cost) {
        const need = cost - inv(host, 'GENE_SEED');
        toast(`เมล็ดพันธุกรรมไม่พอ (ขาดอีก ${need}) — แลกได้ด้วยผลึกปัญญา ${SEED_PRICE} ผลึก/เมล็ด`);
        exchange(host, render, need);
        return;
      }
      host.save.inventory.GENE_SEED -= cost;
      const res = pullMany(host.save.gacha, sel, n);
      const infos = host.applyResults(res);
      host.persist();
      await playAnimation(res, infos);
      render();
    };
    const b1 = body.querySelector('#w-1') as HTMLButtonElement | null;
    if (b1) b1.onclick = () => doPull(1, sel.cost1);
    (body.querySelector('#w-10') as HTMLButtonElement).onclick = () => doPull(10, sel.cost10);
  };
  render();
}

// ======================================================================= sub panels
function subPanel(title: string, html: string, wide = false): { root: HTMLElement; close: () => void } {
  const root = h(`<div class="quiz-wrap wish-sub"><div class="quiz-card panel hex-bg" style="${wide ? 'width:min(980px,94vw)' : ''};max-height:88vh;overflow-y:auto">
    <button class="close-x">✕</button><h2 style="margin:0 0 12px;font-family:var(--font-head);color:var(--gold)">${title}</h2>${html}</div></div>`);
  const close = openModal(root);
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); fin(); } };
  const fin = () => { window.removeEventListener('keydown', onKey, true); close(); };
  window.addEventListener('keydown', onKey, true);
  (root.querySelector('.close-x') as HTMLButtonElement).onclick = fin;
  return { root, close: fin };
}

function exchange(host: WishHost, after: () => void, suggest = 1) {
  const crystals = inv(host, 'INSIGHT_CRYSTAL');
  const maxBuy = Math.floor(crystals / SEED_PRICE);
  const glitter = inv(host, 'STARGLITTER');
  let n = Math.max(1, Math.min(suggest, Math.max(1, maxBuy)));
  const { root, close } = subPanel('แลกเมล็ดพันธุกรรม', `
    <p>💎 ผลึกปัญญา <b>${SEED_PRICE}</b> → 🧬 เมล็ดพันธุกรรม <b>1</b> · มีผลึก ${crystals.toLocaleString()} (แลกได้สูงสุด ${maxBuy} เมล็ด)</p>
    <div class="row" style="justify-content:center;font-size:24px">
      <button class="btn secondary small" id="ex-m">−</button><b id="ex-n" style="min-width:60px;text-align:center">${n}</b><button class="btn secondary small" id="ex-p">＋</button>
      <button class="btn secondary small" id="ex-max">สูงสุด</button>
    </div>
    <p style="text-align:center;opacity:.8" id="ex-cost"></p>
    <div class="row" style="justify-content:center"><button class="btn" id="ex-ok" ${maxBuy <= 0 ? 'disabled' : ''}>แลก</button></div>
    <hr style="border-color:rgba(255,255,255,.1);margin:18px 0">
    <p>✨ ผลึกดาวพันธุกรรม <b>${STARGLITTER_PER_SEED}</b> → 🧬 <b>1</b> · มี ${glitter}</p>
    <div class="row" style="justify-content:center"><button class="btn secondary" id="ex-g" ${glitter < STARGLITTER_PER_SEED ? 'disabled' : ''}>แลก 1 เมล็ด</button></div>
    <p style="font-size:14px;opacity:.7;margin-top:14px">💡 หาผลึกปัญญาได้จาก: เควส · หีบ · ตอบคำถามถูก · ทบทวนประจำวัน · สแกนสิ่งมีชีวิตใหม่ · ปฏิกิริยาธาตุใหม่</p>`);
  const upd = () => {
    (root.querySelector('#ex-n') as HTMLElement).textContent = String(n);
    (root.querySelector('#ex-cost') as HTMLElement).textContent = `ใช้ผลึกปัญญา ${(n * SEED_PRICE).toLocaleString()}`;
  };
  upd();
  (root.querySelector('#ex-m') as HTMLButtonElement).onclick = () => { n = Math.max(1, n - 1); upd(); };
  (root.querySelector('#ex-p') as HTMLButtonElement).onclick = () => { n = Math.min(Math.max(1, maxBuy), n + 1); upd(); };
  (root.querySelector('#ex-max') as HTMLButtonElement).onclick = () => { n = Math.max(1, maxBuy); upd(); };
  (root.querySelector('#ex-ok') as HTMLButtonElement).onclick = () => {
    if (n * SEED_PRICE > inv(host, 'INSIGHT_CRYSTAL')) return;
    host.save.inventory.INSIGHT_CRYSTAL -= n * SEED_PRICE;
    host.save.inventory.GENE_SEED = inv(host, 'GENE_SEED') + n;
    sfx.pickup();
    toast(`ได้รับ 🧬 เมล็ดพันธุกรรม ×${n}`);
    host.persist();
    close();
    after();
  };
  (root.querySelector('#ex-g') as HTMLButtonElement).onclick = () => {
    if (inv(host, 'STARGLITTER') < STARGLITTER_PER_SEED) return;
    host.save.inventory.STARGLITTER -= STARGLITTER_PER_SEED;
    host.save.inventory.GENE_SEED = inv(host, 'GENE_SEED') + 1;
    sfx.pickup();
    host.persist();
    close();
    after();
  };
}

function rates(b: BannerDef) {
  subPanel(`รายละเอียด · ${esc(b.name)}`, `
    <table class="wish-table">
      <tr><th>ระดับ</th><th>อัตราพื้นฐาน</th><th>กติกาการันตี</th></tr>
      <tr><td style="color:${RARITY_COLOR[5]}">★5 ตัวละคร</td><td>${(BASE5 * 100).toFixed(1)}%</td><td>ตั้งแต่ครั้งที่ ${SOFT_PITY + 1} โอกาสเพิ่มครั้งละ 8% · การันตีภายใน ${HARD_PITY} ครั้ง${b.id === 'novice' ? ' (ตู้นี้การันตีภายใน 20 ครั้ง)' : ''}</td></tr>
      <tr><td style="color:${RARITY_COLOR[4]}">★4 ตัวละคร / อาวุธ (อย่างละ 50%)</td><td>${(BASE4 * 100).toFixed(1)}%</td><td>การันตีอย่างน้อย 1 ตัวทุก ${PITY4} ครั้ง</td></tr>
      <tr><td style="color:${RARITY_COLOR[3]}">★3 อาวุธ / วัตถุดิบ</td><td>ที่เหลือ</td><td>อาวุธ ★3 (75%) หรือ น้ำตาล EXP · กลูโคส · เมือกแบคทีเรีย · ผลึกแคลไซต์ (25%) — อาวุธซ้ำใช้หลอมรวมได้</td></tr>
    </table>
    ${b.id === 'featured' ? '<p>🎯 <b>50/50:</b> เมื่อได้ ★5 มีโอกาส 50% เป็นตัวเด่น ถ้าไม่ใช่ ★5 ครั้งถัดไปการันตีเป็นตัวเด่นแน่นอน</p>' : ''}
    <p>🔁 <b>ได้ตัวซ้ำ:</b> ปลด "ลำดับยีน" ขั้นถัดไป (สูงสุด C6) และได้ ✨ ผลึกดาว (★4 = 2, ★5 = 10 · หลัง C6 ได้ 5 / 25)</p>
    <p>📊 จำนวนครั้งเฉลี่ยกว่าจะได้ ★5 (คำนวณจากกติกาจริง): <b>${expectedPulls().toFixed(1)} ครั้ง</b></p>
    <p style="opacity:.7;font-size:14px">ระบบนี้ใช้สกุลเงินที่ได้จากการเล่นและการเรียนเท่านั้น ไม่มีการซื้อด้วยเงินจริง · ครูสามารถปิดระบบสุ่มได้</p>`, true);
}

function history(host: WishHost) {
  const list = host.save.gacha.history;
  subPanel('ประวัติการสุ่ม', list.length ? `<table class="wish-table">
    <tr><th>เวลา</th><th>ตู้</th><th>ผลลัพธ์</th></tr>
    ${list.map((r) => {
      const name = data.characters.get(r.id)?.name.th ?? data.items.get(r.id)?.name.th ?? r.id;
      const ban = BANNERS.find((b) => b.id === r.banner)?.name ?? r.banner;
      const d = new Date(r.t);
      return `<tr><td>${d.toLocaleDateString('th-TH')} ${d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</td><td>${esc(ban)}</td><td style="color:${RARITY_COLOR[r.rarity]}">${'★'.repeat(r.rarity)} ${esc(name)}</td></tr>`;
    }).join('')}</table>` : '<p style="opacity:.7">ยังไม่มีประวัติการสุ่ม</p>', true);
}

/** 🎲 Learning panel: probability the way Mendel used it. */
function probabilityLab(host: WishHost) {
  const { root, close } = subPanel('🎲 ห้องแล็บความน่าจะเป็น', `
    <p>การสุ่มแต่ละครั้งเป็น <b>เหตุการณ์อิสระ</b> เหมือนการที่เซลล์สืบพันธุ์แต่ละเซลล์ได้รับอัลลีลจากพ่อแม่ — เมนเดลใช้หลักเดียวกันนี้อธิบายอัตราส่วน 3 : 1 ในถั่วลันเตา</p>
    <div class="row" style="align-items:flex-start;gap:24px">
      <div>
        <div style="font-family:var(--font-head);margin-bottom:6px">Punnett Square: Aa × Aa</div>
        <table class="punnett"><tr><th></th><th>A</th><th>a</th></tr>
          <tr><th>A</th><td>AA</td><td>Aa</td></tr><tr><th>a</th><td>Aa</td><td class="hl">aa</td></tr></table>
        <div style="font-size:14px;margin-top:6px">โอกาสได้ aa = ½ × ½ = <b>¼</b> (กฎการคูณ)</div>
      </div>
      <div style="flex:1;min-width:280px">
        <div style="font-family:var(--font-head)">ทดลองคำนวณ: สุ่ม <b id="pl-n">10</b> ครั้ง</div>
        <input type="range" id="pl-r" min="1" max="${HARD_PITY}" value="10" style="width:100%">
        <div class="skill-desc">ถ้า <b>ไม่มี</b> ระบบการันตี: โอกาสได้ ★5 อย่างน้อย 1 ตัว = 1 − (1 − 0.012)<sup>n</sup> = <b id="pl-a"></b></div>
        <div class="skill-desc">ด้วย <b>กติกาจริงของเกม</b> (การันตี): <b id="pl-b"></b></div>
        <div style="font-size:14px;opacity:.8">สังเกต: สุ่ม 2 ครั้ง โอกาสได้ ★5 <i>ทั้งสองครั้ง</i> = 0.012 × 0.012 = 0.0144% (ไม่ใช่ 2.4%!)</div>
      </div>
    </div>
    <div class="didyouknow">💡 <b>Gambler's Fallacy</b> — "ไม่ได้มาหลายครั้งแล้ว ครั้งหน้าต้องได้แน่" เป็นความเชื่อที่ผิดสำหรับเหตุการณ์อิสระ ในเกมนี้โอกาสเพิ่มขึ้นจริงก็เพราะ <b>กติกาการันตี</b> ที่ออกแบบไว้เท่านั้น</div>
    <div class="row" style="justify-content:flex-end"><button class="btn" id="pl-quiz">🧠 ทดสอบความเข้าใจ (3 ข้อ)</button></div>`, true);
  const r = root.querySelector('#pl-r') as HTMLInputElement;
  const upd = () => {
    const n = Number(r.value);
    (root.querySelector('#pl-n') as HTMLElement).textContent = String(n);
    (root.querySelector('#pl-a') as HTMLElement).textContent = `${(atLeastOneNoPity(n) * 100).toFixed(1)}%`;
    (root.querySelector('#pl-b') as HTMLElement).textContent = `${(withinNWithPity(n) * 100).toFixed(1)}%`;
  };
  r.oninput = upd;
  upd();
  (root.querySelector('#pl-quiz') as HTMLButtonElement).onclick = async () => { close(); await host.probabilityQuiz(); };
}

// ======================================================================= classroom shop (gacha disabled)
function renderShop(host: WishHost, body: HTMLElement) {
  const render = () => {
    const chars = [...data.characters.values()].filter((c) => !host.save.unlockedChars.includes(c.id));
    body.innerHTML = `
      <div class="wish-top"><h2>🧬 ห้องแล็บโคลนนิ่ง <span style="font-size:15px;color:var(--cream-dim);font-family:var(--font)">โหมดห้องเรียน · ระบบสุ่มถูกปิด</span></h2>
        <div class="hud-chip">💎 ${inv(host, 'INSIGHT_CRYSTAL').toLocaleString()}</div></div>
      <p>ครูปิดระบบสุ่มไว้ — แลกตัวละครด้วยผลึกปัญญาในราคาคงที่แทน (★4 = ${SHOP_PRICE[4].toLocaleString()} · ★5 = ${SHOP_PRICE[5].toLocaleString()})</p>
      <div class="char-list" style="width:auto;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">
        ${chars.length ? chars.map((c) => `<div class="char-card">${img(iconSources(charArtName(c.id, getGender())), avatarPlaceholder(c.name.th.charAt(0), ELEMENT_COLOR[c.element]), 'avatar')}
          <div style="flex:1"><div>${esc(c.name.th)} ${elementIcon(c.element, 18)}</div><div style="font-size:13px;color:var(--gold)">${'★'.repeat(c.rarity)}</div></div>
          <button class="btn small" data-buy="${c.id}" ${inv(host, 'INSIGHT_CRYSTAL') < SHOP_PRICE[c.rarity] ? 'disabled' : ''}>💎 ${SHOP_PRICE[c.rarity].toLocaleString()}</button></div>`).join('') : '<p>มีตัวละครครบทุกตัวแล้ว 🎉</p>'}
      </div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => b.onclick = () => {
      const c = data.characters.get(b.dataset.buy!)!;
      const price = SHOP_PRICE[c.rarity];
      if (inv(host, 'INSIGHT_CRYSTAL') < price) return;
      host.save.inventory.INSIGHT_CRYSTAL -= price;
      host.buyCharacter(c.id);
      host.persist();
      render();
    });
  };
  render();
}

// ======================================================================= animation + reveal
function playAnimation(res: PullResult[], infos: ResultInfo[]): Promise<void> {
  return new Promise((resolve) => {
    const max = Math.max(...res.map((r) => r.rarity)) as 3 | 4 | 5;
    const col = RARITY_COLOR[max];
    const root = h(`<div class="wish-anim"><div class="dna"></div><div class="wish-flash" style="background:radial-gradient(circle, ${col}, transparent 70%)"></div><div class="wish-skip">คลิกเพื่อข้าม ▶</div></div>`);
    const close = openModal(root);
    const dna = root.querySelector('.dna') as HTMLElement;
    const N = 18;
    for (let i = 0; i < N; i++) {
      dna.appendChild(h(`<div class="bp" style="--i:${i}"><span class="a"></span><span class="rung"></span><span class="b"></span></div>`));
    }
    let t0 = performance.now();
    let phase: 'spin' | 'reveal' | 'summary' = 'spin';
    let raf = 0;
    const spin = () => {
      const t = (performance.now() - t0) / 1000;
      const speed = 2 + t * t * 6;
      dna.querySelectorAll<HTMLElement>('.bp').forEach((el, i) => {
        const a = t * speed + i * 0.45;
        const x = Math.sin(a) * 70;
        const z = Math.cos(a);
        (el.children[0] as HTMLElement).style.transform = `translateX(${x}px) scale(${0.7 + 0.3 * (z + 1) / 2})`;
        (el.children[2] as HTMLElement).style.transform = `translateX(${-x}px) scale(${0.7 + 0.3 * (1 - z) / 2})`;
        (el.children[1] as HTMLElement).style.width = `${Math.abs(x) * 2}px`;
        const hue = t > 1.2 ? col : '#9fe3f0';
        (el.children[0] as HTMLElement).style.background = hue;
        (el.children[2] as HTMLElement).style.background = t > 1.2 ? col : '#e8c468';
      });
      if (t < 2.1) raf = requestAnimationFrame(spin);
      else flash();
    };
    const flash = () => {
      cancelAnimationFrame(raf);
      root.classList.add('flashing');
      if (max === 5) sfx.unlock(); else sfx.reaction();
      setTimeout(() => { phase = 'reveal'; showCard(0); }, 450);
    };
    let idx = 0;
    const showCard = (i: number) => {
      idx = i;
      if (i >= res.length) return summary();
      const r = res[i], info = infos[i];
      root.innerHTML = '';
      root.appendChild(cardEl(r, info, true));
      root.appendChild(h(`<div class="wish-skip">${i + 1}/${res.length} · คลิกเพื่อดูต่อ${res.length > 1 ? ' · <u id="skipall">ข้ามทั้งหมด</u>' : ''}</div>`));
      if (r.rarity >= 4) sfx.correct(); else sfx.ui();
      const sa = root.querySelector('#skipall') as HTMLElement | null;
      if (sa) sa.onclick = (ev) => { ev.stopPropagation(); summary(); };
    };
    const summary = () => {
      phase = 'summary';
      if (res.length === 1) return finish();
      root.innerHTML = `<div class="wish-summary">${res.map((r, i) => cardEl(r, infos[i], false).outerHTML).join('')}</div><div class="wish-skip">คลิกเพื่อปิด</div>`;
    };
    const finish = () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(raf); close(); resolve(); };
    const advance = () => {
      if (phase === 'spin') flash();
      else if (phase === 'reveal') showCard(idx + 1);
      else finish();
    };
    const onKey = (e: KeyboardEvent) => { if (['Space', 'Enter', 'Escape'].includes(e.code)) { e.preventDefault(); e.stopImmediatePropagation(); advance(); } };
    root.addEventListener('click', advance);
    window.addEventListener('keydown', onKey, true);
    t0 = performance.now();
    raf = requestAnimationFrame(spin);
  });
}

function cardEl(r: PullResult, info: ResultInfo, big: boolean): HTMLElement {
  const col = RARITY_COLOR[r.rarity];
  let art = '', name = '', sub = '';
  if (r.kind === 'char') {
    const c = data.characters.get(r.id)!;
    const a = charArtName(r.id, getGender());
    art = img([`assets/characters/CHR_${a}_Portrait_Happy.webp`, ...splashSources(a), ...iconSources(a)], portraitPlaceholder(ELEMENT_COLOR[c.element], c.appearance.hair), 'card-art');
    name = c.name.th;
    sub = info.isNew ? '<span class="tag-new">ใหม่!</span>' : info.cons > 0 && info.starglitter <= (r.rarity === 5 ? 10 : 2) ? `ลำดับยีน C${info.cons} · ✨×${info.starglitter}` : `✨ ผลึกดาว ×${info.starglitter}`;
    if (big) sub += `<div style="font-size:15px;opacity:.85;margin-top:6px">${esc(c.title.th)}</div>`;
  } else if (r.kind === 'weapon') {
    const d = gearData.weapons.get(r.id)!;
    art = `<div class="card-art item">${img([weaponImage(r.id)], avatarPlaceholder('⚔', col, '#141a33'), '', 'width:80%;height:90%;object-fit:contain')}</div>`;
    name = d.name.th;
    sub = `${info.isNew ? '<span class="tag-new">ใหม่!</span> ' : ''}อาวุธ ${d.type}${info.starglitter ? ` · ✨×${info.starglitter}` : ''}`;
  } else {
    const it = data.items.get(r.id)!;
    art = `<div class="card-art item">${img([`assets/items/${r.id}.png`], avatarPlaceholder(it.glyph, col, '#141a33'), '', 'width:70%;height:auto;object-fit:contain')}</div>`;
    name = it.name.th;
    sub = `×${r.count.toLocaleString()}`;
  }
  return h(`<div class="wish-card ${big ? 'big' : ''} r${r.rarity}" style="--rc:${col}">
    ${art}
    <div class="card-info"><div class="stars" style="color:${col}">${'★'.repeat(r.rarity)}</div><div class="nm">${esc(name)}</div><div class="sb">${sub}</div>
    ${r.lost5050 ? '<div style="font-size:13px;opacity:.8">(ครั้งหน้าการันตีตัวเด่น)</div>' : ''}</div></div>`);
}
