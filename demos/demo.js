(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (start, end, amount) => start + (end - start) * amount;
  const round = (value, digits = 0) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  };
  const fmt = (value, digits = 0) => Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const esc = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character]));
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  const average = (values) => (values.length ? sum(values) / values.length : 0);
  const stdev = (values) => {
    if (values.length < 2) return 0;
    const mean = average(values);
    return Math.sqrt(sum(values.map((value) => (value - mean) ** 2)) / (values.length - 1));
  };
  const seeded = (seed = 1) => {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  };
  const shuffle = (values, random = Math.random) => {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  };
  const normal = (random = Math.random) => {
    let value = 0;
    for (let index = 0; index < 6; index += 1) value += random();
    return (value - 3) / 0.7071;
  };
  const laplace = (scale, random = Math.random) => {
    const u = random() - 0.5;
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  };

  let toastTimer = 0;
  const toast = (message) => {
    let element = $(".toast");
    if (!element) {
      element = document.createElement("div");
      element.className = "toast";
      document.body.appendChild(element);
    }
    element.textContent = message;
    element.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => element.classList.remove("show"), 2200);
  };

  const download = (filename, text, type = "text/plain;charset=utf-8") => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
  const exposeLocalLinks = () => {
    if (!localHosts.has(window.location.hostname)) return;
    $$("[data-local-app]").forEach((element) => {
      element.href = `${window.location.protocol}//${window.location.hostname}:3000`;
      element.hidden = false;
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", exposeLocalLinks);
  } else {
    exposeLocalLinks();
  }

  window.Demo = {
    $,
    $$,
    clamp,
    lerp,
    round,
    fmt,
    esc,
    sum,
    average,
    stdev,
    seeded,
    shuffle,
    normal,
    laplace,
    toast,
    download,
    exposeLocalLinks,
  };
})();
