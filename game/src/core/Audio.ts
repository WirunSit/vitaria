import type { Element, WeaponType } from './types';

/**
 * Game audio (Genshin-style layering):
 *  · mixer — master → compressor, with music / ambience / sfx buses and a shared reverb send
 *  · samples — CC0/CC-BY recordings in assets/audio/sfx (`<group>_<n>.ogg`, a random variant + slight pitch drift per play)
 *  · synth — whooshes, crackles, splashes, chimes and twangs made with WebAudio for things the packs lack
 *  · 3D — positional one-shots are panned/attenuated against the listener (camera) every frame
 *  · music director — a track per scene (title, meadow day/night, city, Genovia, Zepheria, domain), combat and boss
 *    tracks take over while fighting, all streamed through <audio> elements and cross-faded
 *  · ambience — synthesized wind, birdsong by day, crickets by night, water near the lake, city murmur
 */
type Bus = 'sfx' | 'amb' | 'music' | 'ui';
export type Surface = 'grass' | 'dirt' | 'stone' | 'snow' | 'wood';
export type MusicScene = 'title' | 'field' | 'city' | 'genovia' | 'zepheria' | 'florantis' | 'metabolis' | 'aquorra' | 'neurion' | 'roots' | 'domain' | 'none';

let ctx: AudioContext | null = null;
let master: GainNode;
const buses = {} as Record<Bus, GainNode>;
let reverbIn: GainNode;
export const volumes = { master: 0.8, music: 0.5, sfx: 0.75, amb: 0.6 };

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4;
      master = ctx.createGain();
      master.connect(comp).connect(ctx.destination);
      for (const b of ['sfx', 'amb', 'music', 'ui'] as Bus[]) { buses[b] = ctx.createGain(); buses[b].connect(master); }
      // generated stereo impulse → soft hall reverb shared by sfx/ambience
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 2.2);
      const ir = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      conv.buffer = ir;
      reverbIn = ctx.createGain();
      reverbIn.gain.value = 0.5;
      reverbIn.connect(conv).connect(master);
      applyVolumes();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function setVolumes(v: Partial<typeof volumes>) {
  Object.assign(volumes, v);
  applyVolumes();
}
function applyVolumes() {
  if (!ctx) return;
  master.gain.value = volumes.master;
  buses.music.gain.value = volumes.music;
  buses.sfx.gain.value = volumes.sfx;
  buses.ui.gain.value = volumes.sfx * 0.8;
  buses.amb.gain.value = volumes.amb;
}

// ------------------------------------------------------------------------------------------------ listener / 3D
const listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
/** Call every frame with the camera position and its right vector (x/z). */
export function setListener(x: number, y: number, z: number, rightX: number, rightZ: number) {
  listener.x = x; listener.y = y; listener.z = z;
  const l = Math.hypot(rightX, rightZ) || 1;
  listener.rx = rightX / l; listener.rz = rightZ / l;
}
interface Pos { x: number; y: number; z: number }
/** gain + pan for a world position (near = full, ~40 m = silent) */
function spatial(p?: Pos): { g: number; pan: number } {
  if (!p) return { g: 1, pan: 0 };
  const dx = p.x - listener.x, dz = p.z - listener.z, dy = p.y - listener.y;
  const d = Math.hypot(dx, dy, dz);
  const g = Math.max(0, 1 - d / 42) / (1 + d / 14);
  const pan = d < 0.5 ? 0 : Math.max(-0.85, Math.min(0.85, (dx * listener.rx + dz * listener.rz) / d));
  return { g, pan };
}

/** A gain → panner → bus chain (+ reverb send) for one sound. */
function out(bus: Bus, vol: number, p?: Pos, verb = 0.12): GainNode | null {
  const a = ac();
  if (!a) return null;
  const s = spatial(p);
  if (s.g * vol < 0.004) return null;
  const g = a.createGain();
  g.gain.value = vol * s.g;
  const pan = a.createStereoPanner();
  pan.pan.value = s.pan;
  g.connect(pan).connect(buses[bus]);
  if (verb > 0) {
    const send = a.createGain();
    send.gain.value = verb * (p ? 1 + (1 - s.g) : 1);
    pan.connect(send).connect(reverbIn);
  }
  return g;
}

