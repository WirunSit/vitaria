import { ISLANDS, ZEP, ZEP_SIZE, inZepheria } from '../world/Zepheria';
import { GEN, GEN_SITES, GEN_SIZE, genHeightLocal, inGenovia } from '../world/Genovia';
import { FLO, FLO_SITES, FLO_SIZE, floHeightLocal, inFlorantis } from '../world/Florantis';
import { MET, MET_SITES, MET_SIZE, metHeightLocal, inMetabolis } from '../world/Metabolis';
import { AQU, AQU_SITES, AQU_SIZE, aquHeightLocal, inAquorra } from '../world/Aquorra';
import { NEU, NEU_SITES, NEU_SIZE, neuHeightLocal, inNeurion } from '../world/Neurion';
import { ARB, ARB_SITES, ARB_SIZE, arbHeightLocal, inRoots } from '../world/Roots';
import { CITY, CITY_RADIUS, DISTRICTS, inCity } from '../world/City';
import * as THREE from 'three';
import { ELEMENT_COLOR, ELEMENT_GLYPH } from '../core/types';
import { avatarPlaceholder, charArtName, elementIcon, iconSources, img, itemIcon, skillArtName } from '../core/Assets';
import type { PartyMember } from '../player/Party';
import type { Enemy } from '../enemies/Enemy';
import type { World } from '../world/World';
import { isWater, WORLD_SIZE } from '../world/Terrain';
import { esc, getGender, h, speakerAvatar } from './UI';

export interface HudState {
  party: PartyMember[];
  activeIndex: number;
  stamina: number;
  maxStamina: number;
  shield: number;
  playerPos: THREE.Vector3;
  camYaw: number;
  quest: { title: string; objective: string; dist: number | null; type: string } | null;
  insight: number;
  glucose: number;
  antibiotic: number;
  interacts: { key: string; label: string; icon: string }[];
  boss: Enemy | null;
  scanning: { active: boolean; label: string; progress: number; known: boolean } | null;
  elementUnlocked: boolean;
  questTargets: { x: number; z: number }[];
  enemies: Enemy[];
  waypoints: { x: number; z: number; active: boolean }[];
  npcs: { x: number; z: number; quest: boolean }[];
  timeStr: string;
  rr: number;
  atp: number;
  domain: { name: string; wave: number; waves: number; time: number; mod: string; state: string } | null;
}

const CITY_MAP_R = 95;

export class HUD {
  root = document.getElementById('hud')!;
  private els: Record<string, HTMLElement> = {};
  private minimapBg: HTMLCanvasElement;
  private cityBg = HUD.buildCityMap(256);
  private genBg = HUD.buildGenoviaMap(256);
  private floBg = HUD.buildFlorantisMap(256);
  private metBg = HUD.buildMetabolisMap(256);
  private aquBg = HUD.buildAquorraMap(256);
  private neuBg = HUD.buildRegionMap(256, 'neu');
  private arbBg = HUD.buildRegionMap(256, 'arb');
  private zepBg = HUD.buildZepheriaMap(256);
  private mmCtx: CanvasRenderingContext2D;
  private amoebyT = 0;
  private lastParty = '';
  visible = true;

