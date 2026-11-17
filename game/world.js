import * as THREE from './vendor/three.module.min.js';
import { GATE_PATTERNS, PALETTE, SKILLS, SPAWN, TONE_HEX, TUNING } from './config.js';
import { clamp, lerp, makeRadialTexture, rand, shuffle, disposeObject } from './utils.js';

const TUNNEL_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const TUNNEL_FRAG = /* glsl */ `
  uniform float uScroll;
  uniform vec3 uIndigo;
  uniform vec3 uCyan;
  uniform vec3 uEmerald;
  varying vec2 vUv;
  varying vec3 vWorld;

  void main() {
    float rings = smoothstep(0.982, 1.0, abs(sin(vUv.y * 6.2831853 * 26.0 + uScroll * 0.314)));
    float spokes = smoothstep(0.986, 1.0, abs(sin(vUv.x * 6.2831853 * 24.0)));
    float bands = smoothstep(0.988, 1.0, abs(sin(vUv.x * 6.2831853 * 6.0 + vUv.y * 40.0 - uScroll * 0.05)));

    float depth = clamp(-vWorld.z / 250.0, 0.0, 1.0);
    float fade = 1.0 - smoothstep(0.30, 0.98, depth);
    fade *= smoothstep(0.0, 8.0, vWorld.z + 34.0);

    vec3 col = mix(uIndigo, uCyan, 0.5 + 0.5 * sin(vUv.x * 6.2831853 * 2.0 + 1.2));
    col = mix(col, uEmerald, 0.35 + 0.35 * sin(vUv.x * 6.2831853 * 3.0 - 0.6));
    col = mix(col, uCyan, spokes * 0.45);

    float intensity = rings * 0.9 + spokes * 0.22 + bands * 0.35;
    gl_FragColor = vec4(col * (0.4 + intensity), intensity * fade * 0.82);
  }
`;

const SKY_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vPos;
  void main() {
    vec3 dir = normalize(vPos);
    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(vec3(0.002, 0.006, 0.02), vec3(0.012, 0.02, 0.065), h);
    float t = uTime * 0.006;
    float n = sin(dir.x * 3.0 + t) * sin(dir.y * 4.0 - t * 1.3) * sin(dir.z * 3.5 + t * 0.7);
    float n2 = sin(dir.x * 7.0 - t * 2.0) * sin(dir.z * 5.0 + t);
    col += vec3(0.02, 0.07, 0.1) * max(0.0, n * 0.5 + 0.5) * 0.45;
    col += vec3(0.06, 0.02, 0.12) * max(0.0, n2 * 0.5 + 0.5) * 0.28;
    col += vec3(0.02, 0.1, 0.12) * pow(max(0.0, dir.z), 6.0) * 0.6;
    gl_FragColor = vec4(col, 1.0);
  }
