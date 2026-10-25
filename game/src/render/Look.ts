import { loadSave } from '../core/Save';

/**
 * Art-direction switch. `v2` = the 2026-10-19 look: neutral tone mapping (true anime colours), cool-tinted
 * shadows, blue aerial haze, layered far mountains, stylised water, deeper meadow greens.
 * Read once at start-up (the world is built before a save is loaded), so changing it needs a reload.
 * Esc → settings "ภาพแบบใหม่" (settings.lookV2, default on).
 */
function initial() {
  try { return loadSave()?.settings.lookV2 !== false; } catch { return true; }
}

export const LOOK = { v2: initial() };