  constructor(world: World) {
    this.root.innerHTML = '';
    const html = `
      <div class="hud-minimap"><canvas width="200" height="200"></canvas></div>
      <div class="hud-quest"></div>
      <div class="hud-topright"></div>
      <div class="hud-keys"></div>
      <div class="hud-party"></div>
      <div class="hud-bottom"><div class="hud-hpbar"><div class="fill"></div></div><div class="hud-hptext"></div></div>
      <div class="hud-skills"></div>
      <svg class="stamina-ring" viewBox="0 0 46 46"><circle cx="23" cy="23" r="18" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="6"/><circle class="st" cx="23" cy="23" r="18" fill="none" stroke="#ffe26a" stroke-width="6" stroke-linecap="round" transform="rotate(-90 23 23)" stroke-dasharray="113.1" stroke-dashoffset="0"/></svg>
      <div class="hud-amoeby" style="opacity:0"></div>
      <div class="hud-interact"></div>
      <div class="hud-boss" style="display:none"></div>
      <div class="hud-scan" style="display:none"><div class="scan-overlay"></div><div class="crosshair"></div><div class="scan-info"></div></div>
    `;
    for (const node of Array.from(h(`<div>${html}</div>`).children)) this.root.appendChild(node);
    for (const k of ['hud-minimap', 'hud-quest', 'hud-topright', 'hud-keys', 'hud-party', 'hud-bottom', 'hud-skills', 'stamina-ring', 'hud-amoeby', 'hud-interact', 'hud-boss', 'hud-scan']) {
      this.els[k] = this.root.querySelector(`.${k}`) as HTMLElement;
    }
    this.mmCtx = (this.els['hud-minimap'].querySelector('canvas') as HTMLCanvasElement).getContext('2d')!;
    this.minimapBg = HUD.buildMapImage(world, 256);
    this.els['hud-keys'].innerHTML = `
      <div>J เควส · K Bio-Pedia · C ตัวละคร · B กระเป๋า · M แผนที่</div>
      <div>T สแกน · Z ยาปฏิชีวนะ · G Gene Wish · Esc เมนู · H วิธีเล่น</div>`;
  }

