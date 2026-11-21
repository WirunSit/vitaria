import * as THREE from 'three';

/**
 * Counts every file three.js loaders fetch (GLB / VRM models, their textures, FBX animations), so the loading
 * screen can show real progress and wait until the scene around the player has actually arrived.
 * All of the game's loaders use THREE.DefaultLoadingManager.
 */
let started = 0;
let finished = 0;
let lastChange = 0;
const mgr = THREE.DefaultLoadingManager;
mgr.onStart = (_url, loaded, total) => { started = Math.max(started, total); finished = Math.max(finished, loaded); lastChange = performance.now(); };
mgr.onProgress = (_url, loaded, total) => { started = Math.max(started, total); finished = Math.max(finished, loaded); lastChange = performance.now(); };
mgr.onError = () => { lastChange = performance.now(); };
mgr.onLoad = () => { finished = started; lastChange = performance.now(); };

export function loadCounts() { return { loaded: finished, total: started }; }

/**
 * Resolves once nothing has been loading for `quietMs` (models often queue more files after parsing),
 * or after `maxMs` at the latest. `onProgress` gets 0..1 for the files queued since this call.
 */
export function waitForLoads(onProgress: (p: number, loaded: number, total: number) => void, maxMs: number, quietMs = 600): Promise<void> {
  const base = finished;
  const t0 = performance.now();
  return new Promise((resolve) => {
    const step = () => {
      const now = performance.now();
      const total = started - base, loaded = finished - base;
      onProgress(total > 0 ? loaded / total : 1, loaded, total);
      const idle = finished >= started && now - Math.max(lastChange, t0) > quietMs;
      if (idle || now - t0 > maxMs) return resolve();
      setTimeout(step, 100);
    };
    step();
  });
}
