import * as THREE from 'three';
import { Terrain, WATER_LEVEL, WORLD_RADIUS, WORLD_SIZE, LAKE, fbm, isWater } from './Terrain';
import { GroundMask } from './Ground';
import { ExperimentPlant, planterBox } from './ExperimentPlant';
import { toon, glow, addOutline } from './Materials';
import { data } from '../core/Data';
import { City, CITY, CITY_RADIUS, inCity } from './City';
import { Sites } from './Sites';
import { CYTORIA_PALETTE, hasNature, scatter, type Spot } from './Nature';
import { Genovia, GEN, GEN_RADIUS, genHeightLocal, inGenovia } from './Genovia';
import { Zepheria, ZEP, ZEP_SIZE, ISLANDS, zepHeightLocal, inZepheria, updraftAtLocal } from './Zepheria';
import { Florantis, FLO, FLO_RADIUS, floHeightLocal, inFlorantis } from './Florantis';
import { Metabolis, MET, MET_RADIUS, metHeightLocal, inMetabolis } from './Metabolis';
import { Aquorra, AQU, AQU_RADIUS, aquHeightLocal, inAquorra } from './Aquorra';
import { Neurion, NEU, NEU_RADIUS, neuHeightLocal, inNeurion } from './Neurion';
import { Roots, ARB, ARB_RADIUS, arbHeightLocal, inRoots } from './Roots';
import { WATER_ENV } from '../render/Water';
import { applyDetailTexture, hasProp, propSlot } from '../models/PropModels';
import { PAINTED_TREES, hasFlora, plantFlora, plantTiled, updateFlora, type FloraSet, type FloraSpot } from './Flora';
import { fitToHeight, hasModel, loadGLBAnimated, loadVRM, toonify } from '../models/ModelLibrary';
import { VrmCharacterModel } from '../models/CharacterModels';
import type { AnimState } from '../player/CharacterModel';
import type { Appearance } from '../core/types';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LOOK } from '../render/Look';
import { Backdrop } from '../render/Backdrop';

function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(list.map((g) => g.toNonIndexed()))!;
}

export interface Collider { x: number; z: number; r: number; id?: string }
export interface Interactable {
  id: string;
  label: () => string;
  icon: string;
  pos: THREE.Vector3;
  radius: number;
  enabled: () => boolean;
  onInteract: () => void;
}
export interface Scannable {
  id: string;
  codexId: string;
  tags: string[];
  obj: THREE.Object3D;
  radius: number;
  label: string;
  alive?: () => boolean;
}

/** Instanced lab arena for Lab Domains (far outside the map, hidden by fog). */
export const DOMAIN_CENTER = { x: 0, z: 700 };
export const DOMAIN_RADIUS = 22;

export interface OrbDef { id: string; x: number; z: number; y?: number }
export interface ChestDef { id: string; x: number; z: number; tier: 1 | 2 | 3 }

const ORBS: OrbDef[] = [
  { id: 'ORB_GEO_01', x: 20, z: 30 }, { id: 'ORB_GEO_02', x: -95, z: 10, y: 4 }, { id: 'ORB_GEO_03', x: 70, z: -60 },
  { id: 'ORB_GEO_04', x: -40, z: -100 }, { id: 'ORB_GEO_05', x: 60, z: 50, y: 2 }, { id: 'ORB_GEO_06', x: 120, z: -10 },
  { id: 'ORB_GEO_07', x: -70, z: -40, y: 3 }, { id: 'ORB_GEO_08', x: 30, z: -140 }, { id: 'ORB_GEO_09', x: -120, z: 70 },
  { id: 'ORB_GEO_10', x: 100, z: 90 },
];
const CHESTS: ChestDef[] = [
  { id: 'CH_01', x: -15, z: 40, tier: 1 }, { id: 'CH_02', x: 75, z: 25, tier: 1 }, { id: 'CH_03', x: -98, z: 14, tier: 2 },
  { id: 'CH_04', x: 52, z: -82, tier: 2 }, { id: 'CH_05', x: -60, z: -120, tier: 1 }, { id: 'CH_06', x: 125, z: 45, tier: 3 },
];

export class World {
  root = new THREE.Group();
  terrain: Terrain;
  colliders: Collider[] = [];
  interactables: Interactable[] = [];
  scannables: Scannable[] = [];
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: THREE.Mesh;
  water!: THREE.Mesh;
  private waterMat: THREE.ShaderMaterial | null = null;
  /** far mountain ranges on the horizon (look v2) */
  backdrop: Backdrop | null = null;
  orbs = new Map<string, THREE.Object3D>();
  chests = new Map<string, { def: ChestDef; obj: THREE.Group; lid: THREE.Object3D }>();
  waypoints = new Map<string, { obj: THREE.Group; orb: THREE.Mesh; pos: THREE.Vector3; name: string }>();
  door!: THREE.Object3D;
  doorOpenT = 0;
  doorOpen = false;
  plots: THREE.Group[] = [];
  private plotPlants: ExperimentPlant[][] = [];
  city!: City;
  sites!: Sites;
  genovia!: Genovia;
  florantis!: Florantis;
  metabolis!: Metabolis;
  aquorra!: Aquorra;
  neurion!: Neurion;
  roots!: Roots;
  /** 0 (night) … 1 (full day), set by setTimeOfDay */
  daylight = 1;
  zepheria!: Zepheria;
  plotsHealthy = false;
  statuePos = new THREE.Vector3();
  gatePos = new THREE.Vector3();
  private time = 0;
  readonly orbDefs = ORBS;
  readonly chestDefs: ChestDef[] = CHESTS.map((c) => ({ ...c }));

  constructor(private scene: THREE.Scene) {
    const L = (id: string) => data.locations.get(id) ?? { x: 0, z: 0 };
    const statue = L('LOC_STATUE');
    const door = L('LOC_ANCIENT_DOOR');
    const arena = L('LOC_BOSS_ARENA');
    const gate = L('LOC_CELLARIA_GATE');
    this.terrain = new Terrain([
      { x: statue.x, z: statue.z, r: 9, h: 3 },
      { x: door.x, z: door.z, r: 14, h: 4 },
      { x: arena.x, z: arena.z, r: 22, h: 2 },
      { x: gate.x, z: gate.z, r: 16, h: 2.5 },
      { x: 0, z: 15, r: 12, h: 1.5 },
    ]);
    // chapter 1 sites: level the spire plaza and the base of the tower
    for (const [id, r] of [['LOC_SPIRE', 19], ['LOC_SPIRE_TOWER', 11]] as const) {
      const l = L(id);
      this.terrain.flats.push({ x: l.x, z: l.z, r, h: this.terrain.rawHeight(l.x, l.z) + 0.5 });
    }
    for (const l of data.locations.values()) {
      if (l.type === 'domain') this.terrain.flats.push({ x: l.x, z: l.z, r: 8, h: this.terrain.rawHeight(l.x, l.z) });
    }
    scene.add(this.root);
    this.root.add(this.terrain.build());
    applyDetailTexture(this.terrain.mesh.material as THREE.MeshToonMaterial, 'TEX_Ground_Cytoria', 55);
    this.buildGround();

    // lights
    // look v2: a bluer sky fill and a green-earth bounce give cool, coloured shadows instead of grey ones
    this.hemi = LOOK.v2 ? new THREE.HemisphereLight(0xbcd8f5, 0x8a9a70, 1.5) : new THREE.HemisphereLight(0xcfe6ff, 0x7a6a45, 1.1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 220;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    this.sky = this.buildSky();
    scene.add(this.sky);
    scene.fog = new THREE.Fog(0xbfd8ee, 60, 420); // starts nearer, fades longer: layered aerial perspective

    this.buildWater();
    this.buildVegetation();
    this.buildCrystals();
    this.buildCellBubbles();
    this.buildStatue(statue.x, statue.z);
    this.buildDoorArea(door.x, door.z);
    this.buildGate(gate.x, gate.z);
    this.buildArena(arena.x, arena.z);
    this.buildWaypoints();
    this.buildDomainEntrances();
    this.buildDomainArena();
    this.city = new City();
    this.root.add(this.city.root);
    this.colliders.push(...this.city.colliders);
    this.scannables.push(...this.city.scannables);
    this.sites = new Sites((x, z) => this.h(x, z));
    this.root.add(this.sites.root);
    this.colliders.push(...this.sites.colliders);
    this.scannables.push(...this.sites.scannables);
    // no grass on structures, paths and plazas
    for (const l of data.locations.values()) if (!l.type || l.type === 'domain') this.grassBlock.push({ x: l.x, z: l.z, r: l.id.startsWith('LOC_') ? 3 : 5 });
    for (const f of this.terrain.flats) this.grassBlock.push({ x: f.x, z: f.z, r: f.r * 0.9 });
    for (const c of this.colliders) if (c.r >= 1.5 && Math.hypot(c.x, c.z) < 200) this.grassBlock.push({ x: c.x, z: c.z, r: c.r + 0.4 });
    this.genovia = new Genovia();
    this.root.add(this.genovia.root);
    this.colliders.push(...this.genovia.colliders);
    this.scannables.push(...this.genovia.scannables);
    this.zepheria = new Zepheria();
    this.root.add(this.zepheria.root);
    this.colliders.push(...this.zepheria.colliders);
    this.scannables.push(...this.zepheria.scannables);
    this.florantis = new Florantis();
    this.root.add(this.florantis.root);
    this.colliders.push(...this.florantis.colliders);
    this.scannables.push(...this.florantis.scannables);
    this.metabolis = new Metabolis();
    this.root.add(this.metabolis.root);
    this.colliders.push(...this.metabolis.colliders);
    this.scannables.push(...this.metabolis.scannables);
    this.aquorra = new Aquorra();
    this.root.add(this.aquorra.root);
    this.colliders.push(...this.aquorra.colliders);
    this.scannables.push(...this.aquorra.scannables);
    this.neurion = new Neurion();
    this.root.add(this.neurion.root);
    this.colliders.push(...this.neurion.colliders);
    this.scannables.push(...this.neurion.scannables);
    this.roots = new Roots();
    this.root.add(this.roots.root);
    this.colliders.push(...this.roots.colliders);
    this.scannables.push(...this.roots.scannables);
    this.buildFlora();
    this.buildAmbientNpcs();
    this.buildGuards();
    this.buildOrbs();
    this.buildChests();
  }

  private groves: { x: number; z: number; sc: number }[] = [];
  private mixers: THREE.AnimationMixer[] = [];

  /** Room for a plant/rock: not on a collider, a quest spot, a chest or the lake. */
  private floraFree(x: number, z: number, pad: number) {
    for (const c of this.colliders) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2) return false;
    for (const l of data.locations.values()) if ((x - l.x) ** 2 + (z - l.z) ** 2 < (pad + 5) ** 2) return false;
    for (const c of this.chestDefs) if ((x - c.x) ** 2 + (z - c.z) ** 2 < (pad + 2) ** 2) return false;
    return !isWater(x, z, this.h(x, z) - 0.2);
  }

