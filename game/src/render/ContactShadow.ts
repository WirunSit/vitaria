import * as THREE from 'three';

/**
 * look v3: a soft dark disc under the active character's feet. The sun shadow is a sharp-ish projection that
 * leaves the feet looking pasted on; this cheap stand-in for ambient occlusion grounds them. Fades and shrinks
 * as the character leaves the ground (jumps, gliding).
 */
export class ContactShadow {
  readonly mesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;

  constructor() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(30,40,55,0.42)');
    gr.addColorStop(0.55, 'rgba(30,40,55,0.14)');
    gr.addColorStop(1, 'rgba(30,40,55,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    this.mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2), this.mat);
    this.mesh.renderOrder = 1;
    this.mesh.userData.noOutline = true;
  }

  update(feet: THREE.Vector3, groundY: number, visible: boolean) {
    const lift = Math.max(0, feet.y - groundY);
    const k = 1 - Math.min(1, lift / 3);
    this.mesh.visible = visible && k > 0.02;
    if (!this.mesh.visible) return;
    this.mesh.position.set(feet.x, groundY + 0.04, feet.z);
    this.mesh.scale.setScalar(0.6 + 0.4 * k);
    this.mat.opacity = k;
  }
}
