/* =========================================================
   Curiosity Lab
   Six experiments. Vanilla JS. All computation stays local.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- utilities ---------- */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const randInt = (max) => Math.floor(Math.random() * max);
  const pick = (items) => items[randInt(items.length)];
  const numberFormat = new Intl.NumberFormat('en-US');
  const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionQuery.matches;

  const formatNumber = (value) => numberFormat.format(value);
  const formatCompact = (value) => Math.abs(value) >= 10000 ? compactFormat.format(value) : formatNumber(value);
  const formatPercent = (value, digits = 1) => `${value.toFixed(digits)}%`;
  const plural = (count, singular, pluralWord = `${singular}s`) => count === 1 ? singular : pluralWord;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function random() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function prepareCanvas(canvas, width, height) {
    if (!canvas || canvas._labContext) return canvas && canvas._labContext;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas._labContext = ctx;
    canvas._labWidth = width;
    canvas._labHeight = height;
    return ctx;
  }

  function eventCell(canvas, event, cols, rows, width, height) {
    const rect = canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const py = ((event.clientY - rect.top) / rect.height) * height;
    return {
      x: clamp(Math.floor(px / (width / cols)), 0, cols - 1),
      y: clamp(Math.floor(py / (height / rows)), 0, rows - 1)
    };
  }

  function setupTabs(tabSelector, panelSelector, tabAttribute, panelAttribute) {
    const tabs = $$(tabSelector);
    const panels = $$(panelSelector);
    if (!tabs.length) return null;

    tabs.forEach((tab, index) => {
      const value = tab.getAttribute(tabAttribute);
      const panel = panels.find((candidate) => candidate.getAttribute(panelAttribute) === value);
      if (!tab.id) tab.id = `${tabAttribute.replace('data-', '')}-tab-${index}`;
      if (panel) {
        if (!panel.id) panel.id = `${panelAttribute.replace('data-', '')}-panel-${index}`;
        tab.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
      }
    });

    function activate(value, focusTab = false) {
      tabs.forEach((tab) => {
        const active = tab.getAttribute(tabAttribute) === value;
        tab.classList.toggle('is-on', active);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active && focusTab) tab.focus();
      });
      panels.forEach((panel) => {
        const active = panel.getAttribute(panelAttribute) === value;
        panel.classList.toggle('is-on', active);
        panel.setAttribute('aria-hidden', String(!active));
      });
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab.getAttribute(tabAttribute)));
      tab.addEventListener('keydown', (event) => {
        let nextIndex = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex === null) return;
        event.preventDefault();
        activate(tabs[nextIndex].getAttribute(tabAttribute), true);
      });
    });

    const initial = tabs.find((tab) => tab.classList.contains('is-on')) || tabs[0];
    activate(initial.getAttribute(tabAttribute));
    return { activate, tabs, panels };
  }

  motionQuery.addEventListener?.('change', (event) => {
    reducedMotion = event.matches;
  });

  /* ---------- hero specimen ---------- */
  const specimen = $('#hero-specimen');
  const specimenButton = $('#specimen-reveal');
  if (specimen && specimenButton) {
    specimenButton.addEventListener('click', () => {
      const revealed = specimen.classList.toggle('revealed');
      specimenButton.setAttribute('aria-pressed', String(revealed));
      specimenButton.textContent = revealed ? 'Hide the measurement' : 'Reveal the measurement';
    });
  }

  /* ---------- experiment 01: perception ---------- */
  const perceptionTabs = setupTabs('[data-round]', '[data-round-panel]', 'data-round', 'data-round-panel');
  const perceptionState = { revealed: new Set() };
  const perceptionScore = $('#perception-score');

  const perceptionCopy = {
    length: {
      same: 'The two horizontal lines are exactly the same length. The outward fins make the top line look longer; the inward fins make the bottom line look shorter.',
      a: 'The top line only looks longer because its fins point outward. Measured from end to end, both horizontal lines are exactly 300 px.',
      b: 'The bottom line only looks longer because its fins point inward. Measured from end to end, both horizontal lines are exactly 300 px.'
    },
    size: {
      same: 'Both center circles are exactly the same size. The large surrounding circles make A look smaller; the small surrounding circles make B look larger.',
      a: 'Circle A only looks smaller because it is surrounded by large circles. The two center circles are exactly the same diameter.',
      b: 'Circle B only looks larger because it is surrounded by small circles. The two center circles are exactly the same diameter.'
    },
    shade: {
      same: 'Both inner squares are exactly #7b8794. The dark background makes A look lighter; the light background makes B look darker.',
      a: 'Square A only looks lighter because it sits on a dark background. Both inner squares are exactly #7b8794.',
      b: 'Square B only looks lighter because it sits on a light background. Both inner squares are exactly #7b8794.'
    }
  };

  function updatePerceptionScore() {
    if (perceptionScore) perceptionScore.textContent = `${perceptionState.revealed.size} / 3 revealed`;
  }

  function resetPerceptionRound(roundName) {
    const round = $(`[data-round-panel="${roundName}"]`);
    if (!round) return;
    perceptionState.revealed.delete(roundName);
    round.classList.remove('revealed');
    round.querySelector('.shade-stage')?.classList.remove('neutral');
    round.querySelectorAll('[data-answer]').forEach((button) => {
      button.disabled = false;
      button.classList.remove('is-selected', 'is-correct', 'is-wrong');
      button.removeAttribute('aria-pressed');
    });
    const result = round.querySelector('.result');
    if (result) {
      result.textContent = '';
      result.className = 'result';
    }
    round.querySelector('.reveal-controls')?.classList.add('is-hidden');
    const svg = round.querySelector('svg');
    svg?.classList.remove('ml-fins-hidden', 'eb-surround-hidden');
    round.querySelectorAll('[data-toggle]').forEach((toggle) => {
      toggle.setAttribute('aria-pressed', 'false');
      const type = toggle.getAttribute('data-toggle');
      toggle.textContent = type === 'ml-fins' ? 'Hide the fins' : type === 'eb-surround' ? 'Hide the surroundings' : 'Neutral background';
    });
    updatePerceptionScore();
  }

  function answerPerception(roundName, answer) {
    if (perceptionState.revealed.has(roundName)) return;
    const round = $(`[data-round-panel="${roundName}"]`);
    if (!round) return;
    const buttons = $$('[data-answer]', round);
    const correct = answer === 'same';
    perceptionState.revealed.add(roundName);
    round.classList.add('revealed');
    buttons.forEach((button) => {
      button.disabled = true;
      const selected = button.getAttribute('data-answer') === answer;
      if (selected) button.classList.add(correct ? 'is-correct' : 'is-wrong');
      if (!correct && button.getAttribute('data-answer') === 'same') button.classList.add('is-correct');
      button.setAttribute('aria-pressed', String(selected));
    });
    const result = round.querySelector('.result');
    if (result) {
      const copy = perceptionCopy[roundName]?.[answer] || perceptionCopy[roundName]?.same || '';
      result.className = `result ${correct ? 'good' : 'bad'}`;
      result.innerHTML = `<strong>${correct ? 'Correct.' : 'Not quite.'}</strong> ${copy}`;
    }
    round.querySelector('.reveal-controls')?.classList.remove('is-hidden');
    updatePerceptionScore();
  }

  $$('[data-answer-group]').forEach((group) => {
    const roundName = group.getAttribute('data-answer-group');
    group.addEventListener('click', (event) => {
      const button = event.target.closest('[data-answer]');
      if (!button || button.disabled) return;
      answerPerception(roundName, button.getAttribute('data-answer'));
    });
  });

  $$('[data-reset-round]').forEach((button) => {
    button.addEventListener('click', () => resetPerceptionRound(button.getAttribute('data-reset-round')));
  });

  $$('[data-next-round]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('data-next-round');
      perceptionTabs?.activate(next, true);
    });
  });

  $$('[data-toggle]').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const type = toggle.getAttribute('data-toggle');
      let target;
      let className;
      let onText;
      let offText;
      if (type === 'ml-fins') {
        target = $('#ml-svg');
        className = 'ml-fins-hidden';
        onText = 'Show the fins';
        offText = 'Hide the fins';
      } else if (type === 'eb-surround') {
        target = $('#eb-svg');
        className = 'eb-surround-hidden';
        onText = 'Show the surroundings';
        offText = 'Hide the surroundings';
      } else {
        target = $('#shade-stage');
        className = 'neutral';
        onText = 'Restore the contrast';
        offText = 'Neutral background';
      }
      if (!target) return;
      const active = target.classList.toggle(className);
      toggle.setAttribute('aria-pressed', String(active));
      toggle.textContent = active ? onText : offText;
    });
  });

  updatePerceptionScore();

  /* ---------- experiment 02: probability ---------- */
  setupTabs('[data-prob]', '[data-prob-panel]', 'data-prob', 'data-prob-panel');

  /* Monty Hall */
  const monty = {
    prize: randInt(3),
    chosen: null,
    opened: null,
    phase: 'pick',
    stayWins: 0,
    switchWins: 0,
    trials: 0
  };
  const montyDoors = $$('[data-door]');
  const montyStatus = $('#monty-status');
  const montyReveal = $('#monty-reveal');
  const montyStayButton = $('[data-monty="stay"]');
  const montySwitchButton = $('[data-monty="switch"]');
  const montyNewButton = $('#monty-new');
  const montySimButton = $('#monty-sim');
  const montyResetButton = $('#monty-reset');
  const montySimOutput = $('#monty-sim-output');

  function updateMontyStats() {
    const stayRate = monty.trials ? (monty.stayWins / monty.trials) * 100 : 0;
    const switchRate = monty.trials ? (monty.switchWins / monty.trials) * 100 : 0;
    const stayWins = $('#stay-wins');
    const switchWins = $('#switch-wins');
    const stayRateEl = $('#stay-rate');
    const switchRateEl = $('#switch-rate');
    if (stayWins) stayWins.textContent = monty.stayWins;
    if (switchWins) switchWins.textContent = monty.switchWins;
    if (stayRateEl) stayRateEl.textContent = formatPercent(stayRate, stayRate % 1 === 0 ? 0 : 1);
    if (switchRateEl) switchRateEl.textContent = formatPercent(switchRate, switchRate % 1 === 0 ? 0 : 1);
  }

  function montyResetBoard() {
    monty.prize = randInt(3);
    monty.chosen = null;
    monty.opened = null;
    monty.phase = 'pick';
    montyDoors.forEach((door) => {
      door.disabled = false;
      door.classList.remove('is-chosen', 'is-open', 'is-prize', 'is-goat', 'is-final');
      const face = door.querySelector('.door-face');
      if (face) face.textContent = '?';
    });
    if (montyStayButton) montyStayButton.disabled = true;
    if (montySwitchButton) montySwitchButton.disabled = true;
    if (montyStatus) montyStatus.textContent = 'Pick a door. One hides a prize.';
    if (montyReveal) {
      montyReveal.textContent = '';
      montyReveal.className = 'result';
    }
    updateMontyStats();
  }

  function montyChoose(index) {
    if (monty.phase !== 'pick') return;
    monty.chosen = index;
    const options = [0, 1, 2].filter((door) => door !== monty.chosen && door !== monty.prize);
    monty.opened = pick(options);
    monty.phase = 'offer';
    montyDoors.forEach((door, doorIndex) => {
      door.disabled = true;
      if (doorIndex === monty.chosen) door.classList.add('is-chosen');
      if (doorIndex === monty.opened) {
        door.classList.add('is-open', 'is-goat');
        const face = door.querySelector('.door-face');
        if (face) face.textContent = 'GOAT';
      }
    });
    if (montyStayButton) montyStayButton.disabled = false;
    if (montySwitchButton) montySwitchButton.disabled = false;
    if (montyStatus) montyStatus.textContent = `Door ${monty.opened + 1} is out. The host opened a goat. Stay, or switch to the other unopened door?`;
  }

  function montyDecide(action) {
    if (monty.phase !== 'offer') return;
    const remaining = [0, 1, 2].find((door) => door !== monty.chosen && door !== monty.opened);
    const finalDoor = action === 'switch' ? remaining : monty.chosen;
    const stayed = monty.chosen === monty.prize;
    const switched = remaining === monty.prize;
    monty.trials += 1;
    if (stayed) monty.stayWins += 1;
    if (switched) monty.switchWins += 1;
    monty.phase = 'done';

    montyDoors.forEach((door, doorIndex) => {
      door.disabled = true;
      door.classList.remove('is-chosen');
      if (doorIndex === monty.prize) {
        door.classList.add('is-prize');
        const face = door.querySelector('.door-face');
        if (face) face.textContent = 'PRIZE';
      } else if (doorIndex === monty.opened) {
        door.classList.add('is-open', 'is-goat');
        const face = door.querySelector('.door-face');
        if (face) face.textContent = 'GOAT';
      } else {
        door.classList.add('is-open', 'is-goat');
        const face = door.querySelector('.door-face');
        if (face) face.textContent = 'GOAT';
      }
      if (doorIndex === finalDoor) door.classList.add('is-final');
    });

    if (montyStayButton) montyStayButton.disabled = true;
    if (montySwitchButton) montySwitchButton.disabled = true;

    const won = finalDoor === monty.prize;
    if (montyStatus) montyStatus.textContent = `You chose to ${action}. Door ${finalDoor + 1} was ${won ? 'the prize' : 'a goat'}. Start a new round to play again.`;
    if (montyReveal) {
      montyReveal.className = `result ${won ? 'good' : 'bad'}`;
      montyReveal.innerHTML = `<strong>You ${won ? 'won' : 'lost'}.</strong> Your first pick was ${stayed ? 'right' : 'wrong'}, so staying would have ${stayed ? 'won' : 'lost'} and switching would have ${switched ? 'won' : 'lost'}. The two counters show both hypothetical strategies for this round.`;
    }
    updateMontyStats();
  }

  montyDoors.forEach((door) => {
    door.addEventListener('click', () => montyChoose(Number(door.getAttribute('data-door'))));
  });
  montyStayButton?.addEventListener('click', () => montyDecide('stay'));
  montySwitchButton?.addEventListener('click', () => montyDecide('switch'));
  montyNewButton?.addEventListener('click', () => {
    montyResetBoard();
    if (montySimOutput) montySimOutput.textContent = '';
  });
  montyResetButton?.addEventListener('click', () => {
    monty.stayWins = 0;
    monty.switchWins = 0;
    monty.trials = 0;
    updateMontyStats();
    if (montySimOutput) montySimOutput.textContent = 'Your counters are back to zero. The simulation above is separate.';
  });
  montySimButton?.addEventListener('click', () => {
    const total = 10000;
    let stay = 0;
    let switched = 0;
    for (let i = 0; i < total; i += 1) {
      const prize = randInt(3);
      const first = randInt(3);
      const hostOptions = [0, 1, 2].filter((door) => door !== first && door !== prize);
      const opened = pick(hostOptions);
      const switchDoor = [0, 1, 2].find((door) => door !== first && door !== opened);
      if (first === prize) stay += 1;
      if (switchDoor === prize) switched += 1;
    }
    const stayPct = (stay / total) * 100;
    const switchPct = (switched / total) * 100;
    if (montySimOutput) {
      montySimOutput.innerHTML = `
        <p>${formatNumber(total)} simulated rounds: staying won ${formatNumber(stay)} times (${formatPercent(stayPct)}); switching won ${formatNumber(switched)} times (${formatPercent(switchPct)}).</p>
        <div class="sim-bars" aria-hidden="true">
          <div class="sim-bar"><span>Stay</span><div class="bar"><i style="width:${stayPct}%"></i></div><b>${formatPercent(stayPct, 1)}</b></div>
          <div class="sim-bar"><span>Switch</span><div class="bar"><i style="width:${switchPct}%"></i></div><b>${formatPercent(switchPct, 1)}</b></div>
        </div>`;
    }
  });
  montyResetBoard();

  /* Birthday paradox */
  const birthday = { n: 23 };
  const birthdayRange = $('#birthday-n-range');
  const birthdayN = $('#birthday-n');
  const birthdayNLabel = $('#birthday-n-label');
  const birthdayProb = $('#birthday-prob');
  const birthdayChart = $('#birthday-chart');
  const birthdaySample = $('#birthday-sample');
  const birthdayOutput = $('#birthday-output');
  const birthdaySampleButton = $('#birthday-sample-btn');
  const birthdaySimButton = $('#birthday-sim');
  let birthdayNote = null;

  if (birthdaySample && !$('#birthday-sample-note')) {
    birthdayNote = document.createElement('p');
    birthdayNote.id = 'birthday-sample-note';
    birthdayNote.className = 'micro-note';
    birthdayNote.setAttribute('aria-live', 'polite');
    birthdaySample.insertAdjacentElement('afterend', birthdayNote);
  }

  function birthdayProbabilityFor(n) {
    if (n <= 1) return 0;
    let none = 1;
    for (let i = 0; i < n; i += 1) none *= (365 - i) / 365;
    return 1 - none;
  }

  function monthDay(dayIndex) {
    const date = new Date(Date.UTC(2026, 0, dayIndex + 1));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  function drawBirthdayChart(n) {
    if (!birthdayChart) return;
    const width = 600;
    const height = 220;
    const left = 40;
    const right = 14;
    const top = 14;
    const bottom = 30;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    const x = (value) => left + ((value - 1) / 59) * plotW;
    const y = (probability) => top + (1 - probability) * plotH;
    const points = [];
    for (let people = 1; people <= 60; people += 1) {
      points.push([x(people), y(birthdayProbabilityFor(people))]);
    }
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0].toFixed(2)},${point[1].toFixed(2)}`).join(' ');
    const area = `${line} L${x(60).toFixed(2)},${y(0).toFixed(2)} L${x(1).toFixed(2)},${y(0).toFixed(2)} Z`;
    const currentProbability = birthdayProbabilityFor(n);
    const markerX = x(n);
    const markerY = y(currentProbability);
    const grid = [0, 0.25, 0.5, 0.75, 1].map((probability) => {
      const gy = y(probability);
      return `<line class="chart-grid" x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}" />
        <text class="chart-axis" x="${left - 7}" y="${gy + 3}" text-anchor="end">${Math.round(probability * 100)}%</text>`;
    }).join('');
    birthdayChart.innerHTML = `
      ${grid}
      <path class="chart-area" d="${area}" />
      <path class="chart-line" d="${line}" />
      <line class="chart-marker-line" x1="${markerX}" y1="${top}" x2="${markerX}" y2="${height - bottom}" />
      <circle class="chart-marker" cx="${markerX}" cy="${markerY}" r="4.5" />
      <text class="chart-axis" x="${x(1)}" y="${height - 9}">1</text>
      <text class="chart-axis" x="${x(23)}" y="${height - 9}" text-anchor="middle">23</text>
      <text class="chart-axis" x="${x(60)}" y="${height - 9}" text-anchor="end">60</text>
      <text class="chart-axis" x="${x(30)}" y="${height - 9}" text-anchor="middle">people</text>`;
    birthdayChart.setAttribute('aria-label', `Probability of at least one shared birthday by group size. At ${n} people it is ${formatPercent(currentProbability * 100)}.`);
  }

  function showBirthdaySample(n) {
    if (!birthdaySample) return;
    const days = Array.from({ length: n }, () => randInt(365));
    const counts = new Map();
    days.forEach((day) => counts.set(day, (counts.get(day) || 0) + 1));
    const duplicates = Array.from(counts.entries()).filter(([, count]) => count > 1);
    birthdaySample.innerHTML = days.map((day) => {
      const duplicate = counts.get(day) > 1;
      return `<span class="birthday-chip${duplicate ? ' dup' : ''}">${monthDay(day)}</span>`;
    }).join('');
    birthdaySample.setAttribute('aria-label', `Sample room with ${n} birthdays.${duplicates.length ? ` Shared dates: ${duplicates.map(([day]) => monthDay(day)).join(', ')}.` : ' No shared birthday.'}`);
    if (birthdayNote) {
      if (duplicates.length) {
        const [day, count] = duplicates[0];
        birthdayNote.textContent = `Shared birthday found: ${monthDay(day)} appears ${count} times. With ${n} people, theory predicts a ${formatPercent(birthdayProbabilityFor(n) * 100)} chance.`;
      } else {
        birthdayNote.textContent = `No shared birthday in this sample room. With ${n} people, theory predicts a ${formatPercent(birthdayProbabilityFor(n) * 100)} chance, so empty rooms still happen.`;
      }
    }
  }

  function updateBirthday() {
    const n = clamp(Math.trunc(Number(birthdayRange?.value) || 23), 2, 60);
    birthday.n = n;
    if (birthdayRange) birthdayRange.value = String(n);
    if (birthdayN) birthdayN.textContent = String(n);
    if (birthdayNLabel) birthdayNLabel.textContent = String(n);
    const probability = birthdayProbabilityFor(n);
    if (birthdayProb) birthdayProb.textContent = formatPercent(probability * 100);
    drawBirthdayChart(n);
    showBirthdaySample(n);
  }

  birthdayRange?.addEventListener('input', updateBirthday);
  birthdaySampleButton?.addEventListener('click', () => showBirthdaySample(birthday.n));
  birthdaySimButton?.addEventListener('click', () => {
    const n = birthday.n;
    const trials = 2000;
    let shared = 0;
    for (let trial = 0; trial < trials; trial += 1) {
      const seen = new Set();
      let collision = false;
      for (let person = 0; person < n; person += 1) {
        const day = randInt(365);
        if (seen.has(day)) {
          collision = true;
          break;
        }
        seen.add(day);
      }
      if (collision) shared += 1;
    }
    const observed = (shared / trials) * 100;
    const theory = birthdayProbabilityFor(n) * 100;
    if (birthdayOutput) {
      birthdayOutput.innerHTML = `<strong>${formatNumber(shared)} of ${formatNumber(trials)} rooms</strong> had a shared birthday: ${formatPercent(observed)}. The theoretical value for ${n} people is ${formatPercent(theory)}.`;
    }
  });
  updateBirthday();

  /* Coin streaks */
  const sequenceButtons = $$('[data-seq]');
  const seqResult = $('#seq-result');
  const streakPredictionButtons = $$('[data-streak]');
  const coinGrid = $('#coin-grid');
  const streakResult = $('#streak-result');
  const streakFlipButton = $('#streak-flip');
  const streakSimButton = $('#streak-sim');
  const streakOutput = $('#streak-output');
  const streakState = { prediction: null, lastRun: null, flips: [] };

  function renderCoinPlaceholders() {
    if (!coinGrid) return;
    coinGrid.innerHTML = Array.from({ length: 100 }, () => '<span class="coin" aria-hidden="true">·</span>').join('');
    coinGrid.setAttribute('aria-label', 'One hundred coin flips, not yet flipped.');
  }

  function longestHeadRun(flips) {
    let best = 0;
    let current = 0;
    let bestStart = 0;
    let currentStart = 0;
    for (let i = 0; i < flips.length; i += 1) {
      if (flips[i] === 'H') {
        if (current === 0) currentStart = i;
        current += 1;
        if (current > best) {
          best = current;
          bestStart = currentStart;
        }
      } else {
        current = 0;
      }
    }
    return { length: best, start: bestStart };
  }

  function streakBucket(run) {
    if (run <= 3) return '3';
    if (run <= 5) return '5';
    if (run <= 7) return '7';
    if (run <= 9) return '9';
    return '10';
  }

  function bucketLabel(bucket) {
    return bucket === '3' ? '3 or fewer' : bucket === '5' ? '4-5' : bucket === '7' ? '6-7' : bucket === '9' ? '8-9' : '10+';
  }

  sequenceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (sequenceButtons.some((candidate) => candidate.disabled)) return;
      const choice = button.getAttribute('data-seq');
      sequenceButtons.forEach((candidate) => {
        candidate.disabled = true;
        const isSame = candidate.getAttribute('data-seq') === 'same';
        if (candidate === button) candidate.classList.add(choice === 'same' ? 'is-correct' : 'is-wrong');
        if (choice !== 'same' && isSame) candidate.classList.add('is-correct');
      });
      if (seqResult) {
        seqResult.className = `result ${choice === 'same' ? 'good' : 'bad'}`;
        seqResult.innerHTML = `<strong>${choice === 'same' ? 'Correct.' : 'Not quite.'}</strong> Every exact 10-flip sequence has probability (1/2)<sup>10</sup> = 1/1024, about 0.098%. Sequence B looks more random, but it is exactly as likely as the alternating sequence.`;
      }
    });
  });

  function clearPredictionFeedback() {
    streakPredictionButtons.forEach((button) => button.classList.remove('is-correct', 'is-wrong'));
  }

  function chooseStreakPrediction(button) {
    streakState.prediction = button.getAttribute('data-streak');
    clearPredictionFeedback();
    streakPredictionButtons.forEach((candidate) => {
      const selected = candidate === button;
      candidate.classList.toggle('is-selected', selected);
      candidate.setAttribute('aria-pressed', String(selected));
    });
    if (streakResult) {
      streakResult.className = 'result';
      streakResult.innerHTML = `<strong>Prediction locked:</strong> ${bucketLabel(streakState.prediction)} heads in a row. ${streakState.flips.length ? 'Flip again to test it.' : 'Now flip 100 coins.'}`;
    }
  }

  streakPredictionButtons.forEach((button) => {
    button.addEventListener('click', () => chooseStreakPrediction(button));
  });

  function renderFlips(flips, run) {
    if (!coinGrid) return;
    coinGrid.innerHTML = flips.map((flip, index) => {
      const inRun = run.length > 0 && index >= run.start && index < run.start + run.length;
      return `<span class="coin ${flip === 'H' ? 'h' : 't'}${inRun ? ' run' : ''}" aria-hidden="true">${flip}</span>`;
    }).join('');
    coinGrid.setAttribute('aria-label', `One hundred coin flips. Longest run of heads: ${run.length}.`);
  }

  function flipCoins() {
    const flips = Array.from({ length: 100 }, () => Math.random() < 0.5 ? 'H' : 'T');
    const run = longestHeadRun(flips);
    streakState.flips = flips;
    streakState.lastRun = run.length;
    renderFlips(flips, run);
    const actualBucket = streakBucket(run.length);
    if (streakState.prediction) {
      const correct = streakState.prediction === actualBucket;
      clearPredictionFeedback();
      streakPredictionButtons.forEach((button) => {
        const selected = button.getAttribute('data-streak') === streakState.prediction;
        if (selected) button.classList.add(correct ? 'is-correct' : 'is-wrong');
        if (!correct && button.getAttribute('data-streak') === actualBucket) button.classList.add('is-correct');
      });
      if (streakResult) {
        streakResult.className = `result ${correct ? 'good' : 'bad'}`;
        streakResult.innerHTML = `<strong>Longest run: ${run.length} heads.</strong> You predicted ${bucketLabel(streakState.prediction)}. ${correct ? 'That falls in your range.' : `The actual range was ${bucketLabel(actualBucket)}.`} Runs of this length are normal in 100 fair flips.`;
      }
    } else if (streakResult) {
      streakResult.className = 'result';
      streakResult.innerHTML = `<strong>Longest run: ${run.length} heads.</strong> Make a prediction, then flip again to test it. The longest run in 100 fair flips is usually around 6.`;
    }
  }

  streakFlipButton?.addEventListener('click', flipCoins);
  streakSimButton?.addEventListener('click', () => {
    const trials = 1000;
    const counts = new Map();
    let totalLongest = 0;
    let sixOrMore = 0;
    const samples = [];
    for (let trial = 0; trial < trials; trial += 1) {
      const flips = Array.from({ length: 100 }, () => Math.random() < 0.5 ? 'H' : 'T');
      const run = longestHeadRun(flips).length;
      samples.push(run);
      totalLongest += run;
      if (run >= 6) sixOrMore += 1;
      const bucket = run >= 10 ? 10 : run;
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    const maxCount = Math.max(...counts.values());
    const bars = Array.from({ length: 10 }, (_, index) => {
      const run = index + 1;
      const count = counts.get(run) || 0;
      const height = maxCount ? Math.max(3, (count / maxCount) * 100) : 3;
      return `<div class="hist-bar" title="${run}${run === 10 ? '+' : ''}: ${count}"><i style="height:${height}%"></i><span>${run}${run === 10 ? '+' : ''}</span></div>`;
    }).join('');
    if (streakOutput) {
      streakOutput.innerHTML = `<p>In ${formatNumber(trials)} sequences, the median longest run was <strong>${median}</strong>; ${formatPercent((sixOrMore / trials) * 100)} had a run of 6 or more. The mean was ${(totalLongest / trials).toFixed(2)}.</p><div class="histogram" aria-hidden="true">${bars}</div>`;
    }
  });
  renderCoinPlaceholders();

  /* ---------- experiment 03: chaos ---------- */
  const chaosCanvasA = $('#pendulum-a');
  const chaosCanvasB = $('#pendulum-b');
  const chaosPlayButton = $('#chaos-play');
  const chaosResetButton = $('#chaos-reset');
  const chaosTimeEl = $('#chaos-time');
  const chaosSeparationEl = $('#chaos-sep');
  const chaosBadge = $('#chaos-badge');
  const chaosControls = {
    angle: $('#chaos-angle'),
    angle2: $('#chaos-angle2'),
    delta: $('#chaos-delta'),
    l1: $('#chaos-l1'),
    l2: $('#chaos-l2'),
    m1: $('#chaos-m1'),
    m2: $('#chaos-m2')
  };
  const chaosOutputs = {
    angle: $('#chaos-angle-out'),
    angle2: $('#chaos-angle2-out'),
    delta: $('#chaos-delta-out'),
    l1: $('#chaos-l1-out'),
    l2: $('#chaos-l2-out'),
    m1: $('#chaos-m1-out'),
    m2: $('#chaos-m2-out')
  };

  const chaos = {
    params: null,
    A: [0, 0, 0, 0],
    B: [0, 0, 0, 0],
    time: 0,
    playing: !reducedMotion,
    raf: 0,
    last: 0,
    accumulator: 0,
    trailA: [],
    trailB: [],
    step: 0.0025,
    maxTrail: 440,
    width: 360,
    height: 360,
    pivot: { x: 180, y: 155 }
  };

  if (chaosCanvasA) prepareCanvas(chaosCanvasA, chaos.width, chaos.height);
  if (chaosCanvasB) prepareCanvas(chaosCanvasB, chaos.width, chaos.height);

  function readChaosParams() {
    return {
      angle: Number(chaosControls.angle?.value || 120),
      angle2: Number(chaosControls.angle2?.value || 90),
      delta: Number(chaosControls.delta?.value || 0.05),
      l1: Number(chaosControls.l1?.value || 1),
      l2: Number(chaosControls.l2?.value || 1),
      m1: Number(chaosControls.m1?.value || 1),
      m2: Number(chaosControls.m2?.value || 1),
      g: 9.81
    };
  }

  function updateChaosLabels() {
    const params = readChaosParams();
    if (chaosOutputs.angle) chaosOutputs.angle.textContent = `${Math.round(params.angle)}°`;
    if (chaosOutputs.angle2) chaosOutputs.angle2.textContent = `${Math.round(params.angle2)}°`;
    if (chaosOutputs.delta) chaosOutputs.delta.textContent = `${params.delta.toFixed(3)}°`;
    if (chaosOutputs.l1) chaosOutputs.l1.textContent = `${params.l1.toFixed(2)} m`;
    if (chaosOutputs.l2) chaosOutputs.l2.textContent = `${params.l2.toFixed(2)} m`;
    if (chaosOutputs.m1) chaosOutputs.m1.textContent = `${params.m1.toFixed(2)} kg`;
    if (chaosOutputs.m2) chaosOutputs.m2.textContent = `${params.m2.toFixed(2)} kg`;
  }

  function pendulumDerivatives(state, params) {
    const [theta1, omega1, theta2, omega2] = state;
    const { m1, m2, l1, l2, g } = params;
    const difference = theta1 - theta2;
    const denominator = 2 * m1 + m2 - m2 * Math.cos(2 * difference);
    const alpha1 = (
      -g * (2 * m1 + m2) * Math.sin(theta1)
      - m2 * g * Math.sin(theta1 - 2 * theta2)
      - 2 * Math.sin(difference) * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * Math.cos(difference))
    ) / (l1 * denominator);
    const alpha2 = (
      2 * Math.sin(difference) * (
        omega1 * omega1 * l1 * (m1 + m2)
        + g * (m1 + m2) * Math.cos(theta1)
        + omega2 * omega2 * l2 * m2 * Math.cos(difference)
      )
    ) / (l2 * denominator);
    return [omega1, alpha1, omega2, alpha2];
  }

  function rk4Step(state, params, h) {
    const k1 = pendulumDerivatives(state, params);
    const s2 = state.map((value, index) => value + (h / 2) * k1[index]);
    const k2 = pendulumDerivatives(s2, params);
    const s3 = state.map((value, index) => value + (h / 2) * k2[index]);
    const k3 = pendulumDerivatives(s3, params);
    const s4 = state.map((value, index) => value + h * k3[index]);
    const k4 = pendulumDerivatives(s4, params);
    return state.map((value, index) => value + (h / 6) * (k1[index] + 2 * k2[index] + 2 * k3[index] + k4[index]));
  }

  function pendulumPoints(state, params) {
    const x1 = params.l1 * Math.sin(state[0]);
    const y1 = params.l1 * Math.cos(state[0]);
    const x2 = x1 + params.l2 * Math.sin(state[2]);
    const y2 = y1 + params.l2 * Math.cos(state[2]);
    return { x1, y1, x2, y2 };
  }

  function chaosScreenPoint(x, y, params) {
    const scale = 150 / Math.max(0.6, params.l1 + params.l2);
    return {
      x: chaos.pivot.x + x * scale,
      y: chaos.pivot.y + y * scale
    };
  }

  function updateChaosReadout() {
    const params = chaos.params || readChaosParams();
    const pointsA = pendulumPoints(chaos.A, params);
    const pointsB = pendulumPoints(chaos.B, params);
    const separation = Math.hypot(pointsA.x2 - pointsB.x2, pointsA.y2 - pointsB.y2);
    if (chaosTimeEl) chaosTimeEl.textContent = `${chaos.time.toFixed(2)} s`;
    if (chaosSeparationEl) chaosSeparationEl.textContent = `${separation.toFixed(3)} m`;
    if (chaosBadge) {
      const state = separation < 0.005 ? 'together' : separation < 0.15 ? 'drifting' : 'diverged';
      chaosBadge.textContent = state;
      chaosBadge.classList.toggle('is-diverged', state === 'diverged');
    }
  }

  function drawPendulum(canvas, state, trail, color, params) {
    const ctx = canvas?._labContext;
    if (!ctx) return;
    const width = chaos.width;
    const height = chaos.height;
    ctx.clearRect(0, 0, width, height);

    const scale = 150 / Math.max(0.6, params.l1 + params.l2);
    const pivot = chaos.pivot;

    ctx.save();
    ctx.strokeStyle = 'rgba(129, 140, 248, .10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, params.l1 * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, (params.l1 + params.l2) * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(148, 163, 184, .12)';
    ctx.beginPath();
    ctx.moveTo(pivot.x - 6, pivot.y);
    ctx.lineTo(pivot.x + 6, pivot.y);
    ctx.moveTo(pivot.x, pivot.y - 6);
    ctx.lineTo(pivot.x, pivot.y + 6);
    ctx.stroke();
    ctx.restore();

    if (trail.length > 1) {
      ctx.save();
      ctx.strokeStyle = color.trail;
      ctx.lineWidth = 1.25;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      trail.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.restore();
    }

    const points = pendulumPoints(state, params);
    const p1 = chaosScreenPoint(points.x1, points.y1, params);
    const p2 = chaosScreenPoint(points.x2, points.y2, params);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = color.rod;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.shadowColor = color.glow;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color.bob;
    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#060d18';
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color.rod;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  function renderChaos() {
    const params = chaos.params || readChaosParams();
    drawPendulum(chaosCanvasA, chaos.A, chaos.trailA, {
      trail: 'rgba(103, 232, 249, .36)',
      rod: 'rgba(103, 232, 249, .72)',
      bob: '#67e8f9',
      glow: 'rgba(103, 232, 249, .55)'
    }, params);
    drawPendulum(chaosCanvasB, chaos.B, chaos.trailB, {
      trail: 'rgba(196, 181, 253, .38)',
      rod: 'rgba(196, 181, 253, .72)',
      bob: '#c4b5fd',
      glow: 'rgba(196, 181, 253, .55)'
    }, params);
    updateChaosReadout();
  }

  function addChaosTrail() {
    const params = chaos.params;
    if (!params) return;
    const pointsA = pendulumPoints(chaos.A, params);
    const pointsB = pendulumPoints(chaos.B, params);
    const screenA = chaosScreenPoint(pointsA.x2, pointsA.y2, params);
    const screenB = chaosScreenPoint(pointsB.x2, pointsB.y2, params);
    chaos.trailA.push(screenA);
    chaos.trailB.push(screenB);
    if (chaos.trailA.length > chaos.maxTrail) chaos.trailA.shift();
    if (chaos.trailB.length > chaos.maxTrail) chaos.trailB.shift();
  }

  function resetChaos() {
    updateChaosLabels();
    const params = readChaosParams();
    chaos.params = params;
    chaos.A = [params.angle * Math.PI / 180, 0, params.angle2 * Math.PI / 180, 0];
    chaos.B = [(params.angle + params.delta) * Math.PI / 180, 0, params.angle2 * Math.PI / 180, 0];
    chaos.time = 0;
    chaos.accumulator = 0;
    chaos.trailA = [];
    chaos.trailB = [];
    chaos.last = 0;
    renderChaos();
  }

  function updateChaosButton() {
    if (!chaosPlayButton) return;
    chaosPlayButton.textContent = chaos.playing ? 'Pause' : 'Play';
    chaosPlayButton.setAttribute('aria-pressed', String(chaos.playing));
  }

  function chaosFrame(timestamp) {
    if (!chaos.playing) return;
    if (!chaos.last) chaos.last = timestamp;
    const delta = Math.min(0.05, Math.max(0, (timestamp - chaos.last) / 1000));
    chaos.last = timestamp;
    chaos.accumulator += delta;
    let steps = 0;
    while (chaos.accumulator >= chaos.step && steps < 60) {
      chaos.A = rk4Step(chaos.A, chaos.params, chaos.step);
      chaos.B = rk4Step(chaos.B, chaos.params, chaos.step);
      chaos.time += chaos.step;
      chaos.accumulator -= chaos.step;
      steps += 1;
    }
    if (steps === 60) chaos.accumulator = 0;
    if (steps > 0) addChaosTrail();
    renderChaos();
    chaos.raf = requestAnimationFrame(chaosFrame);
  }

  function playChaos() {
    if (chaos.playing) return;
    chaos.playing = true;
    chaos.last = 0;
    updateChaosButton();
    chaos.raf = requestAnimationFrame(chaosFrame);
  }

  function pauseChaos() {
    if (!chaos.playing) return;
    chaos.playing = false;
    cancelAnimationFrame(chaos.raf);
    chaos.raf = 0;
    chaos.last = 0;
    updateChaosButton();
    renderChaos();
  }

  chaosPlayButton?.addEventListener('click', () => {
    if (chaos.playing) pauseChaos();
    else playChaos();
  });
  chaosResetButton?.addEventListener('click', resetChaos);

  Object.values(chaosControls).forEach((control) => {
    control?.addEventListener('input', resetChaos);
  });
  $$('[data-delta]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.getAttribute('data-delta');
      if (chaosControls.delta) chaosControls.delta.value = value;
      resetChaos();
    });
  });

  resetChaos();
  updateChaosButton();
  if (chaos.playing) {
    chaos.raf = requestAnimationFrame(chaosFrame);
  }

  /* ---------- experiment 04: maze search ---------- */
  const MAZE = {
    cols: 23,
    rows: 13,
    cell: 28,
    width: 644,
    height: 364,
    start: { x: 1, y: 1 },
    goal: { x: 21, y: 11 }
  };
  const mazeCanvas = $('#maze');
  const mazeCtx = prepareCanvas(mazeCanvas, MAZE.width, MAZE.height);
  const mazePathEl = $('#maze-path');
  const mazeExploredEl = $('#maze-explored');
  const mazeStatus = $('#maze-status');
  const mazeModeHint = $('#maze-mode-hint');
  const mazePredictResult = $('#maze-predict-result');
  const mazePredictionButtons = $$('[data-predict]');
  const mazeModeButtons = $$('[data-mode]');
  const mazeState = {
    grid: [],
    visited: [],
    path: [],
    manual: [],
    results: {},
    prediction: null,
    mode: 'walls',
    cursor: { x: MAZE.start.x, y: MAZE.start.y },
    focused: false,
    dragging: false,
    paintWall: false,
    traceActive: false,
    lastCell: null,
    anim: null,
    animFrame: 0
  };

  function mazeKey(x, y) {
    return `${x},${y}`;
  }

  function isMazeOpen(x, y) {
    return y >= 0 && y < MAZE.rows && x >= 0 && x < MAZE.cols && mazeState.grid[y]?.[x] === 0;
  }

  function isMazeProtected(x, y) {
    return x <= 0 || y <= 0 || x >= MAZE.cols - 1 || y >= MAZE.rows - 1
      || (x === MAZE.start.x && y === MAZE.start.y)
      || (x === MAZE.goal.x && y === MAZE.goal.y);
  }

  function isAdjacent(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  }

  function extendMazeTrace(cell) {
    if (!mazeState.manual.length) return;
    const existingIndex = mazeState.manual.findIndex((point) => point.x === cell.x && point.y === cell.y);
    if (existingIndex >= 0) {
      mazeState.manual.length = existingIndex + 1;
      return;
    }
    let last = mazeState.manual[mazeState.manual.length - 1];
    let guard = 0;
    while ((last.x !== cell.x || last.y !== cell.y) && guard < 80) {
      const dx = Math.sign(cell.x - last.x);
      const dy = Math.sign(cell.y - last.y);
      const next = { x: last.x + (dx !== 0 ? dx : 0), y: last.y + (dx === 0 ? dy : 0) };
      if (!isMazeOpen(next.x, next.y) || mazeState.manual.some((point) => point.x === next.x && point.y === next.y)) break;
      mazeState.manual.push(next);
      last = next;
      guard += 1;
    }
  }

  function generateMazeGrid() {
    const grid = Array.from({ length: MAZE.rows }, () => Array(MAZE.cols).fill(1));
    const stack = [[MAZE.start.x, MAZE.start.y]];
    grid[MAZE.start.y][MAZE.start.x] = 0;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const directions = [[0, -2], [2, 0], [0, 2], [-2, 0]];
      for (let i = directions.length - 1; i > 0; i -= 1) {
        const j = randInt(i + 1);
        [directions[i], directions[j]] = [directions[j], directions[i]];
      }
      let moved = false;
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx > 0 && nx < MAZE.cols - 1 && ny > 0 && ny < MAZE.rows - 1 && grid[ny][nx] === 1) {
          grid[y + dy / 2][x + dx / 2] = 0;
          grid[ny][nx] = 0;
          stack.push([nx, ny]);
          moved = true;
          break;
        }
      }
      if (!moved) stack.pop();
    }
    for (let y = 2; y < MAZE.rows - 2; y += 1) {
      for (let x = 2; x < MAZE.cols - 2; x += 1) {
        if (grid[y][x] === 1 && Math.random() < 0.025) grid[y][x] = 0;
      }
    }
    grid[MAZE.start.y][MAZE.start.x] = 0;
    grid[MAZE.goal.y][MAZE.goal.x] = 0;
    return grid;
  }

  function drawMazeEndpoint(cell, color, label) {
    if (!mazeCtx) return;
    const cx = (cell.x + 0.5) * MAZE.cell;
    const cy = (cell.y + 0.5) * MAZE.cell;
    mazeCtx.fillStyle = color;
    mazeCtx.beginPath();
    mazeCtx.arc(cx, cy, 8, 0, Math.PI * 2);
    mazeCtx.fill();
    mazeCtx.fillStyle = '#04101a';
    mazeCtx.font = '700 10px "JetBrains Mono", monospace';
    mazeCtx.textAlign = 'center';
    mazeCtx.textBaseline = 'middle';
    mazeCtx.fillText(label, cx, cy + 0.5);
  }

  function renderMaze() {
    if (!mazeCtx) return;
    const ctx = mazeCtx;
    const { cols, rows, cell } = MAZE;
    ctx.clearRect(0, 0, MAZE.width, MAZE.height);
    ctx.fillStyle = '#060d18';
    ctx.fillRect(0, 0, MAZE.width, MAZE.height);

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const wall = mazeState.grid[y]?.[x] === 1;
        ctx.fillStyle = wall ? '#2a3a52' : '#08111f';
        ctx.fillRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
      }
    }

    if (mazeState.visited.length) {
      ctx.fillStyle = 'rgba(129, 140, 248, .24)';
      mazeState.visited.forEach((cellPoint) => {
        ctx.fillRect(cellPoint.x * cell + 3, cellPoint.y * cell + 3, cell - 6, cell - 6);
      });
    }

    if (mazeState.manual.length > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 113, 133, .9)';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      mazeState.manual.forEach((cellPoint, index) => {
        const cx = (cellPoint.x + 0.5) * cell;
        const cy = (cellPoint.y + 0.5) * cell;
        if (index === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
      ctx.restore();
    }

    if (mazeState.path.length) {
      ctx.fillStyle = 'rgba(103, 232, 249, .17)';
      mazeState.path.forEach((cellPoint) => {
        ctx.fillRect(cellPoint.x * cell + 2, cellPoint.y * cell + 2, cell - 4, cell - 4);
      });
      if (mazeState.path.length > 1) {
        ctx.save();
        ctx.strokeStyle = '#67e8f9';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(103, 232, 249, .5)';
        ctx.shadowBlur = 9;
        ctx.beginPath();
        mazeState.path.forEach((cellPoint, index) => {
          const cx = (cellPoint.x + 0.5) * cell;
          const cy = (cellPoint.y + 0.5) * cell;
          if (index === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
        ctx.stroke();
        ctx.restore();
      }
    }

    drawMazeEndpoint(MAZE.start, '#6ee7b7', 'S');
    drawMazeEndpoint(MAZE.goal, '#fbbf24', 'G');

    if (mazeState.focused) {
      ctx.save();
      ctx.strokeStyle = '#e7eef8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(mazeState.cursor.x * cell + 1.5, mazeState.cursor.y * cell + 1.5, cell - 3, cell - 3);
      ctx.restore();
    }
  }

  function setMazeStatus(message, tone = '') {
    if (!mazeStatus) return;
    mazeStatus.textContent = message;
    mazeStatus.className = `result ${tone}`.trim();
  }

  function setMazePanel(kind, result) {
    const label = kind === 'bfs' ? 'BFS' : 'A*';
    if (mazePathEl) mazePathEl.textContent = result.path.length ? `${result.path.length - 1} steps · ${label}` : `no path · ${label}`;
    if (mazeExploredEl) mazeExploredEl.textContent = `${formatNumber(result.explored)} cells · ${label}`;
  }

  function formatMilliseconds(milliseconds) {
    if (milliseconds < 0.01) return '<0.01 ms';
    return `${milliseconds.toFixed(2)} ms`;
  }

  function updateMazeRow(kind, result) {
    const row = $(`[data-algo="${kind}"]`);
    if (!row) return;
    const pathCell = row.querySelector('[data-cell="path"]');
    const exploredCell = row.querySelector('[data-cell="explored"]');
    const timeCell = row.querySelector('[data-cell="time"]');
    if (pathCell) pathCell.textContent = result.path.length ? `${result.path.length - 1} steps` : 'no path';
    if (exploredCell) exploredCell.textContent = formatNumber(result.explored);
    if (timeCell) timeCell.textContent = formatMilliseconds(result.time);
  }

  function markBestMazeRows() {
    $$('.stat-table tr[data-algo]').forEach((row) => row.classList.remove('is-best'));
    const bfs = mazeState.results.bfs;
    const astar = mazeState.results.astar;
    if (!bfs || !astar) return;
    const best = Math.min(bfs.explored, astar.explored);
    if (bfs.explored === best) $('[data-algo="bfs"]')?.classList.add('is-best');
    if (astar.explored === best) $('[data-algo="astar"]')?.classList.add('is-best');
  }

  function clearMazeResults(message = '') {
    cancelMazeAnimation();
    mazeState.visited = [];
    mazeState.path = [];
    mazeState.results = {};
    if (mazePathEl) mazePathEl.textContent = 'not run';
    if (mazeExploredEl) mazeExploredEl.textContent = 'not run';
    $$('.stat-table tr[data-algo]').forEach((row) => {
      row.classList.remove('is-best');
      row.querySelectorAll('[data-cell]').forEach((cell) => { cell.textContent = 'not run'; });
    });
    if (mazePredictResult) {
      mazePredictResult.className = 'result';
      mazePredictResult.textContent = mazeState.prediction ? 'Run both searches to test your prediction.' : '';
    }
    if (message) setMazeStatus(message);
    renderMaze();
  }

  function reconstructPath(parent, startKey, goalKey) {
    if (!parent.has(goalKey)) return [];
    const path = [];
    let key = goalKey;
    const guard = MAZE.cols * MAZE.rows + 5;
    let count = 0;
    while (key && count < guard) {
      const [x, y] = key.split(',').map(Number);
      path.push({ x, y });
      if (key === startKey) break;
      key = parent.get(key);
      count += 1;
    }
    return path.reverse();
  }

  function runBfs() {
    const started = performance.now();
    const startKey = mazeKey(MAZE.start.x, MAZE.start.y);
    const goalKey = mazeKey(MAZE.goal.x, MAZE.goal.y);
    const queue = [{ ...MAZE.start }];
    const seen = new Set([startKey]);
    const parent = new Map();
    const visited = [];
    let found = false;
    let head = 0;
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    while (head < queue.length) {
      const current = queue[head];
      head += 1;
      visited.push(current);
      if (current.x === MAZE.goal.x && current.y === MAZE.goal.y) {
        found = true;
        break;
      }
      for (const [dx, dy] of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = mazeKey(nx, ny);
        if (isMazeOpen(nx, ny) && !seen.has(key)) {
          seen.add(key);
          parent.set(key, mazeKey(current.x, current.y));
          queue.push({ x: nx, y: ny });
        }
      }
    }
    const elapsed = performance.now() - started;
    return {
      visited,
      path: found ? reconstructPath(parent, startKey, goalKey) : [],
      explored: visited.length,
      time: elapsed
    };
  }

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function runAStar() {
    const started = performance.now();
    const startKey = mazeKey(MAZE.start.x, MAZE.start.y);
    const goalKey = mazeKey(MAZE.goal.x, MAZE.goal.y);
    const start = { ...MAZE.start };
    const open = [{ x: start.x, y: start.y, g: 0, h: manhattan(start, MAZE.goal), f: manhattan(start, MAZE.goal) }];
    const gScore = new Map([[startKey, 0]]);
    const parent = new Map();
    const closed = new Set();
    const visited = [];
    let found = false;
    const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    while (open.length) {
      let bestIndex = 0;
      for (let i = 1; i < open.length; i += 1) {
        if (open[i].f < open[bestIndex].f || (open[i].f === open[bestIndex].f && open[i].h < open[bestIndex].h)) {
          bestIndex = i;
        }
      }
      const current = open.splice(bestIndex, 1)[0];
      const currentKey = mazeKey(current.x, current.y);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      visited.push({ x: current.x, y: current.y });
      if (current.x === MAZE.goal.x && current.y === MAZE.goal.y) {
        found = true;
        break;
      }
      for (const [dx, dy] of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const key = mazeKey(nx, ny);
        if (!isMazeOpen(nx, ny) || closed.has(key)) continue;
        const tentative = current.g + 1;
        if (tentative < (gScore.get(key) ?? Infinity)) {
          gScore.set(key, tentative);
          parent.set(key, currentKey);
          const h = manhattan({ x: nx, y: ny }, MAZE.goal);
          open.push({ x: nx, y: ny, g: tentative, h, f: tentative + h });
        }
      }
    }
    const elapsed = performance.now() - started;
    return {
      visited,
      path: found ? reconstructPath(parent, startKey, goalKey) : [],
      explored: visited.length,
      time: elapsed
    };
  }

  function cancelMazeAnimation() {
    if (mazeState.anim) {
      cancelAnimationFrame(mazeState.anim.frame);
      mazeState.anim = null;
    }
    mazeState.animFrame = 0;
  }

  function animateMaze(visited, path, onDone) {
    cancelMazeAnimation();
    if (reducedMotion || !visited.length) {
      mazeState.visited = visited;
      mazeState.path = path;
      renderMaze();
      onDone?.();
      return;
    }
    const animation = {
      frame: 0,
      started: performance.now(),
      duration: clamp(visited.length * 5, 260, 820)
    };
    mazeState.anim = animation;
    const step = (timestamp) => {
      if (mazeState.anim !== animation) return;
      const progress = clamp((timestamp - animation.started) / animation.duration, 0, 1);
      const count = Math.max(1, Math.ceil(progress * visited.length));
      mazeState.visited = visited.slice(0, count);
      mazeState.path = progress >= 1 ? path : [];
      renderMaze();
      if (progress < 1) {
        animation.frame = requestAnimationFrame(step);
        mazeState.animFrame = animation.frame;
      } else {
        mazeState.anim = null;
        mazeState.animFrame = 0;
        onDone?.();
      }
    };
    animation.frame = requestAnimationFrame(step);
    mazeState.animFrame = animation.frame;
  }

  function fewerSearch() {
    const bfs = mazeState.results.bfs;
    const astar = mazeState.results.astar;
    if (!bfs || !astar) return null;
    if (bfs.explored === astar.explored) return 'same';
    return bfs.explored < astar.explored ? 'bfs' : 'astar';
  }

  function evaluateMazePrediction() {
    if (!mazeState.prediction || !mazeState.results.bfs || !mazeState.results.astar) return;
    const fewer = fewerSearch();
    if (!fewer) return;
    const labels = { bfs: 'BFS', astar: 'A*', same: 'about the same' };
    const bfs = mazeState.results.bfs;
    const astar = mazeState.results.astar;
    const correct = mazeState.prediction === fewer;
    mazePredictionButtons.forEach((button) => {
      button.classList.remove('is-selected', 'is-correct', 'is-wrong');
      const value = button.getAttribute('data-predict');
      if (value === mazeState.prediction) button.classList.add('is-selected', correct ? 'is-correct' : 'is-wrong');
      if (!correct && value === fewer) button.classList.add('is-correct');
    });
    if (mazePredictResult) {
      mazePredictResult.className = `result ${correct ? 'good' : 'bad'}`;
      mazePredictResult.innerHTML = `<strong>${correct ? 'Your prediction held.' : 'The other search explored fewer.'}</strong> BFS explored ${formatNumber(bfs.explored)} cells; A* explored ${formatNumber(astar.explored)}. ${fewer === 'same' ? 'They tied on this maze.' : `${labels[fewer]} had the smaller search frontier here.`}`;
    }
  }

  function setMazePrediction(button) {
    mazeState.prediction = button.getAttribute('data-predict');
    mazePredictionButtons.forEach((candidate) => {
      candidate.classList.toggle('is-selected', candidate === button);
      candidate.classList.remove('is-correct', 'is-wrong');
    });
    if (mazeState.results.bfs && mazeState.results.astar) {
      evaluateMazePrediction();
    } else if (mazePredictResult) {
      mazePredictResult.className = 'result';
      mazePredictResult.innerHTML = `<strong>Prediction locked:</strong> ${mazeState.prediction === 'same' ? 'about the same' : mazeState.prediction === 'bfs' ? 'BFS' : 'A*'}. Run both searches to check it.`;
    }
  }

  function mazeFinalMessage() {
    const bfs = mazeState.results.bfs;
    const astar = mazeState.results.astar;
    if (!bfs || !astar) return '';
    if (!bfs.path.length && !astar.path.length) {
      return `No route to the goal. BFS explored ${formatNumber(bfs.explored)} cells; A* explored ${formatNumber(astar.explored)}. Open a wall and try again.`;
    }
    const fewer = fewerSearch();
    return `Both found a ${bfs.path.length - 1}-step path. BFS explored ${formatNumber(bfs.explored)} cells; A* explored ${formatNumber(astar.explored)}.${fewer && fewer !== 'same' ? ` ${fewer === 'bfs' ? 'BFS' : 'A*'} explored fewer here.` : ' They tied here.'}`;
  }

  function runMazeSearch(kind) {
    const result = kind === 'bfs' ? runBfs() : runAStar();
    mazeState.results[kind] = result;
    updateMazeRow(kind, result);
    setMazePanel(kind, result);
    markBestMazeRows();
    evaluateMazePrediction();
    const label = kind === 'bfs' ? 'BFS' : 'A*';
    setMazeStatus(`${label} is exploring...`);
    animateMaze(result.visited, result.path, () => {
      if (result.path.length) {
        setMazeStatus(`${label} found a ${result.path.length - 1}-step path and explored ${formatNumber(result.explored)} cells in ${formatMilliseconds(result.time)}.`);
      } else {
        setMazeStatus(`${label} explored ${formatNumber(result.explored)} cells and found no route to the goal.`);
      }
    });
  }

  function compareMazeSearches() {
    const bfs = runBfs();
    const astar = runAStar();
    mazeState.results = { bfs, astar };
    updateMazeRow('bfs', bfs);
    updateMazeRow('astar', astar);
    markBestMazeRows();
    evaluateMazePrediction();
    if (reducedMotion) {
      setMazePanel('astar', astar);
      mazeState.visited = astar.visited;
      mazeState.path = astar.path;
      renderMaze();
      setMazeStatus(mazeFinalMessage());
      return;
    }
    const sequence = [['bfs', bfs], ['astar', astar]];
    let index = 0;
    const runNext = () => {
      if (index >= sequence.length) {
        setMazePanel('astar', astar);
        setMazeStatus(mazeFinalMessage());
        return;
      }
      const [kind, result] = sequence[index];
      index += 1;
      setMazePanel(kind, result);
      setMazeStatus(`${kind === 'bfs' ? 'BFS' : 'A*'} is exploring...`);
      animateMaze(result.visited, result.path, runNext);
    };
    runNext();
  }

  function beginMazeEdit() {
    clearMazeResults();
    mazeState.manual = [];
    setMazeStatus('Maze changed. Run the searches again when ready.');
  }

  function setMazeWall(x, y, wall) {
    if (isMazeProtected(x, y)) return false;
    const value = wall ? 1 : 0;
    if (mazeState.grid[y][x] === value) return false;
    mazeState.grid[y][x] = value;
    return true;
  }

  function resetMazePath(message = 'Search results and your trace cleared.') {
    cancelMazeAnimation();
    mazeState.visited = [];
    mazeState.path = [];
    mazeState.manual = [];
    mazeState.results = {};
    if (mazePathEl) mazePathEl.textContent = 'not run';
    if (mazeExploredEl) mazeExploredEl.textContent = 'not run';
    $$('.stat-table tr[data-algo]').forEach((row) => {
      row.classList.remove('is-best');
      row.querySelectorAll('[data-cell]').forEach((cell) => { cell.textContent = 'not run'; });
    });
    if (mazePredictResult) {
      mazePredictResult.className = 'result';
      mazePredictResult.textContent = mazeState.prediction ? 'Run both searches to test your prediction.' : '';
    }
    setMazeStatus(message);
    renderMaze();
  }

  function setMazeMode(mode) {
    mazeState.mode = mode;
    mazeModeButtons.forEach((button) => {
      const active = button.getAttribute('data-mode') === mode;
      button.classList.toggle('is-on', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (mazeModeHint) {
      mazeModeHint.textContent = mode === 'walls'
        ? 'Click or drag to add walls. Tap start/goal to keep them clear.'
        : 'Start at the green cell. Drag through open cells to reach the amber goal.';
    }
    if (mazeCanvas) mazeCanvas.style.cursor = mode === 'walls' ? 'crosshair' : 'cell';
    setMazeStatus(mode === 'walls' ? 'Wall mode. Click or drag cells to edit the maze.' : 'Trace mode. Start at the green cell and draw a route.');
    renderMaze();
  }

  mazePredictionButtons.forEach((button) => {
    button.addEventListener('click', () => setMazePrediction(button));
  });
  mazeModeButtons.forEach((button) => {
    button.addEventListener('click', () => setMazeMode(button.getAttribute('data-mode')));
  });
  $('#maze-bfs')?.addEventListener('click', () => runMazeSearch('bfs'));
  $('#maze-astar')?.addEventListener('click', () => runMazeSearch('astar'));
  $('#maze-compare')?.addEventListener('click', compareMazeSearches);
  $('#maze-new')?.addEventListener('click', () => {
    mazeState.grid = generateMazeGrid();
    mazeState.manual = [];
    resetMazePath('New maze generated. Draw walls or race the solvers.');
  });
  $('#maze-clear')?.addEventListener('click', () => {
    mazeState.grid = Array.from({ length: MAZE.rows }, (_, y) => Array.from({ length: MAZE.cols }, (_, x) => (
      x === 0 || y === 0 || x === MAZE.cols - 1 || y === MAZE.rows - 1 ? 1 : 0
    )));
    mazeState.manual = [];
    resetMazePath('Walls cleared. The open grid is a useful comparison case.');
  });
  $('#maze-reset')?.addEventListener('click', () => resetMazePath());

  mazeCanvas?.addEventListener('focus', () => {
    mazeState.focused = true;
    renderMaze();
  });
  mazeCanvas?.addEventListener('blur', () => {
    mazeState.focused = false;
    renderMaze();
  });
  mazeCanvas?.addEventListener('pointerdown', (event) => {
    if (!mazeCanvas || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    mazeCanvas.focus({ preventScroll: true });
    const cell = eventCell(mazeCanvas, event, MAZE.cols, MAZE.rows, MAZE.width, MAZE.height);
    mazeState.cursor = cell;
    if (mazeState.mode === 'walls') {
      if (isMazeProtected(cell.x, cell.y)) {
        setMazeStatus('The start, goal, and outer border are protected.');
        renderMaze();
        return;
      }
      beginMazeEdit();
      mazeState.dragging = true;
      mazeState.paintWall = mazeState.grid[cell.y][cell.x] === 0;
      setMazeWall(cell.x, cell.y, mazeState.paintWall);
      mazeState.lastCell = cell;
      renderMaze();
      mazeCanvas.setPointerCapture?.(event.pointerId);
      return;
    }
    if (cell.x === MAZE.start.x && cell.y === MAZE.start.y) {
      mazeState.manual = [{ ...MAZE.start }];
      mazeState.traceActive = true;
      mazeState.dragging = true;
      mazeState.lastCell = cell;
      setMazeStatus('Tracing. Drag through open cells to the goal.');
      renderMaze();
      mazeCanvas.setPointerCapture?.(event.pointerId);
    } else if (mazeState.manual.length && isAdjacent(cell, mazeState.manual[mazeState.manual.length - 1]) && isMazeOpen(cell.x, cell.y)) {
      mazeState.manual.push(cell);
      mazeState.traceActive = true;
      mazeState.dragging = true;
      mazeState.lastCell = cell;
      renderMaze();
      mazeCanvas.setPointerCapture?.(event.pointerId);
    } else {
      setMazeStatus('Start your trace at the green cell. Walls block the route.');
      renderMaze();
    }
  });
  mazeCanvas?.addEventListener('pointermove', (event) => {
    if (!mazeCanvas || !mazeState.dragging) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      mazeState.dragging = false;
      mazeState.traceActive = false;
      return;
    }
    const cell = eventCell(mazeCanvas, event, MAZE.cols, MAZE.rows, MAZE.width, MAZE.height);
    if (mazeState.lastCell && cell.x === mazeState.lastCell.x && cell.y === mazeState.lastCell.y) return;
    mazeState.cursor = cell;
    if (mazeState.mode === 'walls') {
      if (isMazeProtected(cell.x, cell.y)) return;
      setMazeWall(cell.x, cell.y, mazeState.paintWall);
      mazeState.lastCell = cell;
      renderMaze();
      return;
    }
    if (!mazeState.traceActive) return;
    if (!isMazeOpen(cell.x, cell.y)) return;
    extendMazeTrace(cell);
    mazeState.lastCell = cell;
    renderMaze();
  });
  const finishMazePointer = () => {
    if (mazeState.mode === 'trace' && mazeState.manual.length) {
      const last = mazeState.manual[mazeState.manual.length - 1];
      if (last.x === MAZE.goal.x && last.y === MAZE.goal.y) {
        setMazeStatus(`Your trace reached the goal in ${mazeState.manual.length - 1} steps. Run BFS and A* to compare.`);
      } else {
        setMazeStatus(`Your trace is ${mazeState.manual.length - 1} steps long. Keep going, or reset the path.`);
      }
    }
    mazeState.dragging = false;
    mazeState.traceActive = false;
    mazeState.lastCell = null;
  };
  mazeCanvas?.addEventListener('pointerup', finishMazePointer);
  mazeCanvas?.addEventListener('pointercancel', finishMazePointer);
  mazeCanvas?.addEventListener('keydown', (event) => {
    const moves = {
      ArrowUp: [0, -1],
      ArrowRight: [1, 0],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0]
    };
    if (moves[event.key]) {
      event.preventDefault();
      mazeState.cursor.x = clamp(mazeState.cursor.x + moves[event.key][0], 1, MAZE.cols - 2);
      mazeState.cursor.y = clamp(mazeState.cursor.y + moves[event.key][1], 1, MAZE.rows - 2);
      renderMaze();
      return;
    }
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    const { x, y } = mazeState.cursor;
    if (mazeState.mode === 'walls') {
      if (isMazeProtected(x, y)) {
        setMazeStatus('The start, goal, and outer border are protected.');
        return;
      }
      beginMazeEdit();
      setMazeWall(x, y, mazeState.grid[y][x] === 0);
      setMazeStatus(`Wall toggled at column ${x + 1}, row ${y + 1}.`);
      renderMaze();
      return;
    }
    if (x === MAZE.start.x && y === MAZE.start.y) {
      mazeState.manual = [{ ...MAZE.start }];
      setMazeStatus('Trace started. Move with the arrow keys and press Space to add a cell.');
    } else {
      const last = mazeState.manual[mazeState.manual.length - 1];
      if (!last || !isAdjacent({ x, y }, last) || !isMazeOpen(x, y)) {
        setMazeStatus('Move to an open cell adjacent to the end of your trace.');
        return;
      }
      if (!mazeState.manual.some((point) => point.x === x && point.y === y)) {
        mazeState.manual.push({ x, y });
      }
      if (x === MAZE.goal.x && y === MAZE.goal.y) setMazeStatus(`Your trace reached the goal in ${mazeState.manual.length - 1} steps.`);
      else setMazeStatus(`Trace length: ${mazeState.manual.length - 1} steps.`);
    }
    renderMaze();
  });

  mazeState.grid = generateMazeGrid();
  renderMaze();

  /* ---------- experiment 05: emergence ---------- */
  const LIFE = { cols: 44, rows: 26, cell: 14, width: 616, height: 364 };
  const lifeCanvas = $('#life');
  const lifeCtx = prepareCanvas(lifeCanvas, LIFE.width, LIFE.height);
  const lifeGenEl = $('#life-gen');
  const lifePopEl = $('#life-pop');
  const lifeDensityEl = $('#life-density');
  const lifePlayButton = $('#life-play');
  const lifeStepButton = $('#life-step');
  const lifeClearButton = $('#life-clear');
  const lifeRandomButton = $('#life-random');
  const lifeSpeed = $('#life-speed');
  const lifeSpeedOut = $('#life-speed-out');
  const lifeNote = $('#life-note');
  const lifePresetButtons = $$('[data-life-preset]');
  const lifeState = {
    grid: new Uint8Array(LIFE.cols * LIFE.rows),
    gen: 0,
    playing: !reducedMotion,
    speed: Number(lifeSpeed?.value || 8),
    raf: 0,
    last: 0,
    accumulator: 0,
    cursor: { x: Math.floor(LIFE.cols / 2), y: Math.floor(LIFE.rows / 2) },
    focused: false,
    dragging: false,
    paint: 1,
    seed: 0
  };

  const lifePatterns = {
    glider: [
      '.O.',
      '..O',
      'OOO'
    ],
    pulsar: [
      '..OOO...OOO..',
      '.............',
      'O....O.O....O',
      'O....O.O....O',
      'O....O.O....O',
      '..OOO...OOO..',
      '.............',
      '..OOO...OOO..',
      'O....O.O....O',
      'O....O.O....O',
      'O....O.O....O',
      '.............',
      '..OOO...OOO..'
    ],
    acorn: [
      '.O.....',
      '...O...',
      'OO..OOO'
    ]
  };

  function lifeIndex(x, y) {
    return y * LIFE.cols + x;
  }

  function lifeAlive(x, y) {
    return x >= 0 && y >= 0 && x < LIFE.cols && y < LIFE.rows && lifeState.grid[lifeIndex(x, y)] === 1;
  }

  function clearLifeGrid() {
    lifeState.grid.fill(0);
    lifeState.gen = 0;
  }

  function placeLifePattern(name) {
    clearLifeGrid();
    const pattern = lifePatterns[name];
    if (!pattern) return;
    const width = pattern[0].length;
    const height = pattern.length;
    const offsetX = Math.floor((LIFE.cols - width) / 2);
    const offsetY = Math.floor((LIFE.rows - height) / 2);
    pattern.forEach((row, y) => {
      row.split('').forEach((value, x) => {
        if (value === 'O') lifeState.grid[lifeIndex(x + offsetX, y + offsetY)] = 1;
      });
    });
  }

  function fillLifeRandom(seed) {
    clearLifeGrid();
    lifeState.seed = seed >>> 0;
    const random = mulberry32(lifeState.seed);
    for (let i = 0; i < lifeState.grid.length; i += 1) {
      lifeState.grid[i] = random() < 0.29 ? 1 : 0;
    }
  }

  function setLifePresetUI(name) {
    lifePresetButtons.forEach((button) => {
      const active = button.getAttribute('data-life-preset') === name;
      button.classList.toggle('is-on', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function updateLifeStats() {
    let population = 0;
    for (let i = 0; i < lifeState.grid.length; i += 1) population += lifeState.grid[i];
    if (lifeGenEl) lifeGenEl.textContent = formatNumber(lifeState.gen);
    if (lifePopEl) lifePopEl.textContent = formatNumber(population);
    if (lifeDensityEl) lifeDensityEl.textContent = `${((population / (LIFE.cols * LIFE.rows)) * 100).toFixed(1)}%`;
  }

  function renderLife() {
    if (!lifeCtx) return;
    const ctx = lifeCtx;
    const { cols, rows, cell } = LIFE;
    ctx.clearRect(0, 0, LIFE.width, LIFE.height);
    ctx.fillStyle = '#060d18';
    ctx.fillRect(0, 0, LIFE.width, LIFE.height);

    ctx.strokeStyle = 'rgba(148, 163, 184, .055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x += 1) {
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, LIFE.height);
    }
    for (let y = 0; y <= rows; y += 1) {
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(LIFE.width, y * cell + 0.5);
    }
    ctx.stroke();

    ctx.fillStyle = 'rgba(251, 113, 133, .92)';
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (!lifeState.grid[lifeIndex(x, y)]) continue;
        ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
      }
    }
    ctx.fillStyle = 'rgba(255, 255, 255, .13)';
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (!lifeState.grid[lifeIndex(x, y)]) continue;
        ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, 2);
      }
    }

    if (lifeState.focused) {
      ctx.save();
      ctx.strokeStyle = '#e7eef8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(lifeState.cursor.x * cell + 1, lifeState.cursor.y * cell + 1, cell - 2, cell - 2);
      ctx.restore();
    }
    updateLifeStats();
  }

  function stepLife() {
    const next = new Uint8Array(lifeState.grid.length);
    for (let y = 0; y < LIFE.rows; y += 1) {
      for (let x = 0; x < LIFE.cols; x += 1) {
        let neighbours = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (dx === 0 && dy === 0) continue;
            if (lifeAlive(x + dx, y + dy)) neighbours += 1;
          }
        }
        const alive = lifeState.grid[lifeIndex(x, y)] === 1;
        next[lifeIndex(x, y)] = alive
          ? (neighbours === 2 || neighbours === 3 ? 1 : 0)
          : (neighbours === 3 ? 1 : 0);
      }
    }
    lifeState.grid = next;
    lifeState.gen += 1;
  }

  function updateLifeButton() {
    if (!lifePlayButton) return;
    lifePlayButton.textContent = lifeState.playing ? 'Pause' : 'Play';
    lifePlayButton.setAttribute('aria-pressed', String(lifeState.playing));
  }

  function lifeFrame(timestamp) {
    if (!lifeState.playing) return;
    if (!lifeState.last) lifeState.last = timestamp;
    const delta = Math.min(220, Math.max(0, timestamp - lifeState.last));
    lifeState.last = timestamp;
    lifeState.accumulator += delta;
    const interval = 1000 / lifeState.speed;
    let steps = 0;
    while (lifeState.accumulator >= interval && steps < 12) {
      stepLife();
      lifeState.accumulator -= interval;
      steps += 1;
    }
    if (steps === 12) lifeState.accumulator = 0;
    if (steps > 0) renderLife();
    lifeState.raf = requestAnimationFrame(lifeFrame);
  }

  function playLife() {
    if (lifeState.playing) return;
    lifeState.playing = true;
    lifeState.last = 0;
    lifeState.accumulator = 0;
    updateLifeButton();
    lifeState.raf = requestAnimationFrame(lifeFrame);
  }

  function pauseLife() {
    if (!lifeState.playing) {
      updateLifeButton();
      return;
    }
    lifeState.playing = false;
    cancelAnimationFrame(lifeState.raf);
    lifeState.raf = 0;
    lifeState.last = 0;
    updateLifeButton();
  }

  function lifeNoteText(name) {
    if (name === 'glider') return 'Glider preset. This small ship translates across the grid while keeping its shape.';
    if (name === 'pulsar') return 'Pulsar preset. A period-3 oscillator with fourfold symmetry.';
    if (name === 'acorn') return 'Acorn preset. A tiny seed that takes many generations to settle.';
    if (name === 'random') return `Seeded random soup · seed ${lifeState.seed}. The same seed reproduces this start.`;
    return 'Empty grid. Click cells to draw, or load a preset.';
  }

  function loadLifePattern(name, options = {}) {
    if (name === 'random') {
      const seed = options.seed ?? ((Math.random() * 0xffffffff) >>> 0);
      fillLifeRandom(seed);
    } else if (lifePatterns[name]) {
      placeLifePattern(name);
    } else {
      clearLifeGrid();
    }
    lifeState.gen = 0;
    setLifePresetUI(name);
    if (lifeNote) lifeNote.textContent = lifeNoteText(name);
    if (options.pause) pauseLife();
    renderLife();
  }

  lifePlayButton?.addEventListener('click', () => {
    if (lifeState.playing) pauseLife();
    else playLife();
  });
  lifeStepButton?.addEventListener('click', () => {
    pauseLife();
    stepLife();
    renderLife();
  });
  lifeClearButton?.addEventListener('click', () => {
    pauseLife();
    clearLifeGrid();
    setLifePresetUI(null);
    if (lifeNote) lifeNote.textContent = lifeNoteText(null);
    renderLife();
  });
  lifeRandomButton?.addEventListener('click', () => {
    pauseLife();
    loadLifePattern('random', { seed: (Math.random() * 0xffffffff) >>> 0 });
  });
  lifePresetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.getAttribute('data-life-preset');
      pauseLife();
      loadLifePattern(name);
    });
  });
  lifeSpeed?.addEventListener('input', () => {
    lifeState.speed = clamp(Number(lifeSpeed.value) || 8, 1, 20);
    if (lifeSpeedOut) lifeSpeedOut.textContent = `${lifeState.speed}/s`;
    lifeState.accumulator = 0;
    lifeState.last = 0;
  });

  lifeCanvas?.addEventListener('focus', () => {
    lifeState.focused = true;
    renderLife();
  });
  lifeCanvas?.addEventListener('blur', () => {
    lifeState.focused = false;
    renderLife();
  });
  lifeCanvas?.addEventListener('pointerdown', (event) => {
    if (!lifeCanvas || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    lifeCanvas.focus({ preventScroll: true });
    if (lifeState.playing) pauseLife();
    const cell = eventCell(lifeCanvas, event, LIFE.cols, LIFE.rows, LIFE.width, LIFE.height);
    lifeState.cursor = cell;
    const index = lifeIndex(cell.x, cell.y);
    lifeState.dragging = true;
    lifeState.paint = lifeState.grid[index] ? 0 : 1;
    lifeState.grid[index] = lifeState.paint;
    renderLife();
    lifeCanvas.setPointerCapture?.(event.pointerId);
  });
  lifeCanvas?.addEventListener('pointermove', (event) => {
    if (!lifeCanvas || !lifeState.dragging) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      lifeState.dragging = false;
      return;
    }
    const cell = eventCell(lifeCanvas, event, LIFE.cols, LIFE.rows, LIFE.width, LIFE.height);
    const index = lifeIndex(cell.x, cell.y);
    if (lifeState.grid[index] === lifeState.paint) return;
    lifeState.grid[index] = lifeState.paint;
    lifeState.cursor = cell;
    renderLife();
  });
  const finishLifePointer = () => {
    lifeState.dragging = false;
  };
  lifeCanvas?.addEventListener('pointerup', finishLifePointer);
  lifeCanvas?.addEventListener('pointercancel', finishLifePointer);
  lifeCanvas?.addEventListener('keydown', (event) => {
    const moves = {
      ArrowUp: [0, -1],
      ArrowRight: [1, 0],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0]
    };
    if (moves[event.key]) {
      event.preventDefault();
      lifeState.cursor.x = clamp(lifeState.cursor.x + moves[event.key][0], 0, LIFE.cols - 1);
      lifeState.cursor.y = clamp(lifeState.cursor.y + moves[event.key][1], 0, LIFE.rows - 1);
      renderLife();
      return;
    }
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (lifeState.playing) pauseLife();
    const index = lifeIndex(lifeState.cursor.x, lifeState.cursor.y);
    lifeState.grid[index] = lifeState.grid[index] ? 0 : 1;
    renderLife();
  });

  if (lifeSpeedOut) lifeSpeedOut.textContent = `${lifeState.speed}/s`;
  loadLifePattern('pulsar', { pause: false });
  updateLifeButton();
  if (lifeState.playing) {
    lifeState.raf = requestAnimationFrame(lifeFrame);
  } else {
    pauseLife();
  }

  /* ---------- experiment 06: numbers ---------- */
  setupTabs('[data-number-tab]', '[data-number-panel]', 'data-number-tab', 'data-number-panel');

  /* Collatz */
  const collatzInput = $('#collatz-input');
  const collatzRunButton = $('#collatz-run');
  const collatzRandomButton = $('#collatz-random');
  const collatzStepsEl = $('#collatz-steps');
  const collatzPeakEl = $('#collatz-peak');
  const collatzLengthEl = $('#collatz-length');
  const collatzChart = $('#collatz-chart');
  const collatzSeq = $('#collatz-seq');
  const collatzScanButton = $('#collatz-scan');
  const collatzResult = $('#collatz-result');

  function collatzSequence(start) {
    const sequence = [start];
    let value = start;
    let guard = 0;
    while (value !== 1 && guard < 200000) {
      value = value % 2 === 0 ? value / 2 : 3 * value + 1;
      sequence.push(value);
      guard += 1;
    }
    return sequence;
  }

  function drawCollatzChart(sequence) {
    if (!collatzChart) return;
    const width = 600;
    const height = 220;
    const left = 44;
    const right = 14;
    const top = 14;
    const bottom = 30;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    const maxValue = Math.max(...sequence, 1);
    const steps = sequence.length - 1;
    const x = (index) => left + (steps === 0 ? 0.5 : index / steps) * plotW;
    const y = (value) => top + (1 - value / maxValue) * plotH;
    let peakIndex = 0;
    sequence.forEach((value, index) => {
      if (value > sequence[peakIndex]) peakIndex = index;
    });
    const points = sequence.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(' ');
    const area = steps > 0 ? `${points} L${x(steps).toFixed(2)},${y(0).toFixed(2)} L${x(0).toFixed(2)},${y(0).toFixed(2)} Z` : '';
    const grid = [0, 0.5, 1].map((fraction) => {
      const value = maxValue * fraction;
      const gy = y(value);
      return `<line class="chart-grid" x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}" />
        <text class="chart-axis" x="${left - 7}" y="${gy + 3}" text-anchor="end">${formatCompact(value)}</text>`;
    }).join('');
    const mid = Math.round(steps / 2);
    collatzChart.innerHTML = `
      ${grid}
      ${area ? `<path d="${area}" fill="rgba(196, 181, 253, .08)" />` : ''}
      <path d="${points}" fill="none" stroke="#c4b5fd" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round" />
      <line class="chart-marker-line" x1="${x(peakIndex)}" y1="${top}" x2="${x(peakIndex)}" y2="${height - bottom}" />
      <circle cx="${x(peakIndex)}" cy="${y(sequence[peakIndex])}" r="4.5" fill="#c4b5fd" stroke="#060d18" stroke-width="3" />
      <text class="chart-axis" x="${left}" y="${height - 9}">0</text>
      <text class="chart-axis" x="${x(mid)}" y="${height - 9}" text-anchor="middle">${formatNumber(mid)}</text>
      <text class="chart-axis" x="${x(steps)}" y="${height - 9}" text-anchor="end">${formatNumber(steps)} steps</text>`;
    collatzChart.setAttribute('aria-label', `Collatz sequence for ${sequence[0]}, peaking at ${formatNumber(maxValue)} and reaching 1 after ${steps} steps.`);
  }

  function renderCollatz(sequence) {
    const steps = sequence.length - 1;
    const peak = Math.max(...sequence);
    if (collatzStepsEl) collatzStepsEl.textContent = formatNumber(steps);
    if (collatzPeakEl) collatzPeakEl.textContent = formatNumber(peak);
    if (collatzLengthEl) collatzLengthEl.textContent = formatNumber(sequence.length);
    drawCollatzChart(sequence);
    if (collatzSeq) {
      collatzSeq.innerHTML = '';
      const fragment = document.createDocumentFragment();
      sequence.forEach((value) => {
        const chip = document.createElement('span');
        chip.className = `seq-num${value === peak ? ' peak' : ''}`;
        chip.textContent = formatNumber(value);
        chip.title = `${value}`;
        fragment.appendChild(chip);
      });
      collatzSeq.appendChild(fragment);
    }
    if (collatzResult) {
      collatzResult.className = 'result';
      collatzResult.innerHTML = `<strong>${formatNumber(sequence[0])}</strong> reaches 1 after <strong>${formatNumber(steps)}</strong> steps and peaks at <strong>${formatNumber(peak)}</strong>. This is a computed example, not a proof of the Collatz conjecture.`;
    }
  }

  function runCollatz() {
    const raw = Number.parseInt(collatzInput?.value, 10);
    const value = clamp(Number.isFinite(raw) ? Math.trunc(raw) : 27, 1, 10000);
    if (collatzInput) collatzInput.value = String(value);
    renderCollatz(collatzSequence(value));
  }

  collatzRunButton?.addEventListener('click', runCollatz);
  collatzInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runCollatz();
    }
  });
  collatzRandomButton?.addEventListener('click', () => {
    const value = 1 + randInt(10000);
    if (collatzInput) collatzInput.value = String(value);
    renderCollatz(collatzSequence(value));
  });
  collatzScanButton?.addEventListener('click', () => {
    let bestNumber = 1;
    let bestSequence = collatzSequence(1);
    for (let value = 2; value <= 100; value += 1) {
      const sequence = collatzSequence(value);
      if (sequence.length > bestSequence.length) {
        bestNumber = value;
        bestSequence = sequence;
      }
    }
    if (collatzResult) {
      collatzResult.className = 'result good';
      collatzResult.innerHTML = `<strong>${bestNumber}</strong> has the longest sequence under 100: ${formatNumber(bestSequence.length - 1)} steps, peaking at ${formatNumber(Math.max(...bestSequence))}. A finite scan is evidence, not proof.`;
    }
  });
  runCollatz();

  /* Prime sieve */
  const primeRange = $('#prime-n');
  const primeNOut = $('#prime-n-out');
  const primeCountEl = $('#prime-count');
  const primeCountWord = $('#prime-count-word');
  const primeDensityEl = $('#prime-density');
  const primeLargestEl = $('#prime-largest');
  const primeGrid = $('#prime-grid');
  const primeStepButton = $('#prime-step');
  const primeResetButton = $('#prime-reset');
  const primeResult = $('#prime-result');
  const primeState = {
    limit: 100,
    marked: [],
    found: [],
    next: 2,
    complete: true,
    current: null
  };

  function computePrimeSieve(limit) {
    const marked = new Array(limit + 1).fill(false);
    if (limit >= 1) marked[1] = true;
    for (let p = 2; p * p <= limit; p += 1) {
      if (marked[p]) continue;
      for (let multiple = p * p; multiple <= limit; multiple += p) marked[multiple] = true;
    }
    const found = [];
    for (let value = 2; value <= limit; value += 1) {
      if (!marked[value]) found.push(value);
    }
    return { marked, found };
  }

  function renderPrimeGrid() {
    if (!primeGrid) return;
    const fragment = document.createDocumentFragment();
    for (let value = 1; value <= primeState.limit; value += 1) {
      const cell = document.createElement('span');
      let className = 'prime-cell';
      if (value === 1) className += ' is-one';
      if (primeState.marked[value]) className += ' is-composite';
      if (primeState.found.includes(value)) className += ' is-prime';
      if (primeState.current === value) className += ' is-current';
      cell.className = className;
      cell.textContent = String(value);
      fragment.appendChild(cell);
    }
    primeGrid.innerHTML = '';
    primeGrid.appendChild(fragment);
    primeGrid.setAttribute('aria-label', `Prime sieve up to ${primeState.limit}. ${primeState.found.length} confirmed primes.`);
  }

  function updatePrimeStats() {
    const count = primeState.found.length;
    const largest = count ? primeState.found[count - 1] : null;
    if (primeCountEl) primeCountEl.textContent = formatNumber(count);
    if (primeCountWord) primeCountWord.textContent = plural(count, 'prime');
    if (primeDensityEl) primeDensityEl.textContent = formatPercent((count / primeState.limit) * 100);
    if (primeLargestEl) primeLargestEl.textContent = largest ? formatNumber(largest) : 'none';
  }

  function primeCompleteMessage() {
    const count = primeState.found.length;
    return `Sieve complete: <strong>${formatNumber(count)} ${plural(count, 'prime')}</strong> up to ${formatNumber(primeState.limit)}. Density ${formatPercent((count / primeState.limit) * 100)}; largest ${formatNumber(primeState.found[count - 1] || 0)}.`;
  }

  function setPrimeButtonLabel() {
    if (!primeStepButton) return;
    primeStepButton.textContent = primeState.complete ? 'Replay sieve' : 'Step the sieve';
  }

  function primeFullSieve() {
    const limit = primeState.limit;
    const { marked, found } = computePrimeSieve(limit);
    primeState.marked = marked;
    primeState.found = found;
    primeState.next = limit + 1;
    primeState.complete = true;
    primeState.current = null;
    renderPrimeGrid();
    updatePrimeStats();
    setPrimeButtonLabel();
    if (primeResult) {
      primeResult.className = 'result';
      primeResult.innerHTML = primeCompleteMessage();
    }
  }

  function primeResetSieve() {
    primeState.marked = new Array(primeState.limit + 1).fill(false);
    if (primeState.limit >= 1) primeState.marked[1] = true;
    primeState.found = [];
    primeState.next = 2;
    primeState.complete = false;
    primeState.current = null;
    renderPrimeGrid();
    updatePrimeStats();
    setPrimeButtonLabel();
    if (primeResult) {
      primeResult.className = 'result';
      primeResult.innerHTML = 'Sieve reset. Press <strong>Step the sieve</strong> to cross out multiples of 2.';
    }
  }

  function finalizePrimeSieve() {
    primeState.found = [];
    for (let value = 2; value <= primeState.limit; value += 1) {
      if (!primeState.marked[value]) primeState.found.push(value);
    }
    primeState.complete = true;
    primeState.next = primeState.limit + 1;
    primeState.current = null;
    renderPrimeGrid();
    updatePrimeStats();
    setPrimeButtonLabel();
    if (primeResult) {
      primeResult.className = 'result good';
      primeResult.innerHTML = primeCompleteMessage();
    }
  }

  function stepPrimeSieve() {
    if (primeState.complete) primeResetSieve();
    const limit = primeState.limit;
    if (primeState.next * primeState.next > limit) {
      finalizePrimeSieve();
      return;
    }
    let prime = primeState.next;
    while (prime * prime <= limit && primeState.marked[prime]) prime += 1;
    if (prime * prime > limit) {
      finalizePrimeSieve();
      return;
    }
    const start = prime * prime;
    for (let multiple = start; multiple <= limit; multiple += prime) primeState.marked[multiple] = true;
    if (!primeState.found.includes(prime)) primeState.found.push(prime);
    primeState.current = prime;
    primeState.next = prime + 1;
    if (primeState.next * primeState.next > limit) {
      finalizePrimeSieve();
      return;
    }
    renderPrimeGrid();
    updatePrimeStats();
    setPrimeButtonLabel();
    const crossed = Math.floor((limit - start) / prime) + 1;
    if (primeResult) {
      primeResult.className = 'result';
      primeResult.innerHTML = `Processing <strong>${prime}</strong>: crossed out ${formatNumber(crossed)} multiples from ${formatNumber(start)} upward. Confirmed primes so far: <strong>${primeState.found.length}</strong>.`;
    }
  }

  function setPrimeLimit(value) {
    primeState.limit = clamp(Math.trunc(Number(value) || 100), 20, 300);
    if (primeRange) primeRange.value = String(primeState.limit);
    if (primeNOut) primeNOut.textContent = String(primeState.limit);
    primeFullSieve();
  }

  primeRange?.addEventListener('input', () => setPrimeLimit(primeRange.value));
  primeStepButton?.addEventListener('click', stepPrimeSieve);
  primeResetButton?.addEventListener('click', primeResetSieve);
  setPrimeLimit(Number(primeRange?.value || 100));

  /* Fibonacci and the golden ratio */
  const fibonacci = [0, 1];
  for (let i = 2; i <= 40; i += 1) fibonacci[i] = fibonacci[i - 1] + fibonacci[i - 2];
  const phi = (1 + Math.sqrt(5)) / 2;
  const fibRange = $('#fib-n');
  const fibNOut = $('#fib-n-out');
  const fibValueEl = $('#fib-value');
  const fibRatioEl = $('#fib-ratio');
  const fibErrorEl = $('#fib-error');
  const fibSpiral = $('#fib-spiral');
  const fibChart = $('#fib-chart');
  const fibResult = $('#fib-result');

  function fibRound(value) {
    return Math.round(value * 10000) / 10000;
  }

  function drawFibChart(n) {
    if (!fibChart) return;
    const width = 600;
    const height = 200;
    const left = 46;
    const right = 14;
    const top = 14;
    const bottom = 30;
    const plotW = width - left - right;
    const plotH = height - top - bottom;
    const minRatio = 1.5;
    const maxRatio = 2.05;
    const x = (index) => left + ((index - 3) / 37) * plotW;
    const y = (ratio) => top + (1 - (ratio - minRatio) / (maxRatio - minRatio)) * plotH;
    const ratios = [];
    for (let index = 3; index <= 40; index += 1) ratios.push([index, fibonacci[index] / fibonacci[index - 1]]);
    const line = ratios.map(([index, ratio], pointIndex) => `${pointIndex === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(ratio).toFixed(2)}`).join(' ');
    const currentRatio = fibonacci[n] / fibonacci[n - 1];
    const grid = [1.5, phi, 2].map((ratio) => {
      const gy = y(ratio);
      return `<line class="chart-grid" x1="${left}" y1="${gy}" x2="${width - right}" y2="${gy}" />
        <text class="chart-axis" x="${left - 7}" y="${gy + 3}" text-anchor="end">${ratio === phi ? 'φ' : ratio.toFixed(2)}</text>`;
    }).join('');
    fibChart.innerHTML = `
      ${grid}
      <line x1="${left}" y1="${y(phi).toFixed(2)}" x2="${width - right}" y2="${y(phi).toFixed(2)}" stroke="#c4b5fd" stroke-width="1" stroke-dasharray="3 5" opacity=".45" />
      <path d="${line}" fill="none" stroke="#c4b5fd" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round" />
      <line class="chart-marker-line" x1="${x(n).toFixed(2)}" y1="${top}" x2="${x(n).toFixed(2)}" y2="${height - bottom}" />
      <circle cx="${x(n).toFixed(2)}" cy="${y(currentRatio).toFixed(2)}" r="4.5" fill="#c4b5fd" stroke="#060d18" stroke-width="3" />
      <text class="chart-axis" x="${left}" y="${height - 9}">3</text>
      <text class="chart-axis" x="${x(20).toFixed(2)}" y="${height - 9}" text-anchor="middle">20</text>
      <text class="chart-axis" x="${width - right}" y="${height - 9}" text-anchor="end">40</text>`;
    fibChart.setAttribute('aria-label', `Fibonacci ratio F(n) divided by F(n minus 1), converging toward phi. At n equals ${n}, the ratio is ${currentRatio.toFixed(5)}.`);
  }

  function buildFibSquares(n) {
    const squares = [{ x: 0, y: 0, s: 1 }];
    let minX = 0;
    let minY = 0;
    let maxX = 1;
    let maxY = 1;
    if (n < 2) return { squares, minX, minY, maxX, maxY };
    const second = { x: maxX, y: minY, s: 1 };
    squares.push(second);
    maxX = Math.max(maxX, second.x + second.s);
    for (let index = 2; index < n; index += 1) {
      const size = fibonacci[index + 1];
      const direction = ['up', 'left', 'down', 'right'][(index - 2) % 4];
      let x;
      let y;
      if (direction === 'up') {
        x = minX;
        y = minY - size;
      } else if (direction === 'left') {
        x = minX - size;
        y = minY;
      } else if (direction === 'down') {
        x = minX;
        y = maxY;
      } else {
        x = maxX;
        y = minY;
      }
      squares.push({ x, y, s: size });
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + size);
      maxY = Math.max(maxY, y + size);
    }
    return { squares, minX, minY, maxX, maxY };
  }

  function fibTangent(sweep, vector) {
    return sweep === 1
      ? { x: -vector.y, y: vector.x }
      : { x: vector.y, y: -vector.x };
  }

  function fibArcCandidate(center, start, end, size) {
    const startVector = { x: (start.x - center.x) / size, y: (start.y - center.y) / size };
    const endVector = { x: (end.x - center.x) / size, y: (end.y - center.y) / size };
    const cross = startVector.x * endVector.y - startVector.y * endVector.x;
    if (Math.abs(Math.abs(cross) - 1) > 1e-6) return null;
    const sweep = cross > 0 ? 1 : 0;
    return {
      sweep,
      tangentStart: fibTangent(sweep, startVector),
      tangentEnd: fibTangent(sweep, endVector),
      end
    };
  }

  function buildFibSpiralPath(squares) {
    if (squares.length < 2) return '';
    const first = squares[1];
    const start = { x: first.x, y: first.y + first.s };
    const center = { x: first.x, y: first.y };
    const end = { x: first.x + first.s, y: first.y };
    const firstArc = fibArcCandidate(center, start, end, first.s);
    if (!firstArc) return '';
    let path = `M${fibRound(start.x)} ${fibRound(start.y)} A${first.s} ${first.s} 0 0 ${firstArc.sweep} ${fibRound(end.x)} ${fibRound(end.y)}`;
    let previousEnd = end;
    let previousTangent = firstArc.tangentEnd;
    for (let index = 2; index < squares.length; index += 1) {
      const square = squares[index];
      const corners = [
        { x: square.x, y: square.y },
        { x: square.x + square.s, y: square.y },
        { x: square.x + square.s, y: square.y + square.s },
        { x: square.x, y: square.y + square.s }
      ];
      const candidates = [];
      corners.forEach((candidateCenter) => {
        const centerDistance = Math.hypot(previousEnd.x - candidateCenter.x, previousEnd.y - candidateCenter.y);
        if (Math.abs(centerDistance - square.s) > 1e-6) return;
        corners.forEach((candidateEnd) => {
          if (candidateEnd.x === previousEnd.x && candidateEnd.y === previousEnd.y) return;
          const endDistance = Math.hypot(candidateEnd.x - candidateCenter.x, candidateEnd.y - candidateCenter.y);
          if (Math.abs(endDistance - square.s) > 1e-6) return;
          const arc = fibArcCandidate(candidateCenter, previousEnd, candidateEnd, square.s);
          if (arc) candidates.push(arc);
        });
      });
      const chosen = candidates.find((candidate) => (
        Math.abs(candidate.tangentStart.x - previousTangent.x) < 1e-6
        && Math.abs(candidate.tangentStart.y - previousTangent.y) < 1e-6
      )) || candidates[0];
      if (!chosen) break;
      path += ` A${square.s} ${square.s} 0 0 ${chosen.sweep} ${fibRound(chosen.end.x)} ${fibRound(chosen.end.y)}`;
      previousEnd = chosen.end;
      previousTangent = chosen.tangentEnd;
    }
    return path;
  }

  function drawFibSpiral(n) {
    if (!fibSpiral) return;
    const layout = buildFibSquares(n);
    const path = buildFibSpiralPath(layout.squares);
    const width = layout.maxX - layout.minX;
    const height = layout.maxY - layout.minY;
    const padding = Math.max(width, height) * 0.035 + 1;
    const rects = layout.squares.map((square) => (
      `<rect class="fib-square" x="${fibRound(square.x)}" y="${fibRound(square.y)}" width="${square.s}" height="${square.s}" vector-effect="non-scaling-stroke" />`
    )).join('');
    fibSpiral.innerHTML = `<svg viewBox="${fibRound(layout.minX - padding)} ${fibRound(layout.minY - padding)} ${fibRound(width + padding * 2)} ${fibRound(height + padding * 2)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      ${rects}
      <path d="${path}" fill="none" stroke="#c4b5fd" stroke-width="1.5" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".9" />
    </svg>`;
  }

  function renderFibonacci() {
    const n = clamp(Math.trunc(Number(fibRange?.value) || 12), 3, 40);
    if (fibRange) fibRange.value = String(n);
    if (fibNOut) fibNOut.textContent = String(n);
    const value = fibonacci[n];
    const ratio = value / fibonacci[n - 1];
    const error = Math.abs(ratio - phi);
    if (fibValueEl) fibValueEl.textContent = formatNumber(value);
    if (fibRatioEl) fibRatioEl.textContent = ratio.toFixed(5);
    if (fibErrorEl) fibErrorEl.textContent = error.toFixed(6);
    drawFibChart(n);
    drawFibSpiral(n);
    if (fibResult) {
      fibResult.className = 'result';
      fibResult.innerHTML = `At n = ${n}, F(n) = <strong>${formatNumber(value)}</strong>. The ratio F(n)/F(n-1) is <strong>${ratio.toFixed(5)}</strong>, about ${error.toFixed(6)} away from φ. The ratio keeps alternating around φ as n grows.`;
    }
  }

  fibRange?.addEventListener('input', renderFibonacci);
  renderFibonacci();

  /* Bases */
  const baseInput = $('#base-input');
  const baseSelect = $('#base-select');
  const baseRunButton = $('#base-run');
  const baseOutput = $('#base-output');
  const baseComparison = $('#base-comparison');
  const baseResult = $('#base-result');

  function convertBase() {
    if (!baseInput || !baseSelect) return;
    const raw = Number.parseInt(baseInput.value, 10);
    const value = clamp(Number.isFinite(raw) ? Math.trunc(raw) : 0, 0, 4095);
    const base = clamp(Number(baseSelect.value) || 2, 2, 16);
    baseInput.value = String(value);
    const digits = value.toString(base).toUpperCase();
    if (baseOutput) {
      baseOutput.innerHTML = `
        <div class="base-card"><span>decimal</span><b>${formatNumber(value)}</b></div>
        <div class="base-card"><span>base ${base}</span><b>${digits}</b></div>`;
    }
    if (baseComparison) {
      const terms = digits.split('').map((digit, index) => {
        const power = digits.length - 1 - index;
        const numeric = Number.parseInt(digit, base);
        const placeValue = numeric * Math.pow(base, power);
        return `<span class="place-card"><b>${digit}</b> × ${base}<sup>${power}</sup> <small>= ${formatNumber(placeValue)}</small></span>`;
      });
      const nonZero = digits.split('').map((digit, index) => {
        const power = digits.length - 1 - index;
        return Number.parseInt(digit, base) * Math.pow(base, power);
      }).filter((part) => part !== 0);
      baseComparison.innerHTML = `${terms.join('')}<span class="place-card"><b>Σ</b> = ${nonZero.length ? nonZero.map((part) => formatNumber(part)).join(' + ') : '0'} = ${formatNumber(value)}</span>`;
    }
    if (baseResult) {
      baseResult.className = 'result';
      baseResult.innerHTML = `<strong>${formatNumber(value)}</strong> in base ${base} is <strong>${digits}</strong>. The place-value expansion above shows exactly why the digits add up to the same number.`;
    }
  }

  baseRunButton?.addEventListener('click', convertBase);
  baseInput?.addEventListener('input', () => {
    if (baseInput.value.trim() === '') return;
    convertBase();
  });
  baseInput?.addEventListener('blur', convertBase);
  baseSelect?.addEventListener('change', convertBase);
  convertBase();

  /* ---------- reduced-motion changes ---------- */
  motionQuery.addEventListener?.('change', (event) => {
    if (event.matches) {
      pauseChaos();
      pauseLife();
    }
  });
})();
