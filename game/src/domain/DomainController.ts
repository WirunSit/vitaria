import * as THREE from 'three';
import { data } from '../core/Data';
import { sfx } from '../core/Audio';
import type { SaveData } from '../core/Save';
import type { DomainDef, Element } from '../core/types';
import type { Combat } from '../combat/Combat';
import type { Enemy } from '../enemies/Enemy';
import type { PlayerController } from '../player/PlayerController';
import type { World } from '../world/World';
import { DOMAIN_CENTER } from '../world/World';
import { CREATINE_COST, regenAtp, spendAtp } from './Atp';

/** Daily environment modifiers (Ley Line Disorder → "สภาพแวดล้อมผิดปกติ") with the biology behind them. */
export interface Modifier { id: string; th: string; effect: string; why: string }
export const MODIFIERS: Modifier[] = [
  { id: 'ACID', th: 'pH ต่ำ (สภาพกรด)', effect: 'ศัตรูเคลื่อนที่และโจมตีช้าลง 25%', why: 'เอนไซม์ทำงานได้ดีที่สุดในช่วง pH ที่เหมาะสม เมื่อ pH ต่ำเกินไป โครงสร้างสามมิติของเอนไซม์เปลี่ยน ปฏิกิริยาในเซลล์จึงช้าลง' },
  { id: 'HOT', th: 'อุณหภูมิสูง', effect: 'ศัตรูถูกเคลือบธาตุไฟตลอด — ใช้น้ำหรือน้ำแข็งทำปฏิกิริยาได้รุนแรง', why: 'สิ่งมีชีวิตต้องรักษาอุณหภูมิให้คงที่ (Homeostasis) ความร้อนเกินไปทำให้โปรตีนเสียสภาพ' },
  { id: 'HUMID', th: 'ความชื้นสูง', effect: 'ศัตรูเปียก (ธาตุน้ำ) ตลอด — ปฏิกิริยาไฟฟ้าและน้ำแข็งได้ผลดี', why: 'เชื้อแบคทีเรียและราเติบโตได้ดีในที่ชื้น เพราะน้ำจำเป็นต่อปฏิกิริยาเคมีในเซลล์' },
  { id: 'HYPOTONIC', th: 'สารละลายไฮโพโทนิก', effect: 'ศัตรูบวมน้ำ: HP +25% แต่รับดาเมจกายภาพเพิ่ม', why: 'เมื่อเซลล์อยู่ในสารละลายที่เจือจางกว่า น้ำจะออสโมซิสเข้าเซลล์จนเต่ง เซลล์ที่ไม่มีผนังเซลล์อาจแตกได้' },
];

export const DOMAIN_LEVELS = [
  { lv: 1, enemyLevel: 8, rr: 1, label: 'I' },
  { lv: 2, enemyLevel: 15, rr: 5, label: 'II' },
  { lv: 3, enemyLevel: 22, rr: 8, label: 'III' },
];
export const DOMAIN_COST = 20;
export const DOMAIN_TIME = 150;

const SERIES_BY_DAY: (string | null)[] = [null, 'CELL', 'OBS', 'HYP', 'CELL', 'OBS', 'HYP']; // Sunday = choose
export const SERIES_TH: Record<string, string> = { CELL: 'ทฤษฎีเซลล์', OBS: 'การสังเกต', HYP: 'สมมติฐาน' };
export function todaysSeries(): string | null { return SERIES_BY_DAY[new Date().getDay()]; }

export function modifierFor(domainId: string): Modifier {
  const idx = [...data.domains.keys()].indexOf(domainId);
  return MODIFIERS[(new Date().getDay() + Math.max(0, idx)) % MODIFIERS.length];
}

export interface DomainHost {
  save: () => SaveData;
  combat: Combat;
  world: World;
  player: () => PlayerController;
  giveItem(id: string, n: number): void;
  grantRelic(rarity: 3 | 4 | 5, announce?: boolean): void;
  addRRExp(n: number): void;
  toast(text: string, big?: boolean): void;
  fadeTeleport(to: THREE.Vector3, after?: () => void): void;
  writeSave(): void;
  onFinished(run: DomainRun, success: boolean): void;
}

