import * as THREE from 'three';
import { ELEMENT_COLOR } from '../core/types';
import { elementIcon } from '../core/Assets';
import type { Enemy } from '../enemies/Enemy';

interface DmgNum { el: HTMLDivElement; pos: THREE.Vector3; t: number; vy: number }

/** Screen-space UI anchored to 3D positions: damage numbers, enemy HP bars, NPC tags, quest markers. */
export class WorldUI {
  private root = document.getElementById('world-ui')!;
  private nums: DmgNum[] = [];
  private bars = new Map<number, HTMLDivElement>();
  private tags = new Map<string, HTMLDivElement>();
  private markers: HTMLDivElement[] = [];
  private v = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera) {}

  private project(p: THREE.Vector3): { x: number; y: number; vis: boolean } {
    this.v.copy(p).project(this.camera);
    const w = window.innerWidth, h = window.innerHeight;
    return { x: (this.v.x * 0.5 + 0.5) * w, y: (-this.v.y * 0.5 + 0.5) * h, vis: this.v.z < 1 && this.v.z > -1 };
  }

  damage(pos: THREE.Vector3, text: string, color: string, kind: 'normal' | 'crit' | 'reaction' | 'heal' | 'info') {
    if (this.nums.length > 60) { const o = this.nums.shift()!; o.el.remove(); }
    const el = document.createElement('div');
    el.className = `dmg ${kind}`;
    el.textContent = kind === 'heal' ? `+${text}` : text;
    el.style.color = color;
    this.root.appendChild(el);
    this.nums.push({ el, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8)), t: 0, vy: kind === 'reaction' ? 0.6 : 1.4 });
  }

  update(dt: number, enemies: Enemy[], playerPos: THREE.Vector3) {
    // damage numbers
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      n.pos.y += n.vy * dt;
      const p = this.project(n.pos);
      if (n.t > 1 || !p.vis) { n.el.remove(); this.nums.splice(i, 1); continue; }
      n.el.style.left = `${p.x}px`;
      n.el.style.top = `${p.y}px`;
      n.el.style.opacity = String(n.t < 0.7 ? 1 : 1 - (n.t - 0.7) / 0.3);
      const s = n.t < 0.1 ? 0.6 + n.t * 6 : 1.2 - Math.min(0.2, n.t);
      n.el.style.transform = `translate(-50%,-50%) scale(${s})`;
    }
    // enemy bars
    const seen = new Set<number>();
    for (const e of enemies) {
      if (!e.alive || e.isBoss) continue;
      const d = e.pos.distanceTo(playerPos);
      if (d > 30) continue;
      const p = this.project(e.topPoint(this.v.clone()));
      if (!p.vis) continue;
      seen.add(e.uid);
      let el = this.bars.get(e.uid);
      if (!el) {
        el = document.createElement('div');
        el.className = 'ebar';
        el.innerHTML = `<div class="aura"></div><div class="lv"></div><div class="bar"><div></div></div><div class="tag"></div>`;
        this.root.appendChild(el);
        this.bars.set(e.uid, el);
      }
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      (el.children[1] as HTMLElement).textContent = e.def.kind === 'dummy' ? e.def.name.th : `Lv.${e.level} ${e.def.name.th}`;
      ((el.children[2] as HTMLElement).firstElementChild as HTMLElement).style.width = `${(e.hp / e.maxHp) * 100}%`;
      const auraEl = el.children[0] as HTMLElement;
      const aura = e.aura?.element;
      const key = `${aura ?? ''}|${e.frozen > 0}|${e.catalyzed > 0}`;
      if (auraEl.dataset.k !== key) {
        auraEl.dataset.k = key;
        auraEl.innerHTML = (aura ? elementIcon(aura, 18) : '')
          + (e.frozen > 0 ? `<span style="background:#dff6ff"></span>` : '')
          + (e.catalyzed > 0 ? `<span style="background:#a8e05a;border-radius:3px"></span>` : '');
      }
      const tag = el.children[3] as HTMLElement;
      const t = e.burnT > 0 ? '🔥 ลุกไหม้' : e.state === 'latched' ? '🔗 เกาะเซลล์' : '';
      if (tag.textContent !== t) tag.textContent = t;
    }
    for (const [uid, el] of this.bars) if (!seen.has(uid)) { el.remove(); this.bars.delete(uid); }
  }

  /** NPC name tags with optional quest "!" marker. */
  npcTag(id: string, pos: THREE.Vector3 | null, name: string, title: string, quest: boolean) {
    let el = this.tags.get(id);
    if (!pos) { el?.remove(); this.tags.delete(id); return; }
    const p = this.project(pos);
    if (!p.vis) { if (el) el.style.display = 'none'; return; }
    if (!el) {
      el = document.createElement('div');
      el.className = 'npc-tag';
      this.root.appendChild(el);
      this.tags.set(id, el);
    }
    el.style.display = '';
    const html = `${quest ? '<div class="q">!</div>' : ''}<div>${name}</div><div style="font-size:12px;opacity:.75">${title}</div>`;
    if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
  }

  /** Quest target markers (clamped to screen edge when off-screen). */
  setMarkers(list: { pos: THREE.Vector3; label: string; dist: number }[]) {
    while (this.markers.length < list.length) {
      const el = document.createElement('div');
      el.className = 'marker';
      this.root.appendChild(el);
      this.markers.push(el);
    }
    this.markers.forEach((el, i) => {
      const m = list[i];
      if (!m) { el.style.display = 'none'; return; }
      el.style.display = '';
      this.v.copy(m.pos).project(this.camera);
      const w = window.innerWidth, h = window.innerHeight;
      let x = (this.v.x * 0.5 + 0.5) * w, y = (-this.v.y * 0.5 + 0.5) * h;
      const behind = this.v.z > 1;
      const pad = 64;
      let dx = x - w / 2, dy = y - h / 2;
      if (behind) { dx = -dx; dy = -dy; if (Math.abs(dy) < 1) dy = 1; }
      const off = behind || x < pad || x > w - pad || y < pad || y > h - pad;
      if (off) {
        // slide the marker to the screen edge along the direction of the goal
        const k = Math.min((w / 2 - pad) / Math.max(1e-3, Math.abs(dx)), (h / 2 - pad) / Math.max(1e-3, Math.abs(dy)));
        x = w / 2 + dx * k; y = h / 2 + dy * k;
      }
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.classList.toggle('off', off);
      const html = off
        ? `<div class="arrow" style="transform:rotate(${Math.atan2(dy, dx)}rad)">➤</div><div class="dist">${Math.round(m.dist)} ม.</div>`
        : `<div class="ic">◆</div><div class="lbl">${m.label}</div><div class="dist">${Math.round(m.dist)} ม.</div>`;
      if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
    });
  }

  clear() {
    this.root.innerHTML = '';
    this.nums = [];
    this.bars.clear();
    this.tags.clear();
    this.markers = [];
  }
}
