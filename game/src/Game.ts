import { CITY, CITY_ENTRY, CITY_GATE_IN, CITY_RADIUS, inCity } from './world/City';
import { inGenovia } from './world/Genovia';
import { inFlorantis } from './world/Florantis';
import { LOOK } from './render/Look';
import { inMetabolis } from './world/Metabolis';
import { inAquorra } from './world/Aquorra';
import { inNeurion } from './world/Neurion';
import { inRoots } from './world/Roots';
import { inZepheria } from './world/Zepheria';
import { LAKE } from './world/Terrain';
import { runBasePairPuzzle, runBeakPuzzle, runPunnettPuzzle, runPyramidPuzzle, runTissuePuzzle, runFlowerPuzzle, runPhotoPuzzle, runHormonePuzzle, runDigestPuzzle, runBreathPuzzle, runGlycoPuzzle, runKrebsPuzzle, runHeartPuzzle, runBloodPuzzle, runImmunePuzzle, runNephronPuzzle, runNeuronPuzzle, runSensePuzzle, runMusclePuzzle, runEndocrinePuzzle, runThermoPuzzle, runGlucosePuzzle, runWaterPuzzle, runEcoPuzzle, runTaxonomyPuzzle } from './ui/Puzzles';
import { PostFX } from './render/PostFX';
import { ContactShadow } from './render/ContactShadow';
import { Ambient } from './render/Ambient';
import { QuestGuide } from './render/QuestGuide';
import { Grass } from './world/Grass';
import { WIND } from './world/Nature';
import * as THREE from 'three';
import { PerfHud } from './ui/PerfHud';
import { CombatFX } from './render/CombatFX';
import { efx, initElementFX } from './render/ElementFX';
import { data } from './core/Data';
import { bus } from './core/EventBus';
import { Input } from './core/Input';
import { ambience, music, setListener, setVolumes, sfx, unlockAudio, type MusicScene, type Surface } from './core/Audio';
import { loadSave, newSave, writeSave, deleteSave, importSave, todayStr, type SaveData } from './core/Save';
import { ELEMENT_COLOR, ELEMENT_GLYPH, type Element, type QuestAction } from './core/types';
import { World, type Interactable, type Scannable } from './world/World';
import { Combat } from './combat/Combat';
import { REACTION_INFO, type ReactionId } from './combat/Elements';
import { reactionIcon } from './core/Assets';
import { Blast } from './combat/Effects';
import { hasKit, tickKits } from './combat/Skills';
import type { Enemy } from './enemies/Enemy';
import { PlayerController } from './player/PlayerController';
import { AmoebyModel, type CharModel } from './player/CharacterModel';
import { createCharacterModel } from './models/CharacterModels';
import { charArtName, skillArtName } from './core/Assets';
import { isTouch } from './core/Device';
import { TouchControls } from './ui/TouchControls';
import { PartyMember, expToNext, levelCap } from './player/Party';
import { QuestManager, type QuestApi } from './quest/QuestManager';
import { Learning } from './learning/Learning';
import { HUD, type HudState } from './ui/HUD';
import { WorldUI } from './ui/WorldUI';
import { playDialogue } from './ui/DialogueUI';
import { runQuiz } from './ui/QuizUI';
import { h, isModalOpen, onModalChange, openModal, setPlayerIdentity, sideToast, toast } from './ui/UI';
import { openCharacters, openCodex, openEscMenu, openHelp, openMap, openProgress, openQuestLog, runPlantExperiment, lastWateredPlots, type MenuHost } from './ui/Menus';
import { showTitle } from './ui/Title';
import { openWish, type ResultInfo, type WishHost } from './ui/WishUI';
import { PartyMember as PM, gearLookup } from './player/Party';
import * as GE from './gear/GearEffects';
import { gearData, rollRelic, relicName, STARTER_WEAPON, SIGNATURE_ON_JOIN, type RelicInst, type WeaponInst } from './gear/Gear';
import { openInventory } from './ui/GearUI';
import { DomainController, type DomainRun } from './domain/DomainController';
import { openDomainMenu, openDomainResult, type DomainMenuHost } from './ui/DomainUI';
import { regenAtp } from './domain/Atp';
import { DOMAIN_CENTER } from './world/World';
import type { PullResult } from './gacha/Gacha';

const REACTION_QUESTION: Record<ReactionId, string> = {
  THERMOREGULATION: 'Q_R_THERMO', DENATURATION: 'Q_CHEM_021', FEVER_SHOCK: 'Q_R_FEVER', OXIDATION: 'Q_R_OXID',
  CRYOSTASIS: 'Q_R_CRYO', ELECTROLYTE: 'Q_R_ELEC', GERMINATION: 'Q_R_GERM', SYNAPTIC_BLOCK: 'Q_R_SYN',
  CATALYSIS: 'Q_CHEM_031', ENZYME_SURGE: 'Q_CHEM_031', BRANCHING: 'Q_CHEM_031', DIFFUSION: 'Q_CELL_011',
  MEMBRANE_SHIELD: 'Q_CELL_014', LYSIS: 'Q_CELL_012',
};

/** Free-roam enemy camps (appear after the prologue tutorial). */
const CAMPS = [
  { id: 'C1', x: -25, z: 28, enemies: [['EN_BAC_COCCI', null], ['EN_BAC_COCCI', 'HYDRO'], ['EN_BAC_BACIL', null]], level: 2 },
  { id: 'C2', x: -60, z: -10, enemies: [['EN_BAC_COCCI', 'PYRO'], ['EN_BAC_COCCI', null], ['EN_BAC_COCCI', null]], level: 3 },
  { id: 'C3', x: 135, z: 70, enemies: [['EN_BAC_BACIL', null], ['EN_BAC_BACIL', 'HYDRO'], ['EN_PHAGE_S', null]], level: 5 },
  { id: 'C4', x: -30, z: -110, enemies: [['EN_BAC_COCCI', 'HYDRO'], ['EN_BAC_COCCI', 'PYRO'], ['EN_BAC_BACIL', null], ['EN_PHAGE_S', null]], level: 6 },
  { id: 'C5', x: 75, z: -110, enemies: [['EN_BAC_COCCI', null], ['EN_BAC_BACIL', 'PYRO'], ['EN_BAC_COCCI', 'HYDRO']], level: 6 },
  { id: 'C6', x: -110, z: 60, enemies: [['EN_PHAGE_S', null], ['EN_BAC_COCCI', null], ['EN_BAC_COCCI', null]], level: 4 },
] as const;

const CHAPTER_SUBTITLE: Record<string, string> = {
  'บทนำ · จบ': 'บทที่ 1 "เซลล์ที่ไม่ยอมหยุดแบ่งตัว" เริ่มขึ้นแล้ว — เข้าสู่นครเซลลาเรียได้ที่ประตูเมือง',
  'บทที่ 1': 'โครงสร้างของเซลล์ · สารชีวโมเลกุล · เอนไซม์ · การลำเลียงสาร · การแบ่งเซลล์',
  'บทที่ 1 · จบ': 'บทที่ 2 "รหัสที่ถูกขโมย" รออยู่ที่เจโนเวีย — ศาสตราจารย์ไลโซจะเรียกพบที่สถาบัน',
  'บทที่ 2': 'โครงสร้าง DNA · การจำลอง DNA · โครโมโซม · กฎของเมนเดล · การถ่ายทอดลักษณะในคน · เทคโนโลยีทาง DNA',
  'บทที่ 2 · จบ': 'บทที่ 3 "หมู่เกาะที่หายไป" รออยู่ที่ซีเฟอเรีย — ศาสตราจารย์ไลโซจะเรียกพบที่สถาบัน',
  'บทที่ 3': 'วิวัฒนาการ · หลักฐานของวิวัฒนาการ · การจัดหมวดหมู่ · ความหลากหลายทางชีวภาพ · ระบบนิเวศและประชากร',
  'บทที่ 3 · จบ': 'บทที่ 4 "ป่าที่หยุดหายใจ" รออยู่ที่ฟลอแรนทิส — ศาสตราจารย์ไลโซจะเรียกพบที่สถาบัน',
  'บทที่ 4': 'เนื้อเยื่อพืช · โครงสร้างดอก · การสืบพันธุ์ของพืชดอก · การสังเคราะห์ด้วยแสง C3/C4/CAM · ฮอร์โมนพืช',
  'บทที่ 4 · จบ': 'บทที่ 5 "เตาที่มอดดับ" รออยู่ที่เมแทบอลิส — ศาสตราจารย์ไลโซจะเรียกพบที่สถาบัน',
  'บทที่ 5': 'ระบบย่อยอาหาร · ระบบหายใจ · การหายใจระดับเซลล์ (ไกลโคไลซิส วัฏจักรเครบส์ การถ่ายทอดอิเล็กตรอน) · การหมัก',
  'บทที่ 5 · จบ': 'บทที่ 6 "โรคระบาดในเมืองแห่งสายน้ำ" รออยู่ที่อควอร์รา — ศาสตราจารย์ไลโซจะเรียกพบที่สถาบัน',
  'บทที่ 6': 'ระบบหมุนเวียนเลือด · หัวใจและหลอดเลือด · ส่วนประกอบของเลือด · ระบบภูมิคุ้มกัน · ระบบขับถ่าย (ไตและหน่วยไต)',
  'บทที่ 6 · จบ': 'บทที่ 7 "ราชาแห่งสายฟ้า" รออยู่ที่นิวรีออน — ศาสตราจารย์ไลโซจะเรียกพบที่สถาบัน',
  'บทที่ 7': 'ระบบประสาท · อวัยวะรับความรู้สึก · ระบบโครงร่างและการเคลื่อนที่ · ระบบต่อมไร้ท่อ · การสืบพันธุ์และการเจริญเติบโต · พฤติกรรมสัตว์',
  'บทที่ 7 · จบ': 'บทสรุป "รากแห่งชีวิต" รออยู่ที่รากต้นไม้แห่งชีวิต — ศาสตราจารย์ไลโซจะเรียกพบที่สถาบัน',
  'บทสรุป': 'ดุลยภาพของร่างกาย (Homeostasis) · การควบคุมอุณหภูมิ น้ำตาล และน้ำในร่างกาย · ดุลยภาพของระบบนิเวศ · ทบทวนทุกบท',
  'บทสรุป · จบ': 'ขอบคุณที่เดินทางมาด้วยกัน — โลกยังเปิดให้สำรวจต่อ ปราบบอสโลก ทำโดเมน และทบทวนความรู้ได้ทุกวัน',
};

const WORLD_BOSSES = [
  { tag: 'WB_KING', quest: 'MQ_P_06', loc: 'LOC_BOSS_ARENA', enemy: 'EN_BOSS_KING', level: 14, hint: 'ราชาแบคทีเรียฟื้นคืนชีพ! ปราบอีกครั้งเพื่อรับ Bio-Relic ระดับสูงนะ' },
  { tag: 'WB_VIRUS', quest: 'MQ_3_06', loc: 'LOC_ZEP_FADE', enemy: 'EN_BOSS_VIRUS', level: 30, hint: 'พายุไวรัสก่อตัวขึ้นอีกครั้งเหนือเกาะ! ปราบเพื่อรับไข่มุกพายุและ Bio-Relic' },
  { tag: 'WB_CHIMERA', quest: 'MQ_2_06', loc: 'LOC_GEN_FORT', enemy: 'EN_BOSS_CHIMERA', level: 26, hint: 'ไคเมร่าบีสต์ตัวใหม่หลุดออกจากกรงในป้อม! ปราบเพื่อรับเกล็ดไคเมร่าและ Bio-Relic' },
  { tag: 'WB_SPORE', quest: 'MQ_4_06', loc: 'LOC_FLO_HEART', enemy: 'EN_BOSS_SPORE', level: 34, hint: 'ราชินีสปอร์งอกขึ้นใหม่ใต้ต้นไม้มารดา! ปราบเพื่อรับหมวกสปอร์และ Bio-Relic' },
  { tag: 'WB_CYANO', quest: 'MQ_5_06', loc: 'LOC_MET_HEART', enemy: 'EN_BOSS_CYANO', level: 38, hint: 'ซินดิเคตส่งไซยาโนคอร์ตัวใหม่มาปิดเตาหลอมอีกแล้ว! ปราบเพื่อรับเฟืองซินดิเคตและ Bio-Relic' },
  { tag: 'WB_SUPERBUG', quest: 'MQ_6_06', loc: 'LOC_AQU_MARSH', enemy: 'EN_BOSS_SUPERBUG', level: 42, hint: 'เชื้อดื้อยาตัวใหม่ก่อตัวขึ้นในหนองน้ำ! ใช้ยาพร่ำเพรื่อเชื้อก็ดื้อได้อีก — ปราบเพื่อรับ Bio-Relic' },
  { tag: 'WB_MEDUSA', quest: 'MQ_7_06', loc: 'LOC_NEU_TOWER', enemy: 'EN_BOSS_MEDUSA', level: 46, hint: 'เมดูซ่าพิษประสาทตัวใหม่ลอยมาเกาะหอสมองอีกแล้ว! ปราบเพื่อรับ Bio-Relic' },
  { tag: 'WB_HERALD', quest: 'MQ_8_06', loc: 'LOC_ARB_ARENA', enemy: 'EN_BOSS_HERALD', level: 50, hint: 'เงาของผู้ประกาศเอนโทรปียังวนเวียนอยู่ที่ราก! ปราบเพื่อรับ Bio-Relic ระดับสูง' },
  { tag: 'WB_GOLEM', quest: 'MQ_1_06', loc: 'LOC_SPIRE', enemy: 'EN_BOSS_GOLEM', level: 22, hint: 'บลายต์ยังหลงเหลือในหอคอย โกเลมมะเร็งก่อตัวขึ้นใหม่! ปราบเพื่อรับแกนโกเลมและ Bio-Relic' },
];

