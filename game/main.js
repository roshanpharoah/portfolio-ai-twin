import { Engine } from './engine.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Particles } from './particles.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { PALETTE, QUALITY, TONE_HEX, TUNING } from './config.js';
import {
  clamp,
  damp,
  reducedMotion,
  storageGet,
  storageSet
} from './utils.js';

const KEY_BEST = 'neon-drift:best';
const KEY_RUNS = 'neon-drift:runs';
const KEY_MUTED = 'neon-drift:muted';
const KEY_QUALITY = 'neon-drift:quality';

const EMPTY_INPUT = { ax: 0, ay: 0, pointerActive: false, target: { x: 0, y: 0 } };

export function createGame({ root, canvas, quality: initialQuality = 'high' }) {
  let rm = reducedMotion();
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const engine = new Engine(canvas, initialQuality);
  const scene = engine.scene;
  const qualityBudget = () => (quality === 'high' ? 1 : 0.42);

  let quality = initialQuality;
  let muted = storageGet(KEY_MUTED, '0') === '1';
  const storedBest = Number(storageGet(KEY_BEST, 0));
  const storedRuns = Number(storageGet(KEY_RUNS, 0));
  let best = Number.isFinite(storedBest) ? Math.max(0, Math.floor(storedBest)) : 0;
  let runs = Number.isFinite(storedRuns) ? Math.max(0, Math.floor(storedRuns)) : 0;

  let state = 'loading';
  let prevState = 'playing';
  let scoreF = 0;
  let score = 0;
  let distance = 0;
  let speed = TUNING.baseSpeed;
  let elapsed = 0;
  let combo = 0;
  let comboTimer = 0;
  let multiplier = 1;
  let shieldCharges = 0;
  let orbsCollected = 0;
  let maxCombo = 0;
  let topSpeed = TUNING.baseSpeed;
  let sector = 1;
  const skillsFound = new Set();

  let countdownLeft = 0;
  let lastCountdown = 4;
  let deathTimer = 0;
  let shake = 0;
  let fovPulse = 0;
  let menuTime = 0;
  let hudAcc = 0;
  let newBest = false;
  let camX = 0;
  let camY = 1.2;
  let camZ = 9.2;
  let renderDirty = true;
  let raf = 0;
  let last = 0;
  let disposed = false;

  const audio = new AudioEngine({ muted });
  audio.setMuted(muted);

  const player = new Player(scene);
  const particles = new Particles(scene, QUALITY.high.particles);
  particles.setPixelRatio(engine.renderer.getPixelRatio());

  const world = new World(
    scene,
    {
      onOrb: handleOrb,
      onPower: handlePower,
      onHit: handleHit,
      onNearMiss: handleNearMiss
    },
    initialQuality
  );
  world.setQuality(initialQuality);

  let ui;

  const actions = {
    start: startRun,
    restart: startRun,
    resume: resumeGame,
    pause: togglePause,
    power: triggerPrimary,
    fullscreen: toggleFullscreen,
    sound: toggleMute,
    quality: () => setQuality(quality === 'high' ? 'low' : 'high'),
    qualityToggle: () => setQuality(quality === 'high' ? 'low' : 'high'),
    setQuality
  };

  ui = new UI(root, actions);
  ui.setBest(best);
  ui.setRuns(runs);
  ui.setQuality(quality);
  ui.setSound(muted);
  ui.resetHud(best);

  const input = new Input(canvas, {
    onAction: handleAction,
    onPointer: () => ui.hideTouchHint()
  });

  function saveBest(nextBest) {
    best = nextBest;
    storageSet(KEY_BEST, best);
    ui.setBest(best);
  }

  function saveRuns(nextRuns) {
    runs = nextRuns;
    storageSet(KEY_RUNS, runs);
    ui.setRuns(runs);
  }

  function blurActive() {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }

  function resetRun() {
    scoreF = 0;
    score = 0;
    distance = 0;
    speed = TUNING.baseSpeed;
    elapsed = 0;
    combo = 0;
    comboTimer = 0;
    multiplier = 1;
    shieldCharges = 0;
    orbsCollected = 0;
    maxCombo = 0;
    topSpeed = TUNING.baseSpeed;
    sector = 1;
    skillsFound.clear();
    deathTimer = 0;
    shake = 0;
    fovPulse = 0;
    hudAcc = 0;
    newBest = false;
    camX = 0;
    camY = 1.2;
    camZ = 9.2;

    world.reset();
    player.reset();
    particles.clear();
    input.reset();
    input.enabled = false;
    ui.hideBanners();
    ui.resetHud(best);
    engine.setDamage(0);
    engine.setAberration(0);
    engine.camera.fov = 70;
    engine.camera.updateProjectionMatrix();
  }

  function startRun() {
    if (state === 'playing' || state === 'countdown' || state === 'dying') return;
    if (state === 'paused') prevState = 'playing';

    audio.unlock();
    audio.setMuted(muted);
    audio.startAmbient();
    audio.duckAmbient(false);
    audio.startRun();
    audio.ui();

    resetRun();
    state = 'countdown';
    prevState = 'countdown';
    countdownLeft = 3;
    lastCountdown = 3;
    blurActive();
    ui.countdown('3');
    ui.setState('countdown');
    ui.showTouchHint();
    pushHud(true);
    last = performance.now();
  }

  function beginPlay() {
    if (state !== 'countdown') return;
    state = 'playing';
    prevState = 'playing';
    input.enabled = true;
    blurActive();
    ui.setState('playing');
    ui.countdown('GO', true);
    audio.countdown(0);
    pushHud(true);
  }

  function triggerPrimary() {
    if (state === 'menu' || state === 'over') {
      startRun();
    } else if (state === 'paused') {
      resumeGame();
    } else if (state === 'playing') {
      activateShield();
    }
  }

  function handleAction(action) {
    if (action === 'pause') togglePause();
    else if (action === 'power') triggerPrimary();
  }

  function pauseGame() {
    if (state !== 'playing' && state !== 'countdown') return;
    prevState = state;
    state = 'paused';
    input.enabled = false;
    input.reset();
    ui.setState('paused');
    audio.duckAmbient(true);
    renderDirty = true;
  }

  function resumeGame() {
    if (state !== 'paused') return;
    state = prevState === 'countdown' ? 'countdown' : 'playing';
    input.enabled = state === 'playing';
    blurActive();
    ui.setState(state);
    audio.duckAmbient(false);
    last = performance.now();
    renderDirty = true;
  }

  function togglePause() {
    if (state === 'paused') resumeGame();
    else pauseGame();
  }

  function toggleMute() {
    muted = !muted;
    storageSet(KEY_MUTED, muted ? '1' : '0');
    audio.unlock();
    audio.setMuted(muted);
    ui.setSound(muted);
    if (!muted) audio.ui();
  }

  function setQuality(next) {
    if (next !== 'low' && next !== 'high') return;
    if (next === quality) {
      ui.setQuality(quality);
      return;
    }
    quality = next;
    storageSet(KEY_QUALITY, quality);
    engine.setQuality(quality);
    world.setQuality(quality);
    particles.setPixelRatio(engine.renderer.getPixelRatio());
    ui.setQuality(quality);
    renderDirty = true;
  }

  function toggleFullscreen() {
    const target = root;
    const full = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (!full) {
        const request = target.requestFullscreen || target.webkitRequestFullscreen;
        Promise.resolve(request?.call(target)).catch(() => {});
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        Promise.resolve(exit?.call(document)).catch(() => {});
      }
    } catch {
      /* fullscreen can be blocked by browser policy */
    }
  }

  function activateShield() {
    if (state !== 'playing') return;
    if (player.shieldTime > 0) {
      ui.callout('SHIELD ACTIVE');
      audio.ui();
      return;
    }
    if (shieldCharges <= 0) {
      audio.powerEmpty();
      ui.callout('NO CHARGE — COLLECT ◈', 'warn');
      return;
    }
    shieldCharges -= 1;
    player.activateShield(TUNING.shieldDuration);
    particles.burst(player.x, player.y, 0.4, particles.tint(PALETTE.emerald), 32, 7, 0.95);
    shake = rm ? 0 : Math.max(shake, 0.25);
    audio.shield();
    ui.callout('SHIELD ONLINE');
    pushHud(true);
  }

  function handleOrb(skill, orb) {
    if (state !== 'playing') return;
    combo += 1;
    comboTimer = TUNING.comboWindow;
    multiplier = Math.min(
      TUNING.maxMultiplier,
      1 + Math.floor(combo / TUNING.comboStep) * 0.5
    );
    const points = Math.round(TUNING.orbPoints * multiplier);
    scoreF += points;
    score = Math.floor(scoreF);
    orbsCollected += 1;
    maxCombo = Math.max(maxCombo, combo);
    skillsFound.add(skill.label);

    const tone = TONE_HEX[skill.tone];
    particles.burst(orb.baseX, orb.baseY, 0.3, particles.tint(tone), quality === 'high' ? 20 : 10, 7, 0.8);
    audio.pickup(combo);
    ui.toast(skill.label, points, tone);
    ui.bumpScore();
    fovPulse = Math.max(fovPulse, 0.65);
    if (combo === TUNING.comboStep) ui.callout(`MULTIPLIER ×${multiplier.toFixed(1)}`);
  }

  function handlePower(power) {
    if (state !== 'playing') return;
    if (shieldCharges >= TUNING.shieldMax) {
      scoreF += 120;
      score = Math.floor(scoreF);
      ui.callout('CHARGE FULL · +120');
      ui.bumpScore();
    } else {
      shieldCharges = Math.min(TUNING.shieldMax, shieldCharges + 1);
      ui.shieldToast('SHIELD CHARGE', PALETTE.emerald);
      ui.callout('SHIELD READY — SPACE');
    }
    particles.burst(power.baseX, power.baseY, 0.3, particles.tint(PALETTE.emerald), 24, 7, 0.9);
    audio.shield();
    fovPulse = Math.max(fovPulse, 0.8);
    pushHud(true);
  }

  function handleNearMiss(obstacle, margin) {
    if (state !== 'playing') return;
    const points = Math.round(TUNING.nearMissPoints * multiplier);
    scoreF += points;
    score = Math.floor(scoreF);
    comboTimer = Math.max(comboTimer, TUNING.comboWindow * 0.8);
    ui.callout(`NEAR MISS +${points}`, 'gold');
    audio.nearMiss();
    ui.bumpScore();
    shake = rm ? 0 : Math.max(shake, 0.14);
    fovPulse = Math.max(fovPulse, 0.35);
  }

  function handleHit(obstacle) {
    if (state !== 'playing') return;
    if (player.shieldTime > 0) {
      world.shatter(obstacle);
      scoreF += 50 * multiplier;
      score = Math.floor(scoreF);
      particles.burst(player.x, player.y, 0.4, particles.tint(PALETTE.cyanSoft), quality === 'high' ? 30 : 14, 10, 0.9);
      audio.shieldHit();
      ui.callout('SHIELD HOLD +' + Math.round(50 * multiplier));
      shake = rm ? 0 : Math.max(shake, 0.5);
      fovPulse = Math.max(fovPulse, 1.1);
      return;
    }
    die();
  }

  function die() {
    state = 'dying';
    prevState = 'dying';
    deathTimer = 1.15;
    input.enabled = false;
    input.reset();
    player.hide();
    const count = quality === 'high' ? 64 : 28;
    particles.burst(player.x, player.y, 0.5, particles.tint(PALETTE.rose), count, 13, 1.25);
    particles.burst(player.x, player.y, 0.5, particles.tint(PALETTE.cyan), Math.floor(count / 2), 7, 0.9);
    audio.crash();
    audio.duckAmbient(true);
    shake = rm ? 0 : 1.2;
    engine.setDamage(0.9);
    if (!rm) ui.flash();
    ui.callout('SIGNAL LOST', 'warn');
    ui.setState('dying');
    renderDirty = true;
  }

  function endRun() {
    const finalScore = Math.floor(scoreF);
    const isBest = finalScore > best;
    if (isBest) {
      saveBest(finalScore);
      newBest = true;
      audio.newBest();
    } else {
      ui.setBest(best);
    }
    saveRuns(runs + 1);
    state = 'over';
    prevState = 'over';
    input.enabled = false;
    ui.showOver({
      score: finalScore,
      best,
      newBest,
      distance,
      orbs: orbsCollected,
      maxCombo,
      topSpeed,
      skills: [...skillsFound],
      multiplier
    });
    ui.setState('over');
    engine.setDamage(0);
    engine.setAberration(0);
    audio.duckAmbient(true);
    renderDirty = true;
  }

  function checkSector() {
    const next = Math.floor(distance / TUNING.sectorSize) + 1;
    if (next > sector) {
      sector = next;
      ui.callout(`SECTOR ${String(sector).padStart(2, '0')} · SPEED UP`, 'gold');
      audio.levelUp();
      fovPulse = Math.max(fovPulse, 1.1);
    }
  }

  function pushHud(force = false) {
    const speedNorm = clamp((speed - TUNING.baseSpeed) / (TUNING.maxSpeed - TUNING.baseSpeed), 0, 1);
    ui.setHud({
      score,
      best,
      combo,
      multiplier,
      comboPct: comboTimer / TUNING.comboWindow,
      speed,
      speedPct: speedNorm,
      distance,
      sector,
      shieldCharges,
      shieldLeft: player.shieldTime,
      shieldPct: player.shieldTime / TUNING.shieldDuration
    });
    if (force) {
      // setHud is diff-based; resetting the cache is handled by ui.resetHud where needed.
    }
  }

  function updateMenuCamera(dt, elapsedTime) {
    const targetX = Math.sin(elapsedTime * 0.24) * 1.3;
    const targetY = 1.25 + Math.sin(elapsedTime * 0.36) * 0.18;
    const targetZ = 9.4 + Math.sin(elapsedTime * 0.19) * 0.4;
    camX = damp(camX, targetX, 0.3, dt);
    camY = damp(camY, targetY, 0.3, dt);
    camZ = damp(camZ, targetZ, 0.3, dt);
    engine.camera.position.set(camX, camY, camZ);
    engine.camera.lookAt(0, 0.15, -16);
    engine.camera.rotateZ(Math.sin(elapsedTime * 0.21) * 0.012);
    engine.setCameraFov(68, dt);
  }

  function updatePlayCamera(dt) {
    const speedNorm = clamp((speed - TUNING.baseSpeed) / (TUNING.maxSpeed - TUNING.baseSpeed), 0, 1);
    const portrait = (engine.camera.aspect || 1) < 0.8;
    const targetX = player.x * (portrait ? 0.82 : 0.33);
    const targetY = player.y * 0.28 + 1.0;
    const targetZ = 8.8 + speedNorm * 0.85 + (player.shieldTime > 0 ? 0.55 : 0) + (portrait ? 0.8 : 0);
    const camTau = portrait ? 0.07 : 0.12;
    camX = damp(camX, targetX, camTau, dt);
    camY = damp(camY, targetY, 0.12, dt);
    camZ = damp(camZ, targetZ, 0.16, dt);

    let shakeX = 0;
    let shakeY = 0;
    let roll = rm ? 0 : clamp(-player.vx * 0.0032, -0.055, 0.055);
    if (!rm && shake > 0.001) {
      const amount = shake * shake * 0.42;
      shakeX = (Math.random() * 2 - 1) * amount;
      shakeY = (Math.random() * 2 - 1) * amount;
      roll += (Math.random() * 2 - 1) * amount * 0.075;
    }

    engine.camera.position.set(camX + shakeX, camY + shakeY, camZ);
    engine.camera.lookAt(player.x * (portrait ? 0.1 : 0.16), player.y * 0.16 + 0.2, -16);
    engine.camera.rotateZ(roll);

    const fov = 68 + speedNorm * 10 + fovPulse * 2.2 + (player.shieldTime > 0 ? 3.5 : 0);
    engine.setCameraFov(fov, dt);
  }

  function updateDeathCamera(dt) {
    camX = damp(camX, player.x * 0.5, 0.3, dt);
    camY = damp(camY, player.y * 0.4 + 1.1, 0.3, dt);
    camZ = damp(camZ, 7.8, 0.25, dt);
    let shakeX = 0;
    let shakeY = 0;
    if (!rm && shake > 0.001) {
      const amount = shake * shake * 0.55;
      shakeX = (Math.random() * 2 - 1) * amount;
      shakeY = (Math.random() * 2 - 1) * amount;
    }
    engine.camera.position.set(camX + shakeX, camY + shakeY, camZ);
    engine.camera.lookAt(player.x * 0.2, player.y * 0.2, -16);
    engine.camera.rotateZ(shake * 0.03);
    engine.setCameraFov(72, dt);
  }

  function updateMenu(dt) {
    menuTime += dt;
    world.updateAmbient(dt, 7.5);
    player.update(dt, EMPTY_INPUT, 0, menuTime, 'menu');
    const enginePos = player.getEnginePosition();
    particles.trail(enginePos.x, enginePos.y, enginePos.z, dt, rm ? 6 : 14, particles.tint(PALETTE.cyan), 8);
    particles.update(dt);
    updateMenuCamera(dt, menuTime);
    engine.setDamage(0);
    engine.setAberration(0);
  }

  function updateCountdown(dt) {
    menuTime += dt;
    countdownLeft -= dt;
    world.updateAmbient(dt, 18);
    player.update(dt, EMPTY_INPUT, 0, menuTime, 'play');
    particles.update(dt);
    updatePlayCamera(dt);

    if (countdownLeft > 0) {
      const number = Math.ceil(countdownLeft);
      if (number !== lastCountdown) {
        lastCountdown = number;
        ui.countdown(String(number));
        audio.countdown(number);
      }
    }
    if (countdownLeft <= 0) {
      beginPlay();
    }
  }

  function updatePlaying(dt) {
    elapsed += dt;

    const speedNorm = clamp(
      (speed - TUNING.baseSpeed) / (TUNING.maxSpeed - TUNING.baseSpeed),
      0,
      1
    );
    const movement = input.getMovement();
    player.update(dt, movement, speedNorm, elapsed, 'play');

    const metres = speed * dt;
    distance += metres;
    scoreF += metres * TUNING.scorePerMetre;
    score = Math.floor(scoreF);
    topSpeed = Math.max(topSpeed, speed);

    world.advance(dt, speed, elapsed, player.x, player.y);
    if (state !== 'playing') {
      pushHud();
      return;
    }

    speed = TUNING.baseSpeed +
      (TUNING.maxSpeed - TUNING.baseSpeed) * (1 - Math.exp(-distance / TUNING.speedCurve));

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        comboTimer = 0;
        combo = 0;
        multiplier = 1;
      }
    }

    checkSector();

    const enginePos = player.getEnginePosition();
    const trailColor = player.shieldTime > 0 ? PALETTE.emerald : PALETTE.cyan;
    const trailRate = (rm ? 22 : 46 + speedNorm * 38) * qualityBudget();
    particles.trail(enginePos.x, enginePos.y, enginePos.z, dt, trailRate, particles.tint(trailColor), speed);

    if (player.shieldTime > 0) {
      particles.trail(
        player.x + Math.sin(elapsed * 6) * 1.2,
        player.y + Math.cos(elapsed * 5) * 1.2,
        0.4,
        dt,
        24 * qualityBudget(),
        particles.tint(PALETTE.emeraldSoft),
        speed
      );
    }

    particles.update(dt);
    updatePlayCamera(dt);
    shake = Math.max(0, shake - dt * 1.9);
    fovPulse = Math.max(0, fovPulse - dt * 4.2);
    engine.setAberration(0.0012 + speedNorm * 0.0015 + fovPulse * 0.0006);
    engine.setDamage(0);
    audio.setIntensity(speedNorm);

    hudAcc += dt;
    if (hudAcc > 0.055) {
      hudAcc = 0;
      pushHud();
    }
  }

  function updateDying(dt) {
    deathTimer -= dt;
    particles.update(dt);
    world.updateAmbient(dt, Math.max(8, speed * 0.12));
    updateDeathCamera(dt);
    shake = Math.max(0, shake - dt * 1.35);
    engine.setDamage(0.72);
    engine.setAberration(0.006);
    if (deathTimer <= 0) endRun();
  }

  function frame(now) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    if (state === 'playing') updatePlaying(dt);
    else if (state === 'countdown') updateCountdown(dt);
    else if (state === 'dying') updateDying(dt);
    else if (state === 'menu') updateMenu(dt);

    const shouldRender = state !== 'paused' && state !== 'over' || renderDirty;
    if (shouldRender) {
      engine.render(dt);
      renderDirty = false;
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden' && (state === 'playing' || state === 'countdown')) {
      pauseGame();
    }
  }

  function onWindowBlur() {
    if (state === 'playing' || state === 'countdown') pauseGame();
  }

  function onMotionPreference(event) {
    rm = event.matches;
    renderDirty = true;
  }

  let resizeRaf = 0;
  function onResize() {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      engine.resize();
      particles.setPixelRatio(engine.renderer.getPixelRatio());
      renderDirty = true;
    });
  }

  function onFullscreenChange() {
    onResize();
    renderDirty = true;
  }

  function onPageHide(event) {
    if (!event.persisted) dispose();
  }

  function onPageShow(event) {
    if (!event.persisted) return;
    last = performance.now();
    renderDirty = true;
    onResize();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    window.removeEventListener('fullscreenchange', onFullscreenChange);
    window.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('pageshow', onPageShow);
    window.removeEventListener('blur', onWindowBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (motionQuery.removeEventListener) motionQuery.removeEventListener('change', onMotionPreference);
    else motionQuery.removeListener?.(onMotionPreference);
    input.dispose();
    ui.dispose();
    world.dispose();
    player.dispose();
    particles.dispose();
    audio.dispose();
    engine.dispose();
  }

  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  window.addEventListener('fullscreenchange', onFullscreenChange);
  window.addEventListener('webkitfullscreenchange', onFullscreenChange);
  window.addEventListener('blur', onWindowBlur);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionPreference);
  else motionQuery.addListener?.(onMotionPreference);

  // One synchronous frame compiles the shaders while the loading screen is up.
  updateMenu(0.016);
  particles.update(0.016);
  engine.render(0.016);
  state = 'menu';
  prevState = 'menu';
  ui.setState('menu');
  last = performance.now();
  raf = requestAnimationFrame(frame);

  return { dispose };
}
