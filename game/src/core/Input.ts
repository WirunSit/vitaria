/** Keyboard + mouse state. `pressed` sets are cleared at the end of every frame. */
export class Input {
  private down = new Set<string>();
  private pressedSet = new Set<string>();
  private releasedSet = new Set<string>();
  mouseDX = 0;
  mouseDY = 0;
  wheel = 0;
  locked = false;
  /**
   * 'drag' = free cursor, hold right (or middle) mouse and drag to turn the camera; a quick right-click still dashes.
   * 'lock' = Genshin-style: click locks the pointer and the mouse always turns the camera.
   */
  mode: 'drag' | 'lock' = 'drag';
  private drag: { button: number; moved: number; t: number } | null = null;
  /** When false, gameplay input is ignored (menus open). */
  enabled = true;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (['Tab', 'F1', 'Space'].includes(e.code) || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.down.has(e.code)) this.pressedSet.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.releasedSet.add(e.code);
    });
    window.addEventListener('blur', () => { this.down.clear(); this.endDrag(); });
    canvas.addEventListener('mousedown', (e) => {
      if (this.mode === 'drag' && (e.button === 1 || e.button === 2)) {
        e.preventDefault();
        this.drag = { button: e.button, moved: 0, t: performance.now() };
        document.body.classList.add('cam-dragging');
        return;
      }
      const code = `Mouse${e.button}`;
      if (!this.down.has(code)) this.pressedSet.add(code);
      this.down.add(code);
      if (this.mode === 'lock' && !this.locked && this.enabled) this.requestLock();
    });
    window.addEventListener('mouseup', (e) => {
      if (this.drag && e.button === this.drag.button) {
        // a short right-click without dragging still counts as a click (dash)
        if (this.drag.button === 2 && this.drag.moved < 6 && performance.now() - this.drag.t < 300) this.pressedSet.add('Mouse2');
        this.endDrag();
        return;
      }
      const code = `Mouse${e.button}`;
      this.down.delete(code);
      this.releasedSet.add(code);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (this.locked || (this.drag && this.enabled)) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
        if (this.drag) this.drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
      }
    });
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (was && !this.locked && !this.intentional) this.onLockLost?.();
      this.intentional = false;
    });
  }

  private endDrag() {
    this.drag = null;
    document.body.classList.remove('cam-dragging');
  }

  setMode(mode: 'drag' | 'lock') {
    this.mode = mode;
    if (mode === 'drag') this.releaseLock();
    this.endDrag();
  }

  requestLock() {
    try { this.canvas.requestPointerLock()?.catch?.(() => {}); } catch { /* ignore */ }
  }
  releaseLock() {
    if (document.pointerLockElement) {
      this.intentional = true;
      document.exitPointerLock();
    }
  }
  private intentional = false;
  /** Called when the browser drops pointer lock by itself (e.g. the player pressed Esc). */
  onLockLost?: () => void;

  isDown(code: string) { return this.enabled && this.down.has(code); }
  pressed(code: string) { return this.enabled && this.pressedSet.has(code); }
  released(code: string) { return this.enabled && this.releasedSet.has(code); }
  /** Raw (ignores enabled) — used by UI shortcuts while menus are open. */
  rawPressed(code: string) { return this.pressedSet.has(code); }

  endFrame() {
    this.pressedSet.clear();
    this.releasedSet.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheel = 0;
  }
}