interface NpcRuntime { id: string; model: CharModel | null; root: THREE.Group; pos: THREE.Vector3; visible: boolean }

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900); // a little tele (Genshin-like): less distortion, more depth
  input: Input;
  world!: World;
  combat!: Combat;
  player!: PlayerController;
  quests!: QuestManager;
  learning!: Learning;
  hud!: HUD;
  wui!: WorldUI;
  save!: SaveData;
  members = new Map<string, PartyMember>();
  private npcs: NpcRuntime[] = [];
  private running = false;
  private inTitle = true;
  private clock = new THREE.Clock();
  private titleT = 0;
  private scanning = false;
  private scanTarget: { id: string; label: string; codexId: string; tags: string[]; known: boolean } | null = null;
  private scanProgress = 0;
  private pendingReactionQuiz: ReactionId[] = [];
  private respawnWatch: QuestAction[] = [];
  private campCleared = new Map<string, number>();
  private campAlive = new Map<string, Enemy[]>();
  private autosaveT = 0;
  private playReminderT = 0;
  private interactList: { key: string; label: string; icon: string; act: () => void }[] = [];
  /** On-screen controls (phones / tablets only). */
  private touch: TouchControls | null = null;
  private deadHandled = false;
  private gameTime = 0;
  private bossShieldOpen = false;
  private firstVirusAntibiotic = false;
  private mapImage: HTMLCanvasElement | null = null;
  private genoviaMap: HTMLCanvasElement | null = null;
  private zepheriaMap: HTMLCanvasElement | null = null;
  private florantisMap: HTMLCanvasElement | null = null;
  private metabolisMap: HTMLCanvasElement | null = null;
  private aquorraMap: HTMLCanvasElement | null = null;
  private neurionMap: HTMLCanvasElement | null = null;
  private rootsMap: HTMLCanvasElement | null = null;
  private lastSafe = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // look v2: neutral tone mapping keeps the stylised palette's hue and saturation (ACES greys out bright colours)
    this.renderer.toneMapping = LOOK.v2 ? THREE.NeutralToneMapping : THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = LOOK.v2 ? 1.45 : 1.05; // v2 value measured against Genshin meadow shots (lit grass ≈ #8bc274)
    if (LOOK.v2) this.renderer.domElement.style.filter = 'saturate(1.0) contrast(1.02)';
    this.input = new Input(canvas);
    if (isTouch) {
      this.touch = new TouchControls(this.input, canvas);
      this.touch.onInteract = (i) => { if (this.running && !isModalOpen()) this.interactList[i]?.act(); };
    }
    window.addEventListener('resize', () => this.resize());
    this.resize();
    onModalChange((open) => {
      this.input.enabled = !open;
      document.body.classList.toggle('modal-open', open);
      if (open) { this.input.releaseLock(); this.touch?.reset(); }
      else this.input.endFrame(); // drop keys that were used to close the modal
    });
    // Browsers swallow the first Esc while the mouse is locked: treat losing the lock as "open menu".
    this.input.onLockLost = () => {
      if (this.running && !this.inTitle && !isModalOpen()) {
        if (this.scanning) { this.scanning = false; return; }
        this.openMenu();
      }
    };
  }

  private postfx: PostFX | null = null;
  private perf!: PerfHud;
  private fx!: CombatFX;
  /** seconds of hit-stop left: the world runs at a crawl so a landed melee hit feels solid */
  private hitStopT = 0;
  private grass!: Grass;
  private ambient!: Ambient;
  private guide!: QuestGuide;
  /** look v3 soft shadow under the active character's feet */
  private contact: ContactShadow | null = null;

  resize() {
    const w = window.innerWidth, hgt = window.innerHeight;
    this.renderer.setSize(w, hgt, false);
    this.camera.aspect = w / hgt;
    this.camera.updateProjectionMatrix();
    this.postfx?.setSize(w, hgt);
  }

  /** Build the world once (used behind the title screen too). */
  init() {
    this.world = new World(this.scene);
    this.combat = new Combat(this.scene, {
      damageNumber: (p, t, c, k) => this.wui?.damage(p, t, c, k),
      reactionFirst: (r) => this.onReaction(r),
      enemyKilled: (e) => this.onEnemyKilled(e),
      bossShield: (e) => this.onBossShield(e),
      playerDamaged: () => {},
      phageLysed: () => this.amoebyOnce('lyse', 'เห็นไหม! เฟจเพิ่มจำนวนในแบคทีเรียจนเซลล์แตก แล้วปล่อยเฟจรุ่นใหม่ออกมา — นี่คือวัฏจักรแบบไลติก!'),
      firstSplit: () => this.amoebyOnce('split', 'เฮ้ย! มันแบ่งตัวแบบ Binary Fission! 1 เป็น 2 รีบจัดการก่อนมันเพิ่มเป็นทวีคูณ!'),
      shieldGained: (el) => sideToast(`<span style="color:${ELEMENT_COLOR[el]}">🛡 ได้รับโล่เยื่อหุ้ม</span>`),
      impact: (at, color, strong, melee) => {
        this.fx.hit(at, color, strong);
        if (melee) this.hitStopT = Math.max(this.hitStopT, strong ? 0.09 : 0.05);
      },
      tumorRipe: () => this.amoebyOnce('tumor', 'ก้อนเนื้องอกโตเต็มที่แล้วส่งพลังให้โกเลม! ทำลายมันให้เร็ว เหมือนการตรวจพบและรักษาแต่เนิ่น ๆ ยิ่งเร็วยิ่งดี!'),
    });
    this.combat.groundY = (x, z) => this.world.groundH(x, z);
    this.wui = new WorldUI(this.camera);
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);
    this.perf = new PerfHud(this.renderer);
    this.fx = new CombatFX(this.scene);
    // browsers keep audio locked until the first click / key press
    const unlock = () => { unlockAudio(); music.refresh(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    initElementFX(this.scene, this.fx.batch);
    this.grass = new Grass({ height: (x, z) => this.world.h(x, z), colorAt: (x, z) => this.world.grassColorAt(x, z), dirtAt: (x, z) => this.world.ground.dirtAt(x, z) });
    this.scene.add(this.grass.mesh);
    this.ambient = new Ambient();
    this.ambient.setFireflySpots(this.world.fireflySpots());
    this.scene.add(this.ambient.points);
    this.guide = new QuestGuide();
    this.scene.add(this.guide.root);
    if (LOOK.v3) { this.contact = new ContactShadow(); this.scene.add(this.contact.mesh); }
    this.resize();
    this.mapImage = HUD.buildMapImage(this.world, 512);
    this.loop();
  }

  showTitle() {
    this.inTitle = true;
    document.body.classList.remove('playing');
    music.setScene('title');
    ambience.silence();
    document.getElementById('hud')!.innerHTML = '';
    showTitle(
      () => { const s = loadSave(); if (s) this.start(s); },
      (name, gender) => { deleteSave(); this.start(newSave(name, gender)); },
    );
  }

  // ================================================================== start / load
  start(save: SaveData) {
    this.save = save;
    setPlayerIdentity(save.playerName, save.gender);
    this.inTitle = false;
    this.learning = new Learning(() => this.save);
    gearLookup.weapon = (uid) => this.save.gear.weapons.find((w) => w.uid === uid);
    gearLookup.relic = (uid) => this.save.gear.relics.find((r) => r.uid === uid);
    GE.setDayProvider(() => this.save.timeOfDay >= 6 && this.save.timeOfDay < 18);

    // party members
    this.members.clear();
    for (const id of save.unlockedChars) this.ensureMember(id);
    const party = save.party.filter((id) => this.members.has(id) && hasKit(id)).map((id) => this.members.get(id)!);
    if (!party.length) party.push(this.ensureMember('SEEKER'));

    if (this.player) { this.scene.remove(this.player.amoeby.root); for (const m of this.player.models.values()) this.scene.remove(m.root); }
    this.combat.dispose();
    this.wui.clear();
    this.player = new PlayerController(this.scene, this.world, this.combat, party, save.gender);
    this.player.activeIndex = Math.min(save.activeIndex, party.length - 1);
    this.player.rebuildModels();
    this.player.maxStamina = save.maxStamina;
    this.player.stamina = save.maxStamina;
    this.player.gliderUnlocked = save.systems.includes('GLIDER');
    this.player.isDay = () => this.save.timeOfDay >= 6 && this.save.timeOfDay < 18;
    this.player.onHeal = (n) => this.wui.damage(this.player.pos.clone().setY(this.player.pos.y + 2), String(Math.round(n)), '#9cf59a', 'heal');
    this.player.onHealBy = (healer) => GE.onHeal(healer, this.player.party);
    this.player.onSwitchIn = (m) => { const sh = GE.onSwitchIn(m); if (sh > 0) this.combat.giveShield(sh, null, 15); };
    const spawn = save.position ? new THREE.Vector3(...save.position) : (() => { const l = data.locations.get('LOC_SPAWN')!; return new THREE.Vector3(l.x, 0, l.z); })();
    this.player.teleport(spawn);
    this.player.camYaw = 0;
    this.player.updateCamera(1, this.camera);
    this.combat.party = () => this.player.party;
    this.combat.active = () => this.player.active;
    this.combat.playerInvuln = () => this.player.iframeT > 0;

    this.hud = new HUD(this.world);
    this.hud.onPartyClick((i) => this.player.switchTo(i));
    // touch: tap the minimap for the map, the quest tracker for the quest log
    this.hud.root.querySelector('.hud-minimap')?.addEventListener('click', () => this.input.tap('KeyM'));
    this.hud.root.querySelector('.hud-quest')?.addEventListener('click', () => this.input.tap('KeyJ'));
    document.body.classList.add('playing');

    // world state from save
    for (const id of save.world.chests) this.world.openChestVisual(id, true);
    for (const id of save.world.orbs) { const o = this.world.orbs.get(id); if (o) o.visible = false; }
    for (const id of save.world.waypoints) this.world.setWaypointActive(id);
    if (save.flags.door_open) this.world.openDoor(true);
    if (save.flags.plots_healthy) this.world.setPlotsHealthy(this.savedPlots(), true);
    this.syncSites();
    this.buildNpcs();
    this.applySettings();

    // quests
    this.respawnWatch = [];
    this.quests = new QuestManager(() => this.save, this.questApi());
    this.quests.start();
    this.domain = new DomainController({
      save: () => this.save,
      combat: this.combat,
      world: this.world,
      player: () => this.player,
      giveItem: (id, n) => this.giveItem(id, n),
      grantRelic: (r, a) => { this.grantRelic(r, a); },
      addRRExp: (n) => this.addRRExp(n),
      toast: (t, big) => toast(t, big),
      fadeTeleport: (to, after) => this.fadeTo(to, after),
      writeSave: () => this.writeSave(),
      onFinished: (_run: DomainRun, ok: boolean) => { if (!ok) setTimeout(() => openDomainResult(this.domainHost()), 900); },
    });
    if (this.save.quests.MQ_P_06?.state === 'COMPLETED') this.unlockGeneWish();
    if (!this.wishListener) {
      this.wishListener = bus.on('QuestCompleted', (q) => { if (q.questId === 'MQ_P_06') this.unlockGeneWish(); });
      // a story boss doesn't come straight back as a world boss the moment its chapter ends
      bus.on('QuestCompleted', (q) => { for (const wb of WORLD_BOSSES) if (wb.quest === q.questId) this.worldBossKilledAt.set(wb.tag, this.gameTime); });
      bus.on('Interacted', (p) => { const m = /^OBJ_SALT_(\d)$/.exec(p.objectId); if (m) { this.setFlag(`salt_${m[1]}`); sfx.pickup(); sideToast('🧂 เก็บกองเกลือแล้ว'); } });
      bus.on('SkillUsed', (p) => {
        const m = this.player?.party.find((x) => x.id === p.charId);
        if (!m) return;
        GE.onSkill(m, p.kind, this.player.party);
        sfx.cast(m.def.element, p.kind === 'Q');
        efx()?.cast(this.player.pos, m.def.element, p.kind === 'Q'); // rune circle + element particles under the caster
      });
    }
    this.running = true;
    this.clock.getDelta();
    this.writeSave();
    if (!save.flags.seen_help) {
      save.flags.seen_help = true;
      setTimeout(() => this.amoebySay(isTouch
        ? 'ลากนิ้วซ้ายเพื่อเดิน · ลากบนจอฝั่งขวาเพื่อหมุนกล้อง · ปุ่ม ☰ มุมขวาบน มีวิธีเล่นทั้งหมด'
        : 'กดเมาส์ขวาค้างแล้วลากเพื่อหมุนกล้อง · WASD หรือลูกศรเพื่อเดิน · กด H ดูวิธีเล่นทั้งหมด', 7000), 1500);
    }
  }

  private savedPlots(): number[] {
    const r = [0, 1, 2].filter((i) => this.save.flags[`plot_w_${i}`]);
    return r.length ? r : [1];
  }

  private ensureMember(id: string): PartyMember {
    let m = this.members.get(id);
    if (m) return m;
    const def = data.characters.get(id)!;
    if (!this.save.chars[id]) this.save.chars[id] = { level: 1, ascension: 0, exp: 0, hpFrac: 1 };
    const cs = this.save.chars[id];
    if (!cs.weapon || !gearLookup.weapon(cs.weapon)) {
      const w = this.createWeapon(SIGNATURE_ON_JOIN[id] ?? STARTER_WEAPON[def.weapon]);
      w.level = Math.min(cs.level, 20);
      cs.weapon = w.uid;
    }
    cs.relics ??= {};
    m = new PartyMember(def, cs);
    this.members.set(id, m);
    return m;
  }

  // ================================================================== gear
  private newUid(prefix: string) { return `${prefix}${this.save.gear.nextUid++}`; }

  createWeapon(id: string): WeaponInst {
    const w: WeaponInst = { uid: this.newUid('w'), id, level: 1, asc: 0, exp: 0, refine: 1 };
    this.save.gear.weapons.push(w);
    return w;
  }

  grantRelic(rarity: 3 | 4 | 5, announce = true): RelicInst {
    const r = rollRelic(this.newUid('r'), rarity);
    this.save.gear.relics.push(r);
    if (announce) sideToast(`<span style="color:${rarity === 5 ? '#ffcf5a' : rarity === 4 ? '#c58bff' : '#6fb6ff'}">${'★'.repeat(rarity)}</span> ได้รับ Bio-Relic: ${relicName(r)}`, 3500);
    return r;
  }

  /** Random relic rarity for a drop source quality (0 = trash … 2 = boss). */
  private relicRarity(q: number): 3 | 4 | 5 {
    const r = Math.random();
    if (q >= 2) return r < 0.3 ? 5 : 4;
    if (q === 1) return r < 0.08 ? 5 : r < 0.55 ? 4 : 3;
    return r < 0.25 ? 4 : 3;
  }

  private buildNpcs() {
    for (const n of this.npcs) this.scene.remove(n.root);
    this.npcs = [];
    for (const def of data.npcs.values()) {
      const loc = data.locations.get(def.location);
      if (!loc) continue;
      const root = new THREE.Group();
      let model: CharModel | null = null;
      if (def.model === 'char' && def.charId) {
        const c = data.characters.get(def.charId)!;
        model = createCharacterModel(`characters/CHR_${charArtName(def.charId, this.save.gender)}.vrm`, c.appearance, c.element, c.weapon);
      } else if (def.model === 'human' && def.appearance) {
        model = createCharacterModel(def.art ? `npcs/NPC_${def.art}.vrm` : null, def.appearance, 'PHYSICAL', 'CATALYST');
      } else if (def.model === 'amoeby') {
        root.add(new AmoebyModel().root);
      }
      if (model) root.add(model.root);
      if (model && def.wear) model.wearOnHead?.(def.wear);
      // NPCs at the same location stand side by side
      const sameLoc = this.npcs.filter((n) => data.npcs.get(n.id)?.location === def.location).length;
      const pos = new THREE.Vector3(loc.x + sameLoc * 2.2, 0, loc.z + (def.id === 'NPC_ALVI' ? 0 : 0));
      pos.y = this.world.h(pos.x, pos.z);
      root.position.copy(pos);
      this.scene.add(root);
      this.npcs.push({ id: def.id, model, root, pos, visible: false });
    }
  }

  private npcVisible(id: string): boolean {
    const d = data.npcs.get(id)!;
    if (d.showFlag && !this.save.flags[d.showFlag]) return false;
    if (d.hideFlag && this.save.flags[d.hideFlag]) return false;
    return true;
  }

  applySettings() {
    this.input.setMode(isTouch ? 'drag' : this.save.settings.camMode);
    const gq = this.save.settings.graphics ?? 'high';
    const sv = this.save.settings.sfxVol ?? 0.75;
    setVolumes({ music: this.save.settings.musicVol ?? 0.5, sfx: sv, amb: sv * 0.8 });
    if (this.postfx) this.postfx.enabled = gq !== 'low';
    // Genshin-style grass field + dirt paths (v0.7.8–0.7.9); the "หญ้าแบบใหม่" switch off brings back the old tufts
    const grass = this.save.settings.oldGrass ? 0 : gq === 'low' ? 0.35 : gq === 'medium' ? 0.6 : 1;
    this.world.ground.enabled.value = grass > 0 ? 1 : 0; // dirt paths + livelier greens go with the new grass
    this.grass.setDensity(grass);
    if (this.world.tufts) this.world.tufts.visible = grass === 0;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, gq === 'low' ? 1 : 1.5));
    this.resize();
    this.renderer.shadowMap.enabled = this.save.settings.shadows;
    this.perf.enabled = !!this.save.settings.showFps;
    this.world.sun.castShadow = this.save.settings.shadows;
    this.scene.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.needsUpdate = true; });
  }

  // ================================================================== quest api
  private questApi(): QuestApi {
    return {
      playDialogue: (id) => playDialogue(id),
      runQuizSet: async (id) => {
        const set = data.quizSets.get(id);
        if (!set) return true;
        const r = await runQuiz({
          questions: this.learning.pickFromPool(set.questionPool, set.drawCount),
          title: set.title?.th ?? 'แบบทดสอบ', context: 'เควส', asker: set.asker, passScore: set.passScore,
          learning: this.learning, rewardPerCorrect: 5, onReward: (n) => this.giveItem('INSIGHT_CRYSTAL', n),
          showResult: set.drawCount > 1, onCodex: (c) => this.openCodexAt(c),
        });
        return r.passed;
      },
      runPuzzle: async (id) => {
        if (id === 'PZ_BASE_PAIR') return runBasePairPuzzle();
        if (id === 'PZ_PUNNETT') return runPunnettPuzzle();
        if (id === 'PZ_BEAK') return runBeakPuzzle();
        if (id === 'PZ_TAXONOMY') return runTaxonomyPuzzle();
        if (id === 'PZ_PYRAMID') return runPyramidPuzzle();
        if (id === 'PZ_TISSUE') return runTissuePuzzle();
        if (id === 'PZ_FLOWER') return runFlowerPuzzle();
        if (id === 'PZ_PHOTO') return runPhotoPuzzle();
        if (id === 'PZ_HORMONE') return runHormonePuzzle();
        if (id === 'PZ_DIGEST') return runDigestPuzzle();
        if (id === 'PZ_BREATH') return runBreathPuzzle();
        if (id === 'PZ_GLYCO') return runGlycoPuzzle();
        if (id === 'PZ_KREBS') return runKrebsPuzzle();
        if (id === 'PZ_HEART') return runHeartPuzzle();
        if (id === 'PZ_BLOOD') return runBloodPuzzle();
        if (id === 'PZ_IMMUNE') return runImmunePuzzle();
        if (id === 'PZ_NEPHRON') return runNephronPuzzle();
        if (id === 'PZ_NEURON') return runNeuronPuzzle();
        if (id === 'PZ_SENSE') return runSensePuzzle();
        if (id === 'PZ_MUSCLE') return runMusclePuzzle();
        if (id === 'PZ_ENDOCRINE') return runEndocrinePuzzle();
        if (id === 'PZ_THERMO') return runThermoPuzzle();
        if (id === 'PZ_GLUCOSE') return runGlucosePuzzle();
        if (id === 'PZ_WATER') return runWaterPuzzle();
        if (id === 'PZ_ECO') return runEcoPuzzle();
        if (id === 'PZ_PLANT_EXPERIMENT') {
          const ok = await runPlantExperiment();
          if (ok) lastWateredPlots.forEach((i) => { this.save.flags[`plot_w_${i}`] = true; });
          return ok;
        }
        return true;
      },
      spawnEnemies: (a) => this.spawnFromAction(a),
      clearEnemies: (tag) => {
        this.combat.clearQuestEnemies(tag);
        this.respawnWatch = this.respawnWatch.filter((a) => a.tag !== tag);
      },
      unlockSystem: (id) => this.unlockSystem(id),
      unlockCodex: (id) => this.unlockCodex(id),
      addCharacter: (id) => this.addCharacter(id),
      giveItem: (id, n) => this.giveItem(id, n),
      setFlag: (k, v) => this.setFlag(k, v),
      toast: (t, big) => toast(t, big),
      amoeby: (t) => this.amoebySay(t),
      chapterCard: (top, title) => this.chapterCard(top, title),
      teleport: (loc) => { const l = data.locations.get(loc); if (l) this.fadeTo(new THREE.Vector3(l.x, 0, l.z)); },
      fillEnergy: () => { for (const m of this.player.party) m.energy = m.def.burstCost; },
      questChanged: () => {},
      save: () => this.writeSave(),
    };
  }

  private spawnFromAction(a: QuestAction) {
    const loc = data.locations.get(String(a.locationId));
    if (!loc) return;
    const n = Number(a.count ?? 1);
    const tag = String(a.tag ?? 'Q');
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const r = n === 1 ? 0 : a.enemyId === 'EN_DUMMY' ? 3.5 : 4 + Math.random() * 3;
      const p = new THREE.Vector3(loc.x + Math.cos(ang) * r, 0, loc.z + Math.sin(ang) * r);
      const variants: (Element | null)[] = a.element ? [a.element as Element] : a.enemyId === 'EN_BAC_COCCI' && Number(a.level) >= 3 ? [null, 'HYDRO', 'PYRO'] : [null];
      const e = this.combat.spawn(String(a.enemyId), p, Number(a.level ?? 1), variants[i % variants.length], tag);
      if (e) {
        if (a.aggro) e.aggro = true;
        if (a.enemyId === 'EN_DUMMY') e.yaw = Math.atan2(this.player.pos.x - p.x, this.player.pos.z - p.z);
      }
    }
    if (a.respawn && !this.respawnWatch.includes(a)) this.respawnWatch.push(a);
  }

  // ================================================================== state changes
  giveItem(id: string, n: number) {
    if (id === 'RR_EXP') return this.addRRExp(n);
    this.save.inventory[id] = (this.save.inventory[id] ?? 0) + n;
    bus.emit('ItemCollected', { itemId: id, count: n });
  }

  private addRRExp(n: number) {
    this.save.rrExp += n;
    let need = 375 + this.save.rr * 125;
    while (this.save.rrExp >= need && this.save.rr < 25) {
      this.save.rrExp -= need;
      this.save.rr++;
      toast(`⭐ Research Rank เพิ่มเป็น ${this.save.rr}!`, true);
      sfx.unlock();
      need = 375 + this.save.rr * 125;
    }
  }

  setFlag(k: string, v = true) {
    this.save.flags[k] = v;
    this.syncSites();
    if (k === 'door_open' && v) this.world.openDoor();
    if (k === 'plots_healthy' && v) this.world.setPlotsHealthy(this.savedPlots());
  }

  unlockSystem(id: string) {
    if (!this.save.systems.includes(id)) this.save.systems.push(id);
    if (id === 'GLIDER') this.player.gliderUnlocked = true;
    if (id === 'SCANNER') sideToast('🔍 ปลดล็อก Bio-Scanner (กด T)');
    if (id === 'MAP') sideToast('🗺️ ปลดล็อกแผนที่ (กด M) และจุดซินแนปส์');
  }

  unlockCodex(id: string, silent = false): boolean {
    if (!id || this.save.codex.includes(id) || !data.codex.has(id)) return false;
    this.save.codex.push(id);
    bus.emit('CodexUnlocked', { codexId: id });
    if (!silent) {
      sfx.unlock();
      sideToast(`📖 การ์ดความรู้ใหม่: <b>${data.codex.get(id)!.name.th}</b> (กด K)`);
    }
    return true;
  }

  addCharacter(id: string, silent = false) {
    if (!this.save.unlockedChars.includes(id)) this.save.unlockedChars.push(id);
    const m = this.ensureMember(id);
    // match the traveler's level roughly so the newcomer is useful
    const seeker = this.members.get('SEEKER');
    if (seeker && m.save.level < seeker.level) { m.save.level = seeker.level; m.hp = m.stats().hp; }
    if (this.save.party.length < 4 && !this.save.party.includes(id) && hasKit(id)) {
      this.save.party.push(id);
      this.player.setParty(this.save.party.map((x) => this.members.get(x)!), this.player.activeIndex);
    }
    const def = data.characters.get(id)!;
    if (!silent) toast(`<span style="color:${ELEMENT_COLOR[def.element]}">${def.name.th}</span> เข้าร่วมทีม!`, true);
    bus.emit('CharacterAdded', { charId: id });
    const codex: Record<string, string> = { MITORA: 'CDX_MITOCHONDRIA', ALVI: 'CDX_ALVEOLI', CHLOREN: 'CDX_CHLOROPLAST', HEMA: 'CDX_RBC', NEUROS: 'CDX_NEURON', HELIX: 'CDX_DNA' };
    if (codex[id]) this.unlockCodex(codex[id], silent);
  }

  // ================================================================== Gene Wish
  private unlockGeneWish(gift = true) {
    if (this.save.systems.includes('GENE_WISH')) return;
    this.save.systems.push('GENE_WISH');
    if (gift) this.save.inventory.GENE_SEED = (this.save.inventory.GENE_SEED ?? 0) + 10;
    sideToast('🧬 ปลดล็อก <b>Gene Wish</b> (กด G) · ของขวัญต้อนรับ: เมล็ดพันธุกรรม ×10', 8000);
    setTimeout(() => this.amoebySay('ศาสตราจารย์ไลโซฝากเมล็ดพันธุกรรม 10 เมล็ดมาให้! กด G เพื่อลองสุ่มตัวละครใหม่ที่ตู้ "พรของนักเรียนใหม่" ดูสิ', 9000), 1500);
  }

  private wishHost(): WishHost {
    return {
      save: this.save,
      applyResults: (res) => this.applyWishResults(res),
      probabilityQuiz: async () => {
        const set = data.quizSets.get('QZ_PROBABILITY')!;
        await runQuiz({
          questions: this.learning.pickFromPool(set.questionPool, set.drawCount), title: set.title!.th, context: '🎲 Gene Wish',
          asker: 'AMOEBY', passScore: set.passScore, learning: this.learning, rewardPerCorrect: 5,
          onReward: (n) => this.giveItem('INSIGHT_CRYSTAL', n), onCodex: (c) => this.openCodexAt(c),
        });
        this.unlockCodex('CDX_PROBABILITY');
      },
      buyCharacter: (id) => { this.addCharacter(id); sfx.unlock(); },
      persist: () => this.writeSave(),
    };
  }

  private applyWishResults(res: PullResult[]): ResultInfo[] {
    return res.map((r) => {
      if (r.kind === 'item') {
        this.giveItem(r.id, r.count);
        return { isNew: false, cons: 0, starglitter: 0 };
      }
      if (r.kind === 'weapon') {
        const isNew = !this.save.gear.weapons.some((w) => w.id === r.id);
        this.createWeapon(r.id);
        return { isNew, cons: 0, starglitter: r.rarity === 4 ? 2 : 0 };
      }
      if (!this.save.unlockedChars.includes(r.id)) {
        this.addCharacter(r.id, true);
        return { isNew: true, cons: 0, starglitter: 0 };
      }
      const m = this.ensureMember(r.id);
      const cur = m.save.geneSeq ?? 0;
      if (cur < 6) {
        m.save.geneSeq = cur + 1;
        const g = r.rarity === 5 ? 10 : 2;
        this.giveItem('STARGLITTER', g);
        return { isNew: false, cons: cur + 1, starglitter: g };
      }
      const g = r.rarity === 5 ? 25 : 5;
      this.giveItem('STARGLITTER', g);
      return { isNew: false, cons: 6, starglitter: g };
    });
  }

  private openWishScreen() {
    if (!this.save.systems.includes('GENE_WISH')) { toast('Gene Wish จะปลดล็อกเมื่อจบบทนำ'); return; }
    openWish(this.wishHost());
  }

  amoebySay(text: string, ms = 5500) { this.hud?.amoebySay(text, ms); this.player?.companionCue(ms / 1000 + 3); }
  private amoebyOnceSet = new Set<string>();
  private amoebyOnce(key: string, text: string) {
    if (this.save.flags[`amo_${key}`] || this.amoebyOnceSet.has(key)) return;
    this.amoebyOnceSet.add(key);
    this.save.flags[`amo_${key}`] = true;
    this.amoebySay(text, 7000);
  }

  private chapterCard(top: string, title: string): Promise<void> {
    return new Promise((resolve) => {
      const root = h(`<div class="chapter-card" style="background:linear-gradient(rgba(4,6,14,.55),rgba(4,6,14,.85)),url(assets/environment/ENV_Cytoria_CellariaCity.jpg) center/cover"><div class="c1">${top}</div><div class="c2">${title}</div><div style="opacity:.7;margin-top:10px">${CHAPTER_SUBTITLE[top] ?? ''}</div><button class="btn" style="margin-top:20px">ดำเนินการต่อ</button></div>`);
      const close = openModal(root);
      sfx.unlock();
      (root.querySelector('button') as HTMLButtonElement).onclick = () => { close(); resolve(); };
    });
  }

  // ================================================================== combat hooks
  private onReaction(r: ReactionId) {
    if (this.save.seenReactions.includes(r)) return;
    this.save.seenReactions.push(r);
    const info = REACTION_INFO[r];
    this.unlockCodex(info.codex);
    toast(`${reactionIcon(info.codex, 40)} ค้นพบปฏิกิริยาใหม่: <span style="color:${info.color}">${info.th}</span>`, true, 2600);
    this.pendingReactionQuiz.push(r);
  }

  private onEnemyKilled(e: Enemy) {
    if (e.def.kind === 'tumor') return;
    const drop = e.def.kind === 'caster' ? 'MAT_SPORE_CAP' : e.isVirus ? 'MAT_PHAGE_WING' : e.isBacteria ? 'MAT_BAC_SLIME' : e.def.kind === 'trooper' ? 'MAT_BLIGHT_CLOTH' : e.def.kind === 'machine' ? 'MAT_SYN_GEAR' : null;
    if (drop && Math.random() < (e.isBoss ? 1 : 0.55)) {
      const n = e.isBoss ? 5 : 1;
      this.giveItem(drop, n);
      sideToast(`${data.items.get(drop)!.glyph} ${data.items.get(drop)!.name.th} ×${n}`, 2000);
    }
    if (e.isBoss) {
      this.giveItem('MAT_CALCITE', 3);
      this.giveItem('GLUCOSE', 3000);
      this.giveItem('GROWTH_FACTOR', 3);
      const wb = WORLD_BOSSES.find((w) => w.tag === e.questTag);
      for (let i = 0; i < (wb ? 2 : 1); i++) this.grantRelic(this.relicRarity(2));
      if (e.def.kind === 'boss_virus') this.giveItem('MAT_STORM_PEARL', wb ? 2 : 1);
      if (e.def.kind === 'boss_chimera') { this.giveItem('MAT_CHIMERA_SCALE', wb ? 2 : 1); this.giveItem('MAT_ICE_HELIX', 2); }
      if (e.def.kind === 'boss_superbug') { this.giveItem('MAT_BAC_SLIME', wb ? 8 : 5); this.giveItem('GROWTH_FACTOR', 2); }
      if (e.def.kind === 'boss_medusa') { this.giveItem('MAT_SYN_GEAR', wb ? 6 : 4); this.giveItem('GROWTH_FACTOR', 2); }
      if (e.def.kind === 'boss_herald') { this.giveItem('MAT_GOLEM_CORE', wb ? 2 : 1); this.giveItem('MAT_STORM_PEARL', 2); this.giveItem('GROWTH_FACTOR', 3); }
      if (e.def.kind === 'boss_cyano') { this.giveItem('MAT_SYN_GEAR', wb ? 6 : 4); this.giveItem('GROWTH_FACTOR', 2); }
      if (e.def.kind === 'boss_spore') { this.giveItem('MAT_SPORE_CAP', wb ? 6 : 4); this.giveItem('GROWTH_FACTOR', 2); }
      if (e.def.kind === 'boss_golem') { this.giveItem('MAT_GOLEM_CORE', wb ? 2 : 1); this.giveItem('ORE_PHOSPHATE', 2); }
      if (wb) { this.worldBossKilledAt.set(wb.tag, this.gameTime); this.giveItem('ORE_PHOSPHATE', 2); }
    } else if (e.def.kind !== 'dummy' && Math.random() < 0.08) this.giveItem('ORE_CALCIUM', 1);
    else if (e.def.kind !== 'dummy') this.giveItem('GLUCOSE', 40 + e.level * 10);
    if (!e.questTag) this.addRRExp(5);
    if (e.isBoss) this.unlockCodex(e.def.codexId); // regular enemies are learned by scanning (T)
  }

  private async onBossShield(e: Enemy) {
    if (this.bossShieldOpen) return;
    this.bossShieldOpen = true;
    await new Promise((r) => setTimeout(r, 500));
    const b = e.def.boss!;
    const set = data.quizSets.get(b.quizSetIds?.[e.shieldsDone - 1] ?? b.quizSetId)!;
    const res = await runQuiz({
      questions: this.learning.pickFromPool(set.questionPool, 1), title: set.title?.th ?? '', context: '🔮 โล่ความรู้', asker: set.asker,
      learning: this.learning, rewardPerCorrect: 10, onReward: (n) => this.giveItem('INSIGHT_CRYSTAL', n), showResult: false,
    });
    e.shieldActive = false;
    e.setShieldVisual(false);
    if (res.score > 0) {
      e.exposedT = 10;
      toast('✨ โล่แตก! ศัตรูเปิดจุดอ่อน ดาเมจ +30% เป็นเวลา 10 วินาที', true);
      this.combat.addEffect(new Blast(e.center(new THREE.Vector3()), 5, '#d7a5ff', 0.5));
    } else {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.05);
      toast(`โล่แตก แต่${e.def.name.th}ฟื้นพลังเล็กน้อย...`);
    }
    this.bossShieldOpen = false;
  }

  private async runReactionQuiz(r: ReactionId) {
    const q = data.questions.get(REACTION_QUESTION[r]);
    if (!q) return;
    await runQuiz({
      questions: [q], title: REACTION_INFO[r].th, context: '✨ ปฏิกิริยาใหม่', asker: 'AMOEBY', learning: this.learning,
      rewardPerCorrect: 10, onReward: (n) => { this.giveItem('INSIGHT_CRYSTAL', n); sideToast(`💎 ผลึกปัญญา ×${n}`); }, showResult: false,
      onCodex: (c) => this.openCodexAt(c),
    });
  }

  // ================================================================== menus host
  private menuHost(): MenuHost {
    return {
      save: this.save,
      learning: this.learning,
      quests: this.quests,
      member: (id) => (this.save.unlockedChars.includes(id) ? this.ensureMember(id) : null),
      partyIds: () => this.player.party.map((p) => p.id),
      setParty: (ids) => {
        const activeId = this.player.active.id;
        this.save.party = ids;
        const idx = Math.max(0, ids.indexOf(activeId));
        this.player.setParty(ids.map((x) => this.ensureMember(x)), idx);
      },
      useExp: (id, item) => this.useExp(id, item),
      ascend: (id) => this.ascend(id),
      ascendCost: () => ({ glucose: 5000, mats: [{ id: 'MAT_BAC_SLIME', n: 3 }, { id: 'MAT_CALCITE', n: 1 }] }),
      teleport: (wp) => this.teleportTo(wp),
      mapImage: this.mapImage!,
      genoviaMap: this.genoviaMap ??= HUD.buildGenoviaMap(512),
      zepheriaMap: this.zepheriaMap ??= HUD.buildZepheriaMap(512),
      florantisMap: this.florantisMap ??= HUD.buildFlorantisMap(512),
      metabolisMap: this.metabolisMap ??= HUD.buildMetabolisMap(512),
      aquorraMap: this.aquorraMap ??= HUD.buildAquorraMap(512),
      neurionMap: this.neurionMap ??= HUD.buildRegionMap(512, 'neu'),
      rootsMap: this.rootsMap ??= HUD.buildRegionMap(512, 'arb'),
      playerXZ: () => ({ x: this.player.pos.x, z: this.player.pos.z }),
      dailyReview: () => this.dailyReview(),
      saveNow: () => this.writeSave(),
      quitToTitle: () => { this.writeSave(); this.running = false; this.combat.dispose(); this.wui.clear(); location.reload(); },
      loadImported: (imp) => {
        // stop autosaving the current game first, or the reload's save-on-exit would overwrite the import
        this.running = false;
        this.inTitle = true;
        if (!importSave(imp)) { toast('บันทึกไม่สำเร็จ (พื้นที่เบราว์เซอร์เต็ม?)'); return; }
        location.reload();
      },
      settingsChanged: () => this.applySettings(),
    };
  }

  private openCodexAt(id?: string) {
    openCodex(this.menuHost(), id, (topic) => this.topicQuiz(topic));
  }

  private async topicQuiz(topic: string) {
    const qs = this.learning.pickByTopic(topic, 3);
    if (!qs.length) { toast('ยังไม่มีคำถามในหัวข้อนี้'); return; }
    await runQuiz({ questions: qs, title: 'ทดสอบความรู้', context: '📖 Bio-Pedia', asker: 'AMOEBY', learning: this.learning, rewardPerCorrect: 2, onReward: (n) => this.giveItem('INSIGHT_CRYSTAL', n) });
  }

  private useExp(id: string, item: string) {
    const m = this.ensureMember(id);
    if ((this.save.inventory[item] ?? 0) <= 0) return;
    const cap = levelCap(m.save.ascension);
    if (m.level >= cap) return;
    this.save.inventory[item]--;
    m.save.exp += item === 'EXP_DI' ? 5000 : 1000;
    const before = m.level;
    while (m.level < cap && m.save.exp >= expToNext(m.level)) {
      m.save.exp -= expToNext(m.level);
      m.save.level++;
    }
    if (m.level >= cap) m.save.exp = Math.min(m.save.exp, expToNext(m.level));
    if (m.level > before) {
      m.hp = m.stats().hp * Math.max(0.01, m.hp / m.stats().hp);
      m.hp = Math.min(m.stats().hp, m.hp + m.stats().hp * 0.1);
      sfx.unlock();
      toast(`${m.def.name.th} เลเวลเพิ่มเป็น ${m.level}!`);
    } else sfx.ui();
  }

  private async ascend(id: string) {
    const m = this.ensureMember(id);
    const inv = this.save.inventory;
    if ((inv.GLUCOSE ?? 0) < 5000 || (inv.MAT_BAC_SLIME ?? 0) < 3 || (inv.MAT_CALCITE ?? 0) < 1) {
      toast('วัตถุดิบไม่พอ — ปราบแบคทีเรียเพื่อเก็บเมือก และปราบบอสเพื่อรับผลึกแคลไซต์');
      return;
    }
    const prefix = m.def.topic.split('.').slice(0, 2).join('.');
    const qs = this.learning.pickByTopic(m.def.topic, 3);
    const pool = qs.length >= 3 ? qs : this.learning.pickByTopic(prefix, 3);
    const res = await runQuiz({ questions: pool, title: `${m.def.name.th} · บททดสอบเซลล์`, context: '🧬 การพัฒนาเซลล์', asker: id, passScore: 2, learning: this.learning });
    if (!res.passed) return;
    inv.GLUCOSE -= 5000; inv.MAT_BAC_SLIME -= 3; inv.MAT_CALCITE -= 1;
    m.save.ascension = 1;
    sfx.unlock();
    toast(`🧬 ${m.def.name.th} พัฒนาเซลล์สำเร็จ! เลเวลสูงสุด ${levelCap(1)} · ปลด Passive`, true);
    this.writeSave();
  }

  private async dailyReview() {
    if (!this.learning.canDailyReview()) { toast('วันนี้ทบทวนไปแล้ว พรุ่งนี้มาใหม่นะ! (การทบทวนแบบเว้นระยะช่วยให้จำได้นาน)'); return; }
    const qs = this.learning.pickDaily(5);
    if (!qs.length) return;
    const r = await runQuiz({ questions: qs, title: 'ศาสตราจารย์ไลโซขอให้ช่วยตรวจรายงาน', context: '🧠 ทบทวนประจำวัน', asker: 'LYSO', learning: this.learning, rewardPerCorrect: 6, onReward: (n) => this.giveItem('INSIGHT_CRYSTAL', n) });
    this.save.lastDailyReview = todayStr();
    this.giveItem('GROWTH_FACTOR', 2);
    this.giveItem('ORE_CALCIUM', 2);
    if (r.score === r.total) { this.giveItem('INSIGHT_CRYSTAL', 20); toast('ตอบถูกครบ! โบนัส 💎 ×20', true); }
    this.addRRExp(150);
    this.writeSave();
  }

  private domainHost(): DomainMenuHost {
    return { save: this.save, learning: this.learning, controller: this.domain, persist: () => this.writeSave(), rewardIcon: () => '' };
  }

  /** Fade to black, move the player, fade back. */
  fadeTo(to: THREE.Vector3, after?: () => void) {
    const fade = h('<div class="fade" style="opacity:0"></div>');
    document.getElementById('hud')!.appendChild(fade);
    requestAnimationFrame(() => (fade.style.opacity = '1'));
    setTimeout(() => {
      this.player.teleport(to);
      after?.();
      fade.style.opacity = '0';
      setTimeout(() => fade.remove(), 700);
    }, 600);
  }

  private teleportTo(wp: string) {
    if (this.domain?.active) { this.domain.fail('ออกจากห้องแล็บ'); this.domain.run = null; this.world.domainExit.visible = false; }
    const w = this.world.waypoints.get(wp);
    if (!w) return;
    const fade = h('<div class="fade" style="opacity:0"></div>');
    document.getElementById('hud')!.appendChild(fade);
    requestAnimationFrame(() => (fade.style.opacity = '1'));
    setTimeout(() => {
      for (const m of this.player.party) if (!m.alive) m.hp = m.stats().hp * 0.3; // synapse nodes revive fallen members
      this.player.teleport(w.pos.clone().add(new THREE.Vector3(2, 0, 2)));
      fade.style.opacity = '0';
      setTimeout(() => fade.remove(), 700);
    }, 600);
  }

  writeSave() {
    if (!this.save || this.inTitle) return;
    for (const m of this.members.values()) m.persist();
    this.save.party = this.player.party.map((p) => p.id);
    this.save.activeIndex = this.player.activeIndex;
    this.save.position = [this.player.pos.x, this.player.pos.y, this.player.pos.z];
    writeSave(this.save);
  }

  // ================================================================== main loop
  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    if (this.inTitle || !this.running) {
      this.titleT += dt * 0.05;
      const c = new THREE.Vector3(Math.sin(this.titleT) * 60, 0, Math.cos(this.titleT) * 60 - 20);
      c.y = this.world.h(c.x, c.z) + 22;
      this.camera.position.copy(c);
      this.camera.lookAt(0, 6, -40);
      this.world.setTimeOfDay(8.5, new THREE.Vector3(0, 0, -20));
      this.world.update(dt);
      this.perf.begin();
      this.postfx ? this.postfx.render(this.scene, this.camera) : this.renderer.render(this.scene, this.camera);
      return;
    }
    const paused = isModalOpen();
    this.fx.update(paused ? 0 : dt);
    let simDt = dt;
    if (this.hitStopT > 0) { this.hitStopT -= dt; simDt = dt * 0.06; }
    if (!paused) this.tick(simDt);
    this.perf.begin();
    this.postfx ? this.postfx.render(this.scene, this.camera) : this.renderer.render(this.scene, this.camera);
    this.perf.end(dt);
    this.input.endFrame();
  };

  /** Debug helper: advance the simulation manually (used for automated testing when the tab is hidden). */
  debugStep(frames = 1, dt = 1 / 30) {
    for (let i = 0; i < frames; i++) {
      if (!isModalOpen() && this.running) { this.tick(dt); this.fx.update(dt); }
      this.input.endFrame();
    }
    this.postfx ? this.postfx.render(this.scene, this.camera) : this.renderer.render(this.scene, this.camera);
  }

  private tick(dt: number) {
    const s = this.save;
    this.gameTime += dt;
    s.stats.playSeconds += dt;
    s.timeOfDay = (s.timeOfDay + dt / 60) % 24; // 1 in-game hour per real minute
    const inp = this.input;

    this.handleShortcuts();
    if (this.scanning) this.updateScanner(dt);

    this.player.canControl = !this.scanning;
    this.player.companionInCombat = this.inCombat();
    if (this.quests.isBusy || document.querySelector('.dialogue-root')) this.player.companionCue(4); // she joins every conversation
    this.player.update(dt, inp, this.camera, s.settings.mouseSens);
    if (this.scanning) this.player.updateCamera(dt, this.camera, true);
    this.combat.playerPos.copy(this.player.pos);
    tickKits(dt);
    GE.tickGear(dt);
    GE.gearFrame(this.player.party, this.combat.shield.hp > 0);
    this.updateWorldBoss();
    this.domain.update(dt);
    this.combat.update(dt);
    this.world.setTimeOfDay(s.timeOfDay, this.player.pos);
    this.postfx?.setWarm(this.world.duskK * 1.5);
    this.world.update(dt, this.player.pos);
    WIND.time.value += dt;
    this.grass.update(this.player.pos);
    this.contact?.update(this.player.pos, this.world.groundH(this.player.pos.x, this.player.pos.z), !this.scanning);
    const sunUp = Math.sin(((s.timeOfDay - 6) / 24) * Math.PI * 2);
    this.updateAudio(dt, THREE.MathUtils.smoothstep(sunUp, -0.15, 0.25));
    this.ambient.update(dt, this.player.pos, THREE.MathUtils.smoothstep(sunUp, -0.15, 0.25), !inCity(this.player.pos.x, this.player.pos.z) && !inGenovia(this.player.pos.x, this.player.pos.z) && !inMetabolis(this.player.pos.x, this.player.pos.z) && !inNeurion(this.player.pos.x, this.player.pos.z) && !this.domain.active, this.player.moveSpeed);

    // walking out through the south gate of Cellaria leaves the city
    if (inCity(this.player.pos.x, this.player.pos.z) && Math.hypot(this.player.pos.x - CITY.x, this.player.pos.z - CITY.z) > CITY_RADIUS + 6 && !this.leavingCity) {
      this.leavingCity = true;
      this.leaveCity();
      setTimeout(() => { this.leavingCity = false; }, 1500);
    }
    // falling into the sea of clouds: back to the last safe ground
    if (this.player.onGround && this.player.pos.y > -20) this.lastSafe.copy(this.player.pos);
    if (this.player.pos.y < -32 && !this.leavingCity) {
      this.leavingCity = true;
      this.fadeTo(this.lastSafe.clone(), () => { this.player.velY = 0; sideToast('🌬️ สายลมพาเธอกลับขึ้นมาบนเกาะ'); });
      setTimeout(() => { this.leavingCity = false; }, 1500);
    }
    this.updateNpcs(dt);
    this.updateWorldPickups();
    this.updateInteractions();
    this.quests.checkAreas(this.player.pos.x, this.player.pos.z);
    this.updateRespawnWatch();
    this.updateCamps();
    this.checkDeath();

    // gentle out-of-combat regeneration (student-friendly; Genshin has none)
    if (!this.inCombat()) {
      this.calmT += dt;
      if (this.calmT > 5) for (const m of this.player.party) if (m.alive) m.hp = Math.min(m.stats().hp, m.hp + m.stats().hp * 0.01 * dt);
    } else this.calmT = 0;

    // first-time hint: level up with EXP items
    if (!s.flags.hint_levelup && (s.inventory.EXP_MONO ?? 0) > 0 && !isModalOpen() && !this.quests.isBusy) {
      s.flags.hint_levelup = true;
      this.amoebySay('ได้ "น้ำตาลโมเลกุลเดี่ยว" แล้ว! กด C แล้วใช้มันเพิ่มเลเวลตัวละครได้นะ', 8000);
    }

    // first time Alvi is out with skills unlocked: teach the hold-E wind lift
    if (!s.flags.hint_alvi_lift && this.player.active.id === 'ALVI' && s.systems.includes('ELEMENT') && !isModalOpen() && !this.quests.isBusy) {
      s.flags.hint_alvi_lift = true;
      this.amoebySay('อัลวีหายใจลึก ๆ ได้นะ! กด E ค้างไว้ ลมจะยกตัวลอยขึ้นสูง แล้วค่อย ๆ ร่อนลงมา ใช้ข้ามหน้าผาหรือมองหาทางได้เลย', 9000);
    }

    // out-of-combat reaction quiz
    if (this.pendingReactionQuiz.length && !this.inCombat() && !this.quests.isBusy && !this.bossShieldOpen) {
      const r = this.pendingReactionQuiz.shift()!;
      this.runReactionQuiz(r);
    }

    // autosave + healthy-play reminder
    this.autosaveT += dt;
    if (this.autosaveT > 60) { this.autosaveT = 0; this.writeSave(); }
    this.playReminderT += dt;
    if (s.settings.playReminderMin > 0 && this.playReminderT > s.settings.playReminderMin * 60) {
      this.playReminderT = 0;
      this.amoebySay('เล่นมาครบ 1 ชั่วโมงแล้ว! พักสายตาสัก 5 นาทีนะ มองไกล ๆ แล้วดื่มน้ำด้วย 💧', 9000);
    }

    this.updateHud(dt);
    this.wui.update(dt, this.combat.enemies, this.player.pos);
    const targets = this.quests.targets().map((t0) => {
      const t = this.routeTarget(t0);
      const y = this.world.h(t.x, t.z) + 2.5;
      const pos = new THREE.Vector3(t.x, y, t.z);
      return { pos, label: t.label, dist: pos.distanceTo(this.player.pos) };
    }).filter((t) => t.dist > 6 && !this.domain.active);
    this.wui.setMarkers(targets);
    const first = targets[0];
    this.guide.update(dt, this.player.pos, first ? new THREE.Vector3(first.pos.x, 0, first.pos.z) : null, (x, z) => this.world.groundH(x, z), this.scene);
  }

  private openMenu() {
    const host = () => this.menuHost();
    openEscMenu(host(), {
      codex: () => this.openCodexAt(), quests: () => openQuestLog(host()), chars: () => openCharacters(host()),
      map: () => openMap(host()), help: () => openHelp(), progress: () => openProgress(host()), wish: () => this.openWishScreen(),
    });
  }

  /** Story bosses return as repeatable world bosses (Bio-Relic source) once their quest is done. */
  private updateWorldBoss() {
    for (const wb of WORLD_BOSSES) {
      if (this.save.quests[wb.quest]?.state !== 'COMPLETED') continue;
      const arena = data.locations.get(wb.loc)!;
      const d = Math.hypot(arena.x - this.player.pos.x, arena.z - this.player.pos.z);
      const alive = this.combat.enemies.some((e) => e.alive && e.questTag === wb.tag);
      const killedAt = this.worldBossKilledAt.get(wb.tag) ?? -9999;
      if (!alive && d < 45 && this.gameTime - killedAt > 300 && !this.quests.isBusy) {
        const e = this.combat.spawn(wb.enemy, new THREE.Vector3(arena.x, 0, arena.z), wb.level, null, wb.tag);
        if (e) {
          this.worldBossKilledAt.set(wb.tag, Infinity); // block respawn until killed
          this.amoebyOnce(`wb_${wb.tag}`, wb.hint);
        }
      }
      if (alive && d > 90) {
        for (const e of this.combat.enemies) if (e.questTag === wb.tag) { e.alive = false; e.deadT = 0.39; }
        this.worldBossKilledAt.set(wb.tag, this.gameTime - 300); // can respawn when the player comes back
      }
    }
  }

  private stepAcc = 0.6;
  private audioV = new THREE.Vector3();
  /**
   * Per-frame audio: listener follows the camera; music follows the area (title / meadow day-night / city /
   * Genovia / Zepheria / domain) and switches to battle or boss music while fighting; synthesized ambience
   * (wind, birds, crickets, lake water, town murmur); footsteps by surface, paced by running speed.
   */
  private updateAudio(dt: number, daylight: number) {
    const p = this.player.pos;
    this.audioV.setFromMatrixColumn(this.camera.matrixWorld, 0);
    setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, this.audioV.x, this.audioV.z);
    const city = inCity(p.x, p.z), gen = inGenovia(p.x, p.z), zep = inZepheria(p.x, p.z), flo = inFlorantis(p.x, p.z), met = inMetabolis(p.x, p.z), aqu = inAquorra(p.x, p.z), neu = inNeurion(p.x, p.z), arb = inRoots(p.x, p.z), dom = !!this.domain.active;
    const scene: MusicScene = dom ? 'domain' : city ? 'city' : gen ? 'genovia' : zep ? 'zepheria' : flo ? 'florantis' : met ? 'metabolis' : aqu ? 'aquorra' : neu ? 'neurion' : arb ? 'roots' : 'field';
    music.setScene(scene, daylight > 0.4);
    const boss = this.combat.enemies.some((e) => e.alive && e.aggro && e.isBoss && e.pos.distanceTo(p) < 30);
    music.setCombat(boss ? 2 : this.inCombat() ? 1 : 0, dt);
    const lake = Math.hypot(p.x - LAKE.x, p.z - LAKE.z) - LAKE.r;
    ambience.update(dt, {
      wind: zep ? 1 : city || gen || met ? 0.2 : flo ? 0.3 : 0.45,
      water: scene === 'field' ? THREE.MathUtils.clamp(1 - lake / 25, 0, 1) : 0,
      day: daylight, city: city || gen || met || aqu || neu, indoor: dom,
    });
    // footsteps
    const pl = this.player;
    if (pl.onGround && !pl.gliding && pl.moveSpeed > 0.05) {
      this.stepAcc += dt * (1.6 + pl.moveSpeed * 1.5);
      if (this.stepAcc >= 1) {
        this.stepAcc -= 1;
        const surface: Surface = city || gen || met || aqu || neu || dom ? 'stone' : p.y > 38 ? 'snow' : this.world.ground.dirtAt(p.x, p.z) > 0.4 ? 'dirt' : 'grass';
        sfx.step(surface, 0.16 + 0.12 * Math.min(1, pl.moveSpeed));
      }
    } else this.stepAcc = 0.6;
  }

  private inCombat() {
    return this.combat.enemies.some((e) => e.alive && e.aggro && e.def.kind !== 'dummy' && e.pos.distanceTo(this.player.pos) < 18);
  }

  private handleShortcuts() {
    const inp = this.input;
    const host = () => this.menuHost();
    if (inp.pressed('Escape')) {
      if (this.scanning) { this.scanning = false; return; }
      this.openMenu();
      return;
    }
    if (inp.pressed('KeyJ')) openQuestLog(host());
    if (inp.pressed('KeyK')) this.openCodexAt();
    if (inp.pressed('KeyC')) openCharacters(host());
    if (inp.pressed('KeyH')) openHelp();
    if (inp.pressed('KeyM')) {
      if (this.save.systems.includes('MAP')) openMap(host()); else toast('แผนที่ยังไม่ปลดล็อก');
    }
    if (inp.pressed('KeyT')) {
      if (!this.save.systems.includes('SCANNER')) toast('ยังไม่มี Bio-Scanner');
      else { this.scanning = !this.scanning; this.scanProgress = 0; this.scanTarget = null; }
    }
    if (inp.pressed('KeyZ')) this.useAntibiotic();
    if (inp.pressed('KeyG')) this.openWishScreen();
    if (inp.pressed('KeyB')) openInventory(this.menuHost());
    if (inp.pressed('KeyF') && this.interactList.length) this.interactList[0].act();
    // E/Q locked until the element is learned
    if (!this.save.systems.includes('ELEMENT')) {
      for (const m of this.player.party) { m.cdE = Math.max(m.cdE, 0.2); m.cdQ = Math.max(m.cdQ, 0.2); }
      if (inp.pressed('KeyE') || inp.pressed('KeyQ')) toast('แกนชีวิตยังว่างเปล่า... ไปหารูปปั้นต้นไม้แห่งชีวิตก่อน');
    }
  }

  // ------------------------------------------------------------------ scanner
  private scannables(): Scannable[] {
    const list: Scannable[] = this.world.scannables.filter((s) => !s.alive || s.alive());
    for (const e of this.combat.enemies) {
      if (!e.alive || !e.def.codexId) continue;
      list.push({ id: `EN_${e.uid}`, codexId: e.def.codexId, tags: e.def.tags, obj: e.root, radius: e.radius + 0.4, label: e.def.name.th });
    }
    for (const r of this.combat.remains) list.push({ id: `REM_${r.obj.id}`, codexId: 'CDX_BACTERIA_BASIC', tags: r.tags, obj: r.obj, radius: 1.2, label: 'ซากแบคทีเรีย' });
    for (const n of this.npcs) if (n.visible && n.id === 'NPC_MITORA') list.push({ id: n.id, codexId: 'CDX_MITOCHONDRIA', tags: ['npc'], obj: n.root, radius: 1, label: 'ไมโทร่า' });
    return list;
  }

  private updateScanner(dt: number) {
    const origin = this.camera.position.clone();
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    let best: Scannable | null = null, bestD = 40;
    const c = new THREE.Vector3();
    for (const s of this.scannables()) {
      s.obj.getWorldPosition(c);
      if (s.obj === this.combat.enemies.find((e) => e.root === s.obj)?.root) c.y += 0.6;
      const to = c.clone().sub(origin);
      const along = to.dot(dir);
      if (along < 0 || along > 40) continue;
      const perp = to.clone().sub(dir.clone().multiplyScalar(along)).length();
      if (perp < s.radius + along * 0.03 && along < bestD) { bestD = along; best = s; }
    }
    if (!best) { this.scanTarget = null; this.scanProgress = 0; return; }
    const known = this.save.codex.includes(best.codexId) && !this.questNeedsScan(best);
    if (this.scanTarget?.id !== best.id) { this.scanProgress = 0; this.scanTarget = { id: best.id, label: best.label, codexId: best.codexId, tags: best.tags, known }; }
    if (this.scanProgress < 1) {
      this.scanProgress += dt / (known ? 0.4 : 1.0);
      if (Math.floor(this.scanProgress * 10) !== Math.floor((this.scanProgress - dt) * 10)) sfx.scan();
      if (this.scanProgress >= 1 && !best.codexId) {
        // a landmark with no codex entry (e.g. the academy airship): tell the player it is not what the quest wants
        sideToast(`🔍 ${best.label}: ไม่ใช่ออร์แกเนลล์ ไม่นับในภารกิจสแกน`, 2500);
        this.scanTarget.known = true;
      } else if (this.scanProgress >= 1) {
        const isNew = this.unlockCodex(best.codexId);
        bus.emit('Scanned', { targetId: best.id, tags: best.tags });
        if (isNew) { this.giveItem('INSIGHT_CRYSTAL', 5); this.addRRExp(50); }
        else sideToast(`🔍 ${best.label} (บันทึกแล้ว)`, 1500);
        this.scanTarget.known = true;
      }
    }
  }

  private questNeedsScan(s: Scannable): boolean {
    return this.quests.activeQuests().some((q) => {
      const info = this.quests.stepInfo(q.id);
      const seen = this.save.quests[q.id]?.seen ?? [];
      return info?.step.objectives.some((o, i) => o.type === 'SCAN' && (info.progress[i] ?? 0) < (o.count ?? 1) && !seen.includes(`${i}:${s.id}`) && (o.targetId === s.id || (!!o.targetTag && s.tags.includes(o.targetTag))));
    });
  }

  // ------------------------------------------------------------------ antibiotic
  private useAntibiotic() {
    if ((this.save.inventory.ANTIBIOTIC ?? 0) <= 0) { if (this.save.flags.got_antibiotic) toast('ยาปฏิชีวนะหมดแล้ว'); return; }
    this.save.flags.got_antibiotic = true;
    const fwd = this.player.forward();
    const target = this.combat.nearestEnemy(this.player.pos, 12);
    const at = target ? target.pos.clone() : this.player.pos.clone().addScaledVector(fwd, 6);
    at.y = this.world.h(at.x, at.z) + 0.5;
    this.save.inventory.ANTIBIOTIC--;
    this.combat.addEffect(new Blast(at, 3.2, '#7fe0d0', 0.5));
    sfx.skill();
    let hitVirus = false;
    for (const e of this.combat.enemiesInRadius(at, 3.2)) {
      if (e.isBacteria) {
        const dmg = Math.round(e.maxHp * (e.isBoss ? 0.06 : 0.45));
        e.hp -= dmg;
        this.wui.damage(e.topPoint(new THREE.Vector3()), `${dmg} 🧪`, '#7fe0d0', 'crit');
        if (e.hp <= 0) this.combat.kill(e);
      } else if (e.isVirus) {
        hitVirus = true;
        this.wui.damage(e.topPoint(new THREE.Vector3()), 'ไม่มีผล!', '#cccccc', 'info');
      }
    }
    this.unlockCodex('CDX_ANTIBIOTIC');
    if (hitVirus && !this.firstVirusAntibiotic) {
      this.firstVirusAntibiotic = true;
      this.amoebySay('ไม่ได้ผลกับไวรัส! ยาปฏิชีวนะออกฤทธิ์กับโครงสร้างของแบคทีเรีย เช่น ผนังเซลล์ ซึ่งไวรัสไม่มี!', 8000);
    }
  }

  // ------------------------------------------------------------------ NPCs & interactions
  private updateNpcs(dt: number) {
    const objectives = this.quests.npcsWithObjectives();
    for (const n of this.npcs) {
      const vis = this.npcVisible(n.id);
      n.visible = vis;
      n.root.visible = vis;
      const def = data.npcs.get(n.id)!;
      if (!vis) { this.wui.npcTag(n.id, null, '', '', false); continue; }
      const d = n.pos.distanceTo(this.player.pos);
      if (d < 25) {
        const to = this.player.pos.clone().sub(n.pos);
        n.root.rotation.y = Math.atan2(to.x, to.z);
      }
      n.model?.update(dt, { speed: 0, air: false, glide: false, attackT: -1, attackKind: 'normal', dashing: false });
      const tagPos = d < 35 ? n.pos.clone().setY(n.pos.y + 2.25) : null;
      this.wui.npcTag(n.id, tagPos, def.name.th, def.title?.th ?? '', objectives.has(n.id));
      // simple collision
      const dx = this.player.pos.x - n.pos.x, dz = this.player.pos.z - n.pos.z, dd = Math.hypot(dx, dz);
      if (dd < 0.8 && dd > 0.01) { this.player.pos.x = n.pos.x + (dx / dd) * 0.8; this.player.pos.z = n.pos.z + (dz / dd) * 0.8; }
    }
  }

  private libraryOpened = false;
  private floSynced = false;
  private metSynced = false;
  private aquSynced = false;
  private neuSynced = false;
  private arbSynced = false;

  /** Chapter 1 sites follow quest flags. */
  private syncSites() {
    const f = this.save.flags, s = this.world.sites;
    s.setEnzymeFixed(!!f.enzyme_fixed);
    s.setLakeState(!!f.salt_dumped, [!!f.salt_1, !!f.salt_2, !!f.salt_3], !!f.lake_fixed);
    s.setSpireCalm(!!f.spire_calm);
    this.world.zepheria.setFadeRestored(!!f.zep_restored);
    this.world.florantis.setRestored(!!f.flo_restored, !this.floSynced);
    this.floSynced = true;
    this.world.metabolis.setRestored(!!f.met_restored, !this.metSynced);
    this.metSynced = true;
    this.world.aquorra.setCured(!!f.aqu_cured, !this.aquSynced);
    this.aquSynced = true;
    this.world.neurion.setFreed(!!f.neu_freed, !this.neuSynced);
    this.neuSynced = true;
    this.world.roots.setHealed(!!f.arb_healed, !this.arbSynced);
    this.arbSynced = true;
    const gv = this.world.genovia;
    if (f.library_open && !this.libraryOpened) {
      this.libraryOpened = true;
      gv.setLibraryOpen(true, !!this.save.flags.library_seen);
      this.save.flags.library_seen = true;
      this.world.colliders = this.world.colliders.filter((c) => c.id !== 'libdoor');
    }
    for (const m of s.pickups) m.obj.visible = !!f.ch1_molecules && !f[`got_${m.id}`];
  }

  private updateWorldPickups() {
    const p = this.player.pos;
    for (const m of this.world.sites.pickups) {
      if (!m.obj.visible || m.obj.position.distanceTo(p.clone().setY(p.y + 1)) > 1.8) continue;
      m.obj.visible = false;
      this.save.flags[`got_${m.id}`] = true;
      this.giveItem(m.item, 1);
      sfx.pickup();
      const it = data.items.get(m.item);
      sideToast(`${it?.glyph ?? '•'} ${it?.name.th ?? m.item} ×1`, 1800);
    }
    for (const [id, o] of this.world.orbs) {
      if (!o.visible) continue;
      if (o.position.distanceTo(p.clone().setY(p.y + 1)) < 1.6) {
        o.visible = false;
        this.save.world.orbs.push(id);
        this.giveItem('BIO_ORB', 1);
        sfx.pickup();
        sideToast(`🟡 ลูกแก้วแคลไซต์ (${this.save.world.orbs.length}/${this.world.orbs.size}) — ถวายที่รูปปั้นได้`);
      }
    }
  }

  private updateInteractions() {
    const list: { key: string; label: string; icon: string; act: () => void; d: number }[] = [];
    const p = this.player.pos;
    const add = (pos: THREE.Vector3 | { x: number; z: number }, r: number, label: string, icon: string, act: () => void) => {
      const d = Math.hypot(pos.x - p.x, pos.z - p.z);
      if (d < r) list.push({ key: 'F', label, icon, act, d });
    };
    // NPCs
    for (const n of this.npcs) {
      if (!n.visible) continue;
      const def = data.npcs.get(n.id)!;
      add(n.pos, 3, `คุยกับ ${def.name.th}`, '💬', async () => {
        const used = await this.quests.interact('npc', n.id);
        if (!used && def.talkDialogue) playDialogue(def.talkDialogue);
        else if (!used) this.amoebySay(`${def.name.th} ดูเหมือนจะยุ่งอยู่`);
      });
    }
    // statue
    const st = this.world.statuePos;
    add(st, 6, 'รูปปั้นต้นไม้แห่งชีวิต', '🌳', () => this.useStatue());
    // quest objects
    const objs = this.quests.objectsWithObjectives();
    for (const id of objs) {
      const l = data.locations.get(id);
      if (l && id !== 'OBJ_STATUE') add(l, 4.5, l.name.th, '🔎', () => this.quests.interact('object', id));
    }
    // Cellaria gates (city is its own zone)
    if (this.save.quests.MQ_P_06?.state === 'COMPLETED') {
      const gate = data.locations.get('LOC_CELLARIA_GATE')!;
      add(gate, 9, 'เข้าสู่นครเซลลาเรีย', '🏛️', () => this.enterCity());
      add(CITY_GATE_IN, 6, 'ออกจากนครเซลลาเรีย', '🚪', () => this.leaveCity());
    }
    // airship routes from the academy dock
    const cd = data.locations.get('OBJ_AIRSHIP_CITY')!;
    const toCity = () => this.fadeTo(new THREE.Vector3(cd.x + 5, 0, cd.z + 6), () => { this.player.camYaw = 0; });
    if (this.save.flags.genovia_unlocked) {
      const gd = data.locations.get('OBJ_AIRSHIP_GEN')!;
      add(cd, 6, 'ขึ้นเรือเหาะ → เจโนเวีย', '🎈', () => this.fadeTo(new THREE.Vector3(gd.x, 0, gd.z - 7), () => { this.player.camYaw = Math.PI; }));
      add(gd, 6, 'ขึ้นเรือเหาะ → นครเซลลาเรีย', '🎈', toCity);
    }
    if (this.save.flags.roots_unlocked) {
      const rd = data.locations.get('OBJ_AIRSHIP_ARB')!, ra = data.locations.get('LOC_ARB_ARRIVE')!;
      add(cd, 6, 'ขึ้นเรือเหาะ → รากต้นไม้แห่งชีวิต', '🎈', () => this.fadeTo(new THREE.Vector3(ra.x, 0, ra.z), () => { this.player.camYaw = 0; }));
      add(rd, 6, 'ขึ้นเรือเหาะ → นครเซลลาเรีย', '🎈', toCity);
    }
    if (this.save.flags.neurion_unlocked) {
      const nd = data.locations.get('OBJ_AIRSHIP_NEU')!, na = data.locations.get('LOC_NEU_ARRIVE')!;
      add(cd, 6, 'ขึ้นเรือเหาะ → นิวรีออน', '🎈', () => this.fadeTo(new THREE.Vector3(na.x, 0, na.z), () => { this.player.camYaw = 0; }));
      add(nd, 6, 'ขึ้นเรือเหาะ → นครเซลลาเรีย', '🎈', toCity);
    }
    if (this.save.flags.aquorra_unlocked) {
      const ad = data.locations.get('OBJ_AIRSHIP_AQU')!, aa = data.locations.get('LOC_AQU_ARRIVE')!;
      add(cd, 6, 'ขึ้นเรือเหาะ → อควอร์รา', '🎈', () => this.fadeTo(new THREE.Vector3(aa.x, 0, aa.z), () => { this.player.camYaw = 0; }));
      add(ad, 6, 'ขึ้นเรือเหาะ → นครเซลลาเรีย', '🎈', toCity);
    }
    if (this.save.flags.metabolis_unlocked) {
      const md = data.locations.get('OBJ_AIRSHIP_MET')!, ma = data.locations.get('LOC_MET_ARRIVE')!;
      add(cd, 6, 'ขึ้นเรือเหาะ → เมแทบอลิส', '🎈', () => this.fadeTo(new THREE.Vector3(ma.x, 0, ma.z), () => { this.player.camYaw = 0; }));
      add(md, 6, 'ขึ้นเรือเหาะ → นครเซลลาเรีย', '🎈', toCity);
    }
    if (this.save.flags.florantis_unlocked) {
      const fd = data.locations.get('OBJ_AIRSHIP_FLO')!, fa = data.locations.get('LOC_FLO_ARRIVE')!;
      add(cd, 6, 'ขึ้นเรือเหาะ → ฟลอแรนทิส', '🎈', () => this.fadeTo(new THREE.Vector3(fa.x, 0, fa.z), () => { this.player.camYaw = 0; }));
      add(fd, 6, 'ขึ้นเรือเหาะ → นครเซลลาเรีย', '🎈', toCity);
    }
    if (this.save.flags.zepheria_unlocked) {
      const zd = data.locations.get('OBJ_AIRSHIP_ZEP')!, za = data.locations.get('LOC_ZEP_ARRIVE')!;
      add(cd, 6, 'ขึ้นเรือเหาะ → ซีเฟอเรีย', '🎈', () => this.fadeTo(new THREE.Vector3(za.x, 0, za.z), () => { this.player.camYaw = Math.PI; }));
      add(zd, 6, 'ขึ้นเรือเหาะ → นครเซลลาเรีย', '🎈', toCity);
    }
    // waypoints
    for (const [id, w] of this.world.waypoints) {
      const on = this.save.world.waypoints.includes(id);
      if (!on) add(w.pos, 3.5, 'เปิดใช้จุดซินแนปส์', '⟡', () => {
        this.save.world.waypoints.push(id);
        this.world.setWaypointActive(id);
        sfx.unlock();
        toast(`⟡ เปิดใช้ ${w.name}`);
        this.writeSave();
      });
    }
    // chests
    for (const [id, c] of this.world.chests) {
      if (this.save.world.chests.includes(id)) continue;
      add(c.obj.position, 2.5, 'เปิดหีบ', '🎁', () => this.openChest(id));
    }
    // lab domains
    if (!this.domain.active) {
      for (const [id, dp] of this.world.domainPortals) {
        const def = data.domains.get(id);
        if (!def) continue;
        add(dp.pos, 5, `เข้าโดเมน: ${def.name.th}`, '🧪', () => {
          if (this.save.quests.MQ_P_06?.state !== 'COMPLETED') { toast('โดเมนจะเปิดเมื่อจบบทนำ'); return; }
          openDomainMenu(this.domainHost(), def);
        });
      }
    } else if (this.domain.run && this.domain.run.state !== 'fighting') {
      const ex = this.world.domainExit.getWorldPosition(new THREE.Vector3());
      add(ex, 4, this.domain.run.state === 'cleared' ? 'แท่นรางวัลการทดลอง' : 'ออกจากโดเมน', '🎁', () => openDomainResult(this.domainHost()));
    }
    list.sort((a, b) => a.d - b.d);
    this.interactList = list.slice(0, 3);
  }

  enterCity() {
    this.fadeTo(new THREE.Vector3(CITY_ENTRY.x, 0, CITY_ENTRY.z), () => {
      this.player.camYaw = 0;
      if (!this.save.flags.city_visited) {
        this.save.flags.city_visited = true;
        sideToast('🏛️ นครเซลลาเรีย — เมืองที่สร้างเหมือนเซลล์ แต่ละย่านคือออร์แกเนลล์!', 5000);
      }
    });
  }

  private leavingCity = false;

  leaveCity() {
    const g = data.locations.get('LOC_GATE_FRONT')!;
    this.fadeTo(new THREE.Vector3(g.x, 0, g.z + 4), () => { this.player.camYaw = Math.PI; });
  }

  /** Quest markers in another zone point at the gate / airship you need to take first. */
  private routeTarget<T extends { x: number; z: number; label: string }>(t: T): T {
    const zone = (x: number, z: number) => (inZepheria(x, z) ? 'zep' : inGenovia(x, z) ? 'gen' : inFlorantis(x, z) ? 'flo' : inMetabolis(x, z) ? 'met' : inAquorra(x, z) ? 'aqu' : inNeurion(x, z) ? 'neu' : inRoots(x, z) ? 'arb' : inCity(x, z) ? 'city' : 'cyto');
    const from = zone(this.player.pos.x, this.player.pos.z), to = zone(t.x, t.z);
    if (from === to) return t;
    const at = (id: string, label: string) => { const l = data.locations.get(id)!; return { ...t, x: l.x, z: l.z, label: `${label} → ${t.label}` }; };
    if (from === 'gen') return at('OBJ_AIRSHIP_GEN', 'เรือเหาะ');
    if (from === 'zep') return at('OBJ_AIRSHIP_ZEP', 'เรือเหาะ');
    if (from === 'flo') return at('OBJ_AIRSHIP_FLO', 'เรือเหาะ');
    if (from === 'met') return at('OBJ_AIRSHIP_MET', 'เรือเหาะ');
    if (from === 'aqu') return at('OBJ_AIRSHIP_AQU', 'เรือเหาะ');
    if (from === 'neu') return at('OBJ_AIRSHIP_NEU', 'เรือเหาะ');
    if (from === 'arb') return at('OBJ_AIRSHIP_ARB', 'เรือเหาะ');
    if (from === 'city') return to === 'gen' || to === 'zep' || to === 'flo' || to === 'met' || to === 'aqu' || to === 'neu' || to === 'arb' ? at('OBJ_AIRSHIP_CITY', 'เรือเหาะ') : { ...t, x: CITY_GATE_IN.x, z: CITY_GATE_IN.z, label: `ออกจากเมือง → ${t.label}` };
    const gate = data.locations.get('LOC_CELLARIA_GATE')!;
    return { ...t, x: gate.x, z: gate.z + 6, label: `นครเซลลาเรีย → ${t.label}` };
  }

  private async useStatue() {
    const used = await this.quests.interact('object', 'OBJ_STATUE');
    if (used) return;
    // heal party
    for (const m of this.members.values()) m.hp = m.stats().hp;
    this.combat.addEffect(new Blast(this.world.statuePos.clone().setY(this.world.statuePos.y + 2), 6, '#ffd36a', 0.6));
    sfx.unlock();
    let msg = 'รูปปั้นฟื้นฟูพลังชีวิตของทุกคนแล้ว';
    const orbs = this.save.inventory.BIO_ORB ?? 0;
    if (orbs > 0) {
      this.save.world.offeredOrbs += orbs;
      this.save.inventory.BIO_ORB = 0;
      const levels = Math.floor(this.save.world.offeredOrbs / 5);
      const newMax = 120 + levels * 15;
      if (newMax > this.save.maxStamina) {
        this.save.maxStamina = newMax;
        this.player.maxStamina = newMax;
        msg += ` · ความอึดสูงสุดเพิ่มเป็น ${newMax}!`;
        this.giveItem('INSIGHT_CRYSTAL', 20);
      } else msg += ` · ถวายลูกแก้วแล้ว (${this.save.world.offeredOrbs % 5}/5)`;
    }
    toast(msg);
  }

  private openChest(id: string) {
    const c = this.world.chests.get(id)!;
    this.save.world.chests.push(id);
    this.world.openChestVisual(id);
    sfx.pickup();
    const t = c.def.tier;
    const crystals = t === 3 ? 40 : t === 2 ? 20 : 5;
    const glucose = t * 1500;
    this.giveItem('INSIGHT_CRYSTAL', crystals);
    this.giveItem('GLUCOSE', glucose);
    this.giveItem('EXP_MONO', t);
    this.giveItem('ORE_CALCIUM', t);
    if (t >= 2) this.grantRelic(this.relicRarity(t - 1));
    if (t >= 2) this.giveItem('GROWTH_FACTOR', t - 1);
    this.addRRExp(t * 40);
    this.combat.spawnParticles(c.obj.position.clone().setY(c.obj.position.y + 1), null, 2);
    sideToast(`🎁 💎×${crystals} · ⬡×${glucose} · 🍬×${t}`);
    this.writeSave();
  }

  // ------------------------------------------------------------------ spawns
  private updateRespawnWatch() {
    for (const a of this.respawnWatch) {
      const alive = this.combat.enemies.some((e) => e.alive && e.questTag === a.tag);
      if (!alive) this.spawnFromAction({ ...a, respawn: false });
    }
  }

  private updateCamps() {
    if (this.save.quests.MQ_P_02?.state !== 'COMPLETED') return;
    for (const camp of CAMPS) {
      const d = Math.hypot(camp.x - this.player.pos.x, camp.z - this.player.pos.z);
      const alive = (this.campAlive.get(camp.id) ?? []).filter((e) => e.alive);
      this.campAlive.set(camp.id, alive);
      const cleared = this.campCleared.get(camp.id);
      if (alive.length === 0 && (this.campAliveSpawned.has(camp.id))) {
        this.campAliveSpawned.delete(camp.id);
        this.campCleared.set(camp.id, this.gameTime);
        if (Math.hypot(camp.x - this.player.pos.x, camp.z - this.player.pos.z) < 60) {
          this.giveItem('ORE_CALCIUM', 1 + Math.floor(Math.random() * 2));
          if (Math.random() < 0.6) this.grantRelic(this.relicRarity(0));
          sideToast('🏕️ กวาดล้างแคมป์เชื้อโรคแล้ว!');
        }
      }
      if (d < 70 && alive.length === 0 && !this.campAliveSpawned.has(camp.id) && (cleared === undefined || this.gameTime - cleared > 300)) {
        const list: Enemy[] = [];
        camp.enemies.forEach(([id, v], i) => {
          const a = (i / camp.enemies.length) * Math.PI * 2;
          const e = this.combat.spawn(id, new THREE.Vector3(camp.x + Math.cos(a) * 3, 0, camp.z + Math.sin(a) * 3), camp.level, v as Element | null, null);
          if (e) list.push(e);
        });
        this.campAlive.set(camp.id, list);
        this.campAliveSpawned.add(camp.id);
      }
      // despawn camps far away to save CPU
      if (d > 120 && alive.length) {
        for (const e of alive) { e.alive = false; e.deadT = 0.39; }
        this.campAliveSpawned.delete(camp.id);
        this.campAlive.set(camp.id, []);
      }
    }
  }
  private campAliveSpawned = new Set<string>();
  domain!: DomainController;
  private worldBossKilledAt = new Map<string, number>();
  private wishListener: (() => void) | null = null;
  private calmT = 0;

  // ------------------------------------------------------------------ death
  private checkDeath() {
    const party = this.player.party;
    const act = this.player.active;
    if (!act.alive) {
      const next = party.findIndex((m) => m.alive);
      if (next >= 0) {
        this.player.activeIndex = next;
        this.player.setParty(party, next);
        sideToast(`${act.def.name.th} หมดสติ!`);
      } else if (!this.deadHandled) {
        if (this.domain.active) { this.domain.fail('ทีมหมดสติ'); this.domain.run = null; this.world.domainExit.visible = false; }
        this.deadHandled = true;
        const fade = h('<div class="fade" style="opacity:0"></div>');
        document.getElementById('hud')!.appendChild(fade);
        requestAnimationFrame(() => (fade.style.opacity = '1'));
        toast('ทุกคนหมดสติ... กลับไปพักที่จุดซินแนปส์ใกล้ที่สุด', true);
        setTimeout(() => {
          let best = this.world.statuePos.clone(), bd = Infinity;
          for (const id of this.save.world.waypoints) {
            const w = this.world.waypoints.get(id)!;
            const d = w.pos.distanceTo(this.player.pos);
            if (d < bd) { bd = d; best = w.pos.clone().add(new THREE.Vector3(2, 0, 2)); }
          }
          for (const m of party) m.hp = m.stats().hp;
          this.combat.shield.hp = 0;
          for (const e of this.combat.enemies) if (e.aggro && !e.questTag) e.aggro = false;
          this.player.teleport(best);
          this.player.setParty(party, 0);
          fade.style.opacity = '0';
          setTimeout(() => fade.remove(), 700);
          this.deadHandled = false;
        }, 1500);
      }
    }
  }

  // ------------------------------------------------------------------ HUD
  private updateHud(dt: number) {
    const s = this.save;
    const tracked = s.trackedQuest ? this.quests.stepInfo(s.trackedQuest) : null;
    let quest: HudState['quest'] = null;
    if (tracked) {
      const idx = tracked.step.objectives.findIndex((o, i) => (tracked.progress[i] ?? 0) < (o.count ?? 1));
      const o = tracked.step.objectives[Math.max(0, idx)];
      const t = this.quests.targets()[0];
      let objective = idx < 0 ? tracked.step.log.th : this.quests.objectiveText(o, tracked.progress[idx] ?? 0);
      if (idx >= 0 && o.type === 'SCAN' && o.targetTag && (o.count ?? 1) > 1) {
        // "scan all N" quests: once only a few are left, name them so the player knows what is still missing
        const seen = s.quests[tracked.quest.id]?.seen ?? [];
        const left = new Map<string, string>();
        for (const sc of this.world.scannables) if (sc.tags.includes(o.targetTag) && !seen.includes(`${idx}:${sc.id}`)) left.set(sc.id, sc.label.replace(/\s*\(.*\)$/, ''));
        if (left.size > 0 && left.size <= 3) objective += ` · ยังขาด: ${[...left.values()].join(', ')}`;
      }
      quest = {
        title: tracked.quest.title.th,
        objective,
        dist: t ? Math.hypot(t.x - this.player.pos.x, t.z - this.player.pos.z) : null,
        type: tracked.quest.type,
      };
    }
    const boss = this.combat.enemies.find((e) => e.isBoss && e.alive && e.aggro) ?? null;
    const hour = Math.floor(s.timeOfDay), min = Math.floor((s.timeOfDay - hour) * 60);
    const objNpcs = this.quests.npcsWithObjectives();
    this.hud.update(dt, {
      party: this.player.party,
      activeIndex: this.player.activeIndex,
      stamina: this.player.stamina,
      maxStamina: this.player.maxStamina,
      shield: this.combat.shield.hp,
      playerPos: this.player.pos,
      camYaw: this.player.camYaw,
      quest,
      insight: s.inventory.INSIGHT_CRYSTAL ?? 0,
      glucose: s.inventory.GLUCOSE ?? 0,
      antibiotic: s.inventory.ANTIBIOTIC ?? 0,
      interacts: this.scanning ? [] : this.interactList,
      boss,
      scanning: this.scanning ? { active: true, label: this.scanTarget?.label ?? '', progress: Math.min(1, this.scanProgress), known: !!this.scanTarget?.known } : null,
      elementUnlocked: s.systems.includes('ELEMENT'),
      questTargets: this.quests.targets().map((t) => this.routeTarget(t)),
      enemies: this.combat.enemies,
      waypoints: [...this.world.waypoints.entries()].map(([id, w]) => ({ x: w.pos.x, z: w.pos.z, active: s.world.waypoints.includes(id) })),
      npcs: this.npcs.filter((n) => n.visible).map((n) => ({ x: n.pos.x, z: n.pos.z, quest: objNpcs.has(n.id) })),
      timeStr: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
      rr: s.rr,
      atp: (regenAtp(s), s.atp.cur),
      domain: this.domain.run ? { name: this.domain.run.def.name.th, wave: this.domain.run.wave, waves: this.domain.run.waves, time: this.domain.run.timeLeft, mod: this.domain.run.mod.th, state: this.domain.run.state } : null,
    });
    if (this.touch) {
      const m = this.player.active;
      this.touch.update({
        elementUnlocked: s.systems.includes('ELEMENT'),
        color: ELEMENT_COLOR[m.element],
        glyph: ELEMENT_GLYPH[m.element],
        skillArt: skillArtName(m.id),
        cdE: m.cdE,
        cdQ: m.cdQ,
        energyPct: Math.min(1, m.energy / m.def.burstCost),
        burstReady: m.burstReady,
        hasScanner: s.systems.includes('SCANNER'),
        scanning: this.scanning,
        antibiotic: s.inventory.ANTIBIOTIC ?? 0,
        interacts: this.scanning ? [] : this.interactList,
      });
    }
  }
}
