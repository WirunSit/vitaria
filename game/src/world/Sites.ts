import * as THREE from 'three';
import { toon, glow, addOutline } from './Materials';
import type { Collider, Scannable } from './World';
import { data } from '../core/Data';
import { propSlot } from '../models/PropModels';
import { PAINTED_TREES, hasFlora, plantFlora, type FloraSet, type FloraSpot } from './Flora';

/**
 * Chapter 1 outdoor sites: Molecule Plains, Enzyme Grove, the salted shore of Membrane Lake and the Mitosis Spire.
 * Positions come from locations.json; quest state toggles their look (see Game.syncSites).
 */

export interface MoleculePickup { id: string; item: string; obj: THREE.Object3D }

const MOLECULES: { item: string; color: string }[] = [
  { item: 'MOL_AMINO', color: '#ff7a6a' },
  { item: 'MOL_MONOSAC', color: '#ffd35a' },
  { item: 'MOL_FATTY', color: '#9be06a' },
  { item: 'MOL_NUCLEOTIDE', color: '#7ab8ff' },
];

export class Sites {
  root = new THREE.Group();
  colliders: Collider[] = [];
  scannables: Scannable[] = [];
  pickups: MoleculePickup[] = [];
  salt: THREE.Object3D[] = [];
  private enzymeMats: THREE.MeshToonMaterial[] = [];
  private substrates: THREE.Object3D[] = [];
  private reedsWilted = new THREE.Group();
  private reedsHealthy = new THREE.Group();
  private spireMats: THREE.MeshToonMaterial[] = [];
  private spireBuds: THREE.Mesh[] = [];
  private t = 0;
  private enzymeOk = false;
  private calm = false;