// ------------------------------------------------------------------------------------------------ samples
const GROUPS: Record<string, number> = {
  step_grass: 5, step_stone: 5, step_snow: 5, step_wood: 5, step_dirt: 10, blade: 3, slice: 2, chop: 1, hit: 5, hitheavy: 5,
  crit: 5, metal: 5, ice: 5, icebig: 5, stone: 4, rock: 5, fire: 7, spell: 2, bell: 5, cloth: 4, gem: 4, coins: 4, book: 4,
  slime: 4, monster_hurt: 2, monster_die: 1, roar: 3, wood: 5, soft: 5,
};
const buffers = new Map<string, AudioBuffer | null | Promise<void>>();

function load(file: string) {
  const a = ac();
  if (!a || buffers.has(file)) return;
  buffers.set(file, fetch(`assets/audio/sfx/${file}.ogg`).then((r) => r.arrayBuffer()).then((b) => a.decodeAudioData(b))
    .then((buf) => { buffers.set(file, buf); }).catch(() => { buffers.set(file, null); }));
}
/** Decode every variant of the given groups ahead of time (first plays would otherwise be silent). */
export function preload(groups = Object.keys(GROUPS)) {
  for (const g of groups) for (let i = 0; i < (GROUPS[g] ?? 0); i++) load(`${g}_${i}`);
}

const lastVariant = new Map<string, number>();
/** Play a random variant of a sample group. */
function sample(group: string, o: { vol?: number; rate?: number; jitter?: number; pos?: Pos; bus?: Bus; verb?: number; delay?: number } = {}) {
  const a = ac();
  const n = GROUPS[group];
  if (!a || !n) return;
  let i = Math.floor(Math.random() * n);
  if (n > 1 && i === lastVariant.get(group)) i = (i + 1) % n; // never the same variant twice in a row
  lastVariant.set(group, i);
  const file = `${group}_${i}`;
  const buf = buffers.get(file);
  if (!(buf instanceof AudioBuffer)) { load(file); return; }
  const dst = out(o.bus ?? 'sfx', o.vol ?? 1, o.pos, o.verb ?? 0.12);
  if (!dst) return;
  const src = a.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = (o.rate ?? 1) * (1 + ((Math.random() * 2 - 1) * (o.jitter ?? 0.06)));
  src.connect(dst);
  src.start(a.currentTime + (o.delay ?? 0));
}

// ------------------------------------------------------------------------------------------------ synth
let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(a: AudioContext) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, slideTo?: number, delay = 0, bus: Bus = 'sfx', pos?: Pos, verb = 0.15) {
  const a = ac();
  if (!a) return;
  const dst = out(bus, 1, pos, verb);
  if (!dst) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dst);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Filtered noise with a frequency sweep (whooshes, splashes, rustles, crackle). */
