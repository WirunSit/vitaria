import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

/**
 * Bloom post-processing (soft glow on bright spots: Vital Cores, crystals, sun, skill effects).
 * Edges are smoothed with FXAA instead of multisampling the half-float scene buffer: on integrated GPUs the
 * 4× MSAA buffer cost more than the whole rest of the frame (≈27 → 17 ms on an Intel UHD 630).
 */
export class PostFX {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  private fxaa: ShaderPass;
  enabled = true;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const size = renderer.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.55, 1.15);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
    this.setSize(size.x, size.y);
  }

  setSize(w: number, h: number) {
    const pr = this.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    (this.fxaa.material.uniforms.resolution.value as THREE.Vector2).set(1 / (w * pr), 1 / (h * pr));
  }

  render(scene: THREE.Scene, camera: THREE.Camera) {
    if (this.enabled) this.composer.render();
    else this.renderer.render(scene, camera);
  }
}
