import { SKILLS, TONE_HEX, TUNING } from './config.js';
import { formatDistance, formatNumber } from './utils.js';

const SCREENS = ['screen-start', 'screen-loading', 'screen-pause', 'screen-over', 'screen-fallback'];
const STATE_SCREEN = {
  menu: 'screen-start',
  loading: 'screen-loading',
  paused: 'screen-pause',
  over: 'screen-over',
  error: 'screen-fallback'
};
const ACTIVE_STATES = new Set(['playing', 'paused', 'dying', 'over']);
const TIPS = [
  'Tip: graze the gates to bank near-miss points.',
  'Tip: chain orbs within 3.2s to grow the multiplier.',
  'Tip: shield charges carry across collisions — press Space early.',
  'Tip: the wall gaps move. Read the rhythm, then commit.',
  'Tip: speed climbs with distance. The tunnel never gets longer.'
];

const skillTone = new Map(SKILLS.map((s) => [s.label, TONE_HEX[s.tone]]));

function multiplierLabel(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export class UI {
  constructor(root, actions) {
    this.root = root;
    this.actions = actions;
    this._lastState = null;
    this._hud = {};
    this._timers = new Set();
    this._toastTimer = null;
    this._calloutTimer = null;
    this._bumpTimer = null;

    this.screens = {};
    for (const id of SCREENS) this.screens[id] = document.getElementById(id);

    this.hud = document.getElementById('hud');
    this.hudScore = document.getElementById('hud-score');
    this.hudBest = document.getElementById('hud-best');
    this.hudSpeed = document.getElementById('hud-speed');
    this.hudSector = document.getElementById('hud-sector');
    this.hudDistance = document.getElementById('hud-distance');
    this.speedBar = document.getElementById('speed-bar');
    this.comboLabel = document.getElementById('combo-label');
    this.comboCount = document.getElementById('combo-count');
    this.comboBar = document.getElementById('combo-bar');
    this.shieldWrap = document.getElementById('shield-wrap');
    this.shieldState = document.getElementById('shield-state');
    this.shieldPips = document.getElementById('shield-pips');
    this.shieldBar = document.getElementById('shield-bar');
    this.shieldHint = document.getElementById('shield-hint');
    this.powerBtn = document.querySelector('.power-btn');
    this.powerCount = document.getElementById('power-count');

    this.toastEl = document.getElementById('toast');
    this.toastTag = this.toastEl.querySelector('.toast-tag');
    this.toastLabel = this.toastEl.querySelector('.toast-label');
    this.toastPoints = this.toastEl.querySelector('.toast-points');
    this.calloutEl = document.getElementById('callout');
    this.countdownEl = document.getElementById('countdown');
    this.flashEl = document.getElementById('fx-flash');
    this.mobileHint = document.getElementById('mobile-hint');

    this.menuBest = document.getElementById('menu-best');
    this.menuRuns = document.getElementById('menu-runs');
    this.menuSkills = document.getElementById('menu-skills');
    this.audioLine = document.getElementById('audio-line');

    this.overScore = document.getElementById('over-score');
    this.overBest = document.getElementById('over-best');
    this.overDistance = document.getElementById('over-distance');
    this.overOrbs = document.getElementById('over-orbs');
    this.overCombo = document.getElementById('over-combo');
    this.overSpeed = document.getElementById('over-speed');
    this.overKicker = document.getElementById('over-kicker');
    this.overSkills = document.getElementById('over-skill-list');
    this.overSkillCount = document.getElementById('over-skill-count');
    this.overFoot = document.getElementById('over-foot');
    this.newBest = document.getElementById('new-best');
    this.pauseIcon = document.querySelector('[data-action="pause"] .icon');

    this._buildPips(TUNING.shieldMax);
    this._buildMenuSkills();

    this._onClick = this._onClick.bind(this);
    this.root.addEventListener('click', this._onClick);
  }

  _later(fn, ms) {
    const id = setTimeout(() => {
      this._timers.delete(id);
      fn();
    }, ms);
    this._timers.add(id);
    return id;
  }

  _onClick(event) {
    const qualityEl = event.target instanceof Element && event.target.closest('[data-quality]');
    if (qualityEl) {
      event.preventDefault();
      this.actions.setQuality?.(qualityEl.dataset.quality);
      return;
    }

    const actionEl = event.target instanceof Element && event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    if (!action || !this.actions[action]) return;
    event.preventDefault();
    this.actions[action]();
  }

  _buildPips(max) {
    this.shieldPips.replaceChildren();
    for (let i = 0; i < max; i++) {
      const pip = document.createElement('i');
      this.shieldPips.appendChild(pip);
    }
  }

  _buildMenuSkills() {
    this.menuSkills.replaceChildren();
    const shown = SKILLS.slice(0, 10);
    for (const skill of shown) {
      const chip = document.createElement('span');
      chip.textContent = skill.label;
      const tone = TONE_HEX[skill.tone];
      chip.style.borderColor = tone + '55';
      chip.style.color = tone;
      chip.style.background = tone + '12';
      this.menuSkills.appendChild(chip);
    }
    if (SKILLS.length > shown.length) {
      const more = document.createElement('span');
      more.textContent = `+${SKILLS.length - shown.length} more`;
      more.style.color = '#94a3b8';
      more.style.borderColor = 'rgba(148,163,184,.2)';
      more.style.background = 'rgba(148,163,184,.06)';
      this.menuSkills.appendChild(more);
    }
  }

  setState(state) {
    this.root.dataset.state = state;
    if (this._lastState === state) return;
    this._lastState = state;

    const activeScreen = STATE_SCREEN[state] || null;
    for (const id of SCREENS) {
      const el = this.screens[id];
      if (!el) continue;
      el.setAttribute('aria-hidden', id === activeScreen ? 'false' : 'true');
    }
    if (this.hud) this.hud.setAttribute('aria-hidden', ACTIVE_STATES.has(state) ? 'false' : 'true');
    if (this.pauseIcon) this.pauseIcon.textContent = state === 'paused' ? '▶' : 'Ⅱ';

    if (state === 'paused') {
      this.hideBanners();
      this._later(() => {
        if (this.root.dataset.state === 'paused') {
          this.screens['screen-pause']?.querySelector('[data-action="resume"]')?.focus({ preventScroll: true });
        }
      }, 80);
    } else if (state === 'over') {
      this._later(() => {
        if (this.root.dataset.state === 'over') {
          this.screens['screen-over']?.querySelector('[data-action="restart"]')?.focus({ preventScroll: true });
        }
      }, 160);
    }
  }

  setHud(data) {
    const score = Math.floor(data.score);
    const best = Math.max(data.best, score);
    const combo = data.combo;
    const multiplier = data.multiplier;
    const speedKmh = Math.round(data.speed * 3.6);
    const sector = String(data.sector).padStart(2, '0');
    const shieldCharges = data.shieldCharges;
    const shieldLeft = Math.max(0, data.shieldLeft || 0);

    if (this._hud.score !== score) {
      this.hudScore.textContent = formatNumber(score);
      this._hud.score = score;
    }
    if (this._hud.best !== best) {
      this.hudBest.textContent = formatNumber(best);
      this._hud.best = best;
    }
    if (this._hud.speed !== speedKmh) {
      this.hudSpeed.textContent = String(speedKmh);
      this._hud.speed = speedKmh;
    }
    if (this._hud.sector !== sector) {
      this.hudSector.textContent = sector;
      this._hud.sector = sector;
    }
    const distanceText = formatDistance(data.distance);
    if (this._hud.distance !== distanceText) {
      this.hudDistance.textContent = distanceText;
      this._hud.distance = distanceText;
    }
    if (this._hud.combo !== combo || this._hud.multiplier !== multiplier) {
      this.comboLabel.textContent = `CHAIN ×${multiplierLabel(multiplier)}`;
      this.comboCount.textContent = `${combo} ${combo === 1 ? 'ORB' : 'ORBS'}`;
      this._hud.combo = combo;
      this._hud.multiplier = multiplier;
    }
    const comboPct = Math.round(Math.max(0, Math.min(1, data.comboPct)) * 100);
    if (this._hud.comboPct !== comboPct) {
      this.comboBar.style.width = comboPct + '%';
      this._hud.comboPct = comboPct;
    }
    const speedPct = Math.round(Math.max(0, Math.min(1, data.speedPct)) * 100);
    if (this._hud.speedPct !== speedPct) {
      this.speedBar.style.width = speedPct + '%';
      this._hud.speedPct = speedPct;
    }

    if (this.shieldPips.children.length !== TUNING.shieldMax) {
      this._buildPips(TUNING.shieldMax);
      this._hud.charges = -1;
    }

    const active = shieldLeft > 0;
    const stateText = active ? `ACTIVE ${shieldLeft.toFixed(1)}s` : shieldCharges > 0 ? 'READY' : 'STANDBY';
    if (this._hud.shieldState !== stateText) {
      this.shieldState.textContent = stateText;
      this._hud.shieldState = stateText;
    }
    if (this._hud.charges !== shieldCharges) {
      const pips = this.shieldPips.children;
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < shieldCharges);
      this.powerCount.textContent = String(shieldCharges);
      this.powerBtn.classList.toggle('ready', shieldCharges > 0 && !active);
      this.powerBtn.classList.toggle('empty', shieldCharges === 0 && !active);
      this.powerBtn.setAttribute(
        'aria-label',
        shieldCharges > 0 ? `Deploy shield (${shieldCharges} charge${shieldCharges > 1 ? 's' : ''})` : 'Deploy shield — no charges'
      );
      this._hud.charges = shieldCharges;
    }
    const shieldPct = active ? Math.round(Math.min(1, shieldLeft / TUNING.shieldDuration) * 100) : 0;
    if (this._hud.shieldPct !== shieldPct) {
      this.shieldBar.style.width = shieldPct + '%';
      this._hud.shieldPct = shieldPct;
    }
    const isActive = active ? 'true' : 'false';
    if (this._hud.shieldActive !== isActive) {
      this.shieldWrap.classList.toggle('active', active);
      this._hud.shieldActive = isActive;
    }
    const hint = active ? 'INVULNERABLE · FLY THROUGH GEOMETRY' : 'SPACE / TAP ◈ TO DEPLOY';
    if (this._hud.hint !== hint) {
      this.shieldHint.textContent = hint;
      this._hud.hint = hint;
    }
  }

  resetHud(best) {
    this._hud = {};
    this.hudScore.textContent = '0';
    this.hudBest.textContent = formatNumber(best);
    this.hudSpeed.textContent = '0';
    this.hudSector.textContent = '01';
    this.hudDistance.textContent = '0 m';
    this.speedBar.style.width = '0%';
    this.comboBar.style.width = '0%';
    this.shieldBar.style.width = '0%';
    this.comboLabel.textContent = 'CHAIN ×1';
    this.comboCount.textContent = '0 ORBS';
    this.shieldState.textContent = 'STANDBY';
    this.shieldHint.textContent = 'SPACE / TAP ◈ TO DEPLOY';
    this.powerCount.textContent = '0';
    this.powerBtn.classList.remove('ready');
    this.powerBtn.classList.add('empty');
    for (const pip of this.shieldPips.children) pip.classList.remove('on');
    this.comboBar.style.width = '0%';
    this._hud.score = 0;
    this._hud.best = best;
  }

  bumpScore() {
    this.hudScore.classList.remove('bump');
    // Force the animation to restart for rapid pickups.
    void this.hudScore.offsetWidth;
    this.hudScore.classList.add('bump');
    if (this._bumpTimer) clearTimeout(this._bumpTimer);
    this._bumpTimer = setTimeout(() => this.hudScore.classList.remove('bump'), 220);
  }

  toast(label, points, tone) {
    this.toastTag.textContent = 'COLLECTED';
    this.toastLabel.textContent = label;
    this.toastPoints.textContent = '+' + formatNumber(points);
    this.toastEl.style.setProperty('--toast-tone', tone || '#22d3ee');
    this.toastEl.classList.add('show');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 1250);
  }

  shieldToast(label, tone) {
    this.toastTag.textContent = 'POWER-UP';
    this.toastLabel.textContent = label;
    this.toastPoints.textContent = '+1';
    this.toastEl.style.setProperty('--toast-tone', tone || '#34d399');
    this.toastEl.classList.add('show');
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), 1350);
  }

  callout(text, variant = '') {
    this.calloutEl.textContent = text;
    this.calloutEl.className = 'callout ' + variant;
    void this.calloutEl.offsetWidth;
    this.calloutEl.classList.add('show');
    if (this._calloutTimer) clearTimeout(this._calloutTimer);
    this._calloutTimer = setTimeout(() => this.calloutEl.classList.remove('show'), 1100);
  }

  countdown(value, go = false) {
    this.countdownEl.textContent = value;
    this.countdownEl.classList.remove('show', 'go');
    void this.countdownEl.offsetWidth;
    if (go) this.countdownEl.classList.add('go');
    this.countdownEl.classList.add('show');
  }

  flash() {
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('on');
    this._later(() => this.flashEl.classList.remove('on'), 460);
  }

  hideBanners() {
    this.toastEl.classList.remove('show');
    this.calloutEl.classList.remove('show');
  }

  setBest(best) {
    this.menuBest.textContent = formatNumber(best);
    this.hudBest.textContent = formatNumber(best);
    this._hud.best = best;
  }

  setRuns(runs) {
    this.menuRuns.textContent = `${formatNumber(runs)} ${runs === 1 ? 'RUN' : 'RUNS'}`;
  }

  setSound(muted) {
    const top = document.querySelector('[data-action="sound"]');
    if (top) {
      top.setAttribute('aria-pressed', muted ? 'false' : 'true');
      const label = top.querySelector('[data-sound-label]');
      if (label) label.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    }
    const mini = document.querySelector('[data-sound-mini]');
    if (mini) {
      mini.textContent = muted ? 'OFF' : 'ON';
      mini.setAttribute('aria-pressed', muted ? 'false' : 'true');
    }
    this.audioLine.textContent = muted
      ? 'Sound is muted · toggle it in the top bar'
      : 'Sound starts when you do · headphones recommended';
  }

  setQuality(quality) {
    const isHigh = quality === 'high';
    for (const label of document.querySelectorAll('[data-quality-label]')) {
      label.textContent = isHigh ? 'HIGH' : 'LOW';
    }
    const top = document.querySelector('[data-action="quality"]');
    if (top) {
      top.setAttribute('aria-label', `Render quality ${isHigh ? 'high' : 'low'}. Click to switch.`);
    }
    for (const button of document.querySelectorAll('[data-quality]')) {
      const on = button.dataset.quality === quality;
      button.classList.toggle('on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  showOver(stats) {
    this.overScore.textContent = formatNumber(stats.score);
    this.overBest.textContent = formatNumber(stats.best);
    this.overDistance.textContent = formatDistance(stats.distance);
    this.overOrbs.textContent = formatNumber(stats.orbs);
    this.overCombo.textContent = `${formatNumber(stats.maxCombo)} chain`;
    this.overSpeed.textContent = `${Math.round(stats.topSpeed * 3.6)} km/h`;
    this.overKicker.textContent = stats.newBest ? 'NEW PERSONAL BEST' : 'RUN TERMINATED';
    this.newBest.classList.toggle('show', Boolean(stats.newBest));
    this.overSkillCount.textContent = `${stats.skills.length} / ${SKILLS.length}`;
    this.overFoot.textContent = TIPS[(Math.random() * TIPS.length) | 0];

    this.overSkills.replaceChildren();
    if (!stats.skills.length) {
      const empty = document.createElement('span');
      empty.textContent = 'none yet — fly closer next time';
      empty.style.color = '#64748b';
      empty.style.borderColor = 'rgba(148,163,184,.15)';
      empty.style.background = 'transparent';
      this.overSkills.appendChild(empty);
    } else {
      for (const label of stats.skills) {
        const chip = document.createElement('span');
        chip.textContent = label;
        const tone = skillTone.get(label) || '#22d3ee';
        chip.style.borderColor = tone + '66';
        chip.style.color = tone;
        chip.style.background = tone + '12';
        this.overSkills.appendChild(chip);
      }
    }
  }

  showTouchHint() {
    this.mobileHint.classList.remove('hide');
  }

  hideTouchHint() {
    this.mobileHint.classList.add('hide');
  }

  setLoadingNote(text) {
    const note = document.getElementById('loading-note');
    if (note) note.textContent = text;
  }

  dispose() {
    this.root.removeEventListener('click', this._onClick);
    for (const id of this._timers) clearTimeout(id);
    this._timers.clear();
    if (this._toastTimer) clearTimeout(this._toastTimer);
    if (this._calloutTimer) clearTimeout(this._calloutTimer);
    if (this._bumpTimer) clearTimeout(this._bumpTimer);
  }
}
