import * as THREE from 'three';

/**
 * In-world quest guidance: a golden light pillar over the target (visible from far away) and a short trail of
 * glowing dots on the ground that flows from the player towards it.
 */
export class QuestGuide {
  root = new THREE.Group();
  private beam: THREE.Mesh;
  private ring: THREE.Mesh;
  private dots: THREE.Mesh[] = [];
  private t = 0;

  constructor() {
    // soft vertical beam (fades upwards)
    const cv = document.createElement('canvas');
    cv.width = 4; cv.height = 128;
    const g = cv.getContext('2d')!;
    const grad = g.createLinearGradient(0, 128, 0, 0);
    grad.addColorStop(0, 'rgba(255,230,140,0.95)');
    grad.addColorStop(0.25, 'rgba(255,220,120,0.55)');
    grad.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 128);
    const tex = new THREE.CanvasTexture(cv);
    const beamMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, color: 0xffd36a });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 46, 16, 1, true), beamMat);
    this.beam.position.y = 23;
    this.beam.userData.noOutline = true;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.5, 40), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.12;
    this.root.add(this.beam, this.ring);
    const dotGeo = new THREE.CircleGeometry(0.3, 14);
    dotGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 9; i++) {
      const d = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffb420, transparent: true, depthWrite: false, toneMapped: false }));
      d.userData.noOutline = true;
      this.dots.push(d);
    }
    this.root.visible = false;
  }

  /** target = where to go (null hides everything). */
  update(dt: number, player: THREE.Vector3, target: THREE.Vector3 | null, groundY: (x: number, z: number) => number, dotParent: THREE.Object3D) {
    this.t += dt;
    if (!target) {
      this.root.visible = false;
      for (const d of this.dots) d.visible = false;
      return;
    }
    const dist = Math.hypot(target.x - player.x, target.z - player.z);
    this.root.visible = dist > 7;
    this.root.position.set(target.x, groundY(target.x, target.z), target.z);
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
    // full strength from afar; dims to 40% up close so it stops outshining the characters
    const near = 0.4 + 0.6 * THREE.MathUtils.smoothstep(dist, 15, 60);
    (this.beam.material as THREE.MeshBasicMaterial).opacity = (0.55 + pulse * 0.35) * near;
    const rs = 1 + ((this.t * 0.8) % 1) * 1.6;
    this.ring.scale.setScalar(rs);
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 1 - ((this.t * 0.8) % 1);
    // ground trail: only while the target is a fair way off, fades out over its length
    const showTrail = dist > 12;
    const dir = new THREE.Vector2(target.x - player.x, target.z - player.z).normalize();
    this.dots.forEach((d, i) => {
      if (d.parent !== dotParent) dotParent.add(d);
      d.visible = showTrail;
      if (!showTrail) return;
      const along = 2.2 + i * 2.1;
      const x = player.x + dir.x * along, z = player.z + dir.y * along;
      d.position.set(x, groundY(x, z) + 0.12, z);
      // a bright wave flows away from the player
      const wave = Math.max(0, Math.sin(this.t * 4 - i * 0.7));
      (d.material as THREE.MeshBasicMaterial).opacity = (0.45 + wave * 0.55) * (1 - i / 11);
      d.scale.setScalar(0.8 + wave * 0.5);
    });
  }
}