  /**
   * Downloaded trees, bushes and rocks, kept sparse on purpose (dense scatter looked messy): groves keep their
   * original layout with bushes and flowers at some of their feet, a few sakura on the lake shore, rock clusters
   * on slopes, and a handful of pieces on the Zepheria islands and around Genovia.
   */
  private buildFlora() {
    if (!hasFlora('NAT_TreesPainted')) return;
    const r = this.rng(99);
    const rot = () => r() * Math.PI * 2;
    const T: Record<string, FloraSet> = {
      trees: PAINTED_TREES,
      tree: { file: 'NAT_TreePainted', sway: 0.035, far: 300, lodDist: 40 }, // 20k triangles each up close
      birch: { file: 'NAT_Birch', split: true, sway: 0.045, far: 300 },
      sakura: { file: 'NAT_Sakura', sway: 0.03, far: 320 },
      bush: { file: 'NAT_Bush', sway: 0.06, far: 110 },
      flowers: { file: 'NAT_TreesPainted', split: true, only: /^(FL|Grass)/, sway: 0.08, far: 90 },
      rocks: { file: 'NAT_RocksStylized', split: true, far: 200 },
      mossy: { file: 'NAT_StonesMini', split: true, only: /^Stone_\d_Low$/, far: 110 }, // the mossy colourway (.001/.002 are bare/alternate)
      boulder: { file: 'NAT_StonePack', split: true, only: /^Big|^BIG/, far: 340 },
      fallen: { file: 'NAT_FallenTree', far: 140 },
      mushroom: { file: 'NAT_MushroomTree', sway: 0.01, far: 300 },
      blooms: { file: 'NAT_Flowers', split: true, sway: 0.1, far: 80, lodDist: 35 },
      glow: { file: 'NAT_GlowPlants', split: true, sway: 0.06, far: 90 },
    };
    const S: Record<string, FloraSpot[]> = Object.fromEntries(Object.keys(T).map((k) => [k, []]));
    const at = (k: string, x: number, z: number, height: number, sink = 0.1) => S[k].push({ x, y: this.h(x, z) - sink, z, rot: rot(), scale: height });
    const near = (x: number, z: number, d0: number, d1: number) => { const a = rot(), d = d0 + r() * (d1 - d0); return [x + Math.cos(a) * d, z + Math.sin(a) * d]; };
    const solid = (x: number, z: number, rad: number) => this.colliders.push({ x, z, r: rad });

    // Cytoria groves: the same spots as before, one tree each, a bush or flowers at some of their feet
    for (const g of this.groves) {
      const k = r() < 0.16 ? 'birch' : r() < 0.07 ? 'tree' : 'trees'; // 'tree' (TE-02) is blue: a rare accent
      at(k, g.x, g.z, (k === 'birch' ? 9 : 7) + g.sc * 2.2, 0.2);
      if (r() < 0.5) { const [x, z] = near(g.x, g.z, 2.2 * g.sc, 3.4 * g.sc); if (this.floraFree(x, z, 0.4)) at('bush', x, z, 0.9 + r() * 0.6); }
      if (r() < 0.3) { const [x, z] = near(g.x, g.z, 3, 5); if (this.floraFree(x, z, 0.4)) at('flowers', x, z, 0.7 + r() * 0.4, 0.02); }
      if (r() < 0.08) { const [x, z] = near(g.x, g.z, 3.5, 5.5); if (this.floraFree(x, z, 1.5)) at('fallen', x, z, 1.1, 0.15); }
      if (r() < 0.22) { const [x, z] = near(g.x, g.z, 2.5, 6); if (this.floraFree(x, z, 0.3)) at('blooms', x, z, 0.5 + r() * 0.35, 0.02); }
      if (r() < 0.07) { const [x, z] = near(g.x, g.z, 1.8, 3); if (this.floraFree(x, z, 0.3)) at('glow', x, z, 0.6 + r() * 0.4, 0.02); }
    }
    // dandelion meadows: small patches in the open fields, a few flowers each
    for (let i = 0, n = 0; i < 300 && n < 18; i++) {
      const x = (r() - 0.5) * 320, z = (r() - 0.5) * 320;
      if (Math.hypot(x, z) > WORLD_RADIUS - 30 || !this.floraFree(x, z, 2) || this.terrain.normalAt(x, z).y < 0.9) continue;
      for (let k = 0; k < 3 + Math.floor(r() * 4); k++) { const [px, pz] = near(x, z, 0, 2.5); at('blooms', px, pz, 0.45 + r() * 0.3, 0.02); }
      n++;
    }
    // sakura along the lake shore, and two framing the Tree of Life statue
    for (let i = 0, n = 0; i < 80 && n < 7; i++) {
      const a = r() * Math.PI * 2, d = LAKE.r + 4 + r() * 8;
      const x = LAKE.x + Math.cos(a) * d, z = LAKE.z + Math.sin(a) * d;
      if (Math.hypot(x, z) > WORLD_RADIUS - 30 || !this.floraFree(x, z, 3) || this.terrain.normalAt(x, z).y < 0.85) continue;
      at('sakura', x, z, 7 + r() * 2, 0.2); solid(x, z, 0.6); n++;
    }
    for (const side of [-1, 1]) {
      const x = this.statuePos.x + side * 9, z = this.statuePos.z + 3;
      if (this.floraFree(x, z, 1)) { at('sakura', x, z, 6.5, 0.2); solid(x, z, 0.6); }
    }
    // rock clusters (prefer slopes), a few landmark boulders, mossy stones near groves
    for (let i = 0, n = 0; i < 400 && n < 22; i++) {
      const x = (r() - 0.5) * 340, z = (r() - 0.5) * 340;
      if (Math.hypot(x, z) > WORLD_RADIUS - 30 || !this.floraFree(x, z, 3)) continue;
      if (this.terrain.normalAt(x, z).y > 0.97 && r() < 0.7) continue;
      const big = 1.6 + r() * 1.8;
      at('rocks', x, z, big, 0.3); solid(x, z, big * 0.45);
      for (let k = 0; k < 2 + Math.floor(r() * 3); k++) { const [px, pz] = near(x, z, big * 0.7, big * 1.6); if (this.floraFree(px, pz, 0.3)) at('rocks', px, pz, 0.4 + r() * 0.8, 0.1); }
      n++;
    }
    for (let i = 0, n = 0; i < 200 && n < 6; i++) {
      const x = (r() - 0.5) * 320, z = (r() - 0.5) * 320;
      if (Math.hypot(x, z) > WORLD_RADIUS - 35 || !this.floraFree(x, z, 6)) continue;
      const hgt = 4 + r() * 2;
      at('boulder', x, z, hgt, 0.5); solid(x, z, hgt * 0.42); n++;
    }
    for (const g of this.groves) if (r() < 0.12) { const [x, z] = near(g.x, g.z, 2.5, 4.5); if (this.floraFree(x, z, 0.4)) at('mossy', x, z, 0.4 + r() * 0.5, 0.05); }

    // Zepheria islands
    const onIsle = (id: string, k: string, n: number, h0: number, h1: number, pad: number, col = 0) => {
      const isle = ISLANDS.find((i) => i.id === id);
      if (!isle) return;
      for (let i = 0, c = 0; i < n * 12 && c < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * isle.r * 0.75;
        const x = ZEP.x + isle.x + Math.cos(a) * d, z = ZEP.z + isle.z + Math.sin(a) * d;
        if (!this.floraFree(x, z, pad)) continue;
        at(k, x, z, h0 + r() * (h1 - h0), 0.15);
        if (col) solid(x, z, col);
        c++;
      }
    };
    onIsle('port', 'sakura', 2, 6, 7.5, 3, 0.6);
    onIsle('port', 'bush', 5, 0.9, 1.4, 0.6);
    onIsle('finch', 'birch', 4, 8, 10, 3, 0.4);
    onIsle('finch', 'flowers', 5, 0.7, 1, 0.5);
    onIsle('fossil', 'rocks', 6, 0.8, 2.4, 1.2, 0.5);
    onIsle('hub', 'bush', 3, 0.9, 1.3, 0.6);
    onIsle('taxon', 'mushroom', 3, 6, 8, 3, 0.8);
    onIsle('taxon', 'mossy', 5, 0.5, 0.9, 0.5);
    onIsle('taxon', 'glow', 6, 0.6, 1, 0.4);
    onIsle('finch', 'blooms', 6, 0.5, 0.8, 0.4);
    onIsle('web', 'trees', 4, 7, 9, 3, 0.6);
    onIsle('web', 'bush', 5, 0.9, 1.4, 0.6);
    onIsle('web', 'fallen', 1, 1.1, 1.1, 2);

    // Genovia: boulders and rock clusters around the valley (its snowy pines stay hand-built)
    for (let i = 0, n = 0; i < 300 && n < 14; i++) {
      const a = r() * Math.PI * 2, d = 40 + r() * 100;
      const x = GEN.x + Math.cos(a) * d, z = GEN.z + Math.sin(a) * d;
      if (!inGenovia(x, z) || !this.floraFree(x, z, 4)) continue;
      const big = n < 5;
      const hgt = big ? 3.5 + r() * 2 : 1.2 + r() * 1.4;
      at(big ? 'boulder' : 'rocks', x, z, hgt, 0.4); solid(x, z, hgt * 0.42); n++;
    }

    for (const k of Object.keys(T)) if (S[k].length) this.root.add(plantFlora(T[k], S[k], r));
  }