function sweep(dur: number, vol: number, f0: number, f1: number, type: BiquadFilterType = 'bandpass', q = 1.2, o: { pos?: Pos; delay?: number; bus?: Bus; attack?: number; verb?: number } = {}) {
  const a = ac();
  if (!a) return;
  const dst = out(o.bus ?? 'sfx', 1, o.pos, o.verb ?? 0.15);
  if (!dst) return;
  const t = a.currentTime + (o.delay ?? 0);
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = a.createGain();
  const att = o.attack ?? dur * 0.25;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(dst);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

const synth = {
  whoosh: (dur = 0.22, vol = 0.35, hi = 2600, pos?: Pos) => sweep(dur, vol, hi * 0.35, hi, 'bandpass', 0.9, { pos, attack: dur * 0.45 }),
  crackle: (n = 6, pos?: Pos) => { for (let i = 0; i < n; i++) { sweep(0.05 + Math.random() * 0.05, 0.3, 5000 + Math.random() * 3000, 2500, 'bandpass', 4, { pos, delay: i * 0.035 + Math.random() * 0.02, attack: 0.004 }); } tone(95, 0.18, 'square', 0.05, 70, 0, 'sfx', pos); },
  splash: (vol = 0.4, pos?: Pos) => { sweep(0.45, vol, 3200, 500, 'lowpass', 0.8, { pos, attack: 0.01 }); for (let i = 0; i < 4; i++) tone(700 + Math.random() * 900, 0.07, 'sine', 0.06, 1400 + Math.random() * 600, 0.05 + i * 0.05, 'sfx', pos); },
  rustle: (vol = 0.3, pos?: Pos) => { for (let i = 0; i < 3; i++) sweep(0.12, vol, 6000, 3500, 'highpass', 0.7, { pos, delay: i * 0.05, attack: 0.02 }); },
  gust: (dur = 0.8, vol = 0.35, pos?: Pos) => sweep(dur, vol, 300, 1400, 'bandpass', 0.6, { pos, attack: dur * 0.5, verb: 0.3 }),
  chime: (base = 880, vol = 0.12, pos?: Pos) => { [1, 1.5, 2, 3].forEach((m, i) => tone(base * m, 0.9, 'sine', vol / (i + 1), undefined, i * 0.03, 'sfx', pos, 0.35)); },
  twang: (pos?: Pos) => { tone(180, 0.25, 'sawtooth', 0.08, 120, 0, 'sfx', pos); sweep(0.18, 0.25, 1200, 4000, 'bandpass', 1, { pos, attack: 0.01 }); },
  rumble: (dur = 1, vol = 0.4, pos?: Pos) => sweep(dur, vol, 140, 60, 'lowpass', 0.7, { pos, attack: 0.05, verb: 0.3 }),
};

// ------------------------------------------------------------------------------------------------ public SFX
const EL_LAYER: Record<Element, (big: boolean, pos?: Pos) => void> = {
  PYRO: (big, pos) => { sample('fire', { vol: big ? 0.9 : 0.6, pos }); if (big) synth.rumble(0.8, 0.35, pos); },
  HYDRO: (big, pos) => synth.splash(big ? 0.5 : 0.35, pos),
  ANEMO: (big, pos) => synth.gust(big ? 1 : 0.5, big ? 0.45 : 0.3, pos),
  ELECTRO: (big, pos) => synth.crackle(big ? 10 : 5, pos),
  DENDRO: (big, pos) => { synth.rustle(big ? 0.35 : 0.22, pos); synth.chime(big ? 660 : 990, big ? 0.1 : 0.06, pos); },
  CRYO: (big, pos) => sample(big ? 'icebig' : 'ice', { vol: big ? 0.6 : 0.45, pos }),
  GEO: (big, pos) => sample(big ? 'rock' : 'stone', { vol: big ? 0.7 : 0.5, pos }),
  PHYSICAL: () => {},
};

export const sfx = {
  /** weapon swing (combo index alternates variants; finishers are heavier) */
  swing(weapon: WeaponType = 'SWORD', combo = 0, last = false) {
    if (weapon === 'BOW') { synth.twang(); return; }
    if (weapon === 'CATALYST') { synth.chime(1200 + combo * 120, 0.05); synth.whoosh(0.18, 0.12, 4000); return; }
    const heavy = weapon === 'CLAYMORE';
    synth.whoosh(heavy ? 0.36 : 0.2, heavy ? 0.5 : 0.32, heavy ? 1400 : weapon === 'POLEARM' ? 2200 : 3000);
    if (heavy) sample('chop', { vol: 0.5, rate: 0.8 });
    else sample(last ? 'slice' : 'blade', { vol: 0.45, rate: weapon === 'POLEARM' ? 0.9 : 1.05 });
    if (last) sample('cloth', { vol: 0.35 });
  },
  /** landed hit: body impact + element layer (+ metallic ring on crits), positioned at the target */
  hit(el: Element = 'PHYSICAL', crit = false, weapon?: WeaponType, pos?: Pos) {
    const heavy = weapon === 'CLAYMORE' || crit;
    sample(heavy ? 'hitheavy' : 'hit', { vol: weapon === 'CATALYST' || weapon === 'BOW' ? 0.35 : 0.6, pos });
    if (crit) sample('crit', { vol: 0.45, pos, rate: 1.1 });
    if (el !== 'PHYSICAL') EL_LAYER[el](false, pos);
  },
  crit() { sample('crit', { vol: 0.5 }); },
  /** element cast flourish for E (big = Q burst) */
  cast(el: Element, big: boolean) {
    sample('spell', { vol: big ? 0.6 : 0.45, rate: big ? 0.85 : 1 });
    EL_LAYER[el](big, undefined);
    if (big) { sample('bell', { vol: 0.35, rate: 0.75, verb: 0.5 }); synth.gust(1.1, 0.3); }
  },
  skill() { synth.whoosh(0.3, 0.25, 2000); },
  burst() { synth.rumble(0.9, 0.35); },
  reaction() { synth.chime(784, 0.12); },
  jump() { sample('cloth', { vol: 0.35 }); synth.whoosh(0.18, 0.12, 1800); },
  land(v = 1) { sample('step_dirt', { vol: Math.min(0.8, 0.3 + v * 0.03), rate: 0.8 }); },
  dodge() { synth.whoosh(0.3, 0.3, 2400); sample('cloth', { vol: 0.4 }); },
  step(surface: Surface, vol = 0.32) { sample(`step_${surface}`, { vol, jitter: 0.08, verb: 0.04 }); },
  enemyHurt(pos?: Pos, slimy = true) { sample(slimy ? 'slime' : 'monster_hurt', { vol: 0.45, pos }); },
  enemyDie(pos?: Pos, big = false) { sample(big ? 'roar' : 'monster_die', { vol: big ? 0.7 : 0.5, pos, rate: big ? 0.9 : 1.1 }); synth.chime(520, 0.05, pos); },
  pickup() { sample('gem', { vol: 0.45, bus: 'ui' }); },
  coins() { sample('coins', { vol: 0.5, bus: 'ui' }); },
  page() { sample('book', { vol: 0.4, bus: 'ui' }); },
  correct() { tone(784, 0.15, 'triangle', 0.3, undefined, 0, 'ui'); tone(1046, 0.25, 'triangle', 0.3, undefined, 0.12, 'ui'); },
  wrong() { tone(300, 0.25, 'sine', 0.25, 220, 0, 'ui'); },
  ui() { tone(660, 0.05, 'sine', 0.1, 880, 0, 'ui', undefined, 0.05); },
  hurt() { sample('hitheavy', { vol: 0.5, rate: 0.85 }); tone(140, 0.15, 'triangle', 0.08, 90); },
  unlock() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, undefined, i * 0.08, 'ui', undefined, 0.35)); },
  scan() { tone(1200, 0.06, 'sine', 0.06, undefined, 0, 'ui'); },
  shield() { sample('stone', { vol: 0.4 }); synth.chime(440, 0.08); },
  /** short victory fanfare when a fight is won */
  victory() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i === 4 ? 0.9 : 0.3, 'triangle', 0.14, undefined, i * 0.09, 'ui', undefined, 0.4)); },
};