export interface DomainRun {
  def: DomainDef;
  level: typeof DOMAIN_LEVELS[number];
  mod: Modifier;
  series: string | null;
  precheck: boolean;
  wave: number;
  waves: number;
  timeLeft: number;
  state: 'fighting' | 'cleared' | 'failed';
  returnTo: THREE.Vector3;
}

export class DomainController {
  run: DomainRun | null = null;
  private waveDelay = 0;

  constructor(private host: DomainHost) {}

  get active() { return !!this.run; }

  enter(def: DomainDef, levelIdx: number, series: string | null, precheck: boolean) {
    const p = this.host.player();
    this.run = {
      def, level: DOMAIN_LEVELS[levelIdx], mod: modifierFor(def.id), series, precheck,
      wave: 0, waves: 2, timeLeft: DOMAIN_TIME, state: 'fighting', returnTo: p.pos.clone(),
    };
    this.host.world.domainExit.visible = false;
    for (const e of this.host.combat.enemies) if (e.questTag === 'DOMAIN') { e.alive = false; e.deadT = 0.39; }
    this.host.fadeTeleport(new THREE.Vector3(DOMAIN_CENTER.x, 0, DOMAIN_CENTER.z + 14), () => {
      p.camYaw = 0;
      this.waveDelay = 1.5;
      this.host.toast(`${def.name.th} ${this.run!.level.label} · สภาพแวดล้อม: ${this.run!.mod.th}`, true);
    });
  }

  private spawnWave() {
    const r = this.run!;
    r.wave++;
    const count = r.wave === 1 ? 4 : 3;
    const list = r.def.enemies;
    for (let i = 0; i < count + (r.wave === 2 ? 1 : 0); i++) {
      const a = (i / count) * Math.PI * 2 + r.wave;
      const pos = new THREE.Vector3(DOMAIN_CENTER.x + Math.cos(a) * 9, 0, DOMAIN_CENTER.z - 2 + Math.sin(a) * 9);
      const id = list[(i + r.wave) % list.length];
      let variant: Element | null = null;
      if (r.mod.id === 'HOT') variant = 'PYRO';
      if (r.mod.id === 'HUMID') variant = 'HYDRO';
      const elite = r.wave === 2 && i === count;
      const e = this.host.combat.spawn(id, pos, r.level.enemyLevel + (elite ? 3 : 0), variant, 'DOMAIN');
      if (!e) continue;
      e.aggro = true;
      e.generation = 2; // no binary fission inside the lab (keeps runs fair)
      this.applyModifier(e, elite);
    }
    this.host.toast(`คลื่นที่ ${r.wave}/${r.waves}`);
  }

  private applyModifier(e: Enemy, elite: boolean) {
    const mod = this.run!.mod.id;
    if (elite) { e.maxHp = Math.round(e.maxHp * 2.2); e.hp = e.maxHp; e.root.scale.setScalar(1.35); }
    if (mod === 'ACID') e.speedMul = 0.75;
    if (mod === 'HYPOTONIC') { e.maxHp = Math.round(e.maxHp * 1.25); e.hp = e.maxHp; e.res.PHYSICAL = -0.3; e.root.scale.multiplyScalar(1.15); }
  }

