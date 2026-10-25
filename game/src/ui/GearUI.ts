import { data } from '../core/Data';
import { avatarPlaceholder, img, itemIcon } from '../core/Assets';
import { sfx } from '../core/Audio';
import {
  FODDER_WEAPON_EXP, GROWTH_FACTOR_EXP, ORE_EXP, RELIC_FODDER_EXP, SLOTS, STAT_TH, addRelicExp, addWeaponExp, fmtStat, gearData,
  passiveText, relicExpToNext, relicImage, relicMainValue, relicMax, relicName, weaponAtk, weaponCap, weaponExpToNext, weaponImage, weaponSub,
  type RelicInst, type SlotId,
} from '../gear/Gear';
import { esc, h, openModal, toast } from './UI';
import type { MenuHost } from './Menus';

const RC: Record<number, string> = { 3: '#6fb6ff', 4: '#c58bff', 5: '#ffcf5a' };
const SLOT_GLYPH: Record<SlotId, string> = { MEMBRANE: '🌸', FLAGELLUM: '➶', MITOCHONDRION: '⏳', VACUOLE: '🏆', NUCLEUS: '👑' };

function weaponArt(id: string, size = 96) {
  const d = gearData.weapons.get(id)!;
  return img([weaponImage(id)], avatarPlaceholder('⚔', RC[d.rarity], '#141a33'), '', `width:${size}px;height:${size}px;object-fit:contain`);
}
function relicArt(r: RelicInst, size = 64) {
  return img([relicImage(r)], avatarPlaceholder(SLOT_GLYPH[r.slot], RC[r.rarity], '#141a33'), '', `width:${size}px;height:${size}px;object-fit:contain`);
}
function ownerOfWeapon(host: MenuHost, uid: string): string | null {
  for (const [id, c] of Object.entries(host.save.chars)) if (c.weapon === uid) return id;
  return null;
}
function ownerOfRelic(host: MenuHost, uid: string): string | null {
  for (const [id, c] of Object.entries(host.save.chars)) if (Object.values(c.relics ?? {}).includes(uid)) return id;
  return null;
}
const charName = (id: string | null) => (id ? data.characters.get(id)?.name.th ?? id : '');

function clampHp(host: MenuHost, charId: string) {
  const m = host.member(charId);
  if (m) m.hp = Math.min(m.hp, m.stats().hp);
}