// ------------------------------------------------------------------------------------------------ music director
const TRACKS: Record<string, string> = {
  title: 'title.mp3', field_day: 'relax.ogg', field_day2: 'field_day.mp3', night: 'night.mp3', city: 'city.mp3',
  genovia: 'relax.ogg', zepheria: 'title.mp3', domain: 'domain.mp3', battle: 'battle.mp3', boss: 'boss.mp3',
};
interface Deck { el: HTMLAudioElement; gain: GainNode }
const decks = new Map<string, Deck>();
let current: string | null = null;
let scene: MusicScene = 'none';
let isDay = true;
let combat: 0 | 1 | 2 = 0;
let combatHold = 0;
let fieldAlt = 0;

function deck(key: string): Deck | null {
  const a = ac();
  if (!a) return null;
  let d = decks.get(key);
  if (!d) {
    const el = new Audio(`assets/audio/music/${TRACKS[key]}`);
    el.loop = true;
    el.preload = 'auto';
    const gain = a.createGain();
    gain.gain.value = 0;
    a.createMediaElementSource(el).connect(gain).connect(buses.music);
    d = { el, gain };
    decks.set(key, d);
  }
  return d;
}

function crossfadeTo(key: string | null, fade = 2.5) {
  if (key === current) return;
  const a = ac();
  if (!a) return;
  const t = a.currentTime;
  if (current) {
    const old = decks.get(current);
    if (old) {
      old.gain.gain.cancelScheduledValues(t);
      old.gain.gain.setValueAtTime(old.gain.gain.value, t);
      old.gain.gain.linearRampToValueAtTime(0, t + fade);
      const el = old.el;
      setTimeout(() => { if (old.gain.gain.value < 0.02) el.pause(); }, fade * 1000 + 100);
    }
  }
  current = key;
  if (!key) return;
  const d = deck(key);
  if (!d) return;
  // battle/boss restart from the top; scene tracks continue where they were
  if (key === 'battle' || key === 'boss') d.el.currentTime = 0;
  void d.el.play().catch(() => {});
  d.gain.gain.cancelScheduledValues(t);
  d.gain.gain.setValueAtTime(d.gain.gain.value, t);
  d.gain.gain.linearRampToValueAtTime(1, t + (key === 'battle' || key === 'boss' ? 0.8 : fade));
}

