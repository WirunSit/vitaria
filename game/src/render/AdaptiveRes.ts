/**
 * Dynamic resolution (phones): the render resolution drops a step when frames come in slower than the target
 * rate and creeps back up when there is headroom, so the frame rate stays steady instead of stuttering in busy
 * scenes. A step that just proved too slow isn't retried for a while, so it doesn't see-saw.
 */
export class AdaptiveRes {
  /** fraction of the quality setting's pixel ratio (1 = full) */
  scale = 1;
  enabled = true;
  private sum = 0;
  private n = 0;
  private frames: number[] = [];
  /** fastest frame of the current window, and of the last few windows: the rate the browser will deliver at all */
  private winMin = 1;
  private recentMins: number[] = [];
  private good = 0;
  /** scale that last ran too slow, and how long it stays off limits */
  private ceiling = 2;
  private ceilingT = 0;

  constructor(private apply: (scale: number) => void, private min = 0.6) {}

  reset() {
    this.sum = this.n = this.good = 0;
    this.frames.length = 0;
    this.winMin = 1;
    this.recentMins = [];
    this.ceiling = 2;
    if (this.scale !== 1) { this.scale = 1; this.apply(1); }
  }

  /** `dt` = real seconds since the last drawn frame, `target` = the frame time we want (1/60, 1/30). */
  frame(dt: number, target: number) {
    if (!this.enabled || dt > 0.25) return; // tab switches / load hitches say nothing about the GPU
    this.ceilingT -= dt;
    if (this.ceilingT <= 0) this.ceiling = 2;
    this.sum += dt;
    this.n++;
    this.frames.push(dt);
    this.winMin = Math.min(this.winMin, dt);
    if (this.sum < 1) return; // judge one-second windows
    // 70th percentile, not the mean: a model finishing loading costs one long frame, which says nothing about the GPU
    this.frames.sort((a, b) => a - b);
    const avg = this.frames[Math.floor(this.frames.length * 0.7)];
    this.frames.length = 0;
    this.sum = this.n = 0;
    this.recentMins.push(this.winMin);
    if (this.recentMins.length > 8) this.recentMins.shift();
    this.winMin = 1;
    // a browser that never draws faster than 30 FPS (iPhone low-power mode, 30 Hz screens) is capped, not slow:
    // judge against what it can deliver, or the resolution would drop for nothing
    target = Math.max(target, Math.min(...this.recentMins) * 0.98);
    let next = this.scale;
    if (avg > target * 1.18) {
      this.good = 0;
      this.ceiling = this.scale;
      this.ceilingT = 20;
      next = Math.max(this.min, this.scale - (avg > target * 1.6 ? 0.2 : 0.1));
    } else if (avg < target * 1.06 && ++this.good >= 3) {
      this.good = 0;
      const up = Math.min(1, this.scale + 0.05);
      if (up < this.ceiling - 0.001) next = up;
    }
    if (Math.abs(next - this.scale) > 0.001) {
      this.scale = next;
      this.apply(next);
      this.sum = this.n = 0; // the frame after a resize is slow; start a fresh window
      this.frames.length = 0;
    }
  }
}
