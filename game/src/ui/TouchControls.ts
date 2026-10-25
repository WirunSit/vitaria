import type { Input } from '../core/Input';
import { avatarPlaceholder, img } from '../core/Assets';
import { isFullscreen, toggleFullscreen } from '../core/Device';
import { esc, h } from './UI';

export interface TouchState {
  elementUnlocked: boolean;
  color: string;
  glyph: string;
  skillArt: string;
  cdE: number;
  cdQ: number;
  energyPct: number;
  burstReady: boolean;
  hasScanner: boolean;
  scanning: boolean;
  antibiotic: number;
  interacts: { label: string; icon: string }[];
}

const STICK_R = 56; // joystick travel radius (px)

/**
 * On-screen controls for phones/tablets. Everything feeds the same `Input` the keyboard uses, so gameplay code
 * doesn't know the difference:
 *  - left part of the screen: floating joystick (appears where the thumb lands) → analog move
 *  - anywhere else on the 3D view: drag to turn the camera, pinch to zoom
 *  - buttons: attack (hold = charged), E, Q, jump/glide, dash (hold = sprint), scanner, antibiotic, interact, menus
 */
export class TouchControls {
  root = h(`<div id="touch">
    <div class="tc-stick" style="display:none"><div class="tc-knob"></div></div>
    <div class="tc-top">
      <button class="tc-mini" data-tap="KeyJ" aria-label="เควส">📜</button>
      <button class="tc-mini" data-tap="KeyM" aria-label="แผนที่">🗺️</button>
      <button class="tc-mini" data-tap="KeyB" aria-label="กระเป๋า">🎒</button>
      <button class="tc-mini" data-tap="KeyC" aria-label="ตัวละคร">🧬</button>
      <button class="tc-mini tc-fs" aria-label="เต็มจอ">⛶</button>
      <button class="tc-mini" data-tap="Escape" aria-label="เมนู">☰</button>
    </div>
    <div class="tc-interact"></div>
    <button class="tc-btn tc-attack" data-hold="Mouse0" aria-label="โจมตี">⚔</button>
    <button class="tc-btn tc-jump" data-hold="Space" aria-label="กระโดด">⤒</button>
    <button class="tc-btn tc-dash" data-hold="ShiftLeft" aria-label="หลบ / วิ่งเร็ว">»</button>
    <button class="tc-btn tc-skill tc-e" data-hold="KeyE" aria-label="สกิลธาตุ"><span class="art"></span><span class="cd"></span></button>
    <button class="tc-btn tc-skill tc-q" data-hold="KeyQ" aria-label="ท่าไม้ตาย"><span class="art"></span><span class="energy"></span><span class="cd"></span></button>
    <button class="tc-btn tc-small tc-scan" data-tap="KeyT" aria-label="Bio-Scanner">🔬</button>
    <button class="tc-btn tc-small tc-anti" data-tap="KeyZ" aria-label="ยาปฏิชีวนะ">💊<span class="n"></span></button>
  </div>`);

  private stick = this.root.querySelector('.tc-stick') as HTMLElement;
  private knob = this.root.querySelector('.tc-knob') as HTMLElement;
  private els = {
    e: this.root.querySelector('.tc-e') as HTMLElement,
    q: this.root.querySelector('.tc-q') as HTMLElement,
    scan: this.root.querySelector('.tc-scan') as HTMLElement,
    anti: this.root.querySelector('.tc-anti') as HTMLElement,
    interact: this.root.querySelector('.tc-interact') as HTMLElement,
  };
  /** pointerId → what that finger is doing on the 3D view */
  private fingers = new Map<number, { kind: 'stick' | 'look'; x: number; y: number; ox: number; oy: number }>();
  private pinchDist = 0;
  private last: Record<string, string> = {};
  /** Called when an interact pill is tapped (index into the interact list). */
  onInteract?: (i: number) => void;

