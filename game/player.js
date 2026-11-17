import * as THREE from './vendor/three.module.min.js';
import { TUNING } from './config.js';
import { clamp, damp, disposeObject, makeRadialTexture } from './utils.js';

function buildShip(glowTexture) {
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x0b1a2c,
    metalness: 0.78,
    roughness: 0.26,
    emissive: new THREE.Color(0x0b3e4a),
    emissiveIntensity: 0.55
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x050b14,
    metalness: 0.65,
    roughness: 0.42
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x07131d,
    metalness: 0.35,
    roughness: 0.16,
    emissive: new THREE.Color(0x22d3ee),
    emissiveIntensity: 1.25
  });
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x67e8f9,
    transparent: true,
    opacity: 0.8
  });
  const neonMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const indigoMat = new THREE.MeshBasicMaterial({
    color: 0x818cf8,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const hullGeometry = new THREE.ConeGeometry(0.46, 2.1, 6);
  hullGeometry.rotateX(-Math.PI / 2);
  const hull = new THREE.Mesh(hullGeometry, hullMat);
  hull.position.z = -0.12;
  group.add(hull);

  const hullEdges = new THREE.LineSegments(new THREE.EdgesGeometry(hullGeometry, 24), edgeMat);
  hullEdges.position.copy(hull.position);
  group.add(hullEdges);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.5), darkMat);
  spine.position.set(0, 0.28, 0.12);
  group.add(spine);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), glassMat);
  cockpit.scale.set(0.9, 0.62, 1.55);
  cockpit.position.set(0, 0.19, -0.22);
  group.add(cockpit);

  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.055, 0.64), hullMat);
    wing.position.set(side * 0.72, -0.06, 0.28);
    wing.rotation.z = side * 0.24;
    wing.rotation.y = side * -0.28;
    group.add(wing);

    const wingEdge = new THREE.LineSegments(new THREE.EdgesGeometry(wing.geometry), edgeMat);
    wingEdge.position.copy(wing.position);
    wingEdge.rotation.copy(wing.rotation);
    group.add(wingEdge);

    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), side < 0 ? neonMat : indigoMat);
    tip.position.set(side * 1.27, -0.02, 0.2);
    group.add(tip);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.42), darkMat);
    fin.position.set(side * 0.4, 0.2, 0.67);
    fin.rotation.z = side * 0.25;
    group.add(fin);
  }

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 8, 32), neonMat);
  ring.position.z = 0.86;
  group.add(ring);

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), indigoMat);
  core.position.z = 0.9;
  group.add(core);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture,
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  glow.scale.setScalar(2.3);
  glow.position.z = 1.0;
  group.add(glow);

  return { group, glow, edgeMat, glassMat, hullMat, darkMat, neonMat, indigoMat };
}

