export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (list) => list[(Math.random() * list.length) | 0];

// Frame-rate independent exponential smoothing.
export const damp = (current, target, tau, dt) =>
  current + (target - current) * (1 - Math.exp(-dt / Math.max(0.0001, tau)));

export const formatNumber = (n) => Math.round(n).toLocaleString('en-US');

export const formatDistance = (m) =>
  m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m';

export function storageGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

export function storageSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* storage can be unavailable in private mode */
  }
}

export const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const finePointer = () =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function autoQuality() {
  const nav = navigator;
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory || 4;
  const mobile = window.matchMedia('(pointer: coarse)').matches;
  return cores <= 4 || memory <= 4 || mobile || window.innerWidth < 760 ? 'low' : 'high';
}

export function webglSupported() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return false;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function makeRadialTexture(size = 128, inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.22, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const material of materials) {
      for (const key of Object.keys(material)) {
        const value = material[key];
        if (value && value.isTexture) value.dispose();
      }
      material.dispose();
    }
  });
}
