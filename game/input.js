import { TUNING } from './config.js';
import { clamp } from './utils.js';

const KEY_LEFT = new Set(['ArrowLeft', 'KeyA']);
const KEY_RIGHT = new Set(['ArrowRight', 'KeyD']);
const KEY_UP = new Set(['ArrowUp', 'KeyW']);
const KEY_DOWN = new Set(['ArrowDown', 'KeyS']);
const GAME_KEYS = new Set([
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Escape', 'KeyP'
]);

export class Input {
  constructor(canvas, { onAction, onPointer } = {}) {
    this.canvas = canvas;
    this.onAction = onAction || (() => {});
    this.onPointer = onPointer || (() => {});
    this.keys = new Set();
    this.enabled = false;
    this.pointerActive = false;
    this.pointerId = null;
    this.target = { x: 0, y: 0 };
    this.gamepadIndex = null;
    this.prevGamepadPower = false;
    this.prevGamepadPause = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onPointerDown = this._onPointerDown.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerUp = this._onPointerUp.bind(this);
    this._onGamepad = this._onGamepad.bind(this);

    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerup', this._onPointerUp);
    canvas.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('gamepadconnected', this._onGamepad);
  }

  _interactiveTarget(event) {
    return event.target instanceof Element &&
      event.target.closest('button, a, input, select, textarea, [role="button"]');
  }

  _onKeyDown(event) {
    if (!GAME_KEYS.has(event.code)) return;
    const interactive = this._interactiveTarget(event);
    // Let focused buttons handle Space/Enter themselves.
    if (interactive && (event.code === 'Space' || event.code === 'Enter')) return;

    if (event.code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) this.onAction('pause');
      return;
    }
    if (event.code === 'KeyP') {
      event.preventDefault();
      if (!event.repeat) this.onAction('pause');
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) this.onAction('power');
      return;
    }

    event.preventDefault();
    this.keys.add(event.code);
    this.pointerActive = false;
  }

  _onKeyUp(event) {
    this.keys.delete(event.code);
  }

  _onBlur() {
    this.keys.clear();
    this.pointerActive = false;
  }

  _mapPointer(event) {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((event.clientY - rect.top) / rect.height) * 2;
    let x = nx * TUNING.playRadius * 0.94;
    let y = ny * TUNING.playRadius * 0.78;
    const radius = Math.hypot(x, y);
    if (radius > TUNING.playRadius) {
      x = (x / radius) * TUNING.playRadius;
      y = (y / radius) * TUNING.playRadius;
    }
    this.target.x = clamp(x, -TUNING.playRadius, TUNING.playRadius);
    this.target.y = clamp(y, -TUNING.playRadius, TUNING.playRadius);
  }

  _onPointerDown(event) {
    if (!this.enabled) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.pointerActive = true;
    this.keys.clear();
    this.canvas.setPointerCapture?.(event.pointerId);
    this._mapPointer(event);
    this.onPointer(event);
  }

  _onPointerMove(event) {
    if (!this.enabled || !this.pointerActive || event.pointerId !== this.pointerId) return;
    event.preventDefault();
    this._mapPointer(event);
    this.onPointer(event);
  }

  _onPointerUp(event) {
    if (event.pointerId !== this.pointerId) return;
    this.pointerActive = false;
    this.pointerId = null;
  }

  _onGamepad(event) {
    this.gamepadIndex = event.gamepad.index;
  }

  _pollGamepad() {
    if (this.gamepadIndex === null || !navigator.getGamepads) {
      return { ax: 0, ay: 0 };
    }
    const pad = navigator.getGamepads()[this.gamepadIndex];
    if (!pad) return { ax: 0, ay: 0 };

    const deadzone = 0.18;
    let ax = Math.abs(pad.axes[0] || 0) > deadzone ? pad.axes[0] : 0;
    let ay = Math.abs(pad.axes[1] || 0) > deadzone ? -pad.axes[1] : 0;

    const dpadUp = pad.buttons[12]?.pressed;
    const dpadDown = pad.buttons[13]?.pressed;
    const dpadLeft = pad.buttons[14]?.pressed;
    const dpadRight = pad.buttons[15]?.pressed;
    if (dpadLeft) ax = -1;
    if (dpadRight) ax = 1;
    if (dpadUp) ay = 1;
    if (dpadDown) ay = -1;

    const power = Boolean(pad.buttons[0]?.pressed || pad.buttons[7]?.pressed);
    const pause = Boolean(pad.buttons[9]?.pressed);
    if (power && !this.prevGamepadPower && this.enabled) this.onAction('power');
    if (pause && !this.prevGamepadPause) this.onAction('pause');
    this.prevGamepadPower = power;
    this.prevGamepadPause = pause;

    return { ax, ay };
  }

  getMovement() {
    let ax = 0;
    let ay = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) ax -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) ax += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) ay += 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) ay -= 1;

    const gamepad = this._pollGamepad();
    if (Math.abs(gamepad.ax) > Math.abs(ax)) ax = gamepad.ax;
    if (Math.abs(gamepad.ay) > Math.abs(ay)) ay = gamepad.ay;

    const length = Math.hypot(ax, ay);
    if (length > 1) {
      ax /= length;
      ay /= length;
    }

    if (ax !== 0 || ay !== 0) this.pointerActive = false;

    return {
      ax,
      ay,
      pointerActive: this.pointerActive,
      target: this.target
    };
  }

  reset() {
    this.keys.clear();
    this.pointerActive = false;
    this.pointerId = null;
    this.target.x = 0;
    this.target.y = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    window.removeEventListener('gamepadconnected', this._onGamepad);
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('pointerup', this._onPointerUp);
    this.canvas.removeEventListener('pointercancel', this._onPointerUp);
  }
}