// ======================================================================= weapon tab
export function renderWeaponTab(host: MenuHost, charId: string, el: HTMLElement, rerender: () => void) {
  const cs = host.save.chars[charId];
  const w = cs?.weapon ? host.save.gear.weapons.find((x) => x.uid === cs.weapon) : undefined;
  const def = data.characters.get(charId)!;
  if (!w) { el.innerHTML = '<p style="opacity:.7">ยังไม่มีอาวุธ</p>'; return; }
  const d = gearData.weapons.get(w.id)!;
  const sub = weaponSub(w);
  const cap = weaponCap(w);
  const inv = host.save.inventory;
  const same = host.save.gear.weapons.filter((x) => x.id === w.id && x.uid !== w.uid && !ownerOfWeapon(host, x.uid));
  const fodder = host.save.gear.weapons.filter((x) => x.id !== w.id && gearData.weapons.get(x.id)?.rarity === 3 && !ownerOfWeapon(host, x.uid));
  el.innerHTML = `
    <div class="row" style="align-items:flex-start;gap:18px">
      <div class="gear-art" style="--rc:${RC[d.rarity]}">${weaponArt(w.id, 120)}</div>
      <div style="flex:1">
        <div style="font-family:var(--font-head);font-size:22px">${esc(d.name.th)} <span style="color:${RC[d.rarity]}">${'★'.repeat(d.rarity)}</span></div>
        <div style="opacity:.8">Lv. ${w.level}/${cap} · หลอมรวม R${w.refine} · ${d.type}</div>
        <div class="stat-grid" style="margin:8px 0">
          <div><span>พลังโจมตีพื้นฐาน</span><b>${weaponAtk(w)}</b></div>
          <div><span>${STAT_TH[sub.stat]}</span><b>${fmtStat(sub.stat, sub.value)}</b></div>
        </div>
        <div class="skill-desc"><b>${esc(d.passive.name.th)}</b> — ${esc(passiveText(w))}</div>
        <div style="font-size:14px;opacity:.7;font-style:italic">${esc(d.lore.th)}</div>
      </div>
    </div>
    <div class="row" style="margin-top:12px">
      <button class="btn small" id="w-swap">⇄ เปลี่ยนอาวุธ</button>
      <button class="btn small" data-ore="ORE_CALCIUM" ${(inv.ORE_CALCIUM ?? 0) <= 0 || w.level >= cap ? 'disabled' : ''}>${itemIcon('ORE_CALCIUM', 20)} แร่แคลเซียม (${inv.ORE_CALCIUM ?? 0})</button>
      <button class="btn small" data-ore="ORE_PHOSPHATE" ${(inv.ORE_PHOSPHATE ?? 0) <= 0 || w.level >= cap ? 'disabled' : ''}>${itemIcon('ORE_PHOSPHATE', 20)} แร่ฟอสเฟต (${inv.ORE_PHOSPHATE ?? 0})</button>
      ${w.level >= cap && w.asc < 1 ? `<button class="btn small" id="w-asc">⬆ เลื่อนขั้น (${itemIcon('MAT_CALCITE', 18)}×2 · ${itemIcon('GLUCOSE', 18)}5,000)</button>` : ''}
      ${same.length && w.refine < 5 ? `<button class="btn small" id="w-ref">✦ หลอมรวม (ใช้อาวุธซ้ำ ${same.length})</button>` : ''}
      ${fodder.length && w.level < cap ? `<button class="btn secondary small" id="w-fod">ย่อยอาวุธ ★3 ที่ไม่ได้ใช้ (${fodder.length})</button>` : ''}
    </div>
    <div style="font-size:13px;opacity:.65;margin-top:6px">EXP ${w.exp}/${weaponExpToNext(w.level, d.rarity)} · ${w.level >= cap ? (w.asc >= 1 ? 'เลื่อนขั้นถัดไปจะเปิดในอัปเดตหน้า' : 'ถึงเลเวลสูงสุด — เลื่อนขั้นเพื่อเพิ่มเลเวลสูงสุดเป็น 40') : 'ใช้แร่เพื่อเพิ่มเลเวล (ได้จากศัตรู แคมป์ หีบ และทบทวนประจำวัน)'}</div>
    <div id="w-list"></div>`;
  el.querySelectorAll<HTMLButtonElement>('[data-ore]').forEach((b) => b.onclick = () => {
    const ore = b.dataset.ore!;
    if ((inv[ore] ?? 0) <= 0) return;
    inv[ore]--;
    const gained = addWeaponExp(w, ORE_EXP[ore]);
    if (gained > 0) { sfx.unlock(); toast(`${d.name.th} เลเวลเพิ่มเป็น ${w.level}`); } else sfx.ui();
    clampHp(host, charId);
    host.saveNow();
    rerender();
  });
  const asc = el.querySelector('#w-asc') as HTMLButtonElement | null;
  if (asc) asc.onclick = () => {
    if ((inv.MAT_CALCITE ?? 0) < 2 || (inv.GLUCOSE ?? 0) < 5000) { toast('วัตถุดิบไม่พอ (ผลึกแคลไซต์ ×2 · กลูโคส 5,000)'); return; }
    inv.MAT_CALCITE -= 2; inv.GLUCOSE -= 5000; w.asc = 1;
    sfx.unlock(); toast(`${d.name.th} เลื่อนขั้นแล้ว! เลเวลสูงสุด 40`, true);
    host.saveNow(); rerender();
  };
  const fod = el.querySelector('#w-fod') as HTMLButtonElement | null;
  if (fod) fod.onclick = () => {
    const exp = fodder.reduce((t, x) => t + FODDER_WEAPON_EXP[3] + x.exp, 0);
    host.save.gear.weapons = host.save.gear.weapons.filter((x) => !fodder.includes(x));
    const gained = addWeaponExp(w, exp);
    sfx.unlock();
    toast(`ย่อยอาวุธ ${fodder.length} ชิ้น · ${d.name.th} ${gained > 0 ? `เลเวลเพิ่มเป็น ${w.level}` : `ได้ EXP ${exp}`}`);
    clampHp(host, charId);
    host.saveNow();
    rerender();
  };
  const ref = el.querySelector('#w-ref') as HTMLButtonElement | null;
  if (ref) ref.onclick = () => {
    const f = same[0];
    host.save.gear.weapons = host.save.gear.weapons.filter((x) => x.uid !== f.uid);
    w.refine = Math.min(5, w.refine + 1);
    sfx.unlock(); toast(`หลอมรวมสำเร็จ! ${d.name.th} R${w.refine}`);
    host.saveNow(); rerender();
  };
  (el.querySelector('#w-swap') as HTMLButtonElement).onclick = () => {
    const list = el.querySelector('#w-list') as HTMLElement;
    const options = host.save.gear.weapons.filter((x) => gearData.weapons.get(x.id)?.type === def.weapon && x.uid !== w.uid)
      .sort((a, b) => gearData.weapons.get(b.id)!.rarity - gearData.weapons.get(a.id)!.rarity || b.level - a.level);
    list.innerHTML = `<div class="gear-list">${options.length ? options.map((x) => {
      const xd = gearData.weapons.get(x.id)!;
      const owner = ownerOfWeapon(host, x.uid);
      return `<div class="gear-card" data-uid="${x.uid}" style="--rc:${RC[xd.rarity]}">${weaponArt(x.id, 64)}
        <div><div>${esc(xd.name.th)}</div><div style="font-size:12px;opacity:.75">Lv.${x.level} · R${x.refine}${owner ? ` · ${esc(charName(owner))}` : ''}</div></div></div>`;
    }).join('') : `<p style="opacity:.7">ไม่มีอาวุธประเภท ${def.weapon} อื่น — สุ่มได้จาก Gene Wish</p>`}</div>`;
    list.querySelectorAll<HTMLElement>('.gear-card').forEach((c) => c.onclick = () => {
      const uid = c.dataset.uid!;
      const owner = ownerOfWeapon(host, uid);
      if (owner) host.save.chars[owner].weapon = w.uid; // swap
      cs.weapon = uid;
      clampHp(host, charId);
      if (owner) clampHp(host, owner);
      sfx.ui();
      host.saveNow();
      rerender();
    });
  };
}