  constructor(private h: (x: number, z: number) => number) {
    const L = (id: string) => data.locations.get(id) ?? { x: 0, z: 0 };
    this.moleculePlains(L('LOC_MOLECULE_PLAINS'));
    this.enzymeGrove(L('LOC_ENZYME_GROVE'));
    this.lakeShore();
    this.mitosisSpire(L('LOC_SPIRE_TOWER'), L('LOC_SPIRE'));
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.isOutline) o.castShadow = true; });
  }

  private place(o: THREE.Object3D, x: number, z: number, lift = 0) {
    o.position.set(x, this.h(x, z) + lift, z);
    this.root.add(o);
    return o;
  }

  // ---------------------------------------------------------------- Molecule Plains
  private moleculePlains(c: { x: number; z: number }) {
    const ballStick = (atoms: [number, number, number, string][], bonds: [number, number][], scale: number) => {
      const g = new THREE.Group();
      for (const [x, y, z, col] of atoms) {
        const a = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 10), toon(col));
        a.position.set(x, y, z);
        g.add(a);
      }
      const stick = toon('#e9e0c8');
      for (const [i, j] of bonds) {
        const A = new THREE.Vector3(...atoms[i].slice(0, 3) as [number, number, number]);
        const B = new THREE.Vector3(...atoms[j].slice(0, 3) as [number, number, number]);
        const len = A.distanceTo(B);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, len, 6), stick);
        s.position.copy(A).add(B).multiplyScalar(0.5);
        s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
        g.add(s);
      }
      g.scale.setScalar(scale);
      addOutline(g, 0.04);
      return g;
    };
    // glucose ring (hexagon with an O in the ring)
    const ring: [number, number, number, string][] = [];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ring.push([Math.cos(a) * 1.6, Math.sin(a) * 1.6 + 2.4, 0, i === 0 ? '#ff5a4a' : '#5a5f70']); }
    ring.push([2.9, 3.4, 0, '#ff5a4a'], [-2.9, 3.4, 0, '#ff5a4a'], [0, 4.9, 0, '#ff5a4a']);
    const glu = ballStick(ring, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 6], [3, 7], [2, 8]], 1.6);
    this.place(glu, c.x - 10, c.z - 6);
    // amino acid: central carbon with amino, carboxyl, H and R group
    const aa = ballStick([[0, 3, 0, '#5a5f70'], [-1.6, 3.8, 0, '#4a7ae8'], [1.6, 3.8, 0, '#5a5f70'], [2.6, 3.0, 0, '#ff5a4a'], [1.9, 5.0, 0, '#ff5a4a'], [0, 1.4, 0, '#6fcf5a'], [0, 3, 1.4, '#f4f4f4']],
      [[0, 1], [0, 2], [2, 3], [2, 4], [0, 5], [0, 6]], 1.7);
    this.place(aa, c.x + 9, c.z - 9);
    // DNA double helix monument
    const dna = new THREE.Group();
    for (let i = 0; i < 22; i++) {
      const a = i * 0.55, y = 0.5 + i * 0.45;
      const p1 = new THREE.Vector3(Math.cos(a) * 1.2, y, Math.sin(a) * 1.2), p2 = p1.clone().setX(-p1.x).setZ(-p1.z);
      for (const [p, col] of [[p1, '#7ab8ff'], [p2, '#ff9ad0']] as const) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), toon(col));
        b.position.copy(p);
        dna.add(b);
      }
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 5), toon(['#ffd35a', '#9be06a', '#ff7a6a', '#7ae0d0'][i % 4]));
      rung.position.set(0, y, 0);
      rung.rotation.z = Math.PI / 2;
      rung.rotation.y = -a;
      dna.add(rung);
    }
    dna.scale.setScalar(1.4);
    addOutline(dna, 0.03);
    this.place(dna, c.x + 2, c.z + 10);
    void propSlot(dna, 'PRP_DNA', { h: 10.5 / 1.4, outline: 0 });
    // fatty acid: zig-zag carbon tail on a glycerol head
    const fa: [number, number, number, string][] = [[0, 5, 0, '#ff5a4a']];
    const bonds: [number, number][] = [];
    for (let i = 0; i < 8; i++) { fa.push([(i % 2 ? 0.7 : -0.7), 4.2 - i * 0.55, 0, '#5a5f70']); bonds.push([i, i + 1]); }
    this.place(ballStick(fa, bonds, 1.5), c.x - 12, c.z + 9);
    for (const [ox, oz] of [[-10, -6], [9, -9], [2, 10], [-12, 9]]) this.colliders.push({ x: c.x + ox, z: c.z + oz, r: 2.6 });

    // collectible molecules scattered around the plains (5 of each, the quest asks for 4)
    let k = 0;
    for (const m of MOLECULES) {
      for (let i = 0; i < 5; i++) {
        const a = (k / 20) * Math.PI * 2 + (i % 2) * 0.3, r = 14 + ((k * 7) % 13);
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        const o = new THREE.Group();
        const core = m.item === 'MOL_MONOSAC' ? new THREE.CylinderGeometry(0.35, 0.35, 0.16, 6)
          : m.item === 'MOL_AMINO' ? new THREE.TetrahedronGeometry(0.42)
          : m.item === 'MOL_FATTY' ? new THREE.CapsuleGeometry(0.14, 0.8, 4, 8)
          : new THREE.DodecahedronGeometry(0.34);
        const mesh = new THREE.Mesh(core, glow(m.color, 1.4));
        if (m.item === 'MOL_MONOSAC') mesh.rotation.x = Math.PI / 2;
        const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.65, 20), new THREE.MeshBasicMaterial({ color: m.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
        halo.userData.noOutline = true;
        mesh.userData.noOutline = true;
        o.add(mesh, halo);
        this.place(o, x, z, 1.1);
        o.userData.baseY = o.position.y;
        o.visible = false;
        this.pickups.push({ id: `MOL_${k}`, item: m.item, obj: o });
        k++;
      }
    }
  }

  // ---------------------------------------------------------------- Enzyme Grove
  private enzymeGrove(c: { x: number; z: number }) {
    let s = 11;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const clearOfGates = (x: number, z: number) => ![[0, -10], [-12, 6], [12, 6]].some(([gx, gz]) => Math.hypot(x - c.x - gx, z - c.z - gz) < 4.5);
    if (hasFlora('NAT_TreesPainted')) {
      // hand-painted trees like the meadow groves, some birches and mushroom trees, bushes and glowing plants
      // underneath for the enchanted look (Flora handles LOD / culling)
      const sets: Record<string, FloraSet> = {
        trees: PAINTED_TREES,
        birch: { file: 'NAT_Birch', split: true, sway: 0.045, far: 300 },
        mushroom: { file: 'NAT_MushroomTree', sway: 0.01, far: 300 },
        bush: { file: 'NAT_Bush', sway: 0.06, far: 110 },
        glow: { file: 'NAT_GlowPlants', split: true, sway: 0.06, far: 90 },
      };
      const spots: Record<string, FloraSpot[]> = Object.fromEntries(Object.keys(sets).map((k) => [k, []]));
      const at = (k: string, x: number, z: number, scale: number, sink = 0.15) => spots[k].push({ x, y: this.h(x, z) - sink, z, rot: rand() * Math.PI * 2, scale });
      for (let i = 0; i < 46; i++) {
        const a = rand() * Math.PI * 2, r = 9 + rand() * 22;
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (!clearOfGates(x, z)) continue;
        const roll = rand();
        if (i % 3 === 2) {
          // understorey instead of a tree (keeps the forest airy and the triangle count down)
          at(roll < 0.5 ? 'bush' : 'glow', x, z, roll < 0.5 ? 1 + rand() * 0.6 : 0.6 + rand() * 0.4, 0.02);
          continue;
        }
        const k = roll < 0.14 ? 'mushroom' : roll < 0.34 ? 'birch' : 'trees';
        at(k, x, z, k === 'mushroom' ? 4.5 + rand() * 2 : k === 'birch' ? 8 + rand() * 2 : 6.5 + rand() * 2.5);
        this.colliders.push({ x, z, r: 0.6 });
        if (rand() < 0.35) { const b = rand() * 6.28, d = 1.8 + rand() * 1.5; at('glow', x + Math.cos(b) * d, z + Math.sin(b) * d, 0.5 + rand() * 0.4, 0.02); }
      }
      for (const k of Object.keys(sets)) if (spots[k].length) this.root.add(plantFlora(sets[k], spots[k], rand));
    } else {
      // fallback when the nature models aren't installed: simple low-poly trees
      const trunk = toon('#6a4a3a');
      const leaves = [toon('#3fae8a'), toon('#2f8f7a'), toon('#7a6ad0')];
      for (let i = 0; i < 46; i++) {
        const a = rand() * Math.PI * 2, r = 9 + rand() * 22;
        const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
        if (!clearOfGates(x, z)) continue;
        const t = new THREE.Group();
        const hgt = 3.5 + rand() * 3;
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, hgt, 6), trunk);
        tr.position.y = hgt / 2;
        const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 + rand(), 0), leaves[Math.floor(rand() * 3)]);
        top.position.y = hgt + 0.8;
        top.scale.y = 0.8;
        t.add(tr, top);
        addOutline(t, 0.03);
        this.place(t, x, z);
        this.colliders.push({ x, z, r: 0.6 });
      }
    }
    // three enzyme gates: an arch with an "active site" that the floating substrate must fit
    for (const [gx, gz] of [[0, -10], [-12, 6], [12, 6]]) {
      const g = new THREE.Group();
      const mat = new THREE.MeshToonMaterial({ color: 0x5a4a7a, emissive: 0xc0281a, emissiveIntensity: 0.45 });
      this.enzymeMats.push(mat);
      const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.45, 8, 16, Math.PI), mat);
      arch.position.y = 0.2;
      // enzyme head with a notch (active site)
      const head = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.45, 8, 16, Math.PI * 1.6), mat);
      head.position.y = 3.4;
      head.rotation.z = Math.PI * 1.2;
      const sub = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 4), toon('#ffd35a'));
      sub.position.set(1.8, 4.6, 0);
      sub.userData.home = sub.position.clone();
      sub.userData.keep = true;
      this.substrates.push(sub);
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.8, 6), toon('#5a4a7a'));
        leg.position.set(sx * 2.4, 0.4, 0);
        g.add(leg);
        this.colliders.push({ x: c.x + gx + sx * 2.4, z: c.z + gz, r: 0.7 });
      }
      g.add(arch, head, sub);
      addOutline(g, 0.04);
      g.rotation.y = Math.atan2(-gx, -gz);
      this.place(g, c.x + gx, c.z + gz);
      void propSlot(g, 'PRP_EnzymeGate', { w: 6 });
      const probe = new THREE.Object3D();
      probe.position.set(c.x + gx, this.h(c.x + gx, c.z + gz) + 3, c.z + gz);
      this.root.add(probe);
      this.scannables.push({ id: 'OBJ_ENZYME_GATE', codexId: 'CDX_ENZYME', tags: ['enzyme_gate'], obj: probe, radius: 2.5, label: 'ประตูเอนไซม์' });
    }
  }

  setEnzymeFixed(ok: boolean) {
    this.enzymeOk = ok;
    for (const m of this.enzymeMats) { m.emissive.set(ok ? 0x1ac060 : 0xc0281a); m.color.set(ok ? 0x4a8a7a : 0x5a4a7a); }
  }

  // ---------------------------------------------------------------- Membrane Lake shore
  private lakeShore() {
    const saltMat = new THREE.MeshToonMaterial({ color: 0xf4f6ff, emissive: 0x9ab0d0, emissiveIntensity: 0.25 });
    for (const id of ['OBJ_SALT_1', 'OBJ_SALT_2', 'OBJ_SALT_3']) {
      const l = data.locations.get(id);
      if (!l) continue;
      const g = new THREE.Group();
      const mound = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.4, 7), saltMat);
      mound.position.y = 0.6;
      g.add(mound);
      for (let i = 0; i < 6; i++) {
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), saltMat);
        cube.position.set(Math.cos(i) * 1.7, 0.18, Math.sin(i) * 1.7);
        cube.rotation.set(i, i * 2, 0);
        g.add(cube);
      }
      // Syndicate sack
      const sack = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), toon('#3a3550'));
      sack.scale.y = 1.3;
      sack.position.set(1.4, 0.6, -0.8);
      g.add(sack);
      addOutline(g, 0.03);
      this.place(g, l.x, l.z);
      g.visible = false;
      this.salt.push(g);
      void propSlot(g, 'PRP_SaltPile', { w: 4 });
    }
    // reeds along the south shore: wilted (plasmolysed) vs healthy
    const w = data.locations.get('OBJ_WILTED');
    if (!w) return;
    const brown = toon('#a08a5a'), green = toon('#5fbf4a');
    for (let i = 0; i < 14; i++) {
      const x = w.x + (i % 7) * 1.1 - 3.3, z = w.z + Math.floor(i / 7) * 1.4;
      const y = this.h(x, z);
      const dry = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 1.8, 5), brown);
      dry.position.set(x, y + 0.6, z);
      dry.rotation.z = 0.9 + (i % 3) * 0.2;
      this.reedsWilted.add(dry);
      const ok = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 1.8, 5), green);
      ok.position.set(x, y + 0.9, z);
      ok.rotation.z = (i % 3 - 1) * 0.1;
      const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.3, 3, 6), toon('#8a6243'));
      tip.position.set(x, y + 1.9, z);
      this.reedsHealthy.add(ok, tip);
    }
    this.root.add(this.reedsWilted, this.reedsHealthy);
    this.reedsWilted.visible = false;
    const probe = new THREE.Object3D();
    probe.position.set(w.x, this.h(w.x, w.z) + 1, w.z + 0.7);
    this.root.add(probe);
    this.scannables.push({ id: 'OBJ_WILTED', codexId: 'CDX_PLASMOLYSIS', tags: ['wilted'], obj: probe, radius: 4, label: 'ต้นกกที่เหี่ยวเฉา', alive: () => this.reedsWilted.visible });
  }

  setLakeState(saltDumped: boolean, removed: boolean[], fixed: boolean) {
    this.salt.forEach((s, i) => { s.visible = saltDumped && !removed[i]; });
    this.reedsWilted.visible = saltDumped && !fixed;
    this.reedsHealthy.visible = !this.reedsWilted.visible;
  }

  // ---------------------------------------------------------------- Mitosis Spire
  private mitosisSpire(t: { x: number; z: number }, a: { x: number; z: number }) {
    const g = new THREE.Group();
    const rock = new THREE.MeshToonMaterial({ color: 0x3e3250, emissive: 0x5a20a0, emissiveIntensity: 0.18 });
    const crystal = new THREE.MeshToonMaterial({ color: 0xc58bff, emissive: 0xa050ff, emissiveIntensity: 0.9 });
    this.spireMats.push(rock, crystal);
    let y = 0;
    for (let i = 0; i < 8; i++) {
      const r = 9 - i * 0.95, hgt = 5 - i * 0.2;
      const tier = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r, hgt, 6), rock);
      tier.position.y = y + hgt / 2;
      tier.rotation.y = i * 0.3;
      g.add(tier);
      // cells bulging out of every tier — the tower keeps dividing
      for (let k = 0; k < 4; k++) {
        const ang = k * 1.57 + i * 0.7;
        const bud = new THREE.Mesh(new THREE.SphereGeometry(1 + (i % 3) * 0.3, 12, 10), crystal);
        bud.position.set(Math.cos(ang) * r * 0.95, y + hgt * 0.6, Math.sin(ang) * r * 0.95);
        bud.userData.phase = i + k;
        this.spireBuds.push(bud);
        g.add(bud);
      }
      y += hgt;
    }
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), crystal);
    tip.position.y = y + 2.4;
    tip.scale.y = 1.8;
    g.add(tip);
    addOutline(g, 0.06);
    this.place(g, t.x, t.z);
    this.colliders.push({ x: t.x, z: t.z, r: 9.5 });
    void propSlot(g, 'BLD_MitosisSpire', { w: 19 });
    // arena ring + crystal pillars
    const ay = this.h(a.x, a.z);
    const ring = new THREE.Mesh(new THREE.RingGeometry(15, 16.5, 6), toon('#5a4a7a', { side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(a.x, ay + 0.06, a.z);
    this.root.add(ring);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const px = a.x + Math.cos(ang) * 18.5, pz = a.z + Math.sin(ang) * 18.5;
      const og = new THREE.Group();
      og.position.set(px, this.h(px, pz), pz);
      og.rotation.y = -ang + Math.PI / 2; // gem faces the arena
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 6, 6), rock);
      p.position.y = 3;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.9, 0), crystal);
      c.position.y = 6.8;
      og.add(p, c);
      this.root.add(og);
      void propSlot(og, 'PRP_Obelisk', { h: 7.5, outline: 0 });
      this.colliders.push({ x: px, z: pz, r: 1 });
    }
    const probe = new THREE.Object3D();
    probe.position.set(t.x, this.h(t.x, t.z) + 12, t.z);
    this.root.add(probe);
    this.scannables.push({ id: 'OBJ_SPIRE', codexId: 'CDX_CELL_CYCLE', tags: ['spire'], obj: probe, radius: 9, label: 'หอคอยไมโทซิส' });
  }

  setSpireCalm(calm: boolean) {
    this.calm = calm;
    this.spireMats[0].emissive.set(calm ? 0x8a5a20 : 0x5a20a0);
    this.spireMats[1].color.set(calm ? 0xffe0a0 : 0xc58bff);
    this.spireMats[1].emissive.set(calm ? 0xffb040 : 0xa050ff);
  }

  update(dt: number) {
    this.t += dt;
    for (const p of this.pickups) {
      if (!p.obj.visible) continue;
      p.obj.rotation.y += dt * 1.6;
      p.obj.position.y = p.obj.userData.baseY + Math.sin(this.t * 2 + p.obj.position.x) * 0.15;
    }
    this.substrates.forEach((s, i) => {
      const home = s.userData.home as THREE.Vector3;
      if (this.enzymeOk) {
        // substrate drifts into the active site and back out as "product"
        const k = (Math.sin(this.t * 1.2 + i) + 1) / 2;
        s.position.set(home.x * (1 - k), 3.4 + (home.y - 3.4) * (1 - k), 0);
      } else {
        s.position.copy(home).setY(home.y + Math.sin(this.t * 3 + i) * 0.15);
        s.rotation.y += dt;
      }
    });
    const grow = this.calm ? 0 : 1;
    for (const b of this.spireBuds) {
      const s = 1 + grow * 0.18 * Math.sin(this.t * 1.5 + b.userData.phase);
      b.scale.setScalar(s);
    }
  }
}