`;

function drawGateTexture(pattern) {
  const size = 512;
  const extent = 16.4;
  const scale = size / extent;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const radius = 8.05 * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, Math.PI * 2);
  ctx.clip();

  const gradient = ctx.createRadialGradient(c, c, 0, c, c, radius);
  gradient.addColorStop(0, 'rgba(3,10,24,0.82)');
  gradient.addColorStop(0.65, 'rgba(4,12,28,0.9)');
  gradient.addColorStop(1, 'rgba(6,16,34,0.96)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(99,102,241,0.16)';
  ctx.lineWidth = 1;
  for (let i = -size; i < size * 2; i += 26) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(i, size);
    ctx.lineTo(i + size, 0);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(34,211,238,0.10)';
  for (let r = 60; r < radius; r += 54) {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(34,211,238,0.7)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c, radius - 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(99,102,241,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, radius - 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.globalCompositeOperation = 'destination-out';
  for (const hole of pattern.holes) {
    ctx.beginPath();
    ctx.arc(c + hole.x * scale, c - hole.y * scale, hole.r * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  for (const hole of pattern.holes) {
    const hx = c + hole.x * scale;
    const hy = c - hole.y * scale;
    const hr = hole.r * scale;
    ctx.strokeStyle = 'rgba(103,232,249,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(hx, hy, hr + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(34,211,238,0.25)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(hx, hy, hr + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeLabelTexture(text, toneHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 384, 96);

  ctx.fillStyle = 'rgba(3,10,24,0.78)';
  ctx.strokeStyle = toneHex;
  ctx.lineWidth = 3;
  const x = 6;
  const y = 10;
  const w = 372;
  const h = 76;
  const r = 38;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.font = "600 36px 'JetBrains Mono', monospace";
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 192, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export class World {
  constructor(scene, callbacks, quality = 'high') {
    this.scene = scene;
    this.cb = callbacks;
    this.quality = quality;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.scroll = 0;
    this.time = 0;
    this.spawnTimer = SPAWN.firstDelay;
    this.orbTimer = 0.55;
    this.powerTimer = rand(SPAWN.powerMin, SPAWN.powerMax);
    this.spawnCount = 0;
    this.orbBursts = 0;
    this.powerBursts = 0;
    this.skillBag = [];
    this.skillIndex = 0;

    this.disposables = [];
    this.toneMaterials = {};
    this.accentMaterials = {};

    this._buildSky();
    this._buildTunnel(quality);
    this._buildStars(quality);
    this._buildMaterials();
    this._buildPools();

    this._tmp = new THREE.Vector2();
  }

  _track(...items) {
    for (const item of items) this.disposables.push(item);
    return items[0];
  }

  _buildSky() {
    this.skyUniforms = { uTime: { value: 0 } };
    this.skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(270, 32, 16), this.skyMaterial);
    this.sky.renderOrder = -10;
    this.group.add(this.sky);
    this._track(this.sky.geometry, this.skyMaterial);
  }

  _buildTunnel(quality) {
    this.tunnelUniforms = {
      uScroll: { value: 0 },
      uIndigo: { value: new THREE.Color(PALETTE.indigo) },
      uCyan: { value: new THREE.Color(PALETTE.cyan) },
      uEmerald: { value: new THREE.Color(PALETTE.emerald) }
    };
    this.tunnelMaterial = new THREE.ShaderMaterial({
      uniforms: this.tunnelUniforms,
      vertexShader: TUNNEL_VERT,
      fragmentShader: TUNNEL_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      fog: false
    });
    this.tunnel = new THREE.Mesh(
      new THREE.CylinderGeometry(8.4, 8.4, 520, quality === 'low' ? 36 : 64, 1, true),
      this.tunnelMaterial
    );
    this.tunnel.position.z = -190;
    this.tunnel.rotation.x = Math.PI / 2;
    this.tunnel.renderOrder = -5;
    this.group.add(this.tunnel);
    this._track(this.tunnel.geometry, this.tunnelMaterial);
  }

  _buildStars(quality) {
    const count = quality === 'low' ? 420 : 780;
    this.starCount = count;
    this.starPositions = new Float32Array(count * 3);
    this.starBase = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      this._seedStar(i, rand(-280, 30));
    }

    this.starGeometry = new THREE.BufferGeometry();
    this.starGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.starPositions, 3).setUsage(THREE.DynamicDrawUsage)
    );

    const glow = new THREE.CanvasTexture(makeRadialTexture(64, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)'));
    glow.colorSpace = THREE.SRGBColorSpace;
    this.starMaterial = new THREE.PointsMaterial({
      color: 0xbfe9ff,
      size: 0.36,
      map: glow,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      fog: false
    });
    this.stars = new THREE.Points(this.starGeometry, this.starMaterial);
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
    this._track(this.starGeometry, this.starMaterial, glow);
  }

  _seedStar(i, z) {
    const i3 = i * 3;
    const angle = Math.random() * Math.PI * 2;
    const radius = rand(10.5, 62);
    this.starBase[i3] = Math.cos(angle) * radius;
    this.starBase[i3 + 1] = Math.sin(angle) * radius * 0.8;
    this.starBase[i3 + 2] = z;
    this.starPositions[i3] = this.starBase[i3];
    this.starPositions[i3 + 1] = this.starBase[i3 + 1];
    this.starPositions[i3 + 2] = z;
  }

  _buildMaterials() {
    for (const [tone, hex] of Object.entries(TONE_HEX)) {
      this.toneMaterials[tone] = this._track(
        new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) })
      );
    }

    const accents = {
      cyan: PALETTE.cyan,
      indigo: PALETTE.indigoSoft,
      emerald: PALETTE.emerald,
      rose: PALETTE.rose
    };

    for (const [name, hex] of Object.entries(accents)) {
      const color = new THREE.Color(hex);
      this.accentMaterials[name] = {
        body: this._track(new THREE.MeshBasicMaterial({ color })),
        glow: this._track(
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.18,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          })
        ),
        line: this._track(
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })
        )
      };
    }

    this.glowTexture = new THREE.CanvasTexture(makeRadialTexture(128));
    this.glowTexture.colorSpace = THREE.SRGBColorSpace;
    this._track(this.glowTexture);
  }

  _buildPools() {
    this.geometries = {
      gatePlane: this._track(new THREE.PlaneGeometry(16.4, 16.4)),
      gateRing: this._track(new THREE.TorusGeometry(1, 0.065, 6, 44)),
      barBody: this._track(new THREE.BoxGeometry(0.3, 10.8, 0.42)),
      barGlow: this._track(new THREE.BoxGeometry(0.82, 11.15, 0.82)),
      endCap: this._track(new THREE.SphereGeometry(0.18, 8, 8)),
      wallBox: this._track(new THREE.BoxGeometry(1, 1, 1)),
      orb: this._track(new THREE.IcosahedronGeometry(0.34, 1)),
      powerRing: this._track(new THREE.TorusGeometry(0.62, 0.05, 8, 32)),
      powerCore: this._track(new THREE.IcosahedronGeometry(0.34, 1))
    };
    this.geometries.wallEdges = this._track(new THREE.EdgesGeometry(this.geometries.wallBox));

    this.gateTextures = GATE_PATTERNS.map((pattern) => {
      const texture = drawGateTexture(pattern);
      this._track(texture);
      return texture;
    });

    this.labelTextures = new Map();
    for (const skill of SKILLS) {
      const texture = makeLabelTexture(skill.label, TONE_HEX[skill.tone]);
      this._track(texture);
      this.labelTextures.set(skill.label, texture);
    }
    const shieldLabel = makeLabelTexture('SHIELD', PALETTE.emerald);
    this._track(shieldLabel);
    this.labelTextures.set('SHIELD', shieldLabel);

    this.obstacles = { gate: [], bar: [], wall: [] };
    for (let i = 0; i < 6; i++) this.obstacles.gate.push(this._makeGate());
    for (let i = 0; i < 8; i++) this.obstacles.bar.push(this._makeBar());
    for (let i = 0; i < 6; i++) this.obstacles.wall.push(this._makeWall());

    this.orbPool = [];
    for (let i = 0; i < 16; i++) this.orbPool.push(this._makeOrb());

    this.powerPool = [];
    for (let i = 0; i < 3; i++) this.powerPool.push(this._makePower());
  }

  _makeGate() {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      map: this.gateTextures[0],
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 1
    });
    this._track(material);
    const plane = new THREE.Mesh(this.geometries.gatePlane, material);
    plane.renderOrder = 2;
    group.add(plane);

    const rings = [];
    for (let i = 0; i < 2; i++) {
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(PALETTE.cyan),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      this._track(ringMaterial);
      const ring = new THREE.Mesh(this.geometries.gateRing, ringMaterial);
      ring.renderOrder = 3;
      ring.visible = false;
      group.add(ring);
      rings.push(ring);
    }

    group.visible = false;
    this.group.add(group);
    return {
      type: 'gate',
      group,
      material,
      plane,
      rings,
      active: false,
      checked: false,
      z: -200,
      prevZ: -200,
      holes: [],
      accent: 'cyan'
    };
  }

  _makeBar() {
    const group = new THREE.Group();
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.cyan),
      transparent: true,
      opacity: 0.9
    });
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.cyan),
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this._track(bodyMaterial, glowMaterial);

    const glow = new THREE.Mesh(this.geometries.barGlow, glowMaterial);
    const body = new THREE.Mesh(this.geometries.barBody, bodyMaterial);
    group.add(glow, body);

    const left = new THREE.Mesh(this.geometries.endCap, bodyMaterial);
    left.position.y = -5.4;
    const right = new THREE.Mesh(this.geometries.endCap, bodyMaterial);
    right.position.y = 5.4;
    group.add(left, right);

    const spriteMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: new THREE.Color(PALETTE.cyan),
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this._track(spriteMaterial);
    for (const y of [-5.4, 5.4]) {
      const glowSprite = new THREE.Sprite(spriteMaterial);
      glowSprite.position.set(0, y, 0);
      glowSprite.scale.setScalar(2.1);
      group.add(glowSprite);
    }

    group.visible = false;
    this.group.add(group);
    return {
      type: 'bar',
      group,
      bodyMaterial,
      glowMaterial,
      spriteMaterial,
      active: false,
      checked: false,
      z: -200,
      prevZ: -200,
      angle: 0,
      spin: 0,
      accent: 'cyan'
    };
  }

  _makeWall() {
    const group = new THREE.Group();
    const panelMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#061326'),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(PALETTE.cyan),
      transparent: true,
      opacity: 0.72
    });
    this._track(panelMaterial, edgeMaterial);

    const panels = [];
    for (let i = 0; i < 2; i++) {
      const panel = new THREE.Mesh(this.geometries.wallBox, panelMaterial);
      const edges = new THREE.LineSegments(this.geometries.wallEdges, edgeMaterial);
      panels.push({ panel, edges });
      group.add(panel, edges);
    }

    const stripMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.cyan),
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this._track(stripMaterial);
    const strips = [];
    for (let i = 0; i < 2; i++) {
      const strip = new THREE.Mesh(this.geometries.wallBox, stripMaterial);
      group.add(strip);
      strips.push(strip);
    }

    group.visible = false;
    this.group.add(group);
    return {
      type: 'wall',
      group,
      panelMaterial,
      edgeMaterial,
      stripMaterial,
      panels,
      strips,
      active: false,
      checked: false,
      z: -200,
      prevZ: -200,
      axis: 'x',
      gapCenter: 0,
      baseCenter: 0,
      gapHalf: 1.38,
      amp: 0,
      moveSpeed: 0,
      phase: 0,
      accent: 'cyan'
    };
  }

  _makeOrb() {
    const group = new THREE.Group();
    const meshMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.cyan) });
    this._track(meshMaterial);
    const mesh = new THREE.Mesh(this.geometries.orb, meshMaterial);
    group.add(mesh);

    const haloMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: new THREE.Color(PALETTE.cyan),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this._track(haloMaterial);
    const halo = new THREE.Sprite(haloMaterial);
    halo.scale.setScalar(2.1);
    group.add(halo);

    const labelMaterial = new THREE.SpriteMaterial({
      map: this.labelTextures.get(SKILLS[0].label),
      transparent: true,
      depthWrite: false,
      depthTest: true
    });
    this._track(labelMaterial);
    const label = new THREE.Sprite(labelMaterial);
    label.scale.set(3.15, 0.79, 1);
    label.position.y = 0.8;
    group.add(label);

    group.visible = false;
    this.group.add(group);
    return {
      type: 'orb',
      group,
      mesh,
      meshMaterial,
      halo,
      haloMaterial,
      label,
      labelMaterial,
      active: false,
      z: -200,
      prevZ: -200,
      baseX: 0,
      baseY: 0,
      phase: 0,
      skill: SKILLS[0]
    };
  }

  _makePower() {
    const group = new THREE.Group();
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.emerald),
      transparent: true,
      opacity: 0.95
    });
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(PALETTE.cyanSoft),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const haloMaterial = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: new THREE.Color(PALETTE.emerald),
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this._track(coreMaterial, ringMaterial, haloMaterial);

    const core = new THREE.Mesh(this.geometries.powerCore, coreMaterial);
    const ring = new THREE.Mesh(this.geometries.powerRing, ringMaterial);
    const ring2 = new THREE.Mesh(this.geometries.powerRing, ringMaterial);
    ring2.rotation.x = Math.PI / 2;
    const halo = new THREE.Sprite(haloMaterial);
    halo.scale.setScalar(2.8);
    group.add(core, ring, ring2, halo);

    const labelMaterial = new THREE.SpriteMaterial({
      map: this.labelTextures.get(SKILLS[0].label),
      transparent: true,
      depthWrite: false
    });
    this._track(labelMaterial);
    const label = new THREE.Sprite(labelMaterial);
    label.scale.set(2.6, 0.65, 1);
    label.position.y = 0.9;
    group.add(label);

    group.visible = false;
    this.group.add(group);
    return {
      type: 'power',
      group,
      core,
      ring,
      ring2,
      halo,
      label,
      labelMaterial,
      active: false,
      z: -200,
      prevZ: -200,
      baseX: 0,
      baseY: 0,
      phase: 0
    };
  }

  reset() {
    for (const list of Object.values(this.obstacles)) {
      for (const o of list) this._deactivateObstacle(o);
    }
    for (const orb of this.orbPool) this._deactivateOrb(orb);
    for (const power of this.powerPool) this._deactivatePower(power);
    this.spawnTimer = SPAWN.firstDelay;
    this.orbTimer = 0.55;
    this.powerTimer = rand(9, 13);
    this.spawnCount = 0;
    this.orbBursts = 0;
    this.powerBursts = 0;
    this.skillBag = [];
    this.skillIndex = 0;
  }

  updateAmbient(dt, speed = 7) {
    this.time += dt;
    this.scroll += dt * speed;
    this.tunnelUniforms.uScroll.value = this.scroll;
    this.skyUniforms.uTime.value = this.time;
    this._moveStars(dt, speed);
  }

  advance(dt, speed, elapsed, playerX, playerY) {
    this.time = elapsed;
    this.scroll += speed * dt;
    this.tunnelUniforms.uScroll.value = this.scroll;
    this.skyUniforms.uTime.value = this.time;
    this._moveStars(dt, speed);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this._spawnObstacle(elapsed);
      const progress = clamp((this.spawnCount - 3) / 18, 0, 1);
      const interval = lerp(SPAWN.intervalStart, SPAWN.intervalMin, progress);
      this.spawnTimer = interval * rand(0.9, 1.16);
    }

    this.orbTimer -= dt;
    if (this.orbTimer <= 0) {
      this._spawnOrbs(elapsed);
      this.orbTimer = rand(SPAWN.orbIntervalStart, SPAWN.orbIntervalStart + 0.7);
    }

    this.powerTimer -= dt;
    if (this.powerTimer <= 0) {
      this._spawnPower(elapsed);
      this.powerTimer = rand(SPAWN.powerMin, SPAWN.powerMax);
    }

    this._updateObstacles(dt, speed, elapsed, playerX, playerY);
    this._updateOrbs(dt, speed, elapsed, playerX, playerY);
    this._updatePowers(dt, speed, elapsed, playerX, playerY);
  }

  _moveStars(dt, speed) {
    const zStep = speed * dt * 0.82;
    for (let i = 0; i < this.starCount; i++) {
      const i3 = i * 3;
      let z = this.starPositions[i3 + 2] + zStep;
      if (z > 34) {
        this._seedStar(i, rand(-300, -240));
        continue;
      }
      this.starPositions[i3 + 2] = z;
    }
    this.starGeometry.attributes.position.needsUpdate = true;
  }

  _nextSkill() {
    if (!this.skillBag.length || this.skillIndex >= this.skillBag.length) {
      this.skillBag = shuffle(SKILLS);
      this.skillIndex = 0;
    }
    return this.skillBag[this.skillIndex++];
  }

  _findInactive(list) {
    for (const item of list) if (!item.active) return item;
    return null;
  }

  _spawnObstacle(elapsed) {
    const r = Math.random();
    let type;
    if (this.spawnCount === 0) type = 'bar';
    else if (this.spawnCount === 1) type = 'gate';
    else if (this.spawnCount < 4) type = r < 0.5 ? 'bar' : 'gate';
    else type = r < 0.38 ? 'bar' : r < 0.7 ? 'gate' : 'wall';

    const progress = clamp(this.spawnCount / 16, 0, 1);
    const depth = this.spawnCount === 0 ? 104 : TUNING.spawnDepth;
    const z = -depth - rand(0, 14);
    this.spawnCount++;

    if (type === 'bar') {
      const o = this._findInactive(this.obstacles.bar);
      if (!o) return;
      const accent = Math.random() < 0.55 ? 'cyan' : 'indigo';
      o.active = true;
      o.checked = false;
      o.z = z;
      o.prevZ = z;
      o.angle = rand(0, Math.PI);
      const dir = Math.random() < 0.5 ? -1 : 1;
      o.spin = dir * lerp(0.35, 1.15, progress) * rand(0.8, 1.25);
      o.accent = accent;
      const color = new THREE.Color(accent === 'cyan' ? PALETTE.cyan : PALETTE.indigoSoft);
      o.bodyMaterial.color.copy(color);
      o.glowMaterial.color.copy(color);
      o.spriteMaterial.color.copy(color);
      o.group.position.set(0, 0, z);
      o.group.rotation.z = o.angle;
      o.group.visible = true;
    } else if (type === 'gate') {
      const o = this._findInactive(this.obstacles.gate);
      if (!o) return;
      let patternIndex = (Math.random() * 5) | 0;
      if (progress > 0.55 && Math.random() < 0.32) patternIndex = 5;
      const pattern = GATE_PATTERNS[patternIndex];
      const accent = Math.random() < 0.5 ? 'cyan' : 'emerald';
      o.active = true;
      o.checked = false;
      o.z = z;
      o.prevZ = z;
      o.holes = pattern.holes;
      o.accent = accent;
      o.material.map = this.gateTextures[patternIndex];
      o.material.needsUpdate = true;
      const color = new THREE.Color(accent === 'cyan' ? PALETTE.cyan : PALETTE.emerald);
      o.rings.forEach((ring, i) => {
        const hole = pattern.holes[i];
        ring.visible = Boolean(hole);
        if (hole) {
          ring.position.set(hole.x, hole.y, 0.08);
          ring.scale.setScalar(hole.r);
          ring.material.color.copy(color);
        }
      });
      o.group.position.set(0, 0, z);
      o.group.visible = true;
    } else {
      const o = this._findInactive(this.obstacles.wall);
      if (!o) return;
      const accent = Math.random() < 0.5 ? 'indigo' : 'emerald';
      o.active = true;
      o.checked = false;
      o.z = z;
      o.prevZ = z;
      o.axis = Math.random() < 0.72 ? 'x' : 'y';
      o.gapHalf = lerp(1.55, 1.28, progress);
      o.baseCenter = rand(-1.9, 1.9);
      o.gapCenter = o.baseCenter;
      o.amp = progress > 0.35 ? rand(0.55, 1.65) : 0;
      o.moveSpeed = rand(0.55, 1.15);
      o.phase = rand(0, Math.PI * 2);
      o.accent = accent;
      const color = new THREE.Color(accent === 'indigo' ? PALETTE.indigoSoft : PALETTE.emerald);
      o.edgeMaterial.color.copy(color);
      o.stripMaterial.color.copy(color);
      o.group.position.set(0, 0, z);
      o.group.visible = true;
      this._layoutWall(o, 0);
    }
  }

  _layoutWall(o, elapsed) {
    const half = 16.4 / 2;
    const gap = o.gapHalf;
    o.gapCenter = o.baseCenter + Math.sin(elapsed * o.moveSpeed + o.phase) * o.amp;

    if (o.axis === 'x') {
      const leftWidth = Math.max(0.1, o.gapCenter - gap + half);
      const rightWidth = Math.max(0.1, half - (o.gapCenter + gap));
      const leftX = -half + leftWidth / 2;
      const rightX = half - rightWidth / 2;
      const [a, b] = o.panels;
      a.panel.scale.set(leftWidth, 14, 0.5);
      a.panel.position.set(leftX, 0, 0);
      a.edges.scale.copy(a.panel.scale);
      a.edges.position.copy(a.panel.position);
      b.panel.scale.set(rightWidth, 14, 0.5);
      b.panel.position.set(rightX, 0, 0);
      b.edges.scale.copy(b.panel.scale);
      b.edges.position.copy(b.panel.position);

      o.strips[0].position.set(o.gapCenter - gap, 0, 0);
      o.strips[1].position.set(o.gapCenter + gap, 0, 0);
      o.strips[0].scale.set(0.18, 14, 1.1);
      o.strips[1].scale.set(0.18, 14, 1.1);
    } else {
      const bottomHeight = Math.max(0.1, o.gapCenter - gap + half);
      const topHeight = Math.max(0.1, half - (o.gapCenter + gap));
      const bottomY = -half + bottomHeight / 2;
      const topY = half - topHeight / 2;
      const [a, b] = o.panels;
      a.panel.scale.set(16.4, bottomHeight, 0.5);
      a.panel.position.set(0, bottomY, 0);
      a.edges.scale.copy(a.panel.scale);
      a.edges.position.copy(a.panel.position);
      b.panel.scale.set(16.4, topHeight, 0.5);
      b.panel.position.set(0, topY, 0);
      b.edges.scale.copy(b.panel.scale);
      b.edges.position.copy(b.panel.position);

      o.strips[0].position.set(0, o.gapCenter - gap, 0);
      o.strips[1].position.set(0, o.gapCenter + gap, 0);
      o.strips[0].scale.set(16.4, 0.18, 1.1);
      o.strips[1].scale.set(16.4, 0.18, 1.1);
    }
  }

  _spawnOrbs(elapsed) {
    const startZ = this.orbBursts === 0 ? -66 : -TUNING.spawnDepth + rand(8, 55);
    this.orbBursts += 1;
    const pattern = Math.random();
    const baseX = rand(-3.4, 3.4);
    const baseY = rand(-2.6, 2.6);

    if (pattern < 0.42) {
      const count = 3 + ((Math.random() * 3) | 0);
      for (let i = 0; i < count; i++) {
        this._activateOrb(
          this._nextSkill(),
          clamp(baseX + Math.sin(i * 0.95) * 1.5, -4.2, 4.2),
          clamp(baseY + Math.cos(i * 0.8) * 1.1, -3.5, 3.5),
          startZ - i * 7.5,
          elapsed
        );
      }
    } else if (pattern < 0.72) {
      const cx = rand(-2, 2);
      const cy = rand(-1.4, 1.4);
      const count = 5;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        this._activateOrb(
          this._nextSkill(),
          clamp(cx + Math.cos(a) * 1.55, -4.2, 4.2),
          clamp(cy + Math.sin(a) * 1.55, -3.4, 3.4),
          startZ,
          elapsed
        );
      }
    } else {
      this._activateOrb(this._nextSkill(), baseX, baseY, startZ, elapsed);
      this._activateOrb(this._nextSkill(), clamp(baseX + rand(1.2, 2.4), -4.2, 4.2), clamp(baseY + rand(-1.4, 1.4), -3.5, 3.5), startZ - 12, elapsed);
    }
  }

  _activateOrb(skill, x, y, z, elapsed) {
    const orb = this._findInactive(this.orbPool);
    if (!orb) return;
    orb.active = true;
    orb.skill = skill;
    orb.baseX = x;
    orb.baseY = y;
    orb.z = z;
    orb.prevZ = z;
    orb.phase = rand(0, Math.PI * 2) + elapsed;
    const colorHex = TONE_HEX[skill.tone];
    const color = new THREE.Color(colorHex);
    orb.meshMaterial.color.copy(color);
    orb.haloMaterial.color.copy(color);
    orb.labelMaterial.map = this.labelTextures.get(skill.label);
    orb.labelMaterial.needsUpdate = true;
    orb.group.position.set(x, y, z);
    orb.group.visible = true;
  }

  _spawnPower(elapsed) {
    const power = this._findInactive(this.powerPool);
    if (!power) return;
    power.active = true;
    power.baseX = rand(-3.4, 3.4);
    power.baseY = rand(-2.5, 2.5);
    power.z = this.powerBursts === 0 ? -96 : -TUNING.spawnDepth + rand(8, 40);
    this.powerBursts += 1;
    power.prevZ = power.z;
    power.phase = rand(0, Math.PI * 2) + elapsed;
    power.labelMaterial.map = this.labelTextures.get('SHIELD');
    power.labelMaterial.needsUpdate = true;
    power.group.position.set(power.baseX, power.baseY, power.z);
    power.group.visible = true;
  }

  _updateObstacles(dt, speed, elapsed, px, py) {
    for (const list of Object.values(this.obstacles)) {
      for (const o of list) {
        if (!o.active) continue;
        o.prevZ = o.z;
        o.z += speed * dt;

        if (o.type === 'bar') {
          o.angle += o.spin * dt;
          o.group.rotation.z = o.angle;
        } else if (o.type === 'wall') {
          this._layoutWall(o, elapsed);
        }
        o.group.position.z = o.z;

        if (!o.checked && o.z >= 0) {
          o.checked = true;
          const hit = this._obstacleHit(o, px, py);
          if (hit) {
            if (this.cb.onHit) this.cb.onHit(o);
          } else if (this.cb.onNearMiss) {
            const margin = this._obstacleMargin(o, px, py);
            if (margin < TUNING.nearMissMargin) this.cb.onNearMiss(o, margin);
          }
        }

        if (o.z > TUNING.despawnZ) this._deactivateObstacle(o);
      }
    }
  }

  _updateOrbs(dt, speed, elapsed, px, py) {
    for (const orb of this.orbPool) {
      if (!orb.active) continue;
      orb.prevZ = orb.z;
      orb.z += speed * dt;
      const bob = Math.sin(elapsed * 2.2 + orb.phase) * 0.16;
      orb.group.position.set(orb.baseX, orb.baseY + bob, orb.z);
      orb.group.rotation.z += dt * 1.7;
      orb.halo.scale.setScalar(2.0 + Math.sin(elapsed * 3.4 + orb.phase) * 0.16);

      if (orb.prevZ < 0 && orb.z >= 0) {
        if (Math.hypot(px - orb.baseX, py - orb.baseY) < 1.45) {
          if (this.cb.onOrb) this.cb.onOrb(orb.skill, orb);
          this._deactivateOrb(orb);
          continue;
        }
      }
      if (orb.z > TUNING.despawnZ) this._deactivateOrb(orb);
    }
  }

  _updatePowers(dt, speed, elapsed, px, py) {
    for (const power of this.powerPool) {
      if (!power.active) continue;
      power.prevZ = power.z;
      power.z += speed * dt;
      const bob = Math.sin(elapsed * 2.4 + power.phase) * 0.2;
      power.group.position.set(power.baseX, power.baseY + bob, power.z);
      power.ring.rotation.z += dt * 1.4;
      power.ring2.rotation.y += dt * 1.1;

      if (power.prevZ < 0 && power.z >= 0) {
        if (Math.hypot(px - power.baseX, py - power.baseY) < 1.6) {
          if (this.cb.onPower) this.cb.onPower(power);
          this._deactivatePower(power);
          continue;
        }
      }
      if (power.z > TUNING.despawnZ) this._deactivatePower(power);
    }
  }

  _obstacleHit(o, px, py) {
    if (o.type === 'bar') {
      return this._barDistance(o, px, py) < 0.34 + TUNING.playerRadius;
    }
    if (o.type === 'gate') {
      for (const hole of o.holes) {
        if (Math.hypot(px - hole.x, py - hole.y) < hole.r - TUNING.playerRadius * 0.72) return false;
      }
      return true;
    }
    if (o.type === 'wall') {
      const offset = o.axis === 'x' ? px - o.gapCenter : py - o.gapCenter;
      return Math.abs(offset) > o.gapHalf - TUNING.playerRadius * 0.72;
    }
    return false;
  }

  _obstacleMargin(o, px, py) {
    if (o.type === 'bar') {
      return this._barDistance(o, px, py) - (0.34 + TUNING.playerRadius);
    }
    if (o.type === 'gate') {
      let best = Infinity;
      for (const hole of o.holes) {
        const edge = hole.r - TUNING.playerRadius * 0.72 - Math.hypot(px - hole.x, py - hole.y);
        if (edge < best) best = edge;
      }
      return best;
    }
    if (o.type === 'wall') {
      const offset = o.axis === 'x' ? px - o.gapCenter : py - o.gapCenter;
      return o.gapHalf - TUNING.playerRadius * 0.72 - Math.abs(offset);
    }
    return Infinity;
  }

  _barDistance(o, px, py) {
    const cos = Math.cos(o.angle);
    const sin = Math.sin(o.angle);
    const projection = clamp(px * cos + py * sin, -5.4, 5.4);
    return Math.hypot(px - cos * projection, py - sin * projection);
  }

  _deactivateObstacle(o) {
    if (!o.active) return;
    o.active = false;
    o.group.visible = false;
  }

  _deactivateOrb(orb) {
    orb.active = false;
    orb.group.visible = false;
  }

  _deactivatePower(power) {
    power.active = false;
    power.group.visible = false;
  }

  shatter(obstacle) {
    this._deactivateObstacle(obstacle);
  }

  setQuality(quality) {
    this.quality = quality;
    this.starGeometry.setDrawRange(0, quality === 'low' ? Math.floor(this.starCount * 0.55) : this.starCount);
  }

  dispose() {
    for (const list of Object.values(this.obstacles)) {
      for (const o of list) {
        o.group.visible = false;
      }
    }
    for (const orb of this.orbPool) orb.group.visible = false;
    for (const power of this.powerPool) power.group.visible = false;
    this.group.removeFromParent();
    disposeObject(this.group);
  }
}