function sceneTrack(): string | null {
  switch (scene) {
    case 'title': return 'title';
    case 'field': return isDay ? (fieldAlt % 2 ? 'field_day2' : 'field_day') : 'night';
    case 'city': return 'city';
    case 'genovia': return isDay ? 'genovia' : 'night';
    case 'zepheria': return 'zepheria';
    case 'florantis': return isDay ? 'field_day2' : 'night';
    case 'metabolis': return isDay ? 'city' : 'night';
    case 'aquorra': return isDay ? 'field_day' : 'night';
    case 'neurion': return isDay ? 'city' : 'night';
    case 'roots': return isDay ? 'field_day' : 'night';
    case 'domain': return 'domain';
    default: return null;
  }
}

export const music = {
  /** Where the player is (and whether it's day); call whenever it may have changed (cheap). */
  setScene(s: MusicScene, day = true) {
    if (s === 'field' && scene !== 'field') fieldAlt++; // alternate the two meadow pieces between visits
    scene = s;
    isDay = day;
    music.refresh();
  },
  /** 0 = calm, 1 = enemies engaged, 2 = boss. Combat music lingers a few seconds after the fight. */
  setCombat(level: 0 | 1 | 2, dt: number) {
    if (level > 0) { combat = level; combatHold = 5; }
    else if (combat > 0) {
      combatHold -= dt;
      if (combatHold <= 0) { combat = 0; sfx.victory(); }
    }
    music.refresh();
  },
  refresh() {
    const want = combat === 2 ? 'boss' : combat === 1 && scene !== 'title' ? 'battle' : sceneTrack();
    crossfadeTo(want);
  },
  stop() { scene = 'none'; combat = 0; crossfadeTo(null, 1.5); },
};

// ------------------------------------------------------------------------------------------------ ambience (synthesized beds)
interface Bed { src: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; lfo?: OscillatorNode }
const beds = new Map<string, Bed>();

