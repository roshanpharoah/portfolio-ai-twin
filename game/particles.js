import * as THREE from './vendor/three.module.min.js';

const VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * 420.0 * uScale / max(0.1, -mv.z), 1.0, 64.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    vAlpha = aAlpha;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = dot(p, p);
    if (d > 0.25) discard;
    float core = smoothstep(0.25, 0.0, d);
    gl_FragColor = vec4(vColor * (0.7 + core), core * vAlpha);
  }
`;

export class Particles {
  constructor(scene, capacity = 900) {
    this.capacity = capacity;
    this.cursor = 0;
    this.trailAcc = 0;
    this.colors = new Map();

    this.position = new Float32Array(capacity * 3);
    this.color = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.active = new Uint8Array(capacity);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.position, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aColor', new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 200);

    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);

    // Park unused particles far away rather than at the origin.
    for (let i = 0; i < capacity; i++) this.position[i * 3 + 2] = -999;
  }

  setPixelRatio(ratio) {
    this.material.uniforms.uScale.value = ratio;
  }

  tint(hex) {
    let c = this.colors.get(hex);
    if (!c) {
      const color = new THREE.Color(hex);
      c = { r: color.r, g: color.g, b: color.b };
      this.colors.set(hex, c);
    }
    return c;
  }

  spawn(x, y, z, vx, vy, vz, color, size, life) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    const i3 = i * 3;

    this.position[i3] = x;
    this.position[i3 + 1] = y;
    this.position[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    this.color[i3] = color.r;
    this.color[i3 + 1] = color.g;
    this.color[i3 + 2] = color.b;
    this.baseSize[i] = size;
    this.size[i] = size;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.alpha[i] = 1;
    this.active[i] = 1;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
  }

  burst(x, y, z, color, count = 14, power = 6, life = 0.7) {
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const speed = power * (0.35 + Math.random() * 0.65);
      this.spawn(
        x, y, z,
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed,
        Math.sin(phi) * Math.sin(theta) * speed * 0.5 + 1.2,
        color,
        0.05 + Math.random() * 0.11,
        life * (0.55 + Math.random() * 0.7)
      );
    }
  }

  trail(x, y, z, dt, rate, color, speed = 0) {
    this.trailAcc += dt * rate;
    while (this.trailAcc >= 1) {
      this.trailAcc -= 1;
      const spread = 0.09;
      this.spawn(
        x + (Math.random() - 0.5) * spread,
        y + (Math.random() - 0.5) * spread,
        z,
        (Math.random() - 0.5) * 0.9,
        (Math.random() - 0.5) * 0.9,
        1.2 + speed * 0.02 + Math.random() * 2.2,
        color,
        0.035 + Math.random() * 0.06,
        0.28 + Math.random() * 0.35
      );
    }
  }

  update(dt) {
    const pos = this.position;
    const vel = this.vel;
    const alpha = this.alpha;
    let dirty = false;

    for (let i = 0; i < this.capacity; i++) {
      if (!this.active[i]) continue;
      const i3 = i * 3;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.active[i] = 0;
        alpha[i] = 0;
        pos[i3 + 2] = -999;
        dirty = true;
        continue;
      }
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      vel[i3] *= 0.985;
      vel[i3 + 1] *= 0.985;
      vel[i3 + 2] *= 0.99;
      alpha[i] = Math.min(1, this.life[i] / (this.maxLife[i] * 0.7));
      dirty = true;
    }

    if (dirty) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.aAlpha.needsUpdate = true;
      this.geometry.attributes.aSize.needsUpdate = true;
    }
  }

  clear() {
    for (let i = 0; i < this.capacity; i++) {
      this.active[i] = 0;
      this.life[i] = 0;
      this.alpha[i] = 0;
      this.position[i * 3 + 2] = -999;
    }
    this.trailAcc = 0;
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.points.removeFromParent();
  }
}
