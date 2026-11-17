import * as THREE from './vendor/three.module.min.js';
import { PALETTE, QUALITY } from './config.js';
import { damp } from './utils.js';

const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BRIGHT_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uThreshold;
  uniform float uKnee;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    float l = max(c.r, max(c.g, c.b));
    float w = smoothstep(uThreshold, uThreshold + uKnee, l);
    gl_FragColor = vec4(c * w, 1.0);
  }
`;

const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uDirection;
  varying vec2 vUv;
  void main() {
    vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270270;
    sum += texture2D(tDiffuse, vUv + uDirection * 1.3846153846) * 0.3162162162;
    sum += texture2D(tDiffuse, vUv - uDirection * 1.3846153846) * 0.3162162162;
    sum += texture2D(tDiffuse, vUv + uDirection * 3.2307692308) * 0.0702702703;
    sum += texture2D(tDiffuse, vUv - uDirection * 3.2307692308) * 0.0702702703;
    gl_FragColor = sum;
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tBase;
  uniform sampler2D tBloom;
  uniform vec2 uResolution;
  uniform float uBloom;
  uniform float uAberration;
  uniform float uDamage;
  uniform float uTime;
  uniform float uGrain;
  varying vec2 vUv;

  vec3 toSRGB(vec3 c) {
    c = max(c, vec3(0.0));
    return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(vec3(0.0031308), c));
  }

  void main() {
    vec2 centre = vUv - 0.5;
    float radius = length(centre);
    vec2 off = centre * (0.0011 + uAberration) * (0.45 + radius * 2.6);

    vec3 base;
    base.r = texture2D(tBase, vUv + off).r;
    base.g = texture2D(tBase, vUv).g;
    base.b = texture2D(tBase, vUv - off).b;

    vec3 bloom = texture2D(tBloom, vUv).rgb;
    vec3 col = base + bloom * uBloom;

    float vignette = 1.0 - smoothstep(0.28, 0.82, radius);
    col *= mix(0.58, 1.0, vignette);

    float grain = fract(sin(dot(vUv * uResolution + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * uGrain;

    float damageEdge = smoothstep(0.1, 0.72, radius);
    col = mix(col, vec3(0.55, 0.06, 0.1), uDamage * damageEdge * 0.65);

    gl_FragColor = vec4(toSRGB(col), 1.0);
  }
`;

export class Engine {
  constructor(canvas, quality = 'high') {
    this.canvas = canvas;
    this.quality = quality;
    this.postEnabled = QUALITY[quality].post;
    this.maxDpr = QUALITY[quality].dpr;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    this.renderer.setClearColor(new THREE.Color(PALETTE.bg), 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.bg);
    this.scene.fog = new THREE.Fog(new THREE.Color(PALETTE.bg), 36, 190);

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 480);
    this.camera.position.set(0, 1.2, 9);

    this._addLights();
    this._buildPost();
    this.resize();

