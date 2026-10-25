import type * as THREE from 'three';

/**
 * Small FPS / draw-call / triangle readout (Esc menu → "แสดง FPS"), so the effect of graphics settings and
 * distance culling can be seen in play. The renderer's counters are reset once per frame by the game loop.
 */
export class PerfHud {
  private el: HTMLDivElement;
  private frames = 0;
  private t = 0;

  constructor(private renderer: THREE.WebGLRenderer) {
    renderer.info.autoReset = false; // postfx renders several passes per frame; count them all
    this.el = document.createElement('div');
    this.el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:50;padding:4px 8px;border-radius:6px;background:rgba(10,14,24,.72);color:#bfe8ff;font:12px/1.4 ui-monospace,Consolas,monospace;pointer-events:none;white-space:pre';
    this.el.hidden = true;
    document.body.appendChild(this.el);
  }

  set enabled(on: boolean) { this.el.hidden = !on; }

  /** Call before rendering a frame. */
  begin() { this.renderer.info.reset(); }

  /** Call after rendering a frame. */
  end(dt: number) {
    this.frames++;
    this.t += dt;
    if (this.t < 0.5 || this.el.hidden) return;
    const r = this.renderer.info.render;
    this.el.textContent = `FPS ${Math.round(this.frames / this.t)}  ·  draw ${r.calls}  ·  ${(r.triangles / 1000).toFixed(0)}k tris`;
    this.frames = 0;
    this.t = 0;
  }
}
