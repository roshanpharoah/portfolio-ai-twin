import { autoQuality, storageGet, webglSupported } from './utils.js';

const root = document.getElementById('game-root');
const canvas = document.getElementById('gl');
const QUALITY_KEY = 'neon-drift:quality';

function showFallback(title, message) {
  root.dataset.state = 'error';
  const titleEl = document.getElementById('fallback-title');
  const copyEl = document.getElementById('fallback-copy');
  if (titleEl) titleEl.innerHTML = `${title}<span>.</span>`;
  if (copyEl) copyEl.textContent = message;
}

function boot() {
  if (!webglSupported()) {
    showFallback(
      'NO WEBGL',
      'Neon Drift needs WebGL 2. Try a current Chrome, Edge, Firefox or Safari with hardware acceleration enabled, then reload the page.'
    );
    return;
  }

  const note = document.getElementById('loading-note');
  if (note) note.textContent = 'Loading flight systems · building the tunnel';

  const stored = storageGet(QUALITY_KEY, null);
  const quality = stored === 'low' || stored === 'high' ? stored : autoQuality();

  // Everything heavy (Three.js, the renderer, the audio graph) stays behind
  // this dynamic import, so the portfolio homepage never pays for it.
  import('./main.js')
    .then(({ createGame }) => {
      createGame({ root, canvas, quality });
    })
    .catch((error) => {
      console.error('[Neon Drift] failed to start', error);
      showFallback(
        'LAUNCH FAILED',
        'The game engine could not start. Check your connection and WebGL support, then reload. The rest of the portfolio is unaffected.'
      );
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
