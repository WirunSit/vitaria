import * as THREE from 'three';
import { loadSave } from '../core/Save';

/**
 * Art-direction switch. `v2` = the 2026-10-19 look: neutral tone mapping (true anime colours), cool-tinted
 * shadows, blue aerial haze, layered far mountains, stylised water, deeper meadow greens.
 * `v3` (needs v2) = the 2026-10-26 depth pass: height fog, wooded boundary mountains, large warm/cool meadow
 * patches, soft light shadows with a contact shadow, colour grade, warmer dusk.
 * Read once at start-up (the world is built before a save is loaded), so changing it needs a reload.
 * Esc → settings "ภาพแบบใหม่" (settings.lookV2) and "ภาพมิติลึก" (settings.lookV3), both default on.
 */
function initial() {
  try {
    const st = loadSave()?.settings;
    const v2 = st?.lookV2 !== false;
    return { v2, v3: v2 && st?.lookV3 !== false };
  } catch { return { v2: true, v3: true }; }
}

export const LOOK = initial();

/**
 * v3 height fog: replaces three's fog chunks before any material compiles. Linear Fog near/far keep their
 * meaning, but the curve is exponential-squared (the midground stays crisp, the far plane still dissolves) and
 * fog thins with world height, so ridge tops read against the sky while valleys stay hazy.
 * World height comes from the view matrix (rotation is orthonormal), so it works for every material that
 * already includes the stock fog chunks — instanced, skinned and custom ShaderMaterials alike.
 */
export function installHeightFog() {
  if (!LOOK.v3) return;
  const C = THREE.ShaderChunk as unknown as Record<string, string>;
  C.fog_pars_vertex = `#ifdef USE_FOG
    varying float vFogDepth;
    varying float vFogWY;
  #endif`;
  C.fog_vertex = `#ifdef USE_FOG
    vFogDepth = - mvPosition.z;
    vFogWY = ( transpose( mat3( viewMatrix ) ) * ( mvPosition.xyz - viewMatrix[ 3 ].xyz ) ).y;
  #endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
    uniform vec3 fogColor;
    varying float vFogDepth;
    varying float vFogWY;
    #ifdef FOG_EXP2
      uniform float fogDensity;
    #else
      uniform float fogNear;
      uniform float fogFar;
    #endif
  #endif`;
  C.fog_fragment = `#ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogLin = smoothstep( fogNear, fogFar, vFogDepth );
      float fogFactor = 1.0 - exp( - 3.2 * fogLin * fogLin );
      fogFactor *= mix( 0.5, 1.0, exp( - max( vFogWY - 2.0, 0.0 ) / 22.0 ) );
      fogFactor = clamp( fogFactor + 0.9 * smoothstep( fogFar * 0.92, fogFar * 1.05, vFogDepth ), 0.0, 1.0 );
    #endif
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif`;
}

/**
 * v3 display-space grade (runs after tone mapping, before FXAA): slightly cool lifted shadows, warm highlights
 * (stronger at dusk via uWarm), a touch of contrast and a light vignette that pulls the eye to the centre.
 */
export const GradeShader = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, uWarm: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uWarm; varying vec2 vUv;
    void main() {
      vec4 t = texture2D(tDiffuse, vUv);
      vec3 c = t.rgb;
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c += vec3(-0.012, 0.0, 0.03) * (1.0 - smoothstep(0.0, 0.45, l));
      c += vec3(0.025, 0.012, -0.02) * smoothstep(0.55, 1.0, l) * (1.0 + uWarm);
      c = (c - 0.5) * 1.03 + 0.512;
      vec2 d = vUv - 0.5;
      c *= 1.0 - 0.1 * smoothstep(0.45, 0.9, length(d * vec2(1.25, 1.0)));
      gl_FragColor = vec4(c, t.a);
    }`,
};