  /**
   * Townsfolk that only add life (no dialogue): the mushroom merchant by the giant mushrooms on the Zepheria
   * taxonomy island, and two downloaded girls by the Cellaria fountain. Rigged models with no clips are posed
   * out of their T-pose; every one gets a gentle breathing sway.
   */
  private buildAmbientNpcs() {
    const isle = ISLANDS.find((i) => i.id === 'taxon')!;
    const list = [
      { file: 'npcs/NPC_MushroomMerchant.glb', x: ZEP.x + isle.x + 6, z: ZEP.z + isle.z + 7, h: 1.7, face: { x: ZEP.x + isle.x, z: ZEP.z + isle.z }, away: true },
      { file: 'npcs/NPC_AnimeGirl.glb', x: 7, z: -1255, h: 1.55, face: { x: 0, z: -1240 }, away: false },
      { file: 'npcs/NPC_LittleWitch.glb', x: -7, z: -1256, h: 1.2, face: { x: 0, z: -1240 }, away: false },
    ];
    for (const n of list) {
      if (!hasModel(n.file)) continue;
      let { x, z } = n;
      for (let i = 0; i < 30 && !this.floraFree(x, z, 1); i++) { const a = i * 0.9, d = 1.5 + i * 0.3; x = n.x + Math.cos(a) * d; z = n.z + Math.sin(a) * d; }
      this.colliders.push({ x, z, r: 0.5 });
      void loadGLBAnimated(n.file).then((res) => {
        if (!res) return;
        toonify(res.obj);
        if (!res.clips.length) relaxArms(res.obj);
        fitToHeight(res.obj, n.h);
        const g = new THREE.Group();
        g.add(res.obj);
        addOutline(g, 0.02);
        g.position.set(x, this.h(x, z), z);
        const dir = Math.atan2(n.face.x - x, n.face.z - z);
        g.rotation.y = n.away ? dir + Math.PI : dir;
        this.root.add(g);
        if (res.clips.length) {
          const mx = new THREE.AnimationMixer(res.obj);
          mx.clipAction(res.clips[0]).play();
          this.mixers.push(mx);
        } else {
          const t0 = Math.random() * 10;
          this.breathers.push((t) => { res.obj.scale.y = res.obj.scale.x * (1 + Math.sin(t * 1.8 + t0) * 0.012); g.rotation.z = Math.sin(t * 0.7 + t0) * 0.015; });
        }
      });
    }
  }
  private breathers: ((t: number) => void)[] = [];

  /** Two spear guards standing just inside Cellaria's south gate, facing out (VRoid model + Mixamo idle). */
  private buildGuards() {
    const file = 'npcs/NPC_CityGuard.vrm';
    if (!hasModel(file)) return;
    for (const sx of [-1, 1]) {
      const x = CITY.x + sx * 4.2, z = CITY.z + CITY_RADIUS - 1.5;
      this.colliders.push({ x, z, r: 0.5 });
      void loadVRM(file).then((vrm) => {
        if (!vrm) return;
        const m = new VrmCharacterModel(vrm, { height: 1.02 } as Appearance, 'PHYSICAL', 'POLEARM');
        m.root.position.set(x - CITY.x, this.h(x, z), z - CITY.z); // city root sits at CITY
        this.city.root.add(m.root);
        this.guards.push(m);
      });
    }
  }
  private guards: VrmCharacterModel[] = [];
  private static readonly IDLE: AnimState = { speed: 0, air: false, glide: false, attackT: -1, attackKind: 'normal', dashing: false };

  /** Upward lift for a gliding player (Zepheria updrafts). */
  updraftAt(x: number, z: number, y = 0) {
    return inZepheria(x, z) && y < 30 ? updraftAtLocal(x - ZEP.x, z - ZEP.z) : 0;
  }

  h(x: number, z: number) {
    if (inCity(x, z)) return 0;
    if (inGenovia(x, z)) return genHeightLocal(x - GEN.x, z - GEN.z);
    if (inZepheria(x, z)) return zepHeightLocal(x - ZEP.x, z - ZEP.z);
    if (inFlorantis(x, z)) return floHeightLocal(x - FLO.x, z - FLO.z);
    if (inMetabolis(x, z)) return metHeightLocal(x - MET.x, z - MET.z);
    if (inAquorra(x, z)) return aquHeightLocal(x - AQU.x, z - AQU.z);
    if (inNeurion(x, z)) return neuHeightLocal(x - NEU.x, z - NEU.z);
    if (inRoots(x, z)) return arbHeightLocal(x - ARB.x, z - ARB.z);
    if (Math.hypot(x - DOMAIN_CENTER.x, z - DOMAIN_CENTER.z) < DOMAIN_RADIUS + 20) return 0;
    return this.terrain.height(x, z);
  }
  /** Walkable ground: in the lake you wade at waist depth instead of walking on the lakebed. */
  groundH(x: number, z: number) {
    const t = this.h(x, z);
    if (inAquorra(x, z)) return Math.max(t, -1.15);
    return isWater(x, z, t) ? Math.max(t, WATER_LEVEL - 0.85) : t;
  }

