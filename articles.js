(() => {
  'use strict';

  const grid = document.getElementById('articles-grid');
  if (!grid) return;

  const statusEl = document.getElementById('articles-updated');
  const dotEl = document.getElementById('articles-dot');
  const refreshBtn = document.getElementById('articles-refresh');
  const filterBar = document.getElementById('articles-filters');
  const fallbackUrl = grid.getAttribute('data-fallback') || 'api/articles.json';

  const CACHE_KEY = 'roshan-articles-v1';
  const CACHE_TTL = 15 * 60 * 1000;
  const MAX_ITEMS = 12;
  const FEEDS = [
    {
      id: 'hn-ai',
      source: 'Hacker News',
      sourceKey: 'hn',
      category: 'AI',
      type: 'hn',
      url: 'https://hn.algolia.com/api/v1/search_by_date?tags=story&query=AI&numericFilters=points%3E20&hitsPerPage=12'
    },
    {
      id: 'hn-tech',
      source: 'Hacker News',
      sourceKey: 'hn',
      category: 'Tech',
      type: 'hn',
      url: 'https://hn.algolia.com/api/v1/search_by_date?tags=story&query=technology&numericFilters=points%3E20&hitsPerPage=8'
    },
    {
      id: 'dev-ai',
      source: 'DEV Community',
      sourceKey: 'dev',
      category: 'AI',
      type: 'dev',
      url: 'https://dev.to/api/articles?tag=ai&per_page=12'
    },
    {
      id: 'dev-tech',
      source: 'DEV Community',
      sourceKey: 'dev',
      category: 'Tech',
      type: 'dev',
      url: 'https://dev.to/api/articles?tag=technology&per_page=8'
    }
  ];

  const state = { items: [], filter: 'all', loading: false, live: false, feedCount: 0 };

  function textOnly(value) {
    if (!value) return '';
    try {
      const doc = new DOMParser().parseFromString(String(value), 'text/html');
      return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
    } catch (_) {
      return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  function domainOf(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch (_) {
      return '';
    }
  }

  function parseDate(value) {
    const time = Date.parse(value || '');
    return Number.isFinite(time) ? time : 0;
  }

  function isoDate(value) {
    const time = parseDate(value);
    return time ? new Date(time).toISOString() : '';
  }

  function shortDate(value) {
    const time = parseDate(value);
    if (!time) return 'Reference';
    return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function ageLabel(time) {
    const diff = Math.max(0, Date.now() - time);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + ' hr ago';
    return Math.floor(hours / 24) + ' days ago';
  }

  function normalizeHn(hit, feed) {
    const title = textOnly(hit && hit.title).replace(/\s+/g, ' ').trim();
    if (!title) return null;
    const url = safeUrl(hit.url) || safeUrl('https://news.ycombinator.com/item?id=' + encodeURIComponent(hit.objectID || ''));
    if (!url || /newsguidelines\.html/i.test(url)) return null;
    return {
      title,
      url,
      source: feed.source,
      sourceKey: feed.sourceKey,
      category: feed.category,
      date: isoDate(hit.created_at),
      summary: textOnly(hit.story_text).slice(0, 220),
      domain: domainOf(url),
      author: textOnly(hit.author),
      readingTime: 0,
      points: Number(hit.points) || 0,
      comments: Number(hit.num_comments) || 0,
      tags: []
    };
  }

  function normalizeDev(article, feed) {
    const title = textOnly(article && article.title).replace(/\s+/g, ' ').trim();
    if (!title) return null;
    if (article.language && String(article.language).toLowerCase() !== 'en') return null;
    const url = safeUrl(article.url) || safeUrl(article.canonical_url);
    if (!url) return null;
    const tags = Array.isArray(article.tag_list) ? article.tag_list.filter(Boolean).slice(0, 3) : [];
    return {
      title,
      url,
      source: feed.source,
      sourceKey: feed.sourceKey,
      category: feed.category,
      date: isoDate(article.published_at || article.created_at),
      summary: textOnly(article.description).slice(0, 220),
      domain: domainOf(url),
      author: textOnly(article.user && (article.user.name || article.user.username)),
      readingTime: Number(article.reading_time_minutes) || 0,
      points: 0,
      comments: Number(article.comments_count) || 0,
      tags
    };
  }

  function normalizeFallback(item) {
    const title = textOnly(item && item.title).replace(/\s+/g, ' ').trim();
    const url = safeUrl(item && item.url);
    if (!title || !url) return null;
    return {
      title,
      url,
      source: textOnly(item.source) || 'Reading list',
      sourceKey: 'static',
      category: /^tech$/i.test(item.category) ? 'Tech' : 'AI',
      date: isoDate(item.date),
      summary: textOnly(item.summary).slice(0, 220),
      domain: domainOf(url),
      author: textOnly(item.author),
      readingTime: Number(item.reading_time) || 0,
      points: 0,
      comments: 0,
      tags: Array.isArray(item.tags) ? item.tags.filter(Boolean).slice(0, 3) : []
    };
  }

  function dedupe(items, limit = MAX_ITEMS) {
    const seen = new Set();
    const out = [];
    for (const item of items) {
      if (!item || !item.url) continue;
      const key = item.url.replace(/\/$/, '').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
    return out.sort((a, b) => parseDate(b.date) - parseDate(a.date)).slice(0, limit);
  }

  async function fetchJson(url, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store'
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadLive() {
    const results = await Promise.allSettled(FEEDS.map(async (feed) => {
      const data = await fetchJson(feed.url);
      const items = feed.type === 'hn'
        ? (Array.isArray(data.hits) ? data.hits : []).map((hit) => normalizeHn(hit, feed))
        : (Array.isArray(data) ? data : []).map((article) => normalizeDev(article, feed));
      return items.filter(Boolean);
    }));
    const all = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
    const ai = dedupe(all.filter((item) => item.category === 'AI'), 20);
    const tech = dedupe(all.filter((item) => item.category === 'Tech'), 20);
    let items = dedupe([...ai.slice(0, 7), ...tech.slice(0, 5)], MAX_ITEMS);
    if (items.length < MAX_ITEMS) {
      const extras = dedupe([...ai, ...tech], 40).filter((item) => !items.some((picked) => picked.url === item.url));
      items = dedupe([...items, ...extras], MAX_ITEMS);
    }
    const feedCount = results.filter((result) => result.status === 'fulfilled' && result.value.length > 0).length;
    if (!items.length) throw new Error('No live articles');
    return { items, feedCount };
  }

  async function loadFallback() {
    const data = await fetchJson(fallbackUrl, 6000);
    const items = dedupe((Array.isArray(data && data.items) ? data.items : []).map(normalizeFallback));
    if (!items.length) throw new Error('No fallback articles');
    return items;
  }

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return null;
      const items = dedupe(parsed.items.filter((item) => item && item.title && item.url && item.category));
      if (!items.length) return null;
      return { savedAt: Number(parsed.savedAt) || 0, items };
    } catch (_) {
      return null;
    }
  }

  function writeCache(items) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items }));
    } catch (_) {}
  }

  function setStatus(text, live) {
    if (statusEl) statusEl.textContent = text;
    if (dotEl) dotEl.setAttribute('data-off', live ? 'false' : 'true');
  }

  function setBusy(busy) {
    grid.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (refreshBtn) {
      refreshBtn.disabled = busy;
      refreshBtn.textContent = busy ? '↻ Refreshing…' : '↻ Refresh';
    }
  }

  function skeleton() {
    grid.innerHTML = '';
    for (let i = 0; i < 6; i += 1) {
      const item = document.createElement('div');
      item.className = 'article-skel';
      item.setAttribute('aria-hidden', 'true');
      grid.appendChild(item);
    }
  }

  function updateCounts() {
    if (!filterBar) return;
    const counts = {
      all: state.items.length,
      ai: state.items.filter((item) => item.category === 'AI').length,
      tech: state.items.filter((item) => item.category === 'Tech').length
    };
    filterBar.querySelectorAll('[data-filter]').forEach((button) => {
      const key = button.getAttribute('data-filter');
      const count = button.querySelector('span');
      if (count) count.textContent = String(counts[key] || 0);
      button.setAttribute('aria-pressed', key === state.filter ? 'true' : 'false');
      button.classList.toggle('on', key === state.filter);
    });
  }

  function addMeta(meta, text, className) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.setAttribute('aria-hidden', 'true');
    meta.appendChild(dot);
    const span = document.createElement('span');
    if (className) span.className = className;
    span.textContent = text;
    meta.appendChild(span);
  }

  function plural(count, one, many) {
    return count === 1 ? one : many;
  }

  function makeCard(item, index) {
    const card = document.createElement('a');
    card.className = 'article-card glass';
    card.href = item.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';
    card.dataset.cat = item.category;
    card.dataset.source = item.sourceKey;
    card.style.setProperty('--i', String(index));
    card.setAttribute('aria-label', item.title + ' - ' + item.source + ' (opens in a new tab)');

    const top = document.createElement('div');
    top.className = 'article-top';
    const source = document.createElement('span');
    source.className = 'article-source';
    source.textContent = item.source;
    const cat = document.createElement('span');
    cat.className = 'article-cat';
    cat.textContent = item.category;
    top.appendChild(source);
    top.appendChild(cat);
    card.appendChild(top);

    const title = document.createElement('h3');
    title.textContent = item.title;
    card.appendChild(title);

    if (item.summary) {
      const desc = document.createElement('p');
      desc.className = 'article-desc';
      desc.textContent = item.summary;
      card.appendChild(desc);
    }

    if (item.tags && item.tags.length) {
      const tags = document.createElement('div');
      tags.className = 'article-tags';
      item.tags.slice(0, 3).forEach((tag) => {
        const tagEl = document.createElement('span');
        tagEl.className = 'article-tag';
        tagEl.textContent = '#' + tag;
        tags.appendChild(tagEl);
      });
      card.appendChild(tags);
    }

    const meta = document.createElement('div');
    meta.className = 'article-meta';
    const time = document.createElement('time');
    time.dateTime = item.date || '';
    time.textContent = shortDate(item.date);
    meta.appendChild(time);

    if (item.readingTime) addMeta(meta, item.readingTime + ' min read');
    if (item.points) addMeta(meta, item.points + ' ' + plural(item.points, 'point', 'points'));
    if (item.comments) addMeta(meta, item.comments + ' ' + plural(item.comments, 'comment', 'comments'));
    if (item.domain) addMeta(meta, item.domain, 'domain');

    const arrow = document.createElement('span');
    arrow.className = 'article-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    meta.appendChild(arrow);

    card.appendChild(meta);
    return card;
  }

  function render() {
    grid.innerHTML = '';
    const items = state.filter === 'all'
      ? state.items
      : state.items.filter((item) => item.category.toLowerCase() === state.filter);
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'articles-empty';
      empty.textContent = 'No articles match this filter right now. Try All or refresh the feeds.';
      grid.appendChild(empty);
    } else {
      items.forEach((item, index) => grid.appendChild(makeCard(item, index)));
    }
    updateCounts();
    grid.setAttribute('aria-busy', 'false');
  }

  function setFilter(filter) {
    state.filter = ['all', 'ai', 'tech'].includes(filter) ? filter : 'all';
    render();
  }

  async function load(options = {}) {
    if (state.loading) return;
    state.loading = true;
    setBusy(true);
    const force = Boolean(options.force);
    const cache = readCache();
    const fresh = cache && Date.now() - Number(cache.savedAt || 0) < CACHE_TTL;

    if (cache && cache.items.length) {
      state.items = cache.items;
      state.live = true;
      render();
      setStatus('Cached ' + ageLabel(Number(cache.savedAt || 0)), true);
    } else {
      skeleton();
      setStatus('Loading live feeds…', true);
    }

    if (fresh && !force) {
      state.loading = false;
      setBusy(false);
      return;
    }

    if (!navigator.onLine) {
      if (state.items.length && cache) {
        setStatus('Offline · showing cached', false);
        state.loading = false;
        setBusy(false);
        return;
      }
      try {
        state.items = await loadFallback();
        state.live = false;
        state.filter = 'all';
        render();
        setStatus('Offline · static reading list', false);
      } catch (_) {
        state.items = [];
        render();
        setStatus('Offline · sources unavailable', false);
      }
      state.loading = false;
      setBusy(false);
      return;
    }

    try {
      const live = await loadLive();
      state.items = live.items;
      state.live = true;
      state.feedCount = live.feedCount;
      writeCache(live.items);
      render();
      setStatus('Live · ' + live.items.length + ' items · ' + live.feedCount + '/' + FEEDS.length + ' feeds · updated just now', true);
    } catch (_) {
      if (state.items.length && cache) {
        setStatus('Live feeds unavailable · showing cached', false);
      } else {
        try {
          state.items = await loadFallback();
          state.live = false;
          state.filter = 'all';
          render();
          setStatus('Live feeds unavailable · static reading list', false);
        } catch (_) {
          state.items = [];
          render();
          setStatus('Live feeds unavailable · open the sources below', false);
        }
      }
    } finally {
      state.loading = false;
      setBusy(false);
    }
  }

  if (filterBar) {
    filterBar.addEventListener('click', (event) => {
      const button = event.target.closest && event.target.closest('[data-filter]');
      if (!button) return;
      setFilter(button.getAttribute('data-filter'));
    });
  }
  if (refreshBtn) refreshBtn.addEventListener('click', () => load({ force: true }));
  window.addEventListener('online', () => load({ force: true }));
  window.addEventListener('storage', (event) => {
    if (event.key === CACHE_KEY) load();
  });

  load();
})();