// ======================================================================= relic tab
let selSlot: SlotId = 'MEMBRANE';

export function renderRelicTab(host: MenuHost, charId: string, el: HTMLElement, rerender: () => void) {
  const cs = host.save.chars[charId];
  cs.relics ??= {};
  const get = (uid?: string) => (uid ? host.save.gear.relics.find((r) => r.uid === uid) : undefined);
  const cur = get(cs.relics[selSlot]);
  const equipped = SLOTS.map((s) => get(cs.relics![s])).filter((r): r is RelicInst => !!r);
  const counts: Record<string, number> = {};
  for (const r of equipped) counts[r.set] = (counts[r.set] ?? 0) + 1;
  const setLines = Object.entries(counts).map(([set, n]) => {
    const sd = gearData.sets.get(set)!;
    return `<div><b style="color:var(--gold)">${esc(sd.name.th)}</b> (${n}/4)<br>
      <span style="opacity:${n >= 2 ? 1 : 0.45}">2 ชิ้น: ${esc(sd.bonus2.th)}</span><br><span style="opacity:${n >= 4 ? 1 : 0.45}">4 ชิ้น: ${esc(sd.bonus4.th)}</span></div>`;
  }).join('');
  el.innerHTML = `
    <div class="relic-slots">${SLOTS.map((s) => {
      const r = get(cs.relics![s]);
      const sname = gearData.relics.slots.find((x) => x.id === s)!.name.th;
      return `<div class="relic-slot ${s === selSlot ? 'sel' : ''}" data-slot="${s}" style="--rc:${r ? RC[r.rarity] : 'rgba(255,255,255,.2)'}">
        ${r ? relicArt(r, 52) : `<img src="assets/relics/RLC_ComplexEukaryote_${s}.png" style="width:44px;height:44px;object-fit:contain;opacity:.22;filter:grayscale(1)" onerror="this.style.display='none'" alt="">`}<div class="sn">${esc(sname)}</div>${r ? `<div class="lv">+${r.level}</div>` : ''}</div>`;
    }).join('')}</div>
    <div class="row" style="align-items:flex-start;gap:16px;margin-top:10px">
      <div style="flex:1;min-width:260px">${cur ? relicDetail(cur) : '<p style="opacity:.7">ยังไม่ได้สวมใส่ในช่องนี้</p>'}
        ${cur ? `<div class="row" style="margin-top:8px"><button class="btn small" id="r-up" ${cur.level >= relicMax(cur) ? 'disabled' : ''}>⬆ เสริมพลัง</button><button class="btn secondary small" id="r-off">ถอดออก</button></div>` : ''}
      </div>
      <div style="flex:1;min-width:240px" class="skill-desc">${setLines || '<span style="opacity:.6">สวมใส่ Relic ชุดเดียวกัน 2 / 4 ชิ้นเพื่อรับโบนัสชุด</span>'}</div>
    </div>
    <div style="margin-top:10px;font-family:var(--font-head)">Bio-Relic ในกระเป๋า (ช่อง${esc(gearData.relics.slots.find((x) => x.id === selSlot)!.name.th)})</div>
    <div class="gear-list" id="r-list"></div>`;
  const list = el.querySelector('#r-list') as HTMLElement;
  const options = host.save.gear.relics.filter((r) => r.slot === selSlot && r.uid !== cs.relics![selSlot])
    .sort((a, b) => b.rarity - a.rarity || b.level - a.level);
  list.innerHTML = options.length ? options.map((r) => {
    const owner = ownerOfRelic(host, r.uid);
    return `<div class="gear-card" data-uid="${r.uid}" style="--rc:${RC[r.rarity]}" title="${esc(relicName(r))}">${relicArt(r, 48)}
      <div><div style="font-size:14px">${esc(gearData.sets.get(r.set)!.name.th)} +${r.level}</div>
      <div style="font-size:12px;opacity:.75">${STAT_TH[r.main]} ${fmtStat(r.main, relicMainValue(r))}${owner ? ` · ${esc(charName(owner))}` : ''}</div></div></div>`;
  }).join('') : '<p style="opacity:.7">ยังไม่มี — หาได้จากหีบ แคมป์เชื้อโรค และบอสราชาแบคทีเรีย (กลับไปที่ลานหน้าประตูเมือง)</p>';
  el.querySelectorAll<HTMLElement>('.relic-slot').forEach((s) => s.onclick = () => { selSlot = s.dataset.slot as SlotId; sfx.ui(); rerender(); });
  list.querySelectorAll<HTMLElement>('.gear-card').forEach((c) => c.onclick = () => {
    const uid = c.dataset.uid!;
    const owner = ownerOfRelic(host, uid);
    if (owner && owner !== charId) {
      const prev = cs.relics![selSlot];
      host.save.chars[owner].relics![selSlot] = prev; // swap
      if (!prev) delete host.save.chars[owner].relics![selSlot];
      clampHp(host, owner);
    }
    cs.relics![selSlot] = uid;
    clampHp(host, charId);
    sfx.ui();
    host.saveNow();
    rerender();
  });
  const off = el.querySelector('#r-off') as HTMLButtonElement | null;
  if (off) off.onclick = () => { delete cs.relics![selSlot]; clampHp(host, charId); host.saveNow(); rerender(); };
  const up = el.querySelector('#r-up') as HTMLButtonElement | null;
  if (up && cur) up.onclick = () => enhanceDialog(host, cur, () => { clampHp(host, charId); rerender(); });
}