  update(dt: number) {
    const r = this.run;
    if (!r || r.state !== 'fighting') return;
    if (this.waveDelay > 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) this.spawnWave();
      return;
    }
    r.timeLeft -= dt;
    const alive = this.host.combat.enemies.some((e) => e.alive && e.questTag === 'DOMAIN');
    if (!alive && r.wave > 0) {
      if (r.wave < r.waves) this.waveDelay = 2;
      else this.clear();
    }
    if (r.timeLeft <= 0) this.fail('หมดเวลา!');
  }

  private clear() {
    const r = this.run!;
    r.state = 'cleared';
    sfx.unlock();
    this.host.world.domainExit.visible = true;
    this.host.toast('🧪 การทดลองสำเร็จ! ไปที่แท่นรางวัลเพื่อรับรางวัล', true);
    this.host.onFinished(r, true);
  }

  fail(reason: string) {
    const r = this.run;
    if (!r || r.state !== 'fighting') return;
    r.state = 'failed';
    for (const e of this.host.combat.enemies) if (e.questTag === 'DOMAIN') { e.alive = false; e.deadT = 0.39; }
    this.host.toast(`การทดลองล้มเหลว — ${reason} (ไม่เสีย ATP)`, true);
    this.host.onFinished(r, false);
  }

  /** Rewards for a cleared run. `mult` = 2 when paying with Creatine Phosphate. */
  rewards(mult: 1 | 2): string[] {
    const r = this.run!;
    const lv = r.level.lv;
    const out: string[] = [];
    const give = (id: string, n: number) => { if (n <= 0) return; this.host.giveItem(id, n * mult); out.push(`${id}×${n * mult}`); };
    const bonus = r.precheck ? 1 : 0;
    if (r.def.type === 'BOOK') {
      const s = r.series ?? 'CELL';
      if (lv === 1) { give(`BOOK_${s}_1`, 3 + (Math.random() < 0.5 ? 1 : 0) + bonus); }
      if (lv === 2) { give(`BOOK_${s}_1`, 2 + bonus); give(`BOOK_${s}_2`, 2); }
      if (lv === 3) { give(`BOOK_${s}_2`, 3 + bonus); give(`BOOK_${s}_3`, Math.random() < 0.5 ? 1 : 0); }
      give('GLUCOSE', 1500 * lv);
    } else if (r.def.type === 'ORE') {
      give('ORE_PHOSPHATE', lv + 1 + bonus);
      give('ORE_CALCIUM', 3);
      give('GLUCOSE', 15000 * lv);
      if (lv >= 2) give('MAT_CALCITE', 1);
    } else {
      const relics: (3 | 4 | 5)[] = [];
      if (lv === 1) { relics.push(3); if (Math.random() < 0.4) relics.push(4); }
      if (lv === 2) { relics.push(4, 3); if (Math.random() < 0.1) relics.push(5); }
      if (lv === 3) { relics.push(4); if (Math.random() < 0.6) relics.push(5); give('GROWTH_FACTOR', 2); }
      if (bonus) relics.push(3);
      for (let k = 0; k < mult; k++) for (const rar of relics) { this.host.grantRelic(rar); out.push(`Relic ★${rar}`); }
    }
    this.host.addRRExp(100 * lv * mult);
    return out;
  }

  /** Pay and claim. Returns an error message or null. */
  claim(useCreatine: boolean): string | null {
    const s = this.host.save();
    regenAtp(s);
    if (useCreatine) {
      if ((s.inventory.CREATINE ?? 0) <= 0) return 'ไม่มีครีเอทีนฟอสเฟต';
      s.inventory.CREATINE--;
    } else if (!spendAtp(s, DOMAIN_COST)) return `ATP ไม่พอ (ต้องใช้ ${DOMAIN_COST}) — ฟื้นฟู 1 หน่วยทุก 8 นาที`;
    this.rewards(useCreatine ? 2 : 1);
    this.host.writeSave();
    return null;
  }

  exit() {
    const r = this.run;
    if (!r) return;
    for (const e of this.host.combat.enemies) if (e.questTag === 'DOMAIN') { e.alive = false; e.deadT = 0.39; }
    this.host.world.domainExit.visible = false;
    const back = r.returnTo;
    this.run = null;
    this.host.fadeTeleport(back);
  }

  /** Restart the same domain (after claiming or failing). */
  retry() {
    const r = this.run;
    if (!r) return;
    const { def, level, series, precheck } = r;
    const ret = r.returnTo;
    this.enter(def, DOMAIN_LEVELS.indexOf(level), series, precheck);
    this.run!.returnTo = ret;
  }
}

export { CREATINE_COST };