function bed(name: string, type: BiquadFilterType, freq: number, q: number): Bed | null {
  const a = ac();
  if (!a) return null;
  let b = beds.get(name);
  if (!b) {
    const src = a.createBufferSource();
    src.buffer = noiseBuffer(a);
    src.loop = true;
    const filter = a.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = a.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(buses.amb);
    src.start(0, Math.random() * 2);
    b = { src, filter, gain };
    beds.set(name, b);
  }
  return b;
}

let birdT = 2, cricketT = 0.5, ambT = 0;
export const ambience = {
  /**
   * @param wind 0..1 (open fields ~0.4, sky islands ~1), @param water 0..1 (proximity to the lake),
   * @param day 0..1 daylight, @param city true inside towns (murmur instead of birds)
   */
  update(dt: number, o: { wind: number; water: number; day: number; city: boolean; indoor: boolean }) {
    const a = ac();
    if (!a) return;
    ambT += dt;
    const t = a.currentTime;
    const set = (b: Bed | null, v: number) => { if (b) b.gain.gain.setTargetAtTime(v, t, 0.8); };
    // wind: band-passed noise whose centre and level breathe slowly
    const w = bed('wind', 'bandpass', 500, 0.5);
    if (w) w.filter.frequency.setTargetAtTime(380 + Math.sin(ambT * 0.23) * 160 + Math.sin(ambT * 0.071) * 120, t, 0.5);
    set(w, o.indoor ? 0 : o.wind * (0.06 + 0.035 * (Math.sin(ambT * 0.31) * 0.5 + 0.5)));
    // water: low rushing noise near the lake
    set(bed('water', 'lowpass', 900, 0.4), o.water * 0.09);
    // town murmur
    set(bed('city', 'bandpass', 350, 0.8), o.city ? 0.05 : 0);
    if (o.indoor) return;
    // birds by day (fields), crickets by night
    if (!o.city && o.day > 0.5) {
      birdT -= dt;
      if (birdT <= 0) {
        birdT = 1.5 + Math.random() * 4;
        const f = 2200 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4), pan = Math.random() * 1.6 - 0.8;
        for (let i = 0; i < n; i++) birdChirp(f * (1 + (Math.random() - 0.5) * 0.15), i * (0.09 + Math.random() * 0.05), pan, o.day);
      }
    } else if (o.day < 0.35 && !o.city) {
      cricketT -= dt;
      if (cricketT <= 0) {
        cricketT = 0.35 + Math.random() * 0.9;
        const pan = Math.random() * 1.6 - 0.8;
        for (let i = 0; i < 3; i++) cricket(4300 + Math.random() * 400, i * 0.06, pan);
      }
    }
  },
  silence() { for (const b of beds.values()) b.gain.gain.setTargetAtTime(0, ac()!.currentTime, 0.4); },
};

function birdChirp(freq: number, delay: number, pan: number, day: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  const p = a.createStereoPanner();
  p.pan.value = pan;
  o.type = 'sine';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * (1.25 + Math.random() * 0.3), t + 0.05);
  o.frequency.exponentialRampToValueAtTime(freq * 0.9, t + 0.1);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.025 * day, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
  o.connect(g).connect(p).connect(buses.amb);
  const send = a.createGain();
  send.gain.value = 0.4;
  p.connect(send).connect(reverbIn);
  o.start(t);
  o.stop(t + 0.15);
}

function cricket(freq: number, delay: number, pan: number) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const am = a.createOscillator();
  const amg = a.createGain();
  const g = a.createGain();
  const p = a.createStereoPanner();
  p.pan.value = pan;
  o.frequency.value = freq;
  am.frequency.value = 55;
  amg.gain.value = 0.5;
  am.connect(amg).connect(g.gain);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.012, t + 0.01);
  g.gain.linearRampToValueAtTime(0.0001, t + 0.045);
  o.connect(g).connect(p).connect(buses.amb);
  o.start(t); am.start(t);
  o.stop(t + 0.06); am.stop(t + 0.06);
}

/** First user gesture: start the context and decode the common sound groups. */
export function unlockAudio() {
  if (!ac()) return;
  preload();
}
