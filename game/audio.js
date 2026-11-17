export class AudioEngine {
  constructor({ muted = false } = {}) {
    this.context = null;
    this.master = null;
    this.compressor = null;
    this.muted = muted;
    this.ambient = null;
    this.started = false;
    this.noiseBuffer = null;
  }

  unlock() {
    if (!this.context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.context = new Ctx();
      this.compressor = this.context.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 22;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.004;
      this.compressor.release.value = 0.24;
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.compressor).connect(this.context.destination);
      this._makeNoise();
    }
    if (this.context.state === 'suspended') this.context.resume();
    return true;
  }

  _makeNoise() {
    const ctx = this.context;
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    this.noiseBuffer = buffer;
  }

  setMuted(muted) {
    this.muted = muted;
    if (!this.master || !this.context) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.55, now, 0.04);
  }

  _env(node, start, attack, peak, decay) {
    const gain = node.gain;
    gain.cancelScheduledValues(start);
    gain.setValueAtTime(0.0001, start);
    gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
    gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  }

  tone(freq, duration = 0.2, type = 'sine', volume = 0.08, when = 0, slideTo = null) {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
    this._env(gain, start, 0.006, volume, duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.06);
  }

  noise(duration = 0.3, volume = 0.12, type = 'bandpass', from = 1200, to = 300, q = 1.2, when = 0) {
    if (!this.context || !this.master || !this.noiseBuffer) return;
    const ctx = this.context;
    const start = ctx.currentTime + when;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), start + duration);
    const gain = ctx.createGain();
    this._env(gain, start, 0.008, volume, duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.05);
  }

  pickup(combo = 0) {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const base = scale[combo % scale.length];
    this.tone(base, 0.18, 'triangle', 0.07);
    this.tone(base * 1.5, 0.26, 'sine', 0.045, 0.035);
    this.tone(base * 2, 0.32, 'sine', 0.025, 0.08);
  }

  nearMiss() {
    this.noise(0.22, 0.1, 'bandpass', 1800, 260, 2.8);
    this.tone(120, 0.12, 'sine', 0.04, 0, 70);
  }

  shield() {
    [392, 523.25, 659.25, 880].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.055, i * 0.055));
    this.noise(0.5, 0.05, 'highpass', 2500, 5000, 0.8);
  }

  shieldHit() {
    this.tone(880, 0.18, 'square', 0.035, 0, 440);
    this.noise(0.28, 0.1, 'bandpass', 2600, 500, 2);
  }

  crash() {
    this.noise(0.9, 0.3, 'lowpass', 1600, 70, 0.9);
    this.tone(96, 0.8, 'sawtooth', 0.16, 0, 28);
    this.tone(64, 0.9, 'sine', 0.18, 0.02, 20);
    this.tone(180, 0.4, 'square', 0.04, 0, 60);
  }

  powerEmpty() {
    this.tone(180, 0.12, 'sine', 0.04, 0, 110);
  }

  countdown(n) {
    if (n > 0) this.tone(520, 0.12, 'square', 0.045);
    else {
      this.tone(1040, 0.35, 'triangle', 0.07);
      this.tone(1560, 0.4, 'sine', 0.04, 0.04);
    }
  }

  startRun() {
    this.tone(130.81, 0.45, 'sawtooth', 0.035, 0, 261.63);
    this.noise(0.4, 0.04, 'bandpass', 400, 2400, 2);
  }

  levelUp() {
    [659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.05, i * 0.07));
  }

  ui() {
    this.tone(620, 0.06, 'sine', 0.035, 0, 760);
  }

  newBest() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
      this.tone(f, 0.45, 'triangle', 0.055, i * 0.09)
    );
  }

  startAmbient() {
    if (!this.context || !this.master || this.ambient) return;
    const ctx = this.context;
    const now = ctx.currentTime;

    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(this.master);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 1.4;
    filter.connect(bus);

    const oscs = [55, 82.5, 110].map((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = index === 2 ? 'triangle' : 'sawtooth';
      osc.frequency.value = frequency;
      osc.detune.value = (index - 1) * 7;
      const gain = ctx.createGain();
      gain.gain.value = index === 2 ? 0.12 : 0.2;
      osc.connect(gain).connect(filter);
      osc.start();
      return osc;
    });

    let noiseSource = null;
    if (this.noiseBuffer) {
      noiseSource = ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      noiseSource.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 700;
      noiseFilter.Q.value = 0.5;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.08;
      noiseSource.connect(noiseFilter).connect(noiseGain).connect(bus);
      noiseSource.start();
    }

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.075;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 150;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.exponentialRampToValueAtTime(0.34, now + 1.6);

    this.ambient = { bus, filter, oscs, noiseSource, lfo, base: 0.34 };
  }

  setIntensity(speedNorm) {
    if (!this.ambient || !this.context) return;
    const now = this.context.currentTime;
    this.ambient.filter.frequency.setTargetAtTime(260 + speedNorm * 900, now, 0.2);
    this.ambient.bus.gain.setTargetAtTime(0.26 + speedNorm * 0.18, now, 0.25);
  }

  duckAmbient(ducked) {
    if (!this.ambient || !this.context) return;
    const now = this.context.currentTime;
    this.ambient.bus.gain.setTargetAtTime(ducked ? 0.1 : 0.34, now, 0.25);
  }

  stopAmbient(fade = 0.6) {
    if (!this.ambient || !this.context) return;
    const now = this.context.currentTime;
    this.ambient.bus.gain.cancelScheduledValues(now);
    this.ambient.bus.gain.setTargetAtTime(0.0001, now, fade / 3);
  }

  dispose() {
    if (!this.context) return;
    try {
      this.stopAmbient(0.1);
      if (this.ambient) {
        const a = this.ambient;
        a.oscs.forEach((o) => o.stop());
        if (a.noiseSource) a.noiseSource.stop();
        a.lfo.stop();
      }
      this.context.close();
    } catch {
      /* context may already be closed */
    }
    this.context = null;
    this.master = null;
    this.ambient = null;
  }
}
