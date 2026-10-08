/* Ground Truth site. Reads data/latest.json and data/stations/<id>.json (contract: docs/STACK.md). No build step. */
(() => {
  "use strict";

  const STATUS = {
    ok: { label: "Agrees with neighbours", short: "Agrees" },
    watch: { label: "Worth a look", short: "Worth a look" },
    flag: { label: "Doesn't add up", short: "Doesn't add up" },
    nodata: { label: "Not enough data", short: "No data" },
  };
  const CHECK_LABEL = { ok: "Passes", watch: "Worth a look", flag: "Doesn't add up", nodata: "No data" };
  const ORDER = ["flag", "watch", "ok", "nodata"];
  const CHECKS = [
    ["physics", "Physics", "Can this reading be real?"],
    ["neighbours", "Neighbours", "Does it agree with the stations around it?"],
    ["history", "History", "Has it suddenly changed?"],
  ];
  const PARAMS = {
    pm10: { name: "PM10 (all dust)", unit: "%" },
    pm25: { name: "PM2.5 (fine dust)", unit: "%" },
    no2: { name: "NO2 (traffic gas)", unit: "%" },
    relativehumidity: { name: "Humidity", unit: "pts" },
  };
  const PM25_STANDARD = 60; // India NAAQS, 24-hour mean, µg/m³

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d = 0) => (v == null ? "–" : Number(v).toFixed(d));
  const milestones = (window.__milestones = []);
  const mark = (name) => { milestones.push({ t: performance.now() / 1000, name }); document.body.dataset.milestone = name; };

  // shape + colour per state, so state never rests on colour alone
  function icon(status, size = 14) {
    const c = { ok: "var(--ok)", watch: "var(--watch)", flag: "var(--flag)", nodata: "var(--nodata)" }[status];
    const s = size;
    const body = {
      ok: `<circle cx="7" cy="7" r="5.5" fill="${c}" stroke="#fff" stroke-width="1.5"/><path d="M4.4 7.2l1.8 1.8 3.4-3.6" stroke="#fff" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
      watch: `<path d="M7 1.2 13 12.2H1z" fill="${c}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 5.2v3.3" stroke="#3a2600" stroke-width="1.4" stroke-linecap="round"/><circle cx="7" cy="10.3" r=".85" fill="#3a2600"/>`,
      flag: `<rect x="2.2" y="2.2" width="9.6" height="9.6" rx="1.5" transform="rotate(45 7 7)" fill="${c}" stroke="#fff" stroke-width="1.3"/><path d="M7 4.2v3.6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><circle cx="7" cy="9.9" r=".9" fill="#fff"/>`,
      nodata: `<circle cx="7" cy="7" r="5" fill="#fff" stroke="${c}" stroke-width="1.8" stroke-dasharray="2.4 1.8"/>`,
    }[status];
    return `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 14 14" aria-hidden="true">${body}</svg>`;
  }
  const pill = (status, label = STATUS[status].label) => `<span class="pill ${status}">${icon(status, 12)}${label}</span>`;
  const short = (name) => name.replace(/,\s*(New )?Delhi$/, "").replace(/\s+-\s+.*$/, "");

  let latest = null, byId = new Map(), map = null, markers = new Map(), chart = null, selected = null, param = "pm10";

  // ---------- data ----------
  async function getJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(`${url}: ${r.status}`);
    return r.json();
  }

  async function boot() {
    try {
      latest = await getJSON("data/latest.json");
    } catch (e) {
      $("#fresh").textContent = "Data unavailable";
      $("#fresh").classList.add("stale");
      $("#panel").innerHTML = `<div class="empty"><h2>Data is updating</h2><p>We couldn't load the latest readings. Try again in a minute.</p><button class="btn ghost" onclick="location.reload()">Try again</button></div>`;
      $("#stats").querySelectorAll(".skel").forEach((el) => { el.classList.remove("skel"); el.textContent = "–"; });
      $("#chrome-live").textContent = "Offline";
      mark("error");
      return;
    }
    latest.stations.forEach((s) => byId.set(s.id, s));
    renderFresh();
    renderStats();
    renderMap();
    renderLegend();
    const example = pickExample();
    renderExample(example);
    renderStory(example);
    renderMeanings();
    renderCheckExamples();
    renderTicks();
    setupSearch();
    window.addEventListener("hashchange", fromHash);
    $("#close-cta")?.addEventListener("click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => $("#search").focus(), 500); });
    mark("loaded");
    if (new URLSearchParams(location.search).get("demo") === "1" || location.hash === "#tour") tour();
    else if (byId.has(Number(location.hash.slice(1)))) fromHash();
    else if (example) select(example.id, { quiet: true, spot: spotFor(example) }); // the map never opens empty
  }

  function fromHash() {
    const id = Number(location.hash.slice(1));
    if (byId.has(id)) select(id, { fly: true });
  }

  function renderFresh() {
    const el = $("#fresh");
    const t = new Date(latest.data_through);
    const hours = (Date.now() - t.getTime()) / 36e5;
    const when = t.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
    el.textContent = `Data through ${when} IST`;
    el.title = `Generated ${latest.generated_at}`;
    el.classList.toggle("stale", hours > 3);
    const live = $("#chrome-live");
    if (live) live.textContent = `Data through ${when}`;
  }

  function renderStats() {
    const n = latest.stations.length;
    const count = (st) => latest.stations.filter((s) => s.status === st).length;
    const stats = $("#stats").children;
    const set = (i, v) => { const b = stats[i].querySelector("b"); b.classList.remove("skel"); b.textContent = v; };
    set(0, n);
    set(1, count("flag"));
    set(2, count("watch"));
    $("#hero-label").textContent = `Delhi + NCR · ${n} monitors · checked hourly`;
  }

  // the hero shows the product: the clearest current case, straight from the data
  function pickExample() {
    // the doubtful station whose reading differs most from its neighbours' right now
    const gap = (x) => Math.abs(Math.log((x.latest.pm25 + 1) / (x.neighbours_latest.pm25 + 1)));
    const cases = latest.stations
      .filter((x) => (x.status === "flag" || x.status === "watch") && x.latest?.pm25 != null && x.neighbours_latest?.pm25 != null)
      .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || gap(b) - gap(a));
    const best = cases.find((x) => gap(x) > Math.log(1.25));
    return best || cases[0] || latest.stations.find((x) => x.status === "flag") || latest.stations.find((x) => x.status === "watch") || null;
  }

  const spotFor = (s) => CHECKS.find(([k]) => s.checks[k].status === s.status)?.[0];
  const openStation = (id, spot) => { select(id, { fly: true, spot }); $("#live").scrollIntoView({ behavior: "smooth", block: "start" }); };

  function renderExample(s) {
    const el = $("#example");
    if (!s) { el.remove(); return; }
    const c = CHECKS.map(([k, name]) => [name, s.checks[k]]).find(([, v]) => v.status === s.status) || ["", { detail: "" }];
    el.innerHTML = `
      <span class="label">Right now, for example</span>
      <h3>${esc(short(s.name))}</h3>
      ${pill(s.status)}
      <div class="nums">This station <b>${fmt(s.latest?.pm25)}</b> µg/m³ PM2.5 · the 4 stations around it <b>${fmt(s.neighbours_latest?.pm25)}</b></div>
      <button class="btn dark" type="button" data-open="${s.id}">See why <span class="arr">→</span></button>`;
    el.querySelector("[data-open]").addEventListener("click", () => openStation(s.id, spotFor(s)));
    el.hidden = false;
  }


  // ---------- the 10-second story, told with one real station ----------
  const mast = (h = 64) => `<svg width="${h * .75}" height="${h}" viewBox="0 0 48 64" aria-hidden="true"><path d="M24 62V18" stroke="#2b2c2f" stroke-width="2.5"/><path d="M24 62 14 64M24 62l10 2" stroke="#2b2c2f" stroke-width="2"/><rect x="11" y="18" width="26" height="20" rx="3" fill="#3a3b3e"/><path d="M14 25h20M14 30h20" stroke="#6b6c70" stroke-width="1.4"/><circle cx="24" cy="12" r="3" fill="#1f9d5c"/><circle cx="24" cy="12" r="6.5" fill="#1f9d5c" opacity=".18"/></svg>`;

  async function renderStory(s) {
    if (!s || s.latest?.pm25 == null) return; // the generic copy in the HTML stays
    let doc = null;
    try { doc = await getJSON(`data/stations/${s.id}.json`); } catch (e) { return; }
    const nbs = (doc.neighbours || []).map((i) => byId.get(i)).filter(Boolean);
    const name = esc(short(s.name));
    $("#step1-art").innerHTML = `<div class="reading">${mast(58)}<div class="big">${fmt(s.latest.pm25)}</div><div class="unit">µg/m³ PM2.5</div><div class="who">${name}</div></div>`;
    $("#step1-title").textContent = `${short(s.name)} says ${fmt(s.latest.pm25)}`;
    $("#step1-text").textContent = "That's its PM2.5 reading for the latest hour. On its own, there's no way to tell whether it's right.";
    const around = s.neighbours_latest?.pm25;
    $("#step2-art").innerHTML = `<div class="nbgrid">${nbs.map((n) => `<div class="nb"><b>${fmt(n.latest?.pm25)}</b><span>${esc(short(n.name))}</span></div>`).join("")}<div class="nbmid">middle value <b>${fmt(around)}</b> µg/m³</div></div>`;
    $("#step2-title").textContent = `Its four neighbours say ${fmt(around)}`;
    $("#step2-text").textContent = "We take the middle value of the four nearest monitors, within 12 km. One odd neighbour can't drag it.";
    const use = s.status === "ok" ? s.latest.pm25 : around;
    $("#step3-art").innerHTML = `<div class="verdict">${pill(s.status)}<div class="use">For today, use<b>${fmt(use)}</b>µg/m³ PM2.5</div></div>`;
    $("#step3-title").textContent = s.status === "ok" ? "It adds up, so use it" : `${STATUS[s.status].label}: use ${fmt(around)}`;
    $("#step3-text").textContent = "Before answering, we also check the reading against physics and against the monitor's own last three weeks. Every answer shows its evidence.";
  }

  function renderMeanings() {
    const groups = {};
    latest.stations.forEach((s) => (groups[s.status] = groups[s.status] || []).push(s));
    const copy = {
      ok: ["Its numbers add up against physics, its neighbours and its own past.", "Use its reading as it is."],
      watch: ["Something about it is unusual, but not clearly wrong.", "Compare its reading with what its neighbours read before acting on it."],
      flag: ["Its numbers don't add up: impossible values, or far out of line with its neighbours or its past.", "Use what the four monitors around it read instead."],
    };
    $("#meanings").innerHTML = ["ok", "watch", "flag"].map((st) => {
      const list = (groups[st] || []).slice().sort((a, b) => a.name.localeCompare(b.name));
      const shown = list.slice(0, st === "ok" ? 4 : 6);
      return `<article class="meaning">
        <div class="head">${icon(st, 30)}<h3>${STATUS[st].label}</h3></div>
        <dl><dt>What it means</dt><dd>${copy[st][0]}</dd><dt>What to do</dt><dd>${copy[st][1]}</dd></dl>
        <div class="now-count"><b>${list.length}</b><span>monitor${list.length === 1 ? "" : "s"} right now${list.length > shown.length ? `, for example:` : list.length ? ":" : ""}</span></div>
        <div class="chips">${shown.map((s) => `<button type="button" data-open="${s.id}">${esc(short(s.name))}</button>`).join("")}</div>
      </article>`;
    }).join("");
    const nd = groups.nodata?.length || 0;
    $("#nodata-note").innerHTML = nd ? `${icon("nodata", 12)} ${nd} more monitor${nd === 1 ? " has" : "s have"} too little recent data to check.` : "";
    $("#meanings").querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => { const s = byId.get(Number(b.dataset.open)); openStation(s.id, spotFor(s)); }));
  }

  function svgLine(values, { w = 320, h = 150, band = null, zero = true } = {}) {
    const pts = values.map((v, i) => [i, v]).filter(([, v]) => v != null);
    if (pts.length < 2) return "";
    const ys = pts.map(([, v]) => v).concat(zero ? [0] : []);
    const lo = Math.min(...ys), hi = Math.max(...ys), pad = (hi - lo) * 0.15 || 1;
    const X = (i) => 16 + (i / (values.length - 1)) * (w - 32), Y = (v) => h - 18 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (h - 36);
    const d = pts.map(([i, v], k) => `${k ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join("");
    const b = band ? `<rect x="${X(band[0] - .5)}" y="10" width="${X(band[1] + .5) - X(band[0] - .5)}" height="${h - 28}" fill="rgba(242,166,12,.12)"/><text x="${(X(band[0]) + X(band[1])) / 2}" y="${h - 4}" text-anchor="middle" font-family="Geist Mono" font-size="10" fill="#8b8d93">11:00-17:00</text>` : "";
    const z = zero ? `<path d="M16 ${Y(0)}H${w - 16}" stroke="#b4b5ba" stroke-dasharray="3 3"/><text x="${w - 16}" y="${Y(0) - 5}" text-anchor="end" font-family="Geist Mono" font-size="10" fill="#8b8d93">same as neighbours</text>` : "";
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${b}${z}<path d="${d}" fill="none" stroke="#08090a" stroke-width="2" stroke-linejoin="round"/></svg>`;
  }

  function svgDaily(values, recent = 7, { w = 320, h = 150 } = {}) {
    const vals = values.map((v) => (v == null ? null : v));
    const nums = vals.filter((v) => v != null);
    if (nums.length < 5) return "";
    const lo = Math.min(0, ...nums), hi = Math.max(0, ...nums), span = hi - lo || 1;
    const bw = (w - 32) / vals.length, Y = (v) => 14 + ((hi - v) / span) * (h - 40);
    const bars = vals.map((v, i) => {
      if (v == null) return "";
      const y0 = Y(0), y1 = Y(v), r = i >= vals.length - recent;
      return `<rect x="${(16 + i * bw + 1).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}" rx="1.5" fill="${r ? "#08090a" : "#c9cace"}"/>`;
    }).join("");
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path d="M16 ${Y(0)}H${w - 16}" stroke="#d6d6d9"/>${bars}<text x="16" y="${h - 6}" font-family="Geist Mono" font-size="10" fill="#8b8d93">3 weeks before</text><text x="${w - 16}" y="${h - 6}" text-anchor="end" font-family="Geist Mono" font-size="10" fill="#08090a">last 7 days</text></svg>`;
  }

  async function renderCheckExamples() {
    const worst = (k, key) => latest.stations.filter((s) => s.checks[k].status === "flag" || s.checks[k].status === "watch")
      .sort((a, b) => Math.abs(b.checks[k][key] ?? 0) - Math.abs(a.checks[k][key] ?? 0))[0];
    const link = (s) => `<button type="button" data-open="${s.id}" data-spot="${s._spot}">${esc(short(s.name))}</button>`;

    // physics: what an impossible reading looks like, and who does it now
    $("#ex-physics").innerHTML = `<svg viewBox="0 0 320 150" aria-hidden="true"><text x="96" y="140" text-anchor="middle" font-family="Geist Mono" font-size="11" fill="#4f5156">PM10 (all dust)</text><text x="224" y="140" text-anchor="middle" font-family="Geist Mono" font-size="11" fill="#4f5156">PM2.5 (fine dust)</text><rect x="66" y="58" width="60" height="66" rx="5" fill="#c9cace"/><rect x="194" y="22" width="60" height="102" rx="5" fill="#d03b3b" opacity=".85"/><path d="M60 58h200" stroke="#08090a" stroke-dasharray="4 4"/><text x="96" y="50" text-anchor="middle" font-family="Geist Mono" font-size="10.5" fill="#4f5156">the limit</text><text x="224" y="80" text-anchor="middle" font-family="Geist Mono" font-size="11" fill="#ffffff">impossible</text></svg>`;
    const p = worst("physics", "fail_pct");
    if (p) { p._spot = "physics"; $("#ex-physics-case").innerHTML = `Right now: ${link(p)} reports impossible values in ${p.checks.physics.fail_pct}% of last week's hours.`; }

    const n = worst("neighbours", "z");
    if (n) {
      n._spot = "neighbours";
      try {
        const doc = await getJSON(`data/stations/${n.id}.json`);
        const pct = (doc.hour_profile_7d?.pm10 || []).map((g) => (g == null ? null : (Math.exp(g) - 1) * 100));
        $("#ex-neighbours").innerHTML = svgLine(pct, { band: [11, 16] });
      } catch (e) { /* the card still reads without the picture */ }
      $("#ex-neighbours-case").innerHTML = `Right now: ${link(n)}. ${esc(n.checks.neighbours.detail)}`;
    }

    const h = worst("history", "z");
    if (h) {
      h._spot = "history";
      try {
        const doc = await getJSON(`data/stations/${h.id}.json`);
        const key = `d_${h.checks.history.param}`;
        $("#ex-history").innerHTML = svgDaily(doc.daily.map((r) => r[key]));
      } catch (e) { /* the card still reads without the picture */ }
      $("#ex-history-case").innerHTML = `Right now: ${link(h)}. ${esc(h.checks.history.detail)}`;
    }
    document.querySelectorAll(".c3-case [data-open]").forEach((b) => b.addEventListener("click", () => openStation(Number(b.dataset.open), b.dataset.spot)));
  }

  function renderTicks() {
    const tick = `<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.5 7.4l2.3 2.3 4.7-5" stroke="#0a6b0a" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    $("#ticks").innerHTML = Array.from({ length: 30 }, (_, i) => `<i style="animation-delay:${(i * 0.03).toFixed(2)}s">${tick}</i>`).join("");
  }

  // ---------- 3D map (MapLibre): our own Delhi base, smog from real readings, a column per monitor ----------
  const STATE_COLOUR = { ok: "#a9cdb0", watch: "#efc867", flag: "#e2867f", nodata: "#cfd0d3" }; // soft tints; the icon on top carries the state
  const VECTOR = "https://tiles.openfreemap.org/planet"; // real streets and 3D buildings, when the browser can reach it
  const HOME = { center: [77.16, 28.63], zoom: 9.7, pitch: 50, bearing: -16 };
  let immersive = false, spinning = false, dustOn = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function disc(lon, lat, r = 280, n = 32) {
    const dx = r / (111320 * Math.cos((lat * Math.PI) / 180)), dy = r / 110540;
    const ring = Array.from({ length: n + 1 }, (_, i) => { const t = (i / n) * 2 * Math.PI; return [lon + dx * Math.cos(t), lat + dy * Math.sin(t)]; });
    return { type: "Polygon", coordinates: [ring] };
  }

  function reading(s) { return s.latest?.pm25 ?? s.neighbours_latest?.pm25 ?? null; }

  function mapStyle() {
    return {
      version: 8,
      sky: { "sky-color": "#e8ebee", "horizon-color": "#e3e3e5", "fog-color": "#e6e6e7", "sky-horizon-blend": 0.75, "horizon-fog-blend": 0.85, "fog-ground-blend": 0.45, "atmosphere-blend": 0.6 },
      sources: {
        wards: { type: "geojson", data: "geo/delhi_wards.json" },
        boundary: { type: "geojson", data: "geo/delhi_boundary.json" },
      },
      layers: [
        { id: "bg", type: "background", paint: { "background-color": "#e9e8e5" } },
        { id: "wards", type: "fill", source: "wards", paint: { "fill-color": "#f4f4f2" } },
        { id: "ward-lines", type: "line", source: "wards", paint: { "line-color": "#d4d4d0", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.4, 13, 1] } },
        { id: "boundary", type: "line", source: "boundary", paint: { "line-color": "#8f9095", "line-width": 1.6, "line-dasharray": [3, 2] } },
      ],
    };
  }

  // real streets, water and 3D buildings, only if the tile server answers; otherwise the wards carry the city
  async function addStreets() {
    try {
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(VECTOR, { signal: ctl.signal });
      if (!r.ok) return;
    } catch (e) { return; }
    map.addSource("osm", { type: "vector", url: VECTOR, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://openfreemap.org">OpenFreeMap</a>' });
    map.addLayer({ id: "water", type: "fill", source: "osm", "source-layer": "water", paint: { "fill-color": "#d5dbde" } }, "ward-lines");
    map.addLayer({ id: "roads", type: "line", source: "osm", "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
      paint: { "line-color": "#ffffff", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 14, 3.5] } }, "ward-lines");
    map.addLayer({ id: "buildings", type: "fill-extrusion", source: "osm", "source-layer": "building", minzoom: 12.5,
      paint: { "fill-extrusion-color": "#e4e4e1", "fill-extrusion-height": ["coalesce", ["get", "render_height"], 9],
               "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0], "fill-extrusion-opacity": 0.9 } }, "smog");
  }

  function addAirLayers() {
    const pts = latest.stations.filter((s) => reading(s) != null).map((s) => ({ type: "Feature", properties: { pm: reading(s) }, geometry: { type: "Point", coordinates: [s.lon, s.lat] } }));
    map.addSource("air", { type: "geojson", data: { type: "FeatureCollection", features: pts } });
    // the smog: thicker where the monitors read more
    map.addLayer({ id: "smog", type: "heatmap", source: "air", paint: {
      "heatmap-weight": ["interpolate", ["linear"], ["get", "pm"], 0, 0, 60, 0.45, 150, 1],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 9, 0.9, 13, 1.4],
      "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 9, 46, 12, 150, 14, 420],
      "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
        0, "rgba(0,0,0,0)", 0.12, "rgba(170,160,144,0.22)", 0.35, "rgba(150,139,121,0.38)", 0.65, "rgba(128,116,98,0.52)", 1, "rgba(104,92,76,0.64)"],
      "heatmap-opacity": 0.9 } }, "boundary");
    // a column per monitor, as tall as its PM2.5 reading, in its state colour
    const cols = latest.stations.map((s) => ({ type: "Feature",
      properties: { h: Math.max(reading(s) ?? 6, 6) * 28, c: STATE_COLOUR[s.status] }, geometry: disc(s.lon, s.lat) }));
    map.addSource("cols", { type: "geojson", data: { type: "FeatureCollection", features: cols } });
    map.addLayer({ id: "cols", type: "fill-extrusion", source: "cols", paint: {
      "fill-extrusion-color": ["get", "c"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.92, "fill-extrusion-vertical-gradient": true } });
  }

  function markerEl(s) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = `gt-marker${s.region === "NCR" ? " ncr" : ""}`;
    el.dataset.name = `${short(s.name)} · ${STATUS[s.status].label}`;
    el.setAttribute("aria-label", `${s.name}: ${STATUS[s.status].label}`);
    el.innerHTML = icon(s.status, 22);
    el.addEventListener("click", (e) => { e.stopPropagation(); select(s.id, { fly: true }); });
    return el;
  }

  function renderMap() {
    map = new maplibregl.Map({
      container: "map", style: mapStyle(), ...HOME, maxPitch: 78, scrollZoom: false, dragRotate: true,
      attributionControl: { compact: true, customAttribution: 'Wards: <a href="https://github.com/datameet/Municipal_Spatial_Data">DataMeet</a> (CC BY-SA 2.5 IN)' },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("load", () => {
      addAirLayers();
      addStreets();
      const sorted = [...latest.stations].sort((a, b) => ORDER.indexOf(b.status) - ORDER.indexOf(a.status));
      for (const s of sorted) markers.set(s.id, new maplibregl.Marker({ element: markerEl(s) }).setLngLat([s.lon, s.lat]).addTo(map));
      if (selected != null) markers.get(selected)?.getElement().classList.add("sel");
      mark("map:ready");
    });
    map.on("error", () => { /* an unreachable tile server only costs the streets; the city still draws */ });
    map.on("click", () => { if (!immersive) enterImmersive(); });
    ["mousedown", "touchstart", "wheel"].forEach((ev) => map.getCanvasContainer().addEventListener(ev, () => { spinning = false; }, { passive: true }));
    $("#enter3d").addEventListener("click", (e) => { e.stopPropagation(); enterImmersive(); });
    $("#exit3d").addEventListener("click", exitImmersive);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && immersive) exitImmersive(); });
  }

  function enterImmersive() {
    if (immersive) return;
    immersive = true;
    $(".window").classList.add("immersive");
    document.documentElement.classList.add("lock");
    $("#exit3d").hidden = false; $("#enter3d").hidden = true;
    map.scrollZoom.enable();
    setTimeout(() => {
      map.resize();
      const s = byId.get(selected);
      map.flyTo({ center: s ? [s.lon, s.lat] : HOME.center, zoom: s ? 11.6 : 10.4, pitch: 64, bearing: map.getBearing() - 28, duration: reduced ? 0 : 2600, essential: true });
      startDust(); startSpin();
    }, 30);
    mark("map:3d");
  }

  function exitImmersive() {
    immersive = false; spinning = false; dustOn = false;
    $(".window").classList.remove("immersive");
    document.documentElement.classList.remove("lock");
    $("#exit3d").hidden = true; $("#enter3d").hidden = false;
    map.scrollZoom.disable();
    setTimeout(() => { map.resize(); map.easeTo({ ...HOME, duration: reduced ? 0 : 1200 }); }, 30);
  }

  function startSpin() {
    if (reduced) return;
    spinning = true;
    const step = () => { if (!spinning || !immersive) return; map.setBearing(map.getBearing() + 0.035); requestAnimationFrame(step); };
    setTimeout(() => requestAnimationFrame(step), 2700);
  }

  // drifting dust in front of the camera; thicker when the city's readings are higher
  function startDust() {
    if (reduced || dustOn) return;
    const cv = $("#dust"), ctx = cv.getContext("2d");
    dustOn = true;
    const vals = latest.stations.map(reading).filter((v) => v != null).sort((a, b) => a - b);
    const median = vals.length ? vals[Math.floor(vals.length / 2)] : 40;
    const n = Math.round(Math.min(260, 70 + median * 1.6));
    let w = 0, h = 0;
    const fit = () => { w = cv.width = cv.clientWidth * devicePixelRatio; h = cv.height = cv.clientHeight * devicePixelRatio; };
    fit();
    const ps = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), z: Math.random(), vx: 0.00004 + Math.random() * 0.00012, vy: -0.00002 - Math.random() * 0.00004 }));
    const frame = () => {
      if (!dustOn) { ctx.clearRect(0, 0, w, h); return; }
      if (cv.clientWidth * devicePixelRatio !== w) fit();
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.x += p.vx * (0.5 + p.z); p.y += p.vy * (0.5 + p.z);
        if (p.x > 1.02) p.x = -0.02; if (p.y < -0.02) p.y = 1.02;
        const r = (0.5 + p.z * 2.2) * devicePixelRatio;
        ctx.fillStyle = `rgba(96, 88, 76, ${0.06 + p.z * 0.2})`;
        ctx.beginPath(); ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2); ctx.fill();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function renderLegend() {
    const count = (st) => latest.stations.filter((s) => s.status === st).length;
    $("#legend").innerHTML = ORDER.map((st) => `<span>${icon(st, 14)}${STATUS[st].label} <span class="count">${count(st)}</span></span>`).join("");
  }

  // ---------- station panel ----------
  async function select(id, { fly = false, spot = null, quiet = false } = {}) {
    const s = byId.get(id);
    if (!s) return;
    if (selected != null) markers.get(selected)?.getElement().classList.remove("sel");
    selected = id;
    markers.get(id)?.getElement().classList.add("sel");
    if (fly && map) {
      spinning = false;
      map.flyTo({ center: [s.lon, s.lat], zoom: Math.max(map.getZoom(), immersive ? 12.2 : 10.8), pitch: immersive ? 64 : map.getPitch(), duration: reduced ? 0 : 1600, essential: true });
    }
    if (!quiet && location.hash !== `#${id}`) history.replaceState(null, "", `${location.search}#${id}`);

    const panel = $("#panel");
    panel.innerHTML = panelHTML(s, null);
    let doc = null;
    try { doc = await getJSON(`data/stations/${id}.json`); } catch (e) { /* the chart says so */ }
    if (selected !== id) return;
    panel.innerHTML = panelHTML(s, doc);
    if (spot) spotCheck(spot);
    drawChart(doc);
    panel.querySelectorAll("[data-goto]").forEach((b) => b.addEventListener("click", () => select(Number(b.dataset.goto), { fly: true })));
    panel.querySelector("#param")?.addEventListener("change", (e) => { param = e.target.value; drawChart(doc); });
    panel.querySelector("#as-table")?.addEventListener("click", () => toggleTable(doc));
    mark(`station:${id}`);
  }

  function adviceHTML(s) {
    const mine = s.latest?.pm25, around = s.neighbours_latest?.pm25;
    const aroundTxt = around == null ? "" : ` The four nearest stations read <b class="mono">${fmt(around)} µg/m³</b> PM2.5 right now.`;
    const text = {
      ok: `This station agrees with the stations around it. Its reading is a fair guide for this area.`,
      watch: `Something about this station is unusual. Before acting on its reading, compare it with the stations around it.${aroundTxt}`,
      flag: around == null
        ? `This station's numbers don't add up, and its neighbours have no reading right now either. Treat today's number with care.`
        : `This station's numbers don't add up. For decisions today, use what the stations around it read.${aroundTxt}`,
      nodata: `There isn't enough recent data to check this station.${aroundTxt}`,
    }[s.status];
    // a big gap right now is worth saying even when the weekly checks pass
    let gapTxt = "";
    if (mine != null && around != null && Math.max(mine, around) >= 15) {
      const r = (mine + 1) / (around + 1);
      if (r > 1.5 || r < 1 / 1.5) gapTxt = ` Right now, though, it reads <b>${r > 1 ? "well above" : "well below"}</b> the stations around it (${fmt(mine)} against ${fmt(around)} µg/m³).`;
    }
    return `<div class="advice ${s.status}">${text}${gapTxt}</div>`;
  }

  function panelHTML(s, doc) {
    const nb = doc?.neighbours?.map((i) => byId.get(i)).filter(Boolean) || [];
    const checks = CHECKS.map(([k, name, q]) => {
      const c = s.checks[k];
      return `<li class="check" data-check="${k}"><div><h3>${name}</h3><div class="q">${q}</div></div>${pill(c.status, CHECK_LABEL[c.status])}<p>${esc(c.detail)}</p></li>`;
    }).join("");
    const opts = Object.entries(PARAMS).map(([k, p]) => `<option value="${k}"${k === param ? " selected" : ""}>${p.name}</option>`).join("");
    return `
      <span class="label">${s.region === "NCR" ? "NCR" : "Delhi"} · OpenAQ location ${s.id}</span>
      <h2>${esc(short(s.name))}</h2>
      <div class="meta">${pill(s.status)}</div>
      <div class="now">
        <div><small>This station, PM2.5 now</small><b>${fmt(s.latest?.pm25)}<small> µg/m³</small></b></div>
        <div><small>4 nearest stations, PM2.5 now</small><b>${fmt(s.neighbours_latest?.pm25)}<small> µg/m³</small></b></div>
      </div>
      <div class="std">India's 24-hour PM2.5 standard is ${PM25_STANDARD} µg/m³.</div>
      ${adviceHTML(s)}
      <ul class="checks">${checks}</ul>
      <div class="chartbox">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:baseline;flex-wrap:wrap">
          <div><h3>Hour by hour, against its neighbours</h3><p class="csub">Above zero: this station reads higher than the 4 nearest stations at that hour.</p></div>
          <label class="sr-only" for="param">Measure</label>
          <select id="param">${opts}</select>
        </div>
        <div class="chartwrap">${doc ? `<canvas id="chart" role="img" aria-label="Hour-of-day gap against neighbours"></canvas>` : `<div class="empty" style="min-height:220px"><p>${doc === null ? "Loading the chart…" : ""}</p></div>`}</div>
        <div class="chartlegend"><span><i style="background:var(--series-7d)"></i>Last 7 days</span><span><i style="background:var(--series-28d)"></i>Last 28 days</span><span><i class="band"></i>11:00-17:00</span><button class="linkish" id="as-table" type="button">Show as table</button></div>
        <div id="tablebox"></div>
      </div>
      ${nb.length ? `<div class="nbs"><span class="label">Compared with</span>${nb.map((n) => `<button data-goto="${n.id}" type="button">${icon(n.status, 11)}${esc(short(n.name))}</button>`).join("")}</div>` : ""}
    `;
  }

  function series(doc, key) {
    const raw = doc?.[key]?.[param] || [];
    return raw.map((g) => (g == null ? null : PARAMS[param].unit === "%" ? (Math.exp(g) - 1) * 100 : g));
  }

  const bandPlugin = {
    id: "band",
    beforeDatasetsDraw(c) {
      const { ctx, chartArea: a, scales: { x, y } } = c;
      ctx.save();
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--band");
      const x0 = x.getPixelForValue(11) - (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2;
      const x1 = x.getPixelForValue(16) + (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2;
      ctx.fillRect(x0, a.top, x1 - x0, a.bottom - a.top);
      ctx.strokeStyle = "#b4b5ba"; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
      const z = y.getPixelForValue(0);
      if (z >= a.top && z <= a.bottom) { ctx.beginPath(); ctx.moveTo(a.left, z); ctx.lineTo(a.right, z); ctx.stroke(); }
      ctx.restore();
    },
  };

  function drawChart(doc) {
    const canvas = $("#chart");
    if (chart) { chart.destroy(); chart = null; }
    if (!canvas || !doc) return;
    const css = getComputedStyle(document.documentElement);
    const unit = PARAMS[param].unit;
    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: [...Array(24).keys()],
        datasets: [
          { label: "Last 28 days", data: series(doc, "hour_profile"), borderColor: css.getPropertyValue("--series-28d").trim(), borderWidth: 2, pointRadius: 0, cubicInterpolationMode: "monotone", spanGaps: true },
          { label: "Last 7 days", data: series(doc, "hour_profile_7d"), borderColor: css.getPropertyValue("--series-7d").trim(), borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, cubicInterpolationMode: "monotone", spanGaps: true },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration: 500 },
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#ffffff", borderColor: "#d6d6d9", borderWidth: 1, titleColor: "#08090a", bodyColor: "#4f5156", titleFont: { family: "Geist Mono", size: 12 }, bodyFont: { family: "Geist", size: 12.5 }, padding: 10,
            callbacks: {
              title: (items) => `${String(items[0].label).padStart(2, "0")}:00 IST`,
              label: (it) => ` ${it.dataset.label}: ${it.raw == null ? "no data" : `${it.raw > 0 ? "+" : ""}${it.raw.toFixed(unit === "%" ? 0 : 1)}${unit === "%" ? "%" : " pts"}`}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "Geist Mono", size: 11 }, color: "#8b8d93", callback: (v) => (v % 3 === 0 ? `${String(v).padStart(2, "0")}h` : "") }, border: { color: "#d6d6d9" } },
          y: { grid: { color: "#efeff0" }, border: { display: false }, ticks: { font: { family: "Geist Mono", size: 11 }, color: "#8b8d93", callback: (v) => `${v > 0 ? "+" : ""}${v}${unit === "%" ? "%" : ""}` } },
        },
      },
      plugins: [bandPlugin],
    });
  }

  function toggleTable(doc) {
    const box = $("#tablebox");
    if (box.innerHTML) { box.innerHTML = ""; $("#as-table").textContent = "Show as table"; return; }
    const a = series(doc, "hour_profile_7d"), b = series(doc, "hour_profile");
    const u = PARAMS[param].unit === "%" ? "%" : " pts";
    box.innerHTML = `<table class="data"><thead><tr><th>Hour (IST)</th><th>Last 7 days</th><th>Last 28 days</th></tr></thead><tbody>${a.map((v, h) => `<tr><td>${String(h).padStart(2, "0")}:00</td><td>${v == null ? "–" : v.toFixed(0) + u}</td><td>${b[h] == null ? "–" : b[h].toFixed(0) + u}</td></tr>`).join("")}</tbody></table>`;
    $("#as-table").textContent = "Hide table";
  }

  function spotCheck(k) {
    document.querySelectorAll(".check").forEach((el) => el.classList.toggle("spot", el.dataset.check === k));
  }

  // ---------- search ----------
  function setupSearch() {
    const input = $("#search"), list = $("#search-list"), box = input.closest(".search");
    let items = [], idx = -1;
    const close = () => { list.hidden = true; box.setAttribute("aria-expanded", "false"); idx = -1; };
    const show = () => {
      const q = input.value.trim().toLowerCase();
      items = latest.stations.filter((s) => !q || s.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 8);
      list.innerHTML = items.map((s, i) => `<li role="option" id="opt-${i}" data-id="${s.id}" aria-selected="${i === idx}">${esc(s.name)} ${pill(s.status)}</li>`).join("") || `<li aria-disabled="true">No station matches</li>`;
      list.hidden = false; box.setAttribute("aria-expanded", "true");
    };
    const pick = (id) => { close(); input.value = ""; select(id, { fly: true }); $("#live").scrollIntoView({ behavior: "smooth", block: "start" }); };
    input.addEventListener("input", () => { idx = -1; show(); });
    input.addEventListener("focus", show);
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { idx = Math.min(idx + 1, items.length - 1); show(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { idx = Math.max(idx - 1, 0); show(); e.preventDefault(); }
      else if (e.key === "Enter" && items.length) { pick(items[Math.max(idx, 0)].id); }
      else if (e.key === "Escape") close();
    });
    list.addEventListener("mousedown", (e) => { const li = e.target.closest("li[data-id]"); if (li) pick(Number(li.dataset.id)); });
    input.addEventListener("blur", () => setTimeout(close, 120));
  }

  // ---------- ?demo=1: the story, playing by itself ----------
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  function caption(k, text) {
    let el = $("#tour");
    if (!el) { el = document.createElement("div"); el.id = "tour"; el.className = "tour"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.innerHTML = `<span class="label">${esc(k)}</span>${text}`;
  }

  async function tour() {
    const pick = (pred, fallback) => (latest.stations.find(pred) || byId.get(fallback) || latest.stations[0]).id;
    const physics = pick((s) => s.checks.physics.status === "flag", 301);
    const history = pick((s) => s.id === 8235 && s.checks.history.status !== "nodata", 8235);
    const n = latest.stations.length;
    mark("tour:start");
    caption("Ground Truth", `${n} air-quality monitors across Delhi and NCR, checked every hour.`);
    await wait(3500);
    $("#live").scrollIntoView({ behavior: "smooth", block: "start" });
    await wait(1500);
    enterImmersive();
    caption("Ground Truth", `Each column is a monitor, as tall as its PM2.5 reading. The haze is thicker where the air is worse.`);
    await wait(5000);

    mark("tour:physics");
    await select(physics, { fly: true, spot: "physics" });
    caption("Physics", `${esc(byId.get(physics).name.split(",")[0])} reports readings that can't be real. Its numbers don't add up.`);
    await wait(6500);

    mark("tour:chart");
    await select(235, { fly: true, spot: "neighbours" });
    caption("Neighbours", `Anand Vihar, hour by hour, against the four stations around it. The shaded band is 11:00 to 17:00.`);
    await wait(7000);

    mark("tour:history");
    await select(history, { fly: true, spot: "history" });
    caption("History", `Jahangirpuri against its own last three weeks. Worth a look, not proof.`);
    await wait(6500);

    mark("tour:advice");
    caption("What to do", `When a station is in doubt, use what the stations around it read right now.`);
    document.querySelector("#panel .now")?.scrollIntoView({ behavior: "smooth", block: "center" });
    await wait(5000);
    caption("Ground Truth", `A flag means the numbers don't add up. Not that anyone cheated.`);
    mark("tour:end");
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