    this._abTarget = 0;
    this._abValue = 0;
    this._damageTarget = 0;
    this._damageValue = 0;
    this._time = 0;
  }

  _addLights() {
    const hemi = new THREE.HemisphereLight(0x8ab4ff, 0x020617, 1.5);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xbde9ff, 2.2);
    key.position.set(4, 7, 6);
    this.scene.add(key);

    const indigo = new THREE.PointLight(0x6366f1, 32, 22, 2);
    indigo.position.set(-7, 2, 4);
    this.scene.add(indigo);

    const emerald = new THREE.PointLight(0x34d399, 22, 20, 2);
    emerald.position.set(6, -3, 2);
    this.scene.add(emerald);
  }

  _buildPost() {
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadGeometry = new THREE.PlaneGeometry(2, 2);
    this.quadScene = new THREE.Scene();
    this.quad = new THREE.Mesh(this.quadGeometry, new THREE.MeshBasicMaterial());
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);

    const targetOptions = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    };
    this.rtScene = new THREE.WebGLRenderTarget(2, 2, { ...targetOptions, depthBuffer: true });
    this.rtBright = new THREE.WebGLRenderTarget(2, 2, targetOptions);
    this.rtBlurA = new THREE.WebGLRenderTarget(2, 2, targetOptions);
    this.rtBlurB = new THREE.WebGLRenderTarget(2, 2, targetOptions);

    this.brightMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: 0.42 },
        uKnee: { value: 0.35 }
      },
      vertexShader: QUAD_VERT,
      fragmentShader: BRIGHT_FRAG,
      depthTest: false,
      depthWrite: false
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2() }
      },
      vertexShader: QUAD_VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false,
      depthWrite: false
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tBase: { value: this.rtScene.texture },
        tBloom: { value: this.rtBlurB.texture },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uBloom: { value: 1.15 },
        uAberration: { value: 0 },
        uDamage: { value: 0 },
        uTime: { value: 0 },
        uGrain: { value: 0.035 }
      },
      vertexShader: QUAD_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false
    });
  }

  setQuality(quality) {
    this.quality = quality;
    this.postEnabled = QUALITY[quality].post;
    this.maxDpr = QUALITY[quality].dpr;
    this._dpr = null;
    this.resize();
  }

  resize() {
    const width = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    const height = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    if (width === this.width && height === this.height && this._dpr === this.renderer.getPixelRatio()) return;

    this.width = width;
    this.height = height;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this._dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const bw = Math.max(2, Math.floor(buffer.x));
    const bh = Math.max(2, Math.floor(buffer.y));
    this.rtScene.setSize(bw, bh);

    const bloomScale = 0.25;
    const lw = Math.max(2, Math.floor(bw * bloomScale));
    const lh = Math.max(2, Math.floor(bh * bloomScale));
    this.rtBright.setSize(lw, lh);
    this.rtBlurA.setSize(lw, lh);
    this.rtBlurB.setSize(lw, lh);

    this.compositeMaterial.uniforms.uResolution.value.set(bw, bh);
    this.blurTexel = new THREE.Vector2(1 / lw, 1 / lh);
  }

  setCameraFov(target, dt) {
    const next = damp(this.camera.fov, target, 0.18, dt);
    if (Math.abs(next - this.camera.fov) > 0.002) {
      this.camera.fov = next;
      this.camera.updateProjectionMatrix();
    }
  }

  setAberration(value) {
    this._abTarget = value;
  }

  setDamage(value) {
    this._damageTarget = value;
  }

  _renderQuad(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  render(dt) {
    this._time += dt;
    this._abValue = damp(this._abValue, this._abTarget, 0.12, dt);
    this._damageValue = damp(this._damageValue, this._damageTarget, 0.08, dt);

    this.renderer.setRenderTarget(null);
    if (!this.postEnabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    this.brightMaterial.uniforms.tDiffuse.value = this.rtScene.texture;
    this._renderQuad(this.brightMaterial, this.rtBright);

    // Two quarter-resolution blur iterations give a wide, soft neon bloom.
    let source = this.rtBright;
    for (let i = 0; i < 2; i++) {
      this.blurMaterial.uniforms.tDiffuse.value = source.texture;
      this.blurMaterial.uniforms.uDirection.value.set(this.blurTexel.x * (i + 1), 0);
      this._renderQuad(this.blurMaterial, this.rtBlurA);

      this.blurMaterial.uniforms.tDiffuse.value = this.rtBlurA.texture;
      this.blurMaterial.uniforms.uDirection.value.set(0, this.blurTexel.y * (i + 1));
      this._renderQuad(this.blurMaterial, this.rtBlurB);
      source = this.rtBlurB;
    }

    const composite = this.compositeMaterial.uniforms;
    composite.tBase.value = this.rtScene.texture;
    composite.tBloom.value = this.rtBlurB.texture;
    composite.uAberration.value = this._abValue;
    composite.uDamage.value = this._damageValue;
    composite.uTime.value = this._time;

    this._renderQuad(this.compositeMaterial, null);
  }

  dispose() {
    this.rtScene.dispose();
    this.rtBright.dispose();
    this.rtBlurA.dispose();
    this.rtBlurB.dispose();
    this.quadGeometry.dispose();
    this.quad.material.dispose();
    this.brightMaterial.dispose();
    this.blurMaterial.dispose();
    this.compositeMaterial.dispose();
    this.renderer.dispose();
    if (this.renderer.forceContextLoss) this.renderer.forceContextLoss();
  }
}
