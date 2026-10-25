import * as THREE from 'three';

/**
 * Stylised water for regions (same look as the v2 lake): colour by depth, scrolling ripples that catch the sun,
 * sky reflection at grazing angles, a wobbling foam line on the shore and a soft transparent edge.
 * One plane covers a whole region; per-vertex `depth` (water level − ground) hides it wherever the ground is above
 * the water, and per-vertex `kind` picks the palette: 0 clear lagoon · 1 rosy "artery" canal · 2 deep-blue "vein"
 * canal · 3 toxic green (fades to clear as `uCure` goes 0 → 1).
 * WATER_ENV holds the sun / sky / daylight shared by every water material (World.setTimeOfDay keeps it current).
 */
export const WATER_ENV = {
  time: { value: 0 },
  sun: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
  sky: { value: new THREE.Color('#bfe0f6') },
  day: { value: 1 },
};

export function regionWaterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uCure: { value: 0 } }]) as Record<string, THREE.IUniform>,
    vertexShader: `attribute float depth; attribute float kind; varying float vDepth; varying float vKind; varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() { vDepth = depth; vKind = kind; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSky; uniform vec3 uSun; uniform float uDay; uniform float uCure;
      varying float vDepth; varying float vKind; varying vec3 vWorld;
      #include <fog_pars_fragment>
      float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
      vec3 pick(float k, vec3 a, vec3 b, vec3 c, vec3 d) {
        return k < 1.0 ? mix(a, b, k) : k < 2.0 ? mix(b, c, k - 1.0) : mix(c, d, k - 2.0);
      }
      void main() {
        if (vDepth < -0.05) discard;
        float d = max(vDepth, 0.0);
        vec2 q = vWorld.xz * 0.35;
        float r1 = n2(q + vec2(uTime * 0.25, uTime * 0.1)), r2 = n2(q * 2.3 - vec2(uTime * 0.18, -uTime * 0.22));
        vec3 nrm = normalize(vec3((r1 - 0.5) * 0.5 + (r2 - 0.5) * 0.3, 1.0, (r2 - 0.5) * 0.5 - (r1 - 0.5) * 0.3));
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(V, nrm), 0.0), 3.0);
        vec3 toxS = mix(vec3(0.62, 0.86, 0.35), vec3(0.56, 0.94, 0.9), uCure), toxD = mix(vec3(0.3, 0.52, 0.16), vec3(0.3, 0.69, 0.85), uCure);
        vec3 shallow = pick(vKind, vec3(0.56, 0.94, 0.9), vec3(1.0, 0.7, 0.66), vec3(0.56, 0.78, 1.0), toxS);
        vec3 deep = pick(vKind, vec3(0.3, 0.69, 0.88), vec3(0.88, 0.34, 0.42), vec3(0.23, 0.38, 0.78), toxD);
        vec3 col = mix(shallow, deep, smoothstep(0.2, 2.6, d)) * mix(0.35, 1.0, uDay);
        col = mix(col, uSky, fres * 0.6);
        vec3 H = normalize(normalize(uSun) + V);
        col += vec3(1.0, 0.95, 0.85) * pow(max(dot(nrm, H), 0.0), 160.0) * 1.6 * uDay;
        float edge = 0.18 + 0.08 * sin(uTime * 1.3 + vWorld.x * 0.4 + vWorld.z * 0.3);
        float foam = smoothstep(edge + 0.12, edge, d) * smoothstep(0.0, 0.05, d) * (0.6 + 0.4 * r1);
        col = mix(col, vec3(0.95, 0.98, 1.0), foam * 0.85);
        float alpha = mix(0.6, 0.93, smoothstep(0.0, 2.0, d)) * smoothstep(0.0, 0.08, d + 0.05);
        gl_FragColor = vec4(col, max(alpha, foam));
        #include <fog_fragment>
      }`,
  });
}

/** Bind the shared environment uniforms into a region water material. */
export function bindWaterEnv(m: THREE.ShaderMaterial) {
  m.uniforms.uTime = WATER_ENV.time;
  m.uniforms.uSun = WATER_ENV.sun;
  m.uniforms.uSky = WATER_ENV.sky;
  m.uniforms.uDay = WATER_ENV.day;
  return m;
}

/**
 * A square of water `size` metres wide (local coordinates), `seg` segments, at height `level`: depth and kind
 * are sampled per vertex from the region's ground height and a kind function.
 */
export function regionWater(size: number, seg: number, level: number, groundAt: (x: number, z: number) => number, kindAt: (x: number, z: number) => number) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  const depth = new Float32Array(p.count), kind = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    depth[i] = level - groundAt(x, z);
    kind[i] = kindAt(x, z);
  }
  geo.setAttribute('depth', new THREE.BufferAttribute(depth, 1));
  geo.setAttribute('kind', new THREE.BufferAttribute(kind, 1));
  const mat = bindWaterEnv(regionWaterMaterial());
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = level;
  mesh.renderOrder = 1;
  mesh.userData.noOutline = true;
  mesh.userData.noShadow = true;
  return mesh;
}