  /** Minimap background for Cellaria (covers the city centre ±CITY_MAP_R metres). */
  static buildCityMap(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const P = (m: number) => (m / CITY_MAP_R) * (size / 2) + size / 2;
    const L = (m: number) => (m / CITY_MAP_R) * (size / 2);
    g.fillStyle = '#7f9a5a'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#a9c878'; g.beginPath(); g.arc(P(0), P(0), L(CITY_RADIUS + 3), 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f1ead8'; g.lineWidth = L(3); g.stroke();
    g.strokeStyle = '#e6dcc2';
    for (const r of [26, 66]) { g.lineWidth = L(4); g.beginPath(); g.arc(P(0), P(0), L(r), 0, Math.PI * 2); g.stroke(); }
    for (const d of DISTRICTS) { g.lineWidth = L(3); g.beginPath(); g.moveTo(P(0), P(0)); g.lineTo(P(d.x), P(d.z)); g.stroke(); }
    for (const d of DISTRICTS) {
      g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(P(d.x), P(d.z), L(d.r + 4), 0, Math.PI * 2); g.fill();
      g.fillStyle = d.color; g.beginPath(); g.arc(P(d.x), P(d.z), L(d.r), 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  /** Zepheria map: islands over a sky-blue void. */
  static buildZepheriaMap(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    g.fillStyle = '#bcd8f0'; g.fillRect(0, 0, size, size);
    const P = (m: number) => (m / ZEP_SIZE + 0.5) * size, L = (m: number) => (m / ZEP_SIZE) * size;
    for (const i of ISLANDS) {
      g.fillStyle = '#7a6e62'; g.beginPath(); g.arc(P(i.x), P(i.z) + 2, L(i.r), 0, Math.PI * 2); g.fill();
      g.fillStyle = i.tint; g.beginPath(); g.arc(P(i.x), P(i.z), L(i.r), 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  /** Florantis map (covers FLO ± FLO_SIZE/2): jungle greens by height, sites as dots. */
  static buildFlorantisMap(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = (i / size - 0.5) * FLO_SIZE, z = (j / size - 0.5) * FLO_SIZE;
      const t = Math.min(1, Math.max(0, (floHeightLocal(x, z) + 4) / 40));
      const k = (j * size + i) * 4;
      img.data[k] = 70 + 90 * t; img.data[k + 1] = 140 + 50 * t; img.data[k + 2] = 70 + 70 * t; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const P = (m: number) => (m / FLO_SIZE + 0.5) * size;
    for (const [s, col] of [[FLO_SITES.village, '#e8a060'], [FLO_SITES.roots, '#8a6243'], [FLO_SITES.bloom, '#ff8fb8'], [FLO_SITES.terrace, '#e8c468'], [FLO_SITES.nursery, '#9fe07a'], [FLO_SITES.heart, '#2f6e3a'], [FLO_SITES.dock, '#e8c468']] as const) {
      g.fillStyle = col; g.beginPath(); g.arc(P(s.x), P(s.z), 4, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  /** Neurion / Roots map (covers the region ± size/2): ground shaded by height, sites as dots. */
  static buildRegionMap(size: number, which: 'neu' | 'arb'): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    const R = which === 'neu' ? NEU_SIZE : ARB_SIZE, hf = which === 'neu' ? neuHeightLocal : arbHeightLocal;
    const lo = which === 'neu' ? [100, 150, 140] : [120, 180, 105], hi = which === 'neu' ? [150, 150, 200] : [170, 185, 150];
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = (i / size - 0.5) * R, z = (j / size - 0.5) * R;
      const t = Math.min(1, Math.max(0, hf(x, z) / 40));
      const k = (j * size + i) * 4;
      for (let ch = 0; ch < 3; ch++) img.data[k + ch] = lo[ch] + (hi[ch] - lo[ch]) * t;
      img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const P = (m: number) => (m / R + 0.5) * size;
    const sites = which === 'neu' ? Object.values(NEU_SITES) : Object.values(ARB_SITES);
    const cols = which === 'neu' ? ['#e8c468', '#f2eee6', '#c8a8f0', '#5ab8ff', '#e07070', '#ffd27a', '#d8a8ff'] : ['#e8c468', '#f2eee6', '#ff8a6a', '#ffd36a', '#5ab8ff', '#8bc34a', '#b8ffb0'];
    sites.forEach((s, i) => { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(P(s.x), P(s.z), 4, 0, Math.PI * 2); g.fill(); });
    return c;
  }

  /** Aquorra map (covers AQU ± AQU_SIZE/2): islands green, canals and lagoons blue, sites as dots. */
  static buildAquorraMap(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = (i / size - 0.5) * AQU_SIZE, z = (j / size - 0.5) * AQU_SIZE;
      const h = aquHeightLocal(x, z), wet = h < -0.3;
      const t = Math.min(1, Math.max(0, (h + 2) / 40));
      const k = (j * size + i) * 4;
      if (wet) { img.data[k] = 90; img.data[k + 1] = 170; img.data[k + 2] = 220; }
      else { img.data[k] = 110 + 80 * t; img.data[k + 1] = 175 + 40 * t; img.data[k + 2] = 110 + 70 * t; }
      img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const P = (m: number) => (m / AQU_SIZE + 0.5) * size;
    for (const [s, col] of [[AQU_SITES.plaza, '#f2eee6'], [AQU_SITES.heart, '#e05060'], [AQU_SITES.vessels, '#8fb0ff'], [AQU_SITES.fort, '#d8d0ff'], [AQU_SITES.kidney, '#a8404a'], [AQU_SITES.marsh, '#7fa040'], [AQU_SITES.dock, '#e8c468']] as const) {
      g.fillStyle = col; g.beginPath(); g.arc(P(s.x), P(s.z), 4, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  /** Metabolis map (covers MET ± MET_SIZE/2): basalt greys by height, sites as dots. */
  static buildMetabolisMap(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = (i / size - 0.5) * MET_SIZE, z = (j / size - 0.5) * MET_SIZE;
      const t = Math.min(1, Math.max(0, (metHeightLocal(x, z) + 4) / 50));
      const k = (j * size + i) * 4;
      img.data[k] = 90 + 70 * t; img.data[k + 1] = 78 + 60 * t; img.data[k + 2] = 82 + 64 * t; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const P = (m: number) => (m / MET_SIZE + 0.5) * size;
    for (const [s, col] of [[MET_SITES.town, '#e8a060'], [MET_SITES.digest, '#e88a8a'], [MET_SITES.lungs, '#f4b0b8'], [MET_SITES.glyco, '#f2d24a'], [MET_SITES.krebs, '#ffb05a'], [MET_SITES.heart, '#ff6a2a'], [MET_SITES.dock, '#e8c468']] as const) {
      g.fillStyle = col; g.beginPath(); g.arc(P(s.x), P(s.z), 4, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  /** Genovia map (covers GEN ± GEN_SIZE/2). */
  static buildGenoviaMap(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const x = (i / size - 0.5) * GEN_SIZE, z = (j / size - 0.5) * GEN_SIZE;
      const hgt = genHeightLocal(x, z);
      const ice = Math.hypot(x - GEN_SITES.lake.x, z - GEN_SITES.lake.z) < GEN_SITES.lake.r;
      const t = Math.min(1, Math.max(0, (hgt + 4) / 40));
      const k = (j * size + i) * 4;
      img.data[k] = ice ? 150 : 200 + 40 * t; img.data[k + 1] = ice ? 215 : 210 + 35 * t; img.data[k + 2] = ice ? 240 : 225 + 25 * t; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const P = (m: number) => (m / GEN_SIZE + 0.5) * size;
    for (const [s, col] of [[GEN_SITES.village, '#e8a060'], [GEN_SITES.greenhouse, '#6fcf5a'], [GEN_SITES.library, '#6aa8ff'], [GEN_SITES.cave, '#8a8fa0'], [GEN_SITES.fort, '#3a3f50'], [GEN_SITES.dock, '#e8c468'], [GEN_SITES.plaza, '#9fe3f0']] as const) {
      g.fillStyle = col; g.beginPath(); g.arc(P(s.x), P(s.z), 4, 0, Math.PI * 2); g.fill();
    }
    return c;
  }

  static buildMapImage(world: World, size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const imgData = g.createImageData(size, size);
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const x = (i / size - 0.5) * WORLD_SIZE, z = (j / size - 0.5) * WORLD_SIZE;
        const hgt = world.h(x, z);
        let r: number, gg: number, b: number;
        if (isWater(x, z, hgt)) { r = 92; gg = 180; b = 228; }
        else if (hgt > 30) { const t = Math.min(1, (hgt - 30) / 20); r = 160 + 70 * t; gg = 145 + 80 * t; b = 125 + 90 * t; }
        else { const t = Math.min(1, Math.max(0, (hgt + 4) / 26)); r = 150 + 70 * t; gg = 170 + 25 * t; b = 85 + 25 * t; }
        const k = (j * size + i) * 4;
        imgData.data[k] = r; imgData.data[k + 1] = gg; imgData.data[k + 2] = b; imgData.data[k + 3] = 255;
      }
    }
    g.putImageData(imgData, 0, 0);
    return c;
  }

  amoebySay(text: string, ms = 5000) {
    const el = this.els['hud-amoeby'];
    el.innerHTML = `${speakerAvatar('AMOEBY', '')}<div class="bubble">${text}</div>`;
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    this.amoebyT = ms / 1000;
  }

  update(dt: number, s: HudState) {
    this.root.style.display = this.visible ? '' : 'none';
    if (!this.visible) return;
    // amoeby bubble timeout
    if (this.amoebyT > 0) {
      this.amoebyT -= dt;
      if (this.amoebyT <= 0) { this.els['hud-amoeby'].style.opacity = '0'; this.els['hud-amoeby'].style.transform = 'translateY(10px)'; }
    }

    // quest
    const q = s.quest;
    const qhtml = q
      ? `<div class="qt"><span class="qicon" style="background:${q.type === 'MAIN' ? 'var(--gold)' : '#7fb6e8'}"></span>${esc(q.title)}</div>
         <div class="qo">▸ ${esc(q.objective)}</div>${q.dist !== null ? `<div class="qd">${Math.round(q.dist)} ม.</div>` : ''}`
      : '<div class="qd">ไม่มีเควสที่ติดตาม (กด J)</div>';
    this.setHtml('hud-quest', qhtml);

    this.setHtml('hud-topright', `
      <div class="hud-chip">⏱ ${s.timeStr}</div>
      <div class="hud-chip">RR ${s.rr}</div>
      <div class="hud-chip">${itemIcon('ATP')} ${s.atp}</div>
      <div class="hud-chip">${itemIcon('INSIGHT_CRYSTAL')} ${s.insight.toLocaleString()}</div>
      <div class="hud-chip">${itemIcon('GLUCOSE')} ${s.glucose.toLocaleString()}</div>
      ${s.antibiotic > 0 ? `<div class="hud-chip">${itemIcon('ANTIBIOTIC')} ×${s.antibiotic}</div>` : ''}`);

    // party
    const partyKey = s.party.map((p) => p.id).join(',') + getGender();
    if (partyKey !== this.lastParty) {
      this.lastParty = partyKey;
      this.els['hud-party'].innerHTML = s.party.map((p, i) => {
        const art = charArtName(p.id, getGender());
        const ph = avatarPlaceholder(p.def.name.th.charAt(0), ELEMENT_COLOR[p.element]);
        return `<div class="party-slot" data-i="${i}">
          ${img(iconSources(art), ph)}
          <div><div class="nm">${esc(p.def.name.th)} ${elementIcon(p.element, 18)}</div><div class="hp"><div></div></div></div>
          <span class="qready"></span><span class="key">${i + 1}</span></div>`;
      }).join('');
    }
    const slots = this.els['hud-party'].children;
    s.party.forEach((p, i) => {
      const el = slots[i] as HTMLElement;
      if (!el) return;
      el.classList.toggle('active', i === s.activeIndex);
      el.classList.toggle('dead', !p.alive);
      const st = p.stats();
      (el.querySelector('.hp > div') as HTMLElement).style.width = `${(p.hp / st.hp) * 100}%`;
      const qr = el.querySelector('.qready') as HTMLElement;
      qr.style.background = p.burstReady && s.elementUnlocked ? ELEMENT_COLOR[p.element] : 'transparent';
      qr.style.boxShadow = p.burstReady && s.elementUnlocked ? `0 0 8px ${ELEMENT_COLOR[p.element]}` : 'none';
    });

    // hp bar
    const m = s.party[s.activeIndex];
    const st = m.stats();
    const fill = this.els['hud-bottom'].querySelector('.fill') as HTMLElement;
    fill.style.width = `${(m.hp / st.hp) * 100}%`;
    const bar = this.els['hud-bottom'].querySelector('.hud-hpbar') as HTMLElement;
    let sh = bar.querySelector('.shield') as HTMLElement | null;
    if (s.shield > 0 && !sh) { sh = h('<div class="shield"></div>'); bar.appendChild(sh); }
    if (s.shield <= 0 && sh) sh.remove();
    this.setHtml('hud-bottom-text', '', this.els['hud-bottom'].querySelector('.hud-hptext') as HTMLElement,
      `${Math.ceil(m.hp).toLocaleString()} / ${st.hp.toLocaleString()} · Lv.${m.level}${s.shield > 0 ? ` · 🛡 ${Math.ceil(s.shield)}` : ''}`);

    // skills
    if (s.elementUnlocked) {
      const col = ELEMENT_COLOR[m.element];
      const cdE = m.cdE > 0 ? `<div class="cd">${m.cdE.toFixed(1)}</div>` : '';
      const ePct = Math.min(1, m.energy / m.def.burstCost);
      const cdQ = m.cdQ > 0 ? `<div class="cd">${m.cdQ.toFixed(1)}</div>` : '';
      const art = skillArtName(m.id);
      const sk = (k: 'E' | 'Q') => img([`assets/ui/SKL_${art}_${k}.png`], avatarPlaceholder(k === 'E' ? ELEMENT_GLYPH[m.element] : '✦', col, '#1b2340'));
      this.setHtml('hud-skills', `
        <div class="skill-btn ${m.cdE <= 0 ? 'ready' : ''}" style="color:${col}">${sk('E')}${cdE}<span class="k">E</span></div>
        <div class="skill-btn q ${m.burstReady ? 'ready' : ''}" style="color:${col}">${sk('Q')}
          ${!m.burstReady ? `<div class="energy" style="height:${ePct * 100}%;background:${col}"></div>` : ''}${cdQ}<span class="k">Q</span></div>`);
    } else this.setHtml('hud-skills', '');

    // stamina
    const ring = this.els['stamina-ring'];
    const frac = s.stamina / s.maxStamina;
    ring.style.opacity = frac < 0.999 ? '1' : '0';
    (ring.querySelector('.st') as SVGCircleElement).setAttribute('stroke-dashoffset', String(113.1 * (1 - frac)));
    (ring.querySelector('.st') as SVGCircleElement).setAttribute('stroke', frac < 0.25 ? '#ff7a6b' : '#ffe26a');

    // interact prompts
    this.setHtml('hud-interact', s.interacts.map((it, i) => `<div class="interact-row ${i === 0 ? 'sel' : ''}"><span class="k">${it.key}</span>${it.icon} ${esc(it.label)}</div>`).join(''));

    // boss
    const b = s.boss;
    const bossEl = this.els['hud-boss'];
    if (b && b.alive) {
      bossEl.style.display = '';
      this.setHtml('hud-boss', `<div class="bn">${esc(b.def.name.th)} <span style="font-size:14px">Lv.${b.level}</span></div>
        <div class="bt">${esc(b.def.boss?.title.th ?? '')}</div>
        <div class="bar"><div style="width:${(b.hp / b.maxHp) * 100}%"></div></div>
        ${b.shieldActive ? '<div class="shield">🔮 โล่ความรู้ทำงาน!</div>' : b.exposedT > 0 ? '<div class="shield" style="color:#ffd36a">✨ เปิดจุดอ่อน! ดาเมจ +30%</div>' : ''}`);
    } else if (s.domain) {
      const d = s.domain;
      bossEl.style.display = '';
      const t = Math.max(0, Math.ceil(d.time));
      this.setHtml('hud-boss', `<div class="bn">🧪 ${esc(d.name)}</div>
        <div class="bt">${d.state === 'cleared' ? 'สำเร็จ! ไปที่แท่นรางวัล (F)' : `คลื่น ${d.wave}/${d.waves} · ⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`} · สภาพแวดล้อม: ${esc(d.mod)}</div>
        <div class="bar"><div style="width:${(Math.max(0, d.time) / 150) * 100}%;background:linear-gradient(90deg,#5fd4b0,#9fe3f0)"></div></div>`);
    } else bossEl.style.display = 'none';

    // scanner
    const sc = this.els['hud-scan'];
    if (s.scanning?.active) {
      sc.style.display = '';
      const info = sc.querySelector('.scan-info') as HTMLElement;
      const html = s.scanning.label
        ? `${s.scanning.known ? '✔ ' : '🔍 '}${esc(s.scanning.label)}<div class="scan-progress"><div style="width:${s.scanning.progress * 100}%"></div></div>`
        : '<span style="opacity:.75">เล็งไปที่สิ่งมีชีวิตหรือวัตถุ · กด T หรือ Esc เพื่อออก</span>';
      if (info.dataset.h !== html) { info.dataset.h = html; info.innerHTML = html; }
    } else sc.style.display = 'none';

    this.drawMinimap(s);
  }

  private cache = new Map<string, string>();
  private setHtml(key: string, html: string, el?: HTMLElement, text?: string) {
    const target = el ?? this.els[key];
    if (text !== undefined) {
      if (target.textContent !== text) target.textContent = text;
      return;
    }
    if (this.cache.get(key) === html) return;
    this.cache.set(key, html);
    target.innerHTML = html;
  }

  private drawMinimap(s: HudState) {
    const g = this.mmCtx;
    const W = 200, R = 70; // world units shown from center to edge
    const toPx = (x: number, z: number) => [W / 2 + ((x - s.playerPos.x) / R) * (W / 2), W / 2 + ((z - s.playerPos.z) / R) * (W / 2)];
    g.clearRect(0, 0, W, W);
    g.imageSmoothingEnabled = true;
    if (inZepheria(s.playerPos.x, s.playerPos.z)) {
      g.fillStyle = '#bcd8f0'; g.fillRect(0, 0, W, W);
      const scale = this.zepBg.width / ZEP_SIZE;
      const sx = (s.playerPos.x - ZEP.x + ZEP_SIZE / 2 - R) * scale, sz = (s.playerPos.z - ZEP.z + ZEP_SIZE / 2 - R) * scale;
      g.drawImage(this.zepBg, sx, sz, R * 2 * scale, R * 2 * scale, 0, 0, W, W);
    } else if (inNeurion(s.playerPos.x, s.playerPos.z) || inRoots(s.playerPos.x, s.playerPos.z)) {
      const neu = inNeurion(s.playerPos.x, s.playerPos.z), bg = neu ? this.neuBg : this.arbBg, C = neu ? NEU : ARB, SZ = neu ? NEU_SIZE : ARB_SIZE;
      g.fillStyle = neu ? '#6a6a9a' : '#7aa070'; g.fillRect(0, 0, W, W);
      const scale = bg.width / SZ;
      const sx = (s.playerPos.x - C.x + SZ / 2 - R) * scale, sz = (s.playerPos.z - C.z + SZ / 2 - R) * scale;
      g.drawImage(bg, sx, sz, R * 2 * scale, R * 2 * scale, 0, 0, W, W);
    } else if (inAquorra(s.playerPos.x, s.playerPos.z)) {
      g.fillStyle = '#5aaadc'; g.fillRect(0, 0, W, W);
      const scale = this.aquBg.width / AQU_SIZE;
      const sx = (s.playerPos.x - AQU.x + AQU_SIZE / 2 - R) * scale, sz = (s.playerPos.z - AQU.z + AQU_SIZE / 2 - R) * scale;
      g.drawImage(this.aquBg, sx, sz, R * 2 * scale, R * 2 * scale, 0, 0, W, W);
    } else if (inMetabolis(s.playerPos.x, s.playerPos.z)) {
      g.fillStyle = '#5a5054'; g.fillRect(0, 0, W, W);
      const scale = this.metBg.width / MET_SIZE;
      const sx = (s.playerPos.x - MET.x + MET_SIZE / 2 - R) * scale, sz = (s.playerPos.z - MET.z + MET_SIZE / 2 - R) * scale;
      g.drawImage(this.metBg, sx, sz, R * 2 * scale, R * 2 * scale, 0, 0, W, W);
    } else if (inFlorantis(s.playerPos.x, s.playerPos.z)) {
      g.fillStyle = '#5a8a4a'; g.fillRect(0, 0, W, W);
      const scale = this.floBg.width / FLO_SIZE;
      const sx = (s.playerPos.x - FLO.x + FLO_SIZE / 2 - R) * scale, sz = (s.playerPos.z - FLO.z + FLO_SIZE / 2 - R) * scale;
      g.drawImage(this.floBg, sx, sz, R * 2 * scale, R * 2 * scale, 0, 0, W, W);
    } else if (inGenovia(s.playerPos.x, s.playerPos.z)) {
      g.fillStyle = '#c8d0dc'; g.fillRect(0, 0, W, W);
      const scale = this.genBg.width / GEN_SIZE;
      const sx = (s.playerPos.x - GEN.x + GEN_SIZE / 2 - R) * scale, sz = (s.playerPos.z - GEN.z + GEN_SIZE / 2 - R) * scale;
      g.drawImage(this.genBg, sx, sz, R * 2 * scale, R * 2 * scale, 0, 0, W, W);
    } else if (inCity(s.playerPos.x, s.playerPos.z)) {
      g.fillStyle = '#7f9a5a'; g.fillRect(0, 0, W, W);
      const scale = this.cityBg.width / (CITY_MAP_R * 2);
      const sx = (s.playerPos.x - CITY.x + CITY_MAP_R - R) * scale, sz = (s.playerPos.z - CITY.z + CITY_MAP_R - R) * scale;
      g.drawImage(this.cityBg, sx, sz, R * 2 * scale, R * 2 * scale, 0, 0, W, W);
    } else {
      const scale = this.minimapBg.width / WORLD_SIZE;
      const sx = (s.playerPos.x + WORLD_SIZE / 2 - R) * scale, sz = (s.playerPos.z + WORLD_SIZE / 2 - R) * scale;
      g.drawImage(this.minimapBg, sx, sz, R * 2 * scale, R * 2 * scale, 0, 0, W, W);
    }
    for (const w of s.waypoints) {
      const [x, y] = toPx(w.x, w.z);
      g.fillStyle = w.active ? '#7ff7ff' : '#7f8ba0';
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
    for (const e of s.enemies) {
      if (!e.alive || e.def.kind === 'dummy') continue;
      const [x, y] = toPx(e.pos.x, e.pos.z);
      g.fillStyle = e.isBoss ? '#ff3b3b' : '#ff6a5a';
      g.beginPath(); g.arc(x, y, e.isBoss ? 6 : 3, 0, Math.PI * 2); g.fill();
    }
    for (const n of s.npcs) {
      const [x, y] = toPx(n.x, n.z);
      g.fillStyle = n.quest ? '#e8c468' : '#ffffff';
      g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
    }
    const now = performance.now() / 1000;
    const blink = 0.55 + 0.45 * Math.abs(Math.sin(now * 3.2));
    for (const t of s.questTargets) {
      let [x, y] = toPx(t.x, t.z);
      const dx = x - W / 2, dy = y - W / 2, d = Math.hypot(dx, dy);
      const edge = W / 2 - 14;
      if (d > edge) {
        // off the minimap: a blinking arrow on the rim pointing towards the goal
        x = W / 2 + (dx / d) * edge; y = W / 2 + (dy / d) * edge;
        g.save(); g.translate(x, y); g.rotate(Math.atan2(dy, dx));
        g.globalAlpha = blink;
        g.fillStyle = '#ffd34a';
        g.beginPath(); g.moveTo(11, 0); g.lineTo(-7, -9); g.lineTo(-3, 0); g.lineTo(-7, 9); g.closePath(); g.fill();
        g.strokeStyle = '#3a2400'; g.lineWidth = 2; g.stroke();
        g.restore();
        continue;
      }
      // on the minimap: expanding pulse ring + blinking diamond
      const ph = (now * 0.9) % 1;
      g.save();
      g.strokeStyle = `rgba(255,211,74,${1 - ph})`; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, 7 + ph * 14, 0, Math.PI * 2); g.stroke();
      g.translate(x, y); g.rotate(Math.PI / 4);
      g.globalAlpha = blink;
      g.fillStyle = '#ffd34a'; g.fillRect(-7, -7, 14, 14);
      g.strokeStyle = '#3a2400'; g.lineWidth = 2; g.strokeRect(-7, -7, 14, 14);
      g.restore();
    }
    // player arrow (camera-facing)
    g.save();
    g.translate(W / 2, W / 2);
    g.rotate(-s.camYaw);
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -9); g.lineTo(7, 7); g.lineTo(0, 3); g.lineTo(-7, 7); g.closePath(); g.fill();
    g.strokeStyle = '#1b2340'; g.lineWidth = 2; g.stroke();
    g.restore();
  }

  onPartyClick(fn: (i: number) => void) {
    this.els['hud-party'].addEventListener('click', (e) => {
      const slot = (e.target as HTMLElement).closest('.party-slot') as HTMLElement | null;
      if (slot) fn(Number(slot.dataset.i));
    });
  }
}