function buildShield() {
  const group = new THREE.Group();

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      wireframe: true,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  group.add(shell);

  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(1.35, 20, 14),
    new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.07,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  group.add(inner);

  group.visible = false;
  return { group, shell, inner };
}

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.shieldTime = 0;
    this.tilt = 0;
    this.pitch = 0;
    this.clock = 0;

    const glowTexture = new THREE.CanvasTexture(makeRadialTexture(128));
    glowTexture.colorSpace = THREE.SRGBColorSpace;
    this.glowTexture = glowTexture;
    this.ship = buildShip(glowTexture);
    this.shield = buildShield();

    this.group = new THREE.Group();
    this.group.add(this.ship.group, this.shield.group);
    scene.add(this.group);

    this._enginePos = new THREE.Vector3();
    this.reset();
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.shieldTime = 0;
    this.tilt = 0;
    this.pitch = 0;
    this.clock = 0;
    this.group.visible = true;
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.group.scale.setScalar(1);
    this.ship.group.rotation.set(0, 0, 0);
    this.shield.group.visible = false;
  }

  setShield(seconds) {
    this.shieldTime = Math.max(0, seconds);
  }

  activateShield(seconds) {
    this.shieldTime = seconds;
  }

  update(dt, input, speedNorm, elapsed, mode) {
    this.clock = elapsed;
    let bankingSource = 0;

    if (mode === 'menu') {
      this.x = Math.sin(elapsed * 0.52) * 2.15;
      this.y = Math.sin(elapsed * 0.79) * 0.42 + 0.1;
      bankingSource = Math.cos(elapsed * 0.52) * 2.15 * 0.52;
      this.vx = bankingSource;
      this.vy = 0;
    } else {
      const pointerActive = input && input.pointerActive && input.target;
      if (pointerActive) {
        const tx = input.target.x;
        const ty = input.target.y;
        this.x = damp(this.x, tx, 0.065, dt);
        this.y = damp(this.y, ty, 0.065, dt);
        this.vx = (this.x - (this._prevX ?? this.x)) / Math.max(dt, 0.001);
        this.vy = (this.y - (this._prevY ?? this.y)) / Math.max(dt, 0.001);
        bankingSource = this.vx;
      } else {
        const ax = input ? input.ax : 0;
        const ay = input ? input.ay : 0;
        const maxSteer = 11.5 + speedNorm * 2.2;
        const targetVx = ax * maxSteer;
        const targetVy = ay * maxSteer * 0.9;
        this.vx = damp(this.vx, targetVx, 0.085, dt);
        this.vy = damp(this.vy, targetVy, 0.085, dt);
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        bankingSource = this.vx;
      }

      const radius = Math.hypot(this.x, this.y);
      if (radius > TUNING.playRadius) {
        const s = TUNING.playRadius / radius;
        this.x *= s;
        this.y *= s;
        this.vx *= 0.5;
        this.vy *= 0.5;
      }
    }

    this._prevX = this.x;
    this._prevY = this.y;

    const bob = mode === 'menu' ? Math.sin(elapsed * 2.1) * 0.045 : Math.sin(elapsed * 2.8) * 0.025;
    this.group.position.set(this.x, this.y + bob, 0.15);

    const targetTilt = clamp(-bankingSource * 0.012, -0.55, 0.55);
    const targetPitch = clamp(this.vy * 0.006, -0.22, 0.22) - speedNorm * 0.018;
    this.tilt = damp(this.tilt, targetTilt, 0.09, dt);
    this.pitch = damp(this.pitch, targetPitch, 0.11, dt);
    this.ship.group.rotation.z = this.tilt;
    this.ship.group.rotation.x = this.pitch;
    this.ship.group.rotation.y = clamp(-this.vx * 0.0022, -0.1, 0.1);

    this.ship.glow.material.opacity = 0.55 + speedNorm * 0.35 + Math.sin(elapsed * 9) * 0.06;
    this.ship.glow.scale.setScalar(2.05 + speedNorm * 0.5 + Math.sin(elapsed * 7) * 0.08);

    if (this.shieldTime > 0) {
      this.shieldTime = Math.max(0, this.shieldTime - dt);
      this.shield.group.visible = true;
      const pulse = 1 + Math.sin(elapsed * 10) * 0.025;
      this.shield.group.scale.setScalar(pulse);
      this.shield.shell.rotation.y += dt * 0.65;
      this.shield.shell.rotation.x += dt * 0.3;
      this.shield.shell.material.opacity = 0.2 + Math.sin(elapsed * 12) * 0.05;
      this.shield.inner.material.opacity = 0.055 + Math.sin(elapsed * 8) * 0.02;
    } else {
      this.shield.group.visible = false;
    }
  }

  getEnginePosition(target = this._enginePos) {
    target.set(this.x, this.y + 0.1, 1.15);
    return target;
  }

  hide() {
    this.group.visible = false;
  }

  dispose() {
    disposeObject(this.group);
    this.glowTexture.dispose();
    this.group.removeFromParent();
  }
}
