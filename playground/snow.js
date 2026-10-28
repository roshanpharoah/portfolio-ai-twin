/* =========================================================
   Curiosity Lab
   A quiet snowfall, scoped to the playground page.
   The animation pauses when the tab is hidden and starts
   paused for visitors who prefer reduced motion.
   ========================================================= */
(() => {
  'use strict';

  const canvas = document.getElementById('snowfall');
  const toggle = document.getElementById('snow-toggle');
  if (!canvas) return;

  const context = canvas.getContext('2d');
  if (!context) return;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = {
    flakes: [],
    width: 0,
    height: 0,
    dpr: 1,
    frame: 0,
    last: 0,
    running: false,
    enabled: !motionQuery.matches,
    sprite: null,
    starSprite: null,
    resizeTimer: 0
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function buildSprites() {
    const size = 64;
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const spriteContext = sprite.getContext('2d');
    if (!spriteContext) return;
    const gradient = spriteContext.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(.18, 'rgba(240, 249, 255, .94)');
    gradient.addColorStop(.44, 'rgba(186, 230, 253, .34)');
    gradient.addColorStop(1, 'rgba(186, 230, 253, 0)');
    spriteContext.fillStyle = gradient;
    spriteContext.fillRect(0, 0, size, size);
    state.sprite = sprite;

    const star = document.createElement('canvas');
    star.width = size;
    star.height = size;
    const starContext = star.getContext('2d');
    if (!starContext) return;
    starContext.translate(size / 2, size / 2);
    starContext.strokeStyle = 'rgba(240, 249, 255, .92)';
    starContext.lineWidth = 2;
    starContext.lineCap = 'round';
    starContext.shadowColor = 'rgba(186, 230, 253, .75)';
    starContext.shadowBlur = 4;
    for (let arm = 0; arm < 6; arm += 1) {
      const angle = (arm * Math.PI) / 3;
      starContext.beginPath();
      starContext.moveTo(0, 0);
      starContext.lineTo(Math.cos(angle) * 21, Math.sin(angle) * 21);
      starContext.stroke();
      const branchAngle = angle + Math.PI / 6;
      const branchX = Math.cos(angle) * 12;
      const branchY = Math.sin(angle) * 12;
      starContext.beginPath();
      starContext.moveTo(branchX, branchY);
      starContext.lineTo(branchX + Math.cos(branchAngle) * 5, branchY + Math.sin(branchAngle) * 5);
      starContext.stroke();
    }
    starContext.fillStyle = 'rgba(255, 255, 255, .95)';
    starContext.beginPath();
    starContext.arc(0, 0, 2.2, 0, Math.PI * 2);
    starContext.fill();
    state.starSprite = star;
  }

  function createFlake(initial = false) {
    const depth = Math.random();
    return {
      x: Math.random() * state.width,
      y: initial ? Math.random() * state.height : -12 - Math.random() * 36,
      depth,
      radius: .72 + depth * 3.05,
      speed: 5 + depth * 14,
      drift: 2.5 + depth * 9,
      phase: Math.random() * Math.PI * 2,
      sway: .35 + Math.random() * .65,
      alpha: .16 + depth * .50,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - .5) * .45
    };
  }

  function seed() {
    const count = Math.round(clamp((state.width * state.height) / 13500, 52, 165));
    state.flakes = Array.from({ length: count }, () => createFlake(true));
  }

  function clear() {
    context.clearRect(0, 0, state.width, state.height);
  }

  function paint() {
    if (!state.sprite) return;
    context.clearRect(0, 0, state.width, state.height);
    for (const flake of state.flakes) {
      const size = flake.radius * 4.8;
      if (flake.depth > .55) {
        const halo = size * 2.1;
        context.globalAlpha = flake.alpha * .16;
        context.drawImage(state.sprite, flake.x - halo / 2, flake.y - halo / 2, halo, halo);
      }
      if (flake.depth > .82 && state.starSprite) {
        context.save();
        context.translate(flake.x, flake.y);
        context.rotate(flake.rotation);
        context.globalAlpha = flake.alpha * .9;
        context.drawImage(state.starSprite, -size / 2, -size / 2, size, size);
        context.restore();
      } else {
        context.globalAlpha = flake.alpha;
        context.drawImage(state.sprite, flake.x - size / 2, flake.y - size / 2, size, size);
      }
    }
    context.globalAlpha = 1;
  }

  function update(dt, time) {
    const wind = Math.sin(time * .00012) * 9 + Math.sin(time * .00007 + 1.4) * 4;
    for (const flake of state.flakes) {
      flake.y += flake.speed * dt;
      flake.rotation += flake.spin * dt;
      flake.x += (
        Math.sin(time * .00022 * flake.sway + flake.phase) * flake.drift
        + wind * flake.depth
      ) * dt;

      if (flake.y > state.height + 12) {
        flake.y = -12 - Math.random() * 34;
        flake.x = Math.random() * state.width;
      }
      if (flake.x > state.width + 12) flake.x = -12;
      else if (flake.x < -12) flake.x = state.width + 12;
    }
  }

  function frame(timestamp) {
    if (!state.running) return;
    if (!state.last) state.last = timestamp;
    const dt = Math.min(.05, Math.max(0, (timestamp - state.last) / 1000));
    state.last = timestamp;
    update(dt, timestamp);
    paint();
    state.frame = requestAnimationFrame(frame);
  }

  function start() {
    if (!state.enabled || state.running || !state.width) return;
    state.running = true;
    state.last = 0;
    state.frame = requestAnimationFrame(frame);
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(state.frame);
    state.frame = 0;
    state.last = 0;
  }

  function updateToggle() {
    if (!toggle) return;
    toggle.hidden = false;
    toggle.setAttribute('aria-pressed', String(state.enabled));
    const label = toggle.querySelector('.snow-toggle-label');
    if (label) label.textContent = state.enabled ? 'Snowfall on' : 'Snowfall off';
  }

  function setEnabled(enabled) {
    state.enabled = enabled;
    if (enabled) {
      start();
    } else {
      stop();
      clear();
    }
    updateToggle();
  }

  function resize() {
    const previousWidth = state.width;
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    // Keep the full-screen canvas light on high-DPI displays.
    const targetPixels = 3500000;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const area = Math.max(1, state.width * state.height);
    if (area * dpr * dpr > targetPixels) dpr = Math.sqrt(targetPixels / area);
    state.dpr = Math.max(.35, dpr);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    if (!state.flakes.length || Math.abs(state.width - previousWidth) > 1) {
      seed();
    } else {
      for (const flake of state.flakes) {
        if (flake.y > state.height + 12) {
          flake.y = -12 - Math.random() * 34;
          flake.x = Math.random() * state.width;
        }
      }
    }

    if (state.enabled) {
      paint();
      start();
    } else {
      clear();
    }
  }

  buildSprites();
  resize();
  updateToggle();

  toggle?.addEventListener('click', () => {
    setEnabled(!state.enabled);
  });

  motionQuery.addEventListener?.('change', (event) => {
    setEnabled(!event.matches);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stop();
    } else if (state.enabled) {
      start();
    }
  });

  window.addEventListener('resize', () => {
    clearTimeout(state.resizeTimer);
    state.resizeTimer = window.setTimeout(() => {
      resize();
      if (state.enabled && !state.running) start();
    }, 120);
  }, { passive: true });
})();