  constructor(private input: Input, private canvas: HTMLCanvasElement) {
    // under the menus/dialogue layer, above the HUD
    document.getElementById('app')!.insertBefore(this.root, document.getElementById('overlay'));
    this.bindButtons();
    this.bindCanvas();
    (this.root.querySelector('.tc-fs') as HTMLElement).addEventListener('click', () => { void toggleFullscreen(); });
    this.els.interact.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
      if (b) this.onInteract?.(Number(b.dataset.i));
    });
  }

  private bindButtons() {
    this.root.querySelectorAll<HTMLElement>('[data-hold]').forEach((b) => {
      const code = b.dataset.hold!;
      const up = (e: PointerEvent) => { e.preventDefault(); b.classList.remove('down'); this.input.virtualUp(code); };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { b.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
        b.classList.add('down');
        this.input.virtualDown(code);
      });
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('lostpointercapture', () => { if (b.classList.contains('down')) { b.classList.remove('down'); this.input.virtualUp(code); } });
    });
    this.root.querySelectorAll<HTMLElement>('[data-tap]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('down'); });
      b.addEventListener('pointerup', (e) => { e.preventDefault(); b.classList.remove('down'); this.input.tap(b.dataset.tap!); });
      b.addEventListener('pointercancel', () => b.classList.remove('down'));
    });
  }

  private bindCanvas() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault(); // also stops the emulated mouse events the desktop controls listen to
      try { c.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      const w = window.innerWidth, hgt = window.innerHeight;
      const stickFree = ![...this.fingers.values()].some((f) => f.kind === 'stick');
      const kind = stickFree && e.clientX < w * 0.42 && e.clientY > hgt * 0.28 ? 'stick' : 'look';
      this.fingers.set(e.pointerId, { kind, x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY });
      if (kind === 'stick') {
        this.stick.style.display = '';
        this.root.classList.add('sticking');
        this.stick.style.left = `${e.clientX}px`;
        this.stick.style.top = `${e.clientY}px`;
        this.knob.style.transform = 'translate(-50%, -50%)';
      }
      this.pinchDist = this.lookPinch();
    });
    c.addEventListener('pointermove', (e) => {
      const f = this.fingers.get(e.pointerId);
      if (!f) return;
      if (f.kind === 'stick') {
        let dx = e.clientX - f.ox, dy = e.clientY - f.oy;
        const d = Math.hypot(dx, dy);
        if (d > STICK_R) {
          // drag the base along so the thumb never "runs off" the stick
          const k = (d - STICK_R) / d;
          f.ox += dx * k; f.oy += dy * k;
          dx = e.clientX - f.ox; dy = e.clientY - f.oy;
          this.stick.style.left = `${f.ox}px`;
          this.stick.style.top = `${f.oy}px`;
        }
        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        const nx = dx / STICK_R, ny = dy / STICK_R;
        const mag = Math.min(1, Math.hypot(nx, ny));
        // small dead zone so a resting thumb doesn't creep
        const s = mag < 0.18 ? 0 : 1 / Math.max(mag, 1e-6);
        this.input.moveX = nx * s;
        this.input.moveY = ny * s;
      } else {
        const pinch = this.lookPinch();
        if (pinch > 0 && this.pinchDist > 0) {
          this.input.wheel += (this.pinchDist - pinch) / 28;
          this.pinchDist = pinch;
        } else {
          this.input.touchDX += e.clientX - f.x;
          this.input.touchDY += e.clientY - f.y;
        }
      }
      f.x = e.clientX; f.y = e.clientY;
    });
    const end = (e: PointerEvent) => {
      const f = this.fingers.get(e.pointerId);
      if (!f) return;
      this.fingers.delete(e.pointerId);
      if (f.kind === 'stick') {
        this.stick.style.display = 'none';
        this.root.classList.remove('sticking');
        this.input.moveX = this.input.moveY = 0;
      }
      this.pinchDist = this.lookPinch();
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
  }

  /** Distance between the two camera fingers (0 unless exactly two are down). */
  private lookPinch() {
    const look = [...this.fingers.values()].filter((f) => f.kind === 'look');
    return look.length === 2 ? Math.hypot(look[0].x - look[1].x, look[0].y - look[1].y) : 0;
  }

  /** Lift every finger (a menu opened, the tab was hidden...). */
  reset() {
    this.fingers.clear();
    this.stick.style.display = 'none';
    this.root.classList.remove('sticking');
    this.root.querySelectorAll('.down').forEach((b) => b.classList.remove('down'));
    this.input.releaseAll();
  }

  private set(key: string, val: string, apply: () => void) {
    if (this.last[key] === val) return;
    this.last[key] = val;
    apply();
  }

  update(s: TouchState) {
    const { e, q, scan, anti, interact } = this.els;
    this.set('fs', String(isFullscreen()), () => this.root.querySelector('.tc-fs')!.classList.toggle('on', isFullscreen()));
    this.set('el', `${s.elementUnlocked}|${s.skillArt}|${s.color}`, () => {
      e.style.display = q.style.display = s.elementUnlocked ? '' : 'none';
      e.style.color = q.style.color = s.color;
      const art = (k: 'E' | 'Q') => img([`assets/ui/SKL_${s.skillArt}_${k}.png`], avatarPlaceholder(k === 'E' ? s.glyph : '✦', s.color, '#1b2340'));
      e.querySelector('.art')!.innerHTML = art('E');
      q.querySelector('.art')!.innerHTML = art('Q');
    });
    this.set('cdE', s.cdE > 0 ? s.cdE.toFixed(1) : '', () => {
      e.querySelector('.cd')!.textContent = s.cdE > 0 ? s.cdE.toFixed(1) : '';
      e.classList.toggle('ready', s.cdE <= 0);
    });
    this.set('q', `${s.burstReady}|${s.cdQ > 0 ? s.cdQ.toFixed(1) : ''}|${Math.round(s.energyPct * 20)}`, () => {
      q.querySelector('.cd')!.textContent = s.cdQ > 0 ? s.cdQ.toFixed(1) : '';
      (q.querySelector('.energy') as HTMLElement).style.height = s.burstReady ? '0' : `${s.energyPct * 100}%`;
      (q.querySelector('.energy') as HTMLElement).style.background = s.color;
      q.classList.toggle('ready', s.burstReady);
    });
    this.set('scan', `${s.hasScanner}|${s.scanning}`, () => {
      scan.style.display = s.hasScanner ? '' : 'none';
      scan.classList.toggle('on', s.scanning);
    });
    this.set('anti', String(s.antibiotic), () => {
      anti.style.display = s.antibiotic > 0 ? '' : 'none';
      anti.querySelector('.n')!.textContent = s.antibiotic > 0 ? String(s.antibiotic) : '';
    });
    this.set('ia', s.interacts.map((i) => i.icon + i.label).join('|'), () => {
      interact.innerHTML = s.interacts.map((it, i) => `<button class="tc-pill ${i === 0 ? 'sel' : ''}" data-i="${i}">${it.icon} ${esc(it.label)}</button>`).join('');
    });
  }
}