  // ---------------------------------------------------------------- sky
  private buildSky(): THREE.Mesh {
    const geo = new THREE.SphereGeometry(400, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color('#5aa7e8') },
        bottom: { value: new THREE.Color('#e9f2f5') },
        sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
        sunCol: { value: new THREE.Color('#fff2c4') },
        uTime: { value: 0 },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform float uTime; varying vec3 vDir;
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float nse(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * nse(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){ vec3 d = normalize(vDir); float t = clamp(d.y*1.6+0.15, 0.0, 1.0); vec3 c = mix(bottom, top, t);
        float s = max(dot(d, normalize(sunDir)), 0.0); c += sunCol*pow(s, 400.0)*1.5 + sunCol*pow(s,8.0)*0.25;
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.12) * 0.9 + vec2(uTime * 0.012, uTime * 0.005);
          float n = fbm(uv * 1.4);
          float cl = smoothstep(0.52, 0.78, n) * smoothstep(0.0, 0.22, d.y);
          vec3 cloud = mix(bottom, vec3(1.0), 0.65) + sunCol * pow(s, 6.0) * 0.35;
          c = mix(c, cloud, cl * 0.9);
        }
        gl_FragColor = vec4(c,1.0);} `,
    });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = -1;
    return m;
  }

  /** hour 0..24 */
  setTimeOfDay(hour: number, playerPos: THREE.Vector3) {
    const a = ((hour - 6) / 24) * Math.PI * 2; // sunrise at 6
    const sunY = Math.sin(a);
    const dir = new THREE.Vector3(Math.cos(a) * 0.8, Math.max(sunY, -0.3), 0.45).normalize();
    const day = THREE.MathUtils.smoothstep(sunY, -0.15, 0.25);
    this.daylight = day;
    const dusk = 1 - Math.abs(sunY - 0.1) * 4;
    const lightDir = sunY > -0.05 ? dir : new THREE.Vector3(-dir.x, 0.6, -dir.z).normalize(); // moon
    this.sun.position.copy(playerPos).addScaledVector(lightDir, 100);
    this.sun.target.position.copy(playerPos);
    this.sun.intensity = LOOK.v2 ? 0.3 + 1.7 * day : 0.35 + 1.9 * day;
    this.sun.color.set(day > 0.5 ? 0xfff1d6 : 0xb8c8ff).lerp(new THREE.Color(0xffb070), Math.max(0, dusk) * 0.6);
    this.hemi.intensity = LOOK.v2 ? 0.5 + 1.0 * day : 0.45 + 0.7 * day;
    const u = (this.sky.material as THREE.ShaderMaterial).uniforms;
    u.sunDir.value.copy(dir);
    const topDay = new THREE.Color(LOOK.v2 ? '#6db6ea' : '#5aa7e8'), topNight = new THREE.Color('#0d1530');
    const botDay = new THREE.Color(LOOK.v2 ? '#cdeaf4' : '#e9f2f5'), botNight = new THREE.Color('#26304f'), botDusk = new THREE.Color('#ffb98a');
    (u.top.value as THREE.Color).copy(topNight).lerp(topDay, day);
    (u.bottom.value as THREE.Color).copy(botNight).lerp(botDay, day).lerp(botDusk, Math.max(0, dusk) * 0.55);
    // Metabolis: a warm, smoky haze over the horizon and in the distance
    if (inMetabolis(playerPos.x, playerPos.z)) (u.bottom.value as THREE.Color).lerp(new THREE.Color(day > 0.5 ? '#c8a088' : '#4a2c28'), 0.55);
    // Neurion: a violet neon haze · the Roots: a soft golden-green glow
    if (inNeurion(playerPos.x, playerPos.z)) { (u.bottom.value as THREE.Color).lerp(new THREE.Color(day > 0.5 ? '#c8b0e8' : '#3a2a5a'), 0.5); (u.top.value as THREE.Color).lerp(new THREE.Color(day > 0.5 ? '#7a8ae0' : '#1a1440'), 0.3); }
    if (inRoots(playerPos.x, playerPos.z)) (u.bottom.value as THREE.Color).lerp(new THREE.Color(day > 0.5 ? '#e4e8b8' : '#2a3a2a'), 0.4);
    (this.scene.fog as THREE.Fog).color.copy(u.bottom.value as THREE.Color);
    // look v2: aerial perspective tinted toward the sky blue, so distance reads as depth instead of white-out
    if (LOOK.v2) (this.scene.fog as THREE.Fog).color.lerp(u.top.value as THREE.Color, 0.22);
    // shared sun / sky / daylight for every region's water
    WATER_ENV.sun.value.copy(dir);
    WATER_ENV.day.value = 0.25 + 0.75 * day;
    WATER_ENV.sky.value.copy(u.bottom.value as THREE.Color).lerp(u.top.value as THREE.Color, 0.3);
    if (this.waterMat) {
      this.waterMat.uniforms.uSun.value.copy(dir);
      this.waterMat.uniforms.uDay.value = 0.25 + 0.75 * day;
      (this.waterMat.uniforms.uSky.value as THREE.Color).copy(u.bottom.value as THREE.Color).lerp(u.top.value as THREE.Color, 0.3);
    }
    if (LOOK.v2) {
      this.backdrop ??= (() => { const b = new Backdrop(); this.scene.add(b.group); return b; })();
      const hidden = inZepheria(playerPos.x, playerPos.z) || Math.hypot(playerPos.x - DOMAIN_CENTER.x, playerPos.z - DOMAIN_CENTER.z) < DOMAIN_RADIUS + 20;
      this.backdrop.update(playerPos, (this.scene.fog as THREE.Fog).color, day, !hidden);
    }
    this.sky.position.copy(playerPos);
  }

  // ---------------------------------------------------------------- water
  private buildWater() {
    if (LOOK.v2) return this.buildWaterV2();
    const geo = new THREE.CircleGeometry(LAKE.r, 48);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshToonMaterial({ color: 0x5cc4f0, transparent: true, opacity: 0.72 });
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.set(LAKE.x, WATER_LEVEL, LAKE.z);
    this.root.add(this.water);
    this.buildLakeBeads();
  }

  /**
   * Stylised lake (look v2): colour by depth (turquoise shallows → deep blue), soft transparent shoreline with a
   * moving foam line, small animated ripples that catch the sun, and the sky reflected at grazing angles.
   * Depth comes from the terrain height per vertex, so no depth texture is needed.
   */
  private buildWaterV2() {
    const size = LAKE.r * 2 + 8, seg = 96;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const depth = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) depth[i] = WATER_LEVEL - this.terrain.height(LAKE.x + p.getX(i), LAKE.z + p.getZ(i));
    geo.setAttribute('depth', new THREE.BufferAttribute(depth, 1));
    const u = this.sky.material as THREE.ShaderMaterial;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        uTime: { value: 0 }, uShallow: { value: new THREE.Color('#8ff2e6') }, uDeep: { value: new THREE.Color('#4cb0e0') },
        uSky: { value: new THREE.Color('#bfe0f6') }, uSun: { value: new THREE.Vector3(0.3, 0.8, 0.2) }, uDay: { value: 1 },
      }]),
      vertexShader: `attribute float depth; varying float vDepth; varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main() { vDepth = depth; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz;
          vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uSky; uniform vec3 uSun; uniform float uDay;
        varying float vDepth; varying vec3 vWorld;
        #include <fog_pars_fragment>
        float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
        void main() {
          if (vDepth < -0.05) discard;
          float d = max(vDepth, 0.0);
          // two scrolling ripple layers → a fake normal
          vec2 q = vWorld.xz * 0.35;
          float r1 = n2(q + vec2(uTime * 0.25, uTime * 0.1)), r2 = n2(q * 2.3 - vec2(uTime * 0.18, -uTime * 0.22));
          vec3 nrm = normalize(vec3((r1 - 0.5) * 0.5 + (r2 - 0.5) * 0.3, 1.0, (r2 - 0.5) * 0.5 - (r1 - 0.5) * 0.3));
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(V, nrm), 0.0), 3.0);
          vec3 col = mix(uShallow, uDeep, smoothstep(0.2, 3.5, d)) * mix(0.35, 1.0, uDay);
          col = mix(col, uSky, fres * 0.7);
          // sun glints
          vec3 H = normalize(normalize(uSun) + V);
          col += vec3(1.0, 0.95, 0.85) * pow(max(dot(nrm, H), 0.0), 160.0) * 1.6 * uDay;
          // shoreline foam: a wobbling bright line where the water gets shallow
          float edge = 0.18 + 0.08 * sin(uTime * 1.3 + vWorld.x * 0.4 + vWorld.z * 0.3);
          float foam = smoothstep(edge + 0.12, edge, d) * smoothstep(0.0, 0.05, d) * (0.6 + 0.4 * r1);
          col = mix(col, vec3(0.95, 0.98, 1.0), foam * 0.85);
          float alpha = mix(0.55, 0.92, smoothstep(0.0, 2.5, d)) * smoothstep(0.0, 0.08, d + 0.05);
          gl_FragColor = vec4(col, max(alpha, foam));
          #include <fog_fragment>
        }`,
    });
    this.waterMat = mat;
    void u;
    this.water = new THREE.Mesh(geo, mat);
    this.water.position.set(LAKE.x, WATER_LEVEL, LAKE.z);
    this.water.renderOrder = 1;
    this.water.userData.noOutline = true;
    this.root.add(this.water);
    this.buildLakeBeads();
  }

  private buildLakeBeads() {
    // membrane bead ring around lake (Membrane Lake motif)
    const bead = new THREE.SphereGeometry(0.9, 10, 8);
    const beadMat = toon('#f4d9a8');
    const ring = new THREE.InstancedMesh(bead, beadMat, 90);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const r = 26 + Math.sin(a * 3) * 2;
      const x = 60 + Math.cos(a) * r, z = 50 + Math.sin(a) * r;
      const y = this.h(x, z);
      if (y < WATER_LEVEL - 0.5) continue;
      m.makeTranslation(x, Math.max(y, WATER_LEVEL) + 0.4, z);
      ring.setMatrixAt(n++, m);
    }
    ring.count = n;
    ring.castShadow = true;
    this.root.add(ring);
  }

  // ---------------------------------------------------------------- vegetation
  private rng(seed: number) {
    let s = seed;
    return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  private isFree(x: number, z: number, pad = 6) {
    if (Math.hypot(x, z) > WORLD_RADIUS - 25) return false;
    const h = this.h(x, z);
    if (isWater(x, z, h - 0.3)) return false;
    for (const l of data.locations.values()) if (Math.hypot(x - l.x, z - l.z) < pad + 6) return false;
    const n = this.terrain.normalAt(x, z);
    return n.y > 0.82;
  }

  private buildVegetation() {
    const rand = this.rng(42);
    // trees
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 4, 7);
    trunkGeo.translate(0, 2, 0);
    const canopyGeo = new THREE.IcosahedronGeometry(2.4, 1);
    const useKit = hasNature('tree_oak');
    const useFlora = hasFlora('NAT_TreesPainted'); // downloaded hand-painted trees replace the round-canopy ones
    const kitTrees = ['tree_oak', 'tree_default', 'tree_detailed', 'tree_fat', 'tree_oak_fall', 'tree_default_fall', 'tree_detailed_fall'];
    const spots: Spot[] = [];
    const trunks = new THREE.InstancedMesh(trunkGeo, toon('#8a6243'), 160);
    const canopies = new THREE.InstancedMesh(canopyGeo, toon('#ffffff'), 480);
    const palette = ['#7fb24a', '#a6c95a', '#d8b54e', '#6aa055', '#e0c063'].map((c) => new THREE.Color(c));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    let t = 0, c = 0;
    for (let i = 0; i < 600 && t < 160; i++) {
      const x = (rand() - 0.5) * 360, z = (rand() - 0.5) * 360;
      if (!this.isFree(x, z, 4)) continue;
      if (fbm(x * 0.02, z * 0.02, 2) < 0.48) continue; // clustered groves
      const y = this.h(x, z);
      const sc = 0.8 + rand() * 0.7;
      m.compose(p.set(x, y - 0.2, z), q.identity(), s.set(sc, sc, sc));
      trunks.setMatrixAt(t++, m);
      const col = palette[Math.floor(rand() * palette.length)];
      if (useKit) {
        const gold = col.r > 0.8;
        const model = gold ? kitTrees[4 + Math.floor(rand() * 3)] : kitTrees[Math.floor(rand() * 4)];
        spots.push({ model, x, y: y - 0.1, z, rot: rand() * 6.28, scale: sc * 5.2, color: col.clone().multiplyScalar(gold ? 1 : 1.05) });
      }
      const blobs = 2 + Math.floor(rand() * 2);
      for (let b = 0; b < blobs; b++) {
        const ox = (rand() - 0.5) * 2.2 * sc, oz = (rand() - 0.5) * 2.2 * sc, oy = (4 + b * 1.1) * sc;
        const bs = sc * (0.8 + rand() * 0.5);
        m.compose(p.set(x + ox, y + oy, z + oz), q.identity(), s.set(bs, bs * 0.85, bs));
        canopies.setMatrixAt(c, m);
        canopies.setColorAt(c++, col);
      }
      this.colliders.push({ x, z, r: 0.7 * sc });
      this.groves.push({ x, z, sc });
      if (t % 9 === 0) {
        const obj = new THREE.Object3D();
        obj.position.set(x, y + 2, z);
        this.root.add(obj);
        this.scannables.push({ id: `TREE_${t}`, codexId: 'CDX_PLANT_CELL', tags: ['plant'], obj, radius: 3, label: 'ต้นไม้ทองคำ' });
      }
    }
    trunks.count = t;
    canopies.count = c;
    trunks.castShadow = canopies.castShadow = true;
    canopies.receiveShadow = true;
    if (useKit) this.root.add(scatter(spots, CYTORIA_PALETTE, 0.045));
    else if (!useFlora) this.root.add(trunks, canopies);
    if (useKit) this.buildNatureProps(rand);

    // grass tufts
    // a tuft = 3 thin blades
    const blade = new THREE.ConeGeometry(0.05, 0.55, 3);
    blade.translate(0, 0.27, 0);
    const blades = [0, 1, 2].map((i) => {
      const b = blade.clone();
      b.rotateZ((i - 1) * 0.35);
      b.translate((i - 1) * 0.07, 0, (i % 2) * 0.05);
      return b;
    });
    const tuftGeo = mergeGeos(blades);
    const tuftItems: { m: THREE.Matrix4; color: THREE.Color }[] = [];
    const gA = new THREE.Color('#b8c25a'), gB = new THREE.Color('#e3c86a');
    for (let i = 0; i < 12000 && tuftItems.length < 5000; i++) {
      const x = (rand() - 0.5) * 340, z = (rand() - 0.5) * 340;
      const y = this.h(x, z);
      if (isWater(x, z, y - 0.3) || Math.hypot(x, z) > WORLD_RADIUS - 20) continue;
      if (this.terrain.normalAt(x, z).y < 0.85) continue;
      q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.4, rand() * 6, (rand() - 0.5) * 0.4));
      const sc = 0.7 + rand() * 0.7;
      tuftItems.push({ m: new THREE.Matrix4().compose(p.set(x, y - 0.05, z), q, s.set(sc, sc, sc)), color: gA.clone().lerp(gB, rand()) });
    }
    // tufts are tiny: drawn in map tiles and only within ~70 m (they vanish into the meadow colour beyond that)
    if (!useKit) { this.tufts = plantTiled(tuftGeo, toon('#ffffff'), tuftItems, 70); this.root.add(this.tufts); }

    // flowers (scannable) + wilted plants handled in door area
    const flowerColors = ['#ff9ec7', '#ffffff', '#ffd25e', '#b59cff'];
    for (let i = 0; i < 26; i++) {
      const x = (rand() - 0.5) * 300, z = (rand() - 0.5) * 300;
      if (!this.isFree(x, z, 2)) continue;
      const y = this.h(x, z);
      const f = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 5), toon('#5f9a3b'));
      stem.position.y = 0.35;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), toon(flowerColors[i % 4]));
      head.position.y = 0.75;
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), toon('#f7c948'));
      center.position.set(0, 0.8, 0.12);
      f.add(stem, head, center);
      f.position.set(x, y, z);
      f.scale.setScalar(1.4);
      this.root.add(f);
      this.scannables.push({ id: `FLOWER_${i}`, codexId: 'CDX_FLOWER_GOLD', tags: ['plant', 'flower'], obj: f, radius: 1.2, label: 'ดอกไม้หุบเซลล์' });
    }
  }

  /** Rocks, bushes, flowers, mushrooms and logs from the nature kit. */
  private buildNatureProps(rand: () => number) {
    const spots: Spot[] = [];
    const place = (models: string[], n: number, pad: number, scale: [number, number], collide = 0, onlyFlat = true, cluster = false) => {
      let k = 0;
      for (let i = 0; i < n * 6 && k < n; i++) {
        const x = (rand() - 0.5) * 340, z = (rand() - 0.5) * 340;
        if (!this.isFree(x, z, pad)) continue;
        if (onlyFlat && this.terrain.normalAt(x, z).y < 0.88) continue;
        if (cluster && fbm(x * 0.03 + 7, z * 0.03, 2) < 0.5) continue;
        const sc = scale[0] + rand() * (scale[1] - scale[0]);
        const y = this.h(x, z);
        spots.push({ model: models[Math.floor(rand() * models.length)], x, y: y - 0.05, z, rot: rand() * 6.28, scale: sc });
        if (collide) this.colliders.push({ x, z, r: collide * sc });
        k++;
      }
    };
    place(['rock_largeA', 'rock_largeB', 'rock_largeC', 'rock_largeD', 'rock_largeE', 'rock_largeF'], 70, 3, [3, 6], 0.3, false);
    place(['rock_smallA', 'rock_smallB', 'rock_smallC', 'rock_smallD'], 140, 1, [3, 5]);
    place(['rock_tallA', 'rock_tallB'], 18, 4, [4, 7], 0.25, false);
    place(['plant_bush', 'plant_bushLarge', 'plant_bushDetailed'], 220, 1, [4, 7], 0, true, true);
    place(['flower_redA', 'flower_yellowA', 'flower_purpleA', 'flower_redB', 'flower_yellowB', 'flower_purpleB'], 420, 0.5, [4, 6], 0, true, true);
    place(['mushroom_red', 'mushroom_redGroup', 'mushroom_tanGroup'], 70, 1, [4, 6], 0, true, true);
    place(['stump_round', 'log'], 24, 2, [4, 5], 0.3);
    this.root.add(scatter(spots, CYTORIA_PALETTE, 0.02));
  }

  /** Bare earth (Genshin-style): worn paths between the landmarks, dirt plazas, a few bald patches. */
  readonly ground = new GroundMask(WORLD_SIZE);
  private buildGround() {
    const t = this.terrain;
    const bad = (x: number, z: number) => Math.hypot(x, z) > WORLD_RADIUS - 14 || isWater(x, z, t.height(x, z) - 0.4) || t.normalAt(x, z).y < 0.8;
    const ids = /^(LOC_SPAWN|WP_|DOM_|LOC_STATUE$|LOC_ANCIENT_DOOR$|LOC_MITORA$|LOC_ALVI_HILL$|LOC_GATE_FRONT$|LOC_BOSS_ARENA$|LOC_MOLECULE_PLAINS$|LOC_ENZYME_GROVE$|LOC_SPIRE$|LOC_LAKE_SALT$)/;
    const nodes = [...data.locations.values()].filter((l) => ids.test(l.id) && Math.hypot(l.x, l.z) < WORLD_RADIUS - 10);
    // minimum spanning tree (Prim), crossing water costs extra so paths go round the lake
    const cost = (a: { x: number; z: number }, b: { x: number; z: number }) => {
      const len = Math.hypot(a.x - b.x, a.z - b.z);
      let wet = 0;
      for (let k = 1; k < 10; k++) if (isWater(a.x + (b.x - a.x) * k / 10, a.z + (b.z - a.z) * k / 10, t.height(a.x + (b.x - a.x) * k / 10, a.z + (b.z - a.z) * k / 10))) wet++;
      return len * (1 + wet);
    };
    const inTree = new Set([0]);
    while (inTree.size < nodes.length) {
      let best: [number, number, number] | null = null;
      for (const i of inTree) for (let j = 0; j < nodes.length; j++) {
        if (inTree.has(j)) continue;
        const c = cost(nodes[i], nodes[j]);
        if (!best || c < best[2]) best = [i, j, c];
      }
      if (!best) break;
      inTree.add(best[1]);
      const a = nodes[best[0]], b = nodes[best[1]];
      this.ground.path(a.x, a.z, b.x, b.z, 2.4, bad);
    }
    for (const f of t.flats) if (Math.hypot(f.x, f.z) < WORLD_RADIUS) this.ground.stamp(f.x, f.z, f.r * 0.7, 2.5);
    this.ground.patches((x, z) => !bad(x, z));
    this.ground.finish();
    this.ground.applyTo(t.mesh.material as THREE.MeshToonMaterial);
  }

  /** Firefly swarms: the densest grove clusters, the Enzyme Grove and a few spots on the lake shore. */
  fireflySpots(): { x: number; y: number; z: number; r: number }[] {
    const out: { x: number; y: number; z: number; r: number }[] = [];
    const add = (x: number, z: number, r: number) => out.push({ x, y: this.h(x, z), z, r });
    const ranked = this.groves.map((g) => ({ g, n: this.groves.filter((o) => Math.hypot(o.x - g.x, o.z - g.z) < 14).length }))
      .filter((e) => e.n >= 3).sort((a, b) => b.n - a.n);
    for (const { g } of ranked) {
      if (out.length >= 5) break;
      if (out.some((o) => Math.hypot(o.x - g.x, o.z - g.z) < 25)) continue;
      add(g.x, g.z, 10);
    }
    const grove = data.locations.get('LOC_ENZYME_GROVE');
    if (grove) add(grove.x, grove.z, 20);
    for (const a of [0.6, 2.4, 4.4]) add(LAKE.x + Math.cos(a) * (LAKE.r + 6), LAKE.z + Math.sin(a) * (LAKE.r + 6), 8);
    return out;
  }

  /** Grass colour for the shader grass field, or null where it shouldn't grow (water, slopes, sites, other zones). */
  grassColorAt(x: number, z: number): THREE.Color | null {
    if (Math.hypot(x, z) > WORLD_RADIUS - 12) return null;
    for (const l of this.grassBlock) if ((x - l.x) ** 2 + (z - l.z) ** 2 < l.r * l.r) return null;
    return this.terrain.grassColor(x, z);
  }
  private grassBlock: { x: number; z: number; r: number }[] = [];
  /** the old sparse straw tufts — hidden while the shader grass field is on */
  tufts: THREE.Object3D | null = null;

  // ---------------------------------------------------------------- crystals
  private crystalCluster(x: number, z: number, scale: number, rand: () => number, color = '#e8b54a') {
    const grp = new THREE.Group();
    const y = this.h(x, z);
    if (this.crystalSpots.length) {
      // downloaded crystal models, re-tinted to the valley's gold; the empty group stays as scan target / light holder
      this.crystalSpots[Math.floor(rand() * this.crystalSpots.length)].push({ x, y: y - 0.2, z, rot: rand() * 6.28, scale: 2.6 * scale });
      grp.position.set(x, y, z);
      this.root.add(grp);
      this.colliders.push({ x, z, r: 1.1 * scale });
      return grp;
    }
    const mat = toon(color, { emissive: new THREE.Color(color).multiplyScalar(0.15) });
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const hgt = (1.5 + rand() * 3) * scale;
      const geo = new THREE.CylinderGeometry(0.0, 0.55 * scale, hgt * 0.3, 6);
      const body = new THREE.CylinderGeometry(0.55 * scale, 0.6 * scale, hgt, 6);
      const b = new THREE.Mesh(body, mat);
      const tip = new THREE.Mesh(geo, mat);
      b.position.y = hgt / 2;
      tip.position.y = hgt + hgt * 0.15;
      const piece = new THREE.Group();
      piece.add(b, tip);
      piece.position.set((rand() - 0.5) * 1.6 * scale, -0.2, (rand() - 0.5) * 1.6 * scale);
      piece.rotation.set((rand() - 0.5) * 0.7, rand() * 6, (rand() - 0.5) * 0.7);
      grp.add(piece);
    }
    grp.position.set(x, y, z);
    grp.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    addOutline(grp, 0.05);
    this.root.add(grp);
    this.colliders.push({ x, z, r: 1.3 * scale });
    return grp;
  }

  private crystalSpots: FloraSpot[][] = [];
  private buildCrystals() {
    const rand = this.rng(7);
    const sets: FloraSet[] = ['NAT_Crystal1', 'NAT_Crystal2', 'NAT_Crystal3', 'NAT_Crystal4']
      .filter(hasFlora).map((file) => ({ file, tint: '#f0bf4c', far: 280 }));
    this.crystalSpots = sets.map(() => []);
    for (let i = 0; i < 46; i++) {
      const x = (rand() - 0.5) * 330, z = (rand() - 0.5) * 330;
      if (!this.isFree(x, z, 4)) continue;
      const g = this.crystalCluster(x, z, 0.7 + rand() * 1.1, rand);
      if (i % 4 === 0) this.scannables.push({ id: `CRYSTAL_${i}`, codexId: 'CDX_CALCITE', tags: ['mineral'], obj: g, radius: 2.5, label: 'ผลึกแคลไซต์' });
    }
    // the quest crystal (P01)
    const L = data.locations.get('LOC_HOLLOW_CRYSTAL');
    if (L) {
      const g = this.crystalCluster(L.x, L.z, 2.2, this.rng(99), '#f2c75c');
      const light = new THREE.PointLight(0xffd27a, 8, 14);
      light.position.set(0, 4, 0);
      g.add(light);
    }
    sets.forEach((set, k) => { if (this.crystalSpots[k].length) this.root.add(plantFlora(set, this.crystalSpots[k], rand)); });
    this.crystalSpots = [];
  }

  // ---------------------------------------------------------------- cell bubbles
  private buildCellBubbles() {
    const rand = this.rng(1234);
    const spots = [[-25, 5], [35, 10], [-50, 55], [15, -50], [-80, -70], [90, 60], [110, -70], [-130, -10], [55, -120], [-20, -150]];
    for (const [x, z] of spots) {
      const r = 3 + rand() * 3;
      const y = this.h(x, z);
      const g = new THREE.Group();
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(r, 28, 20),
        new THREE.MeshToonMaterial({ color: 0xd8f6ff, transparent: true, opacity: 0.28, depthWrite: false }),
      );
      shell.userData.noOutline = true;
      const rim = new THREE.Mesh(
        new THREE.SphereGeometry(r * 1.01, 28, 20),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false }),
      );
      const nucleus = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 16, 12), toon('#b07ad8'));
      nucleus.position.set(r * 0.15, 0, -r * 0.1);
      const nucleolus = new THREE.Mesh(new THREE.SphereGeometry(r * 0.1, 10, 8), toon('#6b3d99'));
      nucleolus.position.copy(nucleus.position).add(new THREE.Vector3(0.1, r * 0.12, r * 0.22));
      g.add(shell, rim, nucleus, nucleolus);
      for (let i = 0; i < 6; i++) {
        const mito = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.06, r * 0.18, 4, 8), toon('#ff8a5c'));
        mito.position.set((rand() - 0.5) * r * 1.2, (rand() - 0.5) * r * 1.0, (rand() - 0.5) * r * 1.2);
        mito.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        g.add(mito);
      }
      for (let i = 0; i < 8; i++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(r * 0.035, 6, 5), toon('#ffe680'));
        dot.position.set((rand() - 0.5) * r * 1.4, (rand() - 0.5) * r * 1.2, (rand() - 0.5) * r * 1.4);
        g.add(dot);
      }
      g.position.set(x, y + r * 0.7, z);
      g.userData.baseY = g.position.y;
      g.userData.phase = rand() * 6;
      this.root.add(g);
      this.colliders.push({ x, z, r: r * 0.9 });
      this.scannables.push({ id: `CELL_${x}_${z}`, codexId: 'CDX_ANIMAL_CELL', tags: ['cell'], obj: g, radius: r, label: 'เซลล์ยักษ์' });
      this.bubbles.push(g);
    }
  }
  private bubbles: THREE.Group[] = [];

  // ---------------------------------------------------------------- statue of the tree of life
  private buildStatue(x: number, z: number) {
    const y = this.h(x, z);
    const g = new THREE.Group();
    const stone = toon('#d8d0bd');
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 1.2, 6), stone);
    base.position.y = 0.6;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2, 2.6, 6), stone);
    ped.position.y = 2.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.8, 4.5, 8), toon('#b9ad93'));
    trunk.position.y = 6;
    g.add(base, ped, trunk);
    // branching (neuron-like) branches
    for (let i = 0; i < 6; i++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 3, 6), toon('#b9ad93'));
      const a = (i / 6) * Math.PI * 2;
      br.position.set(Math.cos(a) * 1.1, 8.6, Math.sin(a) * 1.1);
      br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      g.add(br);
    }
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 16), new THREE.MeshToonMaterial({ color: 0xfff1c4, transparent: true, opacity: 0.35, depthWrite: false }));
    canopy.position.y = 10.2;
    canopy.userData.noOutline = true;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), glow('#ffd36a', 1.6));
    core.position.y = 10.2;
    core.userData.noOutline = true;
    core.name = 'statueCore';
    core.userData.keep = true;
    const light = new THREE.PointLight(0xffd36a, 12, 22);
    light.position.y = 10;
    light.userData.keep = true;
    g.add(canopy, core, light);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    addOutline(g, 0.05);
    g.position.set(x, y, z);
    this.root.add(g);
    this.statueCore = core;
    this.statuePos.set(x, y, z);
    void propSlot(g, 'PRP_StatueTreeOfLife', { h: 12 });
    this.colliders.push({ x, z, r: 3.6, id: 'statue' });
    this.scannables.push({ id: 'STATUE', codexId: 'CDX_TREE_OF_LIFE', tags: ['statue'], obj: core, radius: 3, label: 'รูปปั้นต้นไม้แห่งชีวิต' });
  }
  statueCore!: THREE.Mesh;

  // ---------------------------------------------------------------- ancient door + experiment plots
  private buildDoorArea(x: number, z: number) {
    const y = this.h(x, z);
    const stone = toon('#c9bfa8');
    const arch = new THREE.Group();
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1.6, 7, 1.6), stone);
    pillarL.position.set(-3, 3.5, 0);
    const pillarR = pillarL.clone();
    pillarR.position.x = 3;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 1.8), stone);
    lintel.position.y = 7.4;
    const emblem = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 6), glow('#7ee0c0', 1.2));
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, 7.4, 0.95);
    emblem.userData.noOutline = true;
    const doorSlab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 6.2, 0.8), toon('#9d927c'));
    doorSlab.position.set(0, 3.1, 0);
    arch.add(pillarL, pillarR, lintel, emblem, doorSlab);
    arch.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    addOutline(arch, 0.05);
    arch.position.set(x, y, z - 6);
    this.root.add(arch);
    this.door = doorSlab;
    this.colliders.push({ x: x - 3, z: z - 6, r: 1.2 }, { x: x + 3, z: z - 6, r: 1.2 }, { x, z: z - 6, r: 2.3, id: 'door' });
    // chest behind door
    this.chestDefs.push({ id: 'CH_DOOR', x, z: z - 11, tier: 2 });

    // three experiment plots
    for (let i = 0; i < 3; i++) {
      const px = x - 6 + i * 6, pz = z + 4;
      const py = this.h(px, pz);
      const plot = planterBox(3.2, 2.2, String(i + 1));
      // three young sunflowers per plot, all wilted until the experiment waters them
      const plant = new THREE.Group();
      plant.name = 'plant';
      const ps: ExperimentPlant[] = [];
      for (let k = 0; k < 3; k++) {
        const p = new ExperimentPlant(1.05 + ((i + k) % 3) * 0.15);
        p.group.position.set(-0.95 + k * 0.95, 0.4, (k % 2) * 0.25 - 0.12);
        p.group.rotation.y = (i * 3 + k) * 1.3;
        plant.add(p.group);
        ps.push(p);
      }
      this.plotPlants.push(ps);
      plot.add(plant);
      plot.position.set(px, py, pz);
      addOutline(plot, 0.04);
      this.root.add(plot);
      this.plots.push(plot);
      this.colliders.push({ x: px, z: pz, r: 1.4 });
    }
    const wilted = new THREE.Object3D();
    wilted.position.set(x, y + 1, z + 4);
    this.root.add(wilted);
    this.scannables.push({ id: 'PLANT_WILTED', codexId: 'CDX_OBSERVATION', tags: ['plant', 'wilted'], obj: wilted, radius: 5, label: 'ต้นไม้ที่เหี่ยวเฉา' });
  }

  /** `instant` = restoring a saved game (no recovery animation) */
  setPlotsHealthy(watered: number[] = [1], instant = false) {
    if (this.plotsHealthy) return;
    this.plotsHealthy = true;
    // only watered plots recover (independent variable = water); unwatered ones stay wilted as the control
    this.plotPlants.forEach((ps, i) => { if (watered.includes(i)) ps.forEach((p) => p.setTarget(1, instant)); });
  }

  // ---------------------------------------------------------------- cellaria gate
  private buildGate(x: number, z: number) {
    const y = this.h(x, z);
    const g = new THREE.Group();
    const white = toon('#f1ead8');
    const gold = toon('#e8c468');
    for (const sx of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 16, 6), white);
      tower.position.set(sx * 9, 8, 0);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(2.8, 4, 6), gold);
      cap.position.set(sx * 9, 18, 0);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(30, 9, 2.4), white);
      wall.position.set(sx * 24, 4.5, 0);
      wall.userData.keep = true;
      g.add(tower, cap, wall);
      this.colliders.push({ x: x + sx * 9, z, r: 2.8 });
      for (let k = 0; k < 7; k++) this.colliders.push({ x: x + sx * (12 + k * 4), z, r: 2.2 });
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(7, 1, 8, 6, Math.PI), gold);
    arch.position.set(0, 10, 0);
    const portal = new THREE.Mesh(new THREE.CircleGeometry(6.4, 6), new THREE.MeshBasicMaterial({ color: 0xa6f0ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    portal.position.set(0, 8, 0);
    portal.userData.noOutline = true;
    g.add(arch, portal);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    addOutline(g, 0.06);
    g.position.set(x, y, z);
    this.root.add(g);
    this.gatePos.set(x, y, z);
    void propSlot(g, 'BLD_CellariaGate', { w: 24, yaw: Math.PI / 2 }); // the download's archway opens along x
    this.colliders.push({ x, z: z - 1, r: 6, id: 'gate' });
    // dome of Cellaria visible behind
    const dome = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshToonMaterial({ color: 0xcdeeff, transparent: true, opacity: 0.25, depthWrite: false }));
    dome.position.set(x, y - 5, z - 110);
    this.root.add(dome);
    const nucleusTower = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), toon('#b490e0'));
    nucleusTower.position.set(x, y + 10, z - 110);
    this.root.add(nucleusTower);
  }

  private buildArena(x: number, z: number) {
    const y = this.h(x, z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(17, 18.5, 6), toon('#d9cfb6', { side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, y + 0.05, z);
    this.root.add(ring);
    const rand = this.rng(5);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      this.crystalCluster(x + Math.cos(a) * 21, z + Math.sin(a) * 21, 1.3, rand, '#d7b2ff');
    }
  }

  // ---------------------------------------------------------------- lab domains
  domainPortals = new Map<string, { obj: THREE.Group; ring: THREE.Mesh; pos: THREE.Vector3 }>();

  private buildDomainEntrances() {
    const col: Record<string, string> = { DOM_LIBRARY: '#9fd8ff', DOM_FOSSIL: '#e8b54a', DOM_CULTURE: '#8be06a' };
    for (const l of data.locations.values()) {
      if (l.type !== 'domain') continue;
      const y = this.h(l.x, l.z);
      const g = new THREE.Group();
      const stone = toon('#d8d0bd');
      const base = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.8, 0.6, 6), stone);
      base.position.y = 0.3;
      g.add(base);
      for (const sx of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 6, 6), stone);
        pillar.position.set(2.6 * sx, 3.3, 0);
        const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), glow(col[l.id] ?? '#ffffff', 1.4));
        cap.position.set(2.6 * sx, 6.8, 0);
        cap.userData.noOutline = true;
        g.add(pillar, cap);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.8, 1.2), stone);
      lintel.position.y = 6.3;
      const ring = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(col[l.id] ?? '#ffffff'), transparent: true, opacity: 0.45, side: THREE.DoubleSide, toneMapped: false }));
      ring.position.y = 3.2;
      ring.userData.noOutline = true;
      ring.userData.keep = true;
      g.add(lintel, ring);
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      addOutline(g, 0.05);
      g.position.set(l.x, y, l.z);
      g.rotation.y = Math.atan2(-l.x, -l.z);
      this.root.add(g);
      for (const sx of [-1, 1]) this.colliders.push({ x: l.x + Math.cos(g.rotation.y) * 2.6 * sx, z: l.z - Math.sin(g.rotation.y) * 2.6 * sx, r: 0.8 });
      this.domainPortals.set(l.id, { obj: g, ring, pos: new THREE.Vector3(l.x, y, l.z) });
      const alt = this.domainPortals.size % 2 === 0 && hasProp('PRP_DomainPortal_B');
      void propSlot(g, alt ? 'PRP_DomainPortal_B' : 'PRP_DomainPortal', { w: 7 }).then((ok) => {
        // the stone-circle model is open at the top: lay the coloured ring flat inside it instead of standing up
        if (ok && !alt) { ring.rotation.x = -Math.PI / 2; ring.position.y = 0.3; ring.scale.setScalar(1.15); }
        if (ok && alt) ring.visible = false; // the arch model has its own glowing portal surface
      });
    }
  }

  domainExit!: THREE.Group;
  private buildDomainArena() {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(DOMAIN_RADIUS + 2, DOMAIN_RADIUS + 3, 1, 6), toon('#cfd8e6'));
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    g.add(floor);
    // hexagon tile ring pattern
    const tile = new THREE.CylinderGeometry(1.6, 1.6, 0.06, 6);
    const tiles = new THREE.InstancedMesh(tile, toon('#ffffff'), 400);
    const m = new THREE.Matrix4();
    const ca = new THREE.Color('#b9d6ee'), cb = new THREE.Color('#e6f0fa');
    let n = 0;
    for (let q = -9; q <= 9; q++) for (let r = -9; r <= 9; r++) {
      const x = 2.9 * (q + r / 2), z = 2.5 * r;
      if (Math.hypot(x, z) > DOMAIN_RADIUS) continue;
      m.makeTranslation(x, 0.03, z);
      tiles.setMatrixAt(n, m);
      tiles.setColorAt(n++, (q + r) % 2 ? ca : cb);
    }
    tiles.count = n;
    tiles.receiveShadow = true;
    g.add(tiles);
    // glass wall + lab props
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(DOMAIN_RADIUS + 1, DOMAIN_RADIUS + 1, 9, 6, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    wall.position.y = 4.5;
    g.add(wall);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const flask = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 }));
      body.position.y = 1.1;
      const liquid = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8), glow(['#8be06a', '#9fd8ff', '#ffb36b'][i % 3], 1.2, 0.85));
      liquid.position.y = 0.95;
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.2, 8), new THREE.MeshToonMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
      neck.position.y = 2.6;
      flask.add(body, liquid, neck);
      flask.position.set(Math.cos(a) * (DOMAIN_RADIUS - 1.5), 0, Math.sin(a) * (DOMAIN_RADIUS - 1.5));
      flask.scale.setScalar(1.4);
      g.add(flask);
    }
    // exit pedestal
    const exit = new THREE.Group();
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 1, 6), toon('#d8d0bd'));
    ped.position.y = 0.5;
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), glow('#ffd36a', 1.6));
    orb.position.y = 1.9;
    exit.add(ped, orb);
    exit.position.set(0, 0, -DOMAIN_RADIUS + 4);
    exit.visible = false;
    g.add(exit);
    this.domainExit = exit;
    addOutline(exit, 0.04); // (no outline on the glass wall/tiles: back-face hulls would turn them black)
    g.position.set(DOMAIN_CENTER.x, 0, DOMAIN_CENTER.z);
    this.root.add(g);
  }

  // ---------------------------------------------------------------- waypoints (synapse nodes)
  private buildWaypoints() {
    for (const l of data.locations.values()) {
      if (l.type !== 'waypoint') continue;
      const y = this.h(l.x, l.z);
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 0.6, 6), toon('#d8d0bd'));
      base.position.y = 0.3;
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 3.2, 6), toon('#cfc6b0'));
      pillar.position.y = 2;
      g.add(base, pillar);
      for (let i = 0; i < 4; i++) {
        const den = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.14, 1.4, 5), toon('#cfc6b0'));
        const a = (i / 4) * Math.PI * 2;
        den.position.set(Math.cos(a) * 0.45, 3.7, Math.sin(a) * 0.45);
        den.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
        g.add(den);
      }
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), glow('#7f8ba0', 1));
      orb.position.y = 4;
      orb.userData.noOutline = true;
      orb.userData.keep = true;
      g.add(orb);
      addOutline(g, 0.04);
      g.position.set(l.x, y, l.z);
      this.root.add(g);
      this.colliders.push({ x: l.x, z: l.z, r: 1.6 });
      this.waypoints.set(l.id, { obj: g, orb, pos: new THREE.Vector3(l.x, y, l.z), name: l.name.th });
      // each region can have its own shrine model; falls back to the shared one
      const region = inCity(l.x, l.z) ? '_City' : inGenovia(l.x, l.z) ? '_Gen' : inZepheria(l.x, l.z) ? '_Zep' : inFlorantis(l.x, l.z) ? '_Flo' : inMetabolis(l.x, l.z) ? '_Met' : inAquorra(l.x, l.z) ? '_Aqu' : inNeurion(l.x, l.z) ? '_Neu' : inRoots(l.x, l.z) ? '_Arb' : '';
      void propSlot(g, region && hasProp(`PRP_Waypoint${region}`) ? `PRP_Waypoint${region}` : 'PRP_Waypoint', { h: 4.4 });
    }
  }

  setWaypointActive(id: string) {
    const w = this.waypoints.get(id);
    if (w) w.orb.material = glow('#7ff7ff', 1.8);
  }

  // ---------------------------------------------------------------- bio-orbs
  private buildOrbs() {
    for (const o of ORBS) {
      const y = (o.y ?? 0) + this.h(o.x, o.z) + 1.6;
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), glow('#ffcf5a', 1.8));
      const hex = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 4, 6), glow('#fff2b0', 1.5));
      g.add(core, hex);
      g.position.set(o.x, y, o.z);
      g.userData.baseY = y;
      this.root.add(g);
      this.orbs.set(o.id, g);
    }
  }

  // ---------------------------------------------------------------- chests
  private buildChests() {
    for (const c of this.chestDefs) {
      const y = this.h(c.x, c.z);
      const g = new THREE.Group();
      const col = c.tier === 3 ? '#e8c468' : c.tier === 2 ? '#7fb6e8' : '#b08a5a';
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), toon(col));
      body.position.y = 0.4;
      const lidPivot = new THREE.Group();
      lidPivot.position.set(0, 0.8, -0.45);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.4, 8, 1, false, 0, Math.PI), toon(col));
      lid.rotation.z = Math.PI / 2;
      lid.rotation.y = Math.PI / 2;
      lid.position.set(0, 0, 0.45);
      lidPivot.add(lid);
      const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 6), glow('#fff2b0', 1.3));
      lock.rotation.x = Math.PI / 2;
      lock.position.set(0, 0.7, 0.47);
      g.add(body, lidPivot, lock);
      addOutline(g, 0.04);
      g.position.set(c.x, y, c.z);
      g.rotation.y = Math.atan2(-c.x, -c.z);
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      this.root.add(g);
      this.chests.set(c.id, { def: c, obj: g, lid: lidPivot });
      const model = c.tier === 3 ? 'PRP_Chest_Gold' : c.tier === 2 && hasProp('PRP_Chest_Silver') ? 'PRP_Chest_Silver' : 'PRP_Chest';
      void propSlot(g, model, { w: 1.6 });
    }
  }

  openChestVisual(id: string, instant = false) {
    const c = this.chests.get(id);
    if (!c) return;
    c.lid.userData.open = true;
    if (instant) c.lid.rotation.x = -1.6;
    void propSlot(c.obj, 'PRP_Chest_Open', { w: 1.6 });
  }

  // ---------------------------------------------------------------- per-frame
  update(dt: number, playerPos?: THREE.Vector3) {
    for (const ps of this.plotPlants) for (const p of ps) p.update(dt);
    this.time += dt;
    if (playerPos) this.genovia.update(dt, playerPos);
    this.zepheria.update(dt);
    if (playerPos) this.florantis.update(dt, playerPos, this.daylight);
    if (playerPos) this.metabolis.update(dt, playerPos, this.daylight);
    if (playerPos) this.aquorra.update(dt, playerPos);
    if (playerPos) this.neurion.update(dt, playerPos);
    if (playerPos) this.roots.update(dt, playerPos);
    WATER_ENV.time.value = this.time;
    for (const m of this.mixers) m.update(dt);
    if (playerPos) {
      updateFlora(playerPos);
      // regions are 1.3–1.8 km apart: skip a whole region (thousands of meshes) unless the player is near it
      const near = (cx: number, cz: number, r: number) => Math.hypot(playerPos.x - cx, playerPos.z - cz) < r + 450;
      this.city.root.visible = near(CITY.x, CITY.z, CITY_RADIUS);
      this.genovia.root.visible = near(GEN.x, GEN.z, GEN_RADIUS);
      this.zepheria.root.visible = near(ZEP.x, ZEP.z, ZEP_SIZE * 0.75);
      this.florantis.root.visible = near(FLO.x, FLO.z, FLO_RADIUS);
      this.metabolis.root.visible = near(MET.x, MET.z, MET_RADIUS);
      this.aquorra.root.visible = near(AQU.x, AQU.z, AQU_RADIUS);
      this.neurion.root.visible = near(NEU.x, NEU.z, NEU_RADIUS);
      this.roots.root.visible = near(ARB.x, ARB.z, ARB_RADIUS);
    }
    for (const b of this.breathers) b(this.time);
    if (this.city.root.visible) for (const g of this.guards) g.update(dt, World.IDLE);
    this.city.update(dt);
    (this.sky.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    if (this.waterMat) this.waterMat.uniforms.uTime.value = this.time;
    this.sites.update(dt);
    for (const o of this.orbs.values()) {
      o.rotation.y += dt * 1.5;
      o.position.y = o.userData.baseY + Math.sin(this.time * 2 + o.position.x) * 0.2;
    }
    for (const b of this.bubbles) {
      b.position.y = b.userData.baseY + Math.sin(this.time * 0.6 + b.userData.phase) * 0.4;
      b.rotation.y += dt * 0.05;
    }
    if (this.statueCore) this.statueCore.rotation.y += dt;
    for (const c of this.chests.values()) {
      if (c.lid.userData.open && c.lid.rotation.x > -1.6) c.lid.rotation.x = Math.max(-1.6, c.lid.rotation.x - dt * 3);
    }
    if (this.doorOpen && this.doorOpenT < 1) {
      this.doorOpenT = Math.min(1, this.doorOpenT + dt * 0.4);
      this.door.position.y = 3.1 - this.doorOpenT * 6.4;
      if (this.doorOpenT >= 1) this.colliders = this.colliders.filter((c) => c.id !== 'door');
    }
  }

  openDoor(instant = false) {
    this.doorOpen = true;
    if (instant) {
      this.doorOpenT = 1;
      this.door.position.y = -3.3;
      this.colliders = this.colliders.filter((c) => c.id !== 'door');
    }
  }

  /** Push a circle (x,z,r) out of world colliders. Returns corrected position. */
  resolve(pos: THREE.Vector3, r: number) {
    for (const c of this.colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + r;
      if (d < min && d > 1e-4) {
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }
    const dd = Math.hypot(pos.x - DOMAIN_CENTER.x, pos.z - DOMAIN_CENTER.z);
    if (dd < DOMAIN_RADIUS + 20) {
      if (dd > DOMAIN_RADIUS) {
        pos.x = DOMAIN_CENTER.x + ((pos.x - DOMAIN_CENTER.x) / dd) * DOMAIN_RADIUS;
        pos.z = DOMAIN_CENTER.z + ((pos.z - DOMAIN_CENTER.z) / dd) * DOMAIN_RADIUS;
      }
      return;
    }
    if (inZepheria(pos.x, pos.z)) {
      const dz = Math.hypot(pos.x - ZEP.x, pos.z - ZEP.z), R = ZEP_SIZE / 2;
      if (dz > R) { pos.x = ZEP.x + ((pos.x - ZEP.x) / dz) * R; pos.z = ZEP.z + ((pos.z - ZEP.z) / dz) * R; }
      return;
    }
    for (const [inR, C, R] of [[inNeurion, NEU, NEU_RADIUS], [inRoots, ARB, ARB_RADIUS]] as const) {
      if (!inR(pos.x, pos.z)) continue;
      const d = Math.hypot(pos.x - C.x, pos.z - C.z);
      if (d > R) { pos.x = C.x + ((pos.x - C.x) / d) * R; pos.z = C.z + ((pos.z - C.z) / d) * R; }
      return;
    }
    if (inAquorra(pos.x, pos.z)) {
      const da = Math.hypot(pos.x - AQU.x, pos.z - AQU.z);
      if (da > AQU_RADIUS) {
        pos.x = AQU.x + ((pos.x - AQU.x) / da) * AQU_RADIUS;
        pos.z = AQU.z + ((pos.z - AQU.z) / da) * AQU_RADIUS;
      }
      return;
    }
    if (inMetabolis(pos.x, pos.z)) {
      const dm = Math.hypot(pos.x - MET.x, pos.z - MET.z);
      if (dm > MET_RADIUS) {
        pos.x = MET.x + ((pos.x - MET.x) / dm) * MET_RADIUS;
        pos.z = MET.z + ((pos.z - MET.z) / dm) * MET_RADIUS;
      }
      return;
    }
    if (inFlorantis(pos.x, pos.z)) {
      const df = Math.hypot(pos.x - FLO.x, pos.z - FLO.z);
      if (df > FLO_RADIUS) {
        pos.x = FLO.x + ((pos.x - FLO.x) / df) * FLO_RADIUS;
        pos.z = FLO.z + ((pos.z - FLO.z) / df) * FLO_RADIUS;
      }
      return;
    }
    if (inGenovia(pos.x, pos.z)) {
      const dg = Math.hypot(pos.x - GEN.x, pos.z - GEN.z);
      if (dg > GEN_RADIUS) {
        pos.x = GEN.x + ((pos.x - GEN.x) / dg) * GEN_RADIUS;
        pos.z = GEN.z + ((pos.z - GEN.z) / dg) * GEN_RADIUS;
      }
      return;
    }
    if (inCity(pos.x, pos.z)) {
      const dc = Math.hypot(pos.x - CITY.x, pos.z - CITY.z);
      if (dc > CITY_RADIUS + 8) { // only the gate gap reaches this far
        pos.x = CITY.x + ((pos.x - CITY.x) / dc) * (CITY_RADIUS + 8);
        pos.z = CITY.z + ((pos.z - CITY.z) / dc) * (CITY_RADIUS + 8);
      }
      return;
    }
    const d = Math.hypot(pos.x, pos.z);
    if (d > WORLD_RADIUS) {
      pos.x *= WORLD_RADIUS / d;
      pos.z *= WORLD_RADIUS / d;
    }
  }
}

/** Lower a T-posed rig's upper arms to the sides (models downloaded without an idle clip). */
function relaxArms(root: THREE.Object3D) {
  root.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    const n = o.name.toLowerCase().replace(/[\s_.]+/g, '');
    if (/^(left|l)(upper)?arm\d*$|^upperarm(l|left)\d*$/.test(n)) o.rotateZ(1.15);
    else if (/^(right|r)(upper)?arm\d*$|^upperarm(r|right)\d*$/.test(n)) o.rotateZ(-1.15);
  });
}