function relicDetail(r: RelicInst): string {
  const sd = gearData.sets.get(r.set)!;
  return `<div class="row" style="gap:12px;align-items:flex-start">
    <div class="gear-art" style="--rc:${RC[r.rarity]}">${relicArt(r, 84)}</div>
    <div><div style="font-family:var(--font-head);font-size:18px">${esc(relicName(r))}</div>
      <div style="color:${RC[r.rarity]}">${'★'.repeat(r.rarity)} <span style="color:var(--cream)">+${r.level}/${relicMax(r)}</span></div>
      <div style="font-size:18px;margin:4px 0"><b>${STAT_TH[r.main]} ${fmtStat(r.main, relicMainValue(r))}</b></div>
      ${r.subs.map((s) => `<div style="font-size:15px">· ${STAT_TH[s.stat]} +${fmtStat(s.stat, s.value)}</div>`).join('')}
      <div style="font-size:13px;opacity:.65;margin-top:4px;font-style:italic">${esc(sd.lore.th)}</div></div></div>`;
}

function enhanceDialog(host: MenuHost, r: RelicInst, done: () => void) {
  const fodder = host.save.gear.relics.filter((x) => x.uid !== r.uid && x.rarity <= 4 && !ownerOfRelic(host, x.uid));
  const root = h(`<div class="quiz-wrap"><div class="quiz-card panel hex-bg">
    <button class="close-x">✕</button>
    <h2 style="margin:0 0 10px;font-family:var(--font-head);color:var(--gold)">เสริมพลัง Bio-Relic</h2>
    ${relicDetail(r)}
    <div style="margin:10px 0">EXP ${r.exp}/${relicExpToNext(r)} · <span id="e-log" style="color:var(--good)"></span></div>
    <div class="row">
      <button class="btn small" id="e-gf" ${(host.save.inventory.GROWTH_FACTOR ?? 0) <= 0 ? 'disabled' : ''}>${itemIcon('GROWTH_FACTOR', 20)} ใช้สารเร่งการเจริญ (${host.save.inventory.GROWTH_FACTOR ?? 0}) · +${GROWTH_FACTOR_EXP} EXP</button>
      <button class="btn small" id="e-fod" ${!fodder.length ? 'disabled' : ''}>ย่อย Relic ★3/★4 ที่ไม่ได้ใช้ (${fodder.length})</button>
    </div>
    <p style="font-size:13px;opacity:.65">ทุก +4 เลเวล จะได้ค่าสถานะรองใหม่ (หรือเพิ่มค่าเดิม) · การเสริมพลังใช้กลูโคส 1 ต่อ 1 EXP</p></div></div>`);
  const close = openModal(root);
  const fin = () => { close(); done(); };
  (root.querySelector('.close-x') as HTMLButtonElement).onclick = fin;
  const apply = (exp: number) => {
    const cost = exp; // 1 glucose per EXP (kept cheap for the vertical slice)
    if ((host.save.inventory.GLUCOSE ?? 0) < cost) { toast('กลูโคสไม่พอ'); return false; }
    host.save.inventory.GLUCOSE -= cost;
    const log = addRelicExp(r, exp);
    (root.querySelector('#e-log') as HTMLElement).textContent = log.join(' · ');
    sfx.unlock();
    host.saveNow();
    return true;
  };
  (root.querySelector('#e-gf') as HTMLButtonElement).onclick = () => {
    if ((host.save.inventory.GROWTH_FACTOR ?? 0) <= 0) return;
    if (apply(GROWTH_FACTOR_EXP)) host.save.inventory.GROWTH_FACTOR--;
    fin();
  };
  (root.querySelector('#e-fod') as HTMLButtonElement).onclick = () => {
    const exp = fodder.reduce((s, x) => s + RELIC_FODDER_EXP[x.rarity] + x.exp, 0);
    if (apply(exp)) host.save.gear.relics = host.save.gear.relics.filter((x) => !fodder.includes(x));
    fin();
  };
}

// ======================================================================= inventory (B)
export function openInventory(host: MenuHost) {
  const root = h(`<div class="menu-wrap"><div class="menu panel hex-bg"><button class="close-x">✕</button><h2>🎒 กระเป๋า</h2><div class="mbody" style="flex:1;display:flex;flex-direction:column;min-height:0"></div></div></div>`);
  const close = openModal(root);
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape' || e.code === 'KeyB') { e.preventDefault(); fin(); } };
  const fin = () => { window.removeEventListener('keydown', onKey); close(); };
  setTimeout(() => window.addEventListener('keydown', onKey), 0);
  (root.querySelector('.close-x') as HTMLButtonElement).onclick = fin;
  const body = root.querySelector('.mbody') as HTMLElement;
  let tab: 'ITEM' | 'WEAPON' | 'RELIC' = 'ITEM';
  let sel: string | null = null;
  const render = () => {
    const inv = host.save.inventory;
    let cards = '', detail = '<p style="opacity:.6">เลือกรายการเพื่อดูรายละเอียด</p>';
    if (tab === 'ITEM') {
      const ids = Object.keys(inv).filter((k) => (inv[k] ?? 0) > 0 && data.items.has(k));
      cards = ids.map((id) => `<div class="inv-card ${sel === id ? 'sel' : ''}" data-id="${id}">${itemIcon(id, 56)}<div class="cnt">${inv[id].toLocaleString()}</div></div>`).join('');
      const it = sel ? data.items.get(sel) : null;
      if (it) detail = `<div style="text-align:center">${itemIcon(it.id, 120)}</div><h3>${esc(it.name.th)}</h3><div class="en">${esc(it.name.en ?? '')}</div><p>${esc(it.desc.th)}</p><p>จำนวน: <b>${(inv[it.id] ?? 0).toLocaleString()}</b></p>`;
    } else if (tab === 'WEAPON') {
      const ws = [...host.save.gear.weapons].sort((a, b) => gearData.weapons.get(b.id)!.rarity - gearData.weapons.get(a.id)!.rarity || b.level - a.level);
      cards = ws.map((w) => { const d = gearData.weapons.get(w.id)!; return `<div class="inv-card ${sel === w.uid ? 'sel' : ''}" data-id="${w.uid}" style="--rc:${RC[d.rarity]}">${weaponArt(w.id, 56)}<div class="cnt">Lv.${w.level}</div></div>`; }).join('');
      const w = host.save.gear.weapons.find((x) => x.uid === sel);
      if (w) { const d = gearData.weapons.get(w.id)!; const sub = weaponSub(w); const owner = ownerOfWeapon(host, w.uid);
        detail = `<div style="text-align:center">${weaponArt(w.id, 140)}</div><h3>${esc(d.name.th)} <span style="color:${RC[d.rarity]}">${'★'.repeat(d.rarity)}</span></h3>
          <div class="en">${d.type} · Lv.${w.level} · R${w.refine}${owner ? ` · สวมใส่โดย ${esc(charName(owner))}` : ''}</div>
          <div class="stat-grid"><div><span>พลังโจมตีพื้นฐาน</span><b>${weaponAtk(w)}</b></div><div><span>${STAT_TH[sub.stat]}</span><b>${fmtStat(sub.stat, sub.value)}</b></div></div>
          <div class="skill-desc"><b>${esc(d.passive.name.th)}</b> — ${esc(passiveText(w))}</div><p style="opacity:.75;font-style:italic">${esc(d.lore.th)}</p>`; }
    } else {
      const rs = [...host.save.gear.relics].sort((a, b) => b.rarity - a.rarity || b.level - a.level);
      cards = rs.map((r) => `<div class="inv-card ${sel === r.uid ? 'sel' : ''}" data-id="${r.uid}" style="--rc:${RC[r.rarity]}">${relicArt(r, 56)}<div class="cnt">+${r.level}</div></div>`).join('');
      const r = host.save.gear.relics.find((x) => x.uid === sel);
      if (r) { const owner = ownerOfRelic(host, r.uid); detail = relicDetail(r) + (owner ? `<p>สวมใส่โดย ${esc(charName(owner))}</p>` : '') +
        `<div class="skill-desc" style="margin-top:8px">2 ชิ้น: ${esc(gearData.sets.get(r.set)!.bonus2.th)}<br>4 ชิ้น: ${esc(gearData.sets.get(r.set)!.bonus4.th)}</div>`; }
    }
    body.innerHTML = `
      <div class="tabs">
        <button class="tab ${tab === 'ITEM' ? 'sel' : ''}" data-t="ITEM">ไอเทม</button>
        <button class="tab ${tab === 'WEAPON' ? 'sel' : ''}" data-t="WEAPON">อาวุธ (${host.save.gear.weapons.length})</button>
        <button class="tab ${tab === 'RELIC' ? 'sel' : ''}" data-t="RELIC">Bio-Relic (${host.save.gear.relics.length})</button>
      </div>
      <div class="body"><div class="inv-grid">${cards || '<p style="opacity:.6">ว่างเปล่า</p>'}</div><div class="detail">${detail}</div></div>`;
    body.querySelectorAll<HTMLElement>('[data-t]').forEach((b) => b.onclick = () => { tab = b.dataset.t as typeof tab; sel = null; sfx.ui(); render(); });
    body.querySelectorAll<HTMLElement>('.inv-card').forEach((c) => c.onclick = () => { sel = c.dataset.id!; sfx.ui(); render(); });
  };
  render();
}

