"use strict";

const TYPES = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying",
  "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"];
const CHART = {
  normal: { rock: .5, ghost: 0, steel: .5 },
  fire: { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
  water: { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
  electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
  grass: { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
  ice: { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
  fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
  poison: { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
  flying: { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
  psychic: { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
  bug: { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
  rock: { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: .5 },
  dragon: { dragon: 2, steel: .5, fairy: 0 },
  dark: { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
  steel: { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
  fairy: { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 },
};
const GENS = [[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905]];
const HOW = [
  ["wild", "Selvatico"], ["raid", "Raid"], ["evolve", "Evoluzione"], ["breed", "Uovo"], ["gift", "Regalo / Missione"],
];
const STAT_LABEL = { en: ["HP", "Atk", "Def", "Sp. Atk", "Sp. Def", "Speed"], it: ["PS", "Attacco", "Difesa", "Att. Sp.", "Dif. Sp.", "Velocità"] };
const WHY = {
  stab: "STAB", cov: "Copertura", boost: "Potenziamento", heal: "Cura", util: "Supporto",
};
const CAT = { en: { Physical: "Physical", Special: "Special", Status: "Status" }, it: { Physical: "Fisico", Special: "Speciale", Status: "Stato" } };
const ART = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const SPR = id => `sprites/${id}.png`;

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fold = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

let DEX = [], MOVES = {}, META = {}, BY_ID = new Map();
const state = {
  lang: store.get("lang", "en"), own: "", q: "", types: new Set(), gen: 0, how: "", move: "", sort: "dex",
};
let cards = [], current = null, learnTab = "lv", artMode = store.get("art", "art");
const TEAM_MAX = 6;
const load = (k, d) => { try { return JSON.parse(store.get(k, "")) ?? d; } catch { return d; } };
let team = load("team", []);
const caught = new Set(load("caught", []));
const OWN = [["", "Tutti"], ["team", "Squadra"], ["caught", "Catturati"], ["uncaught", "Non catturati"]];

const L = (p, k = "") => state.lang === "it" ? (p[k + "it"] ?? p[k + "en"]) : p[k + "en"];
const other = (p, k = "") => state.lang === "it" ? p[k + "en"] : (p[k + "it"] ?? p[k + "en"]);
const typeName = t => state.lang === "it" ? (META.type_it?.[t] ?? t) : t;
const typeBadge = (t, cls = "") => `<span class="type ${cls}" style="--c:var(--t-${t})">${esc(typeName(t))}</span>`;
const dexNo = n => "#" + String(n).padStart(3, "0");

function classify(loc) {
  const out = new Set();
  if (!loc.length) out.add("none");
  for (const l of loc) {
    if (/raid den/i.test(l)) out.add("raid");
    else if (/^(evolve|evolves|level up|use )/i.test(l)) out.add("evolve");
    else if (/breed|egg lady|hatch/i.test(l)) out.add("breed");
    else if (/mission|reward|gift|starter|prize|mystery|code|trade|fossil|game corner|given|receive/i.test(l)) out.add("gift");
    else out.add("wild");
  }
  return out;
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  document.body.dataset.lang = state.lang;
  const [dex, moves, meta] = await Promise.all(
    ["data/dex.json", "data/moves.json", "data/meta.json"].map(u => fetch(u).then(r => r.json())));
  DEX = dex; MOVES = moves; META = meta;
  DEX.forEach((p, i) => {
    p.i = i;
    BY_ID.set(p.id, p);
    p.how = classify(p.loc);
    p.bst = p.stats.reduce((a, b) => a + b, 0);
    const lr = p.learn;
    p.moveset = new Set([...lr.lv.map(x => x[1]), ...lr.tm, ...lr.tu, ...lr.egg]);
    p.hay = fold([p.en, p.it, ...p.types, ...p.types.map(t => META.type_it?.[t] || ""),
      ...p.abil.flatMap(a => [a.en, a.it]), ...p.loc, ...p.locIt].join(" | "));
  });
  team = team.filter(id => BY_ID.has(id)).slice(0, TEAM_MAX);
  buildChrome();
  buildGrid();
  renderTeambar();
  apply();
  route();
}

function buildChrome() {
  const fb = $("#filterBtn");
  const chips = $("#typeChips");
  chips.innerHTML = TYPES.map(t =>
    `<button class="chip" type="button" data-t="${t}" style="--c:var(--t-${t})"><i></i><span>${esc(typeName(t))}</span></button>`).join("");
  chips.addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    const t = b.dataset.t;
    state.types.has(t) ? state.types.delete(t) : state.types.add(t);
    b.classList.toggle("on", state.types.has(t));
    apply(true);
  });

  $("#genSeg").innerHTML = `<button class="on" data-g="0">Tutte</button>` +
    GENS.map((_, i) => `<button data-g="${i + 1}">${i + 1}</button>`).join("");
  $("#genSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.gen = +b.dataset.g;
    [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
    apply(true);
  });
  $("#ownSeg").innerHTML = OWN.map(([k, v], i) => `<button class="${i ? "" : "on"}" data-o="${k}">${v}</button>`).join("");
  $("#ownSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.own = b.dataset.o;
    [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
    apply(true);
  });
  $("#filtersDone").addEventListener("click", () => { $("#filters").hidden = true; fb.setAttribute("aria-expanded", "false"); });
  $("#teambar").addEventListener("click", e => {
    const b = e.target.closest("[data-go],.an"); if (!b) return;
    b.dataset.go ? openDetail(b.dataset.go) : openTeam();
  });
  $("#howSeg").innerHTML = `<button class="on" data-h="">Tutti</button>` +
    HOW.map(([k, v]) => `<button data-h="${k}">${v}</button>`).join("");
  $("#howSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    state.how = b.dataset.h;
    [...e.currentTarget.children].forEach(x => x.classList.toggle("on", x === b));
    apply(true);
  });

  const names = new Set();
  for (const m of Object.values(MOVES)) { names.add(m.en); if (m.it) names.add(m.it); }
  $("#moveList").innerHTML = [...names].sort().map(n => `<option value="${esc(n)}">`).join("");
  let mt;
  $("#moveQ").addEventListener("input", e => { clearTimeout(mt); mt = setTimeout(() => { state.move = e.target.value; apply(true); }, 200); });
  $("#sort").addEventListener("change", e => { state.sort = e.target.value; apply(true); });
  $("#reset").addEventListener("click", resetFilters);

  fb.setAttribute("aria-expanded", "false");
  fb.addEventListener("click", () => {
    const p = $("#filters"); p.hidden = !p.hidden;
    fb.setAttribute("aria-expanded", String(!p.hidden));
  });

  const q = $("#q");
  let qt;
  q.addEventListener("input", () => {
    $("#clear").hidden = !q.value;
    clearTimeout(qt); qt = setTimeout(() => { state.q = q.value; apply(true); }, 120);
  });
  q.addEventListener("keydown", e => { if (e.key === "Enter") q.blur(); });
  $("#clear").addEventListener("click", () => { q.value = ""; state.q = ""; $("#clear").hidden = true; apply(true); q.focus(); });

  for (const b of [$("#lang"), $("#sheetLang")]) b.addEventListener("click", toggleLang);

  const top = $("#totop");
  addEventListener("scroll", () => { top.hidden = scrollY < 600; }, { passive: true });
  top.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

  $("#back").addEventListener("click", closeDetail);
  $("#closeAll").addEventListener("click", closeAll);
  $("#sheetSearch").addEventListener("click", () => {
    const q = $("#q");
    q.focus({ preventScroll: true }); // inside the tap so iOS opens the keyboard
    closeDetail();
    q.select();
  });
  addEventListener("popstate", route);
}

function resetFilters() {
  state.types.clear(); state.gen = 0; state.how = ""; state.own = ""; state.move = ""; state.sort = "dex";
  document.querySelectorAll(".chip.on").forEach(c => c.classList.remove("on"));
  for (const seg of ["#genSeg", "#howSeg", "#ownSeg"]) [...$(seg).children].forEach((x, i) => x.classList.toggle("on", i === 0));
  $("#moveQ").value = ""; $("#sort").value = "dex";
  apply(true);
}

function toggleLang() {
  state.lang = state.lang === "en" ? "it" : "en";
  store.set("lang", state.lang);
  document.body.dataset.lang = state.lang;
  cards.forEach((c, i) => { c.nm.textContent = L(DEX[i]); c.el.setAttribute("aria-label", L(DEX[i])); });
  document.querySelectorAll(".chip span").forEach(s => { s.textContent = typeName(s.parentNode.dataset.t); });
  renderTeambar();
  rerender();
}

/* ------------------------------------------------------------------ grid */
function buildGrid() {
  const frag = document.createDocumentFragment();
  cards = DEX.map(p => {
    const el = document.createElement("button");
    el.className = "card"; el.type = "button"; el.dataset.id = p.id;
    el.style.setProperty("--c1", `var(--t-${p.types[0]})`);
    el.setAttribute("aria-label", L(p));
    el.innerHTML = `<span class="num">${dexNo(p.dex)}</span>` +
      `<img loading="lazy" decoding="async" width="88" height="88" alt="" src="${SPR(p.spr)}">` +
      `<div class="nm"></div><div class="types">${p.types.map(t => `<span class="dot" style="--c:var(--t-${t})"></span>`).join("")}</div>` +
      `<span class="mk"></span>`;
    const nm = el.querySelector(".nm"); nm.textContent = L(p);
    frag.appendChild(el);
    return { el, nm, mk: el.querySelector(".mk") };
  });
  DEX.forEach(refreshMark);
  const grid = $("#grid");
  grid.appendChild(frag);
  grid.addEventListener("click", e => {
    const c = e.target.closest(".card"); if (c) openDetail(c.dataset.id);
  });
}

function matchMoves(q) {
  q = fold(q.trim()); if (!q) return null;
  const exact = [], part = [];
  for (const [id, m] of Object.entries(MOVES)) {
    const a = fold(m.en), b = fold(m.it || "");
    if (a === q || b === q) exact.push(id); else if (a.includes(q) || b.includes(q)) part.push(id);
  }
  return new Set(exact.length ? exact : part);
}

function apply(scroll) {
  const q = fold(state.q.trim()).replace(/^#/, "");
  const num = /^\d+$/.test(q) ? +q : null;
  // phrase match; a trailing number must end there ("route 5" must not match "route 50")
  const rx = q && num === null ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (/\d$/.test(q) ? "(?!\\d)" : "")) : null;
  const mv = matchMoves(state.move);
  const range = state.gen ? GENS[state.gen - 1] : null;
  let shown = 0;
  const vis = [];
  DEX.forEach((p, i) => {
    let ok = true;
    if (num !== null) ok = p.dex === num;
    else if (rx) ok = rx.test(p.hay);
    if (ok && state.types.size) ok = [...state.types].every(t => p.types.includes(t));
    if (ok && range) ok = p.dex >= range[0] && p.dex <= range[1];
    if (ok && state.how) ok = p.how.has(state.how);
    if (ok && mv) ok = [...mv].some(m => p.moveset.has(m));
    if (ok && state.own) ok = state.own === "team" ? team.includes(p.id) : state.own === "caught" ? caught.has(p.id) : !caught.has(p.id);
    cards[i].el.hidden = !ok;
    if (ok) { shown++; vis.push(p); }
  });
  // reorder only when needed
  const key = { dex: p => p.dex * 10000 + p.i, name: null, bst: p => -p.bst, atk: p => -p.stats[1], spa: p => -p.stats[3], spe: p => -p.stats[5] }[state.sort];
  const order = [...DEX].sort(key ? (a, b) => key(a) - key(b) || a.i - b.i : (a, b) => L(a).localeCompare(L(b)));
  const grid = $("#grid");
  const sig = state.sort + state.lang;
  if (grid.dataset.sig !== sig) { order.forEach(p => grid.appendChild(cards[p.i].el)); grid.dataset.sig = sig; }

  const n = (state.types.size ? 1 : 0) + (state.gen ? 1 : 0) + (state.how ? 1 : 0) + (state.own ? 1 : 0) + (mv ? 1 : 0) + (state.sort !== "dex" ? 1 : 0);
  const fc = $("#filterCount"); fc.hidden = !n; fc.textContent = n;
  $("#count").textContent = `${shown} Pokémon` + (shown !== DEX.length ? ` su ${DEX.length}` : "") +
    (caught.size ? ` · ✓ ${caught.size} ${caught.size === 1 ? "catturato" : "catturati"}` : "");
  $("#empty").hidden = shown > 0;
  if (scroll) {
    const y = $("main").offsetTop - $("#top").offsetHeight;
    if (scrollY > y) scrollTo({ top: Math.max(0, y) });
  }
}

/* ------------------------------------------------------------------ routing */
// history.state.dex = how many sheet pages we pushed on top of the list
function push(hash) {
  history.pushState({ dex: (history.state?.dex || 0) + 1 }, "", hash);
  route();
}
const openDetail = id => push("#/p/" + encodeURIComponent(id));
const openTeam = () => push("#/team");
function toList() {
  history.replaceState(null, "", location.pathname + location.search);
  route();
}
function closeDetail() {
  // entries we pushed can be popped (phone back button works too); a deep link is replaced instead
  if (history.state?.dex) history.back(); else toList();
}
function closeAll() {
  const n = history.state?.dex || 0;
  if (n) history.go(-n); else toList();
}
function route() {
  const m = location.hash.match(/^#\/p\/(.+)$/);
  const p = location.hash === "#/team" ? "team" : m && BY_ID.get(decodeURIComponent(m[1]));
  const sheet = $("#sheet");
  if (p) {
    p === "team" ? renderTeam() : renderDetail(p);
    sheet.classList.add("open"); sheet.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
  } else {
    current = null;
    sheet.classList.remove("open"); sheet.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
  }
}

/* ------------------------------------------------------------------ detail */
function weaknesses(types) {
  const res = {};
  for (const a of TYPES) res[a] = types.reduce((m, d) => m * (CHART[a][d] ?? 1), 1);
  return res;
}
function locIcon(l) {
  if (/raid/i.test(l)) return "⭐";
  if (/rod|amo/i.test(l)) return "🎣";
  if (/surf|underwater|sott/i.test(l)) return "🌊";
  if (/cave|grotta|rock smash/i.test(l)) return "⛰️";
  if (/grass|erba|swarm|flower/i.test(l)) return "🌿";
  if (/^(evolve|evolves|level|use )/i.test(l)) return "🔁";
  if (/breed|egg|hatch/i.test(l)) return "🥚";
  if (/mission|reward|gift|starter|prize|code|trade|fossil/i.test(l)) return "🎁";
  return "📍";
}
function moveRow(id, extra = "") {
  const m = MOVES[id]; if (!m) return "";
  return `<tr>${extra}<td class="nm"><b>${esc(L(m))}</b><small>${esc(other(m))}</small></td>` +
    `<td>${typeBadge(m.type, "sm")}<span class="cat ${m.cat}">${CAT[state.lang][m.cat][0]}</span></td>` +
    `<td class="p">${m.pow || "–"} · ${m.acc ? m.acc + "%" : "–"}</td></tr>`;
}
function learnTable(p) {
  const l = p.learn;
  let rows = "";
  if (learnTab === "lv") rows = l.lv.map(([lv, id]) => moveRow(id, `<td class="lv">${lv || "–"}</td>`)).join("");
  else rows = [...(l[learnTab] || [])].sort((a, b) => L(MOVES[a] || { en: a }).localeCompare(L(MOVES[b] || { en: b }))).map(id => moveRow(id)).join("");
  return rows ? `<table class="ml">${rows}</table>` : `<p class="note">Nessuna mossa.</p>`;
}

function renderDetail(p, keepScroll) {
  const body = $("#detail");
  const y = keepScroll && current === p ? body.scrollTop : 0;
  if (current !== p) learnTab = "lv";
  current = p;
  const it = state.lang === "it";
  $("#sheetTitle").textContent = `${L(p)} ${dexNo(p.dex)}`;
  const c1 = `var(--t-${p.types[0]})`, c2 = `var(--t-${p.types[1] || p.types[0]})`;

  const fam = p.evo.length ? p.evo : [{ s: p.id, n: p.en }];
  const sprOf = s => BY_ID.get(s)?.spr;
  const nameOf = (s, n) => { const q = BY_ID.get(s); return q ? L(q) : n; };
  const famHtml = `<div class="fam">${fam.map(e => `<button type="button" data-go="${esc(e.s)}" class="${e.s === p.id ? "cur" : ""}">` +
    `<img loading="lazy" alt="" src="${SPR(sprOf(e.s))}">${esc(nameOf(e.s, e.n))}</button>`).join("")}</div>`;
  const steps = p.evo.filter(e => e.f).map(e => `<div class="step">` +
    `<button type="button" data-go="${esc(e.f)}"><img alt="${esc(nameOf(e.f, e.f))}" src="${SPR(sprOf(e.f))}"></button>` +
    `<div class="how">${esc(it ? e.howIt : e.how)}<b>${esc(nameOf(e.f, e.f))} → ${esc(nameOf(e.s, e.n))}</b></div>` +
    `<button type="button" data-go="${esc(e.s)}"><img alt="${esc(nameOf(e.s, e.n))}" src="${SPR(sprOf(e.s))}"></button></div>`).join("");
  const evoHtml = p.evo.length > 1
    ? famHtml + `<div class="steps">${steps}</div>`
    : `<p class="note" style="margin:0">Questo Pokémon non si evolve.</p>`;

  const locs = (it ? p.locIt : p.loc);
  const locHtml = locs.length
    ? `<ul class="loc">${locs.map(l => `<li><span class="ico">${locIcon(l)}</span><span>${esc(l)}</span></li>`).join("")}</ul>`
    : `<p class="note" style="margin:0">Nessun luogo noto (non ottenibile o solo tramite evento).</p>`;

  const best = p.best.map(b => {
    const m = MOVES[b.m]; if (!m) return "";
    return `<button type="button" class="mv" style="--c:var(--t-${m.type})">` +
      `<span class="n">${esc(L(m))}</span>` +
      `<span class="meta"><span class="why">${WHY[b.why]}</span>${typeBadge(m.type, "sm")}</span>` +
      `<span class="a">${esc(other(m))} · ${CAT[state.lang][m.cat]} · ${m.pow ? "Pot. " + m.pow : "—"} · ${m.acc ? m.acc + "%" : "—"}</span>` +
      `<span class="desc">${esc(it ? (m.dit || m.den || "") : (m.den || ""))}</span></button>`;
  }).join("");

  const max = 200, colors = v => v < 50 ? "#f87171" : v < 80 ? "#fbbf24" : v < 100 ? "#a3e635" : v < 130 ? "#34d399" : "#22d3ee";
  const stats = p.stats.map((v, i) => `<div class="st"><span>${STAT_LABEL[state.lang][i]}</span><b>${v}</b>` +
    `<span class="b"><i style="width:${Math.min(100, v / max * 100)}%;--bc:${colors(v)}"></i></span></div>`).join("") +
    `<div class="st tot"><span>Totale</span><b>${p.bst}</b><span></span></div>`;

  const w = weaknesses(p.types);
  const grp = [[4, "4×"], [2, "2×"], [.5, "½×"], [.25, "¼×"], [0, "0×"]].map(([k, lab]) => {
    const ts = TYPES.filter(t => w[t] === k);
    return ts.length ? `<div class="r"><span>${lab}</span>${ts.map(t => typeBadge(t, "sm")).join("")}</div>` : "";
  }).join("");

  const abil = p.abil.map(a => `<div><b>${esc(L(a))}</b>${a.h ? "<em>Nascosta</em>" : ""}` +
    `<p>${esc(it ? a.dit : a.den)}</p></div>`).join("");

  const artSrc = artMode === "art" ? ART(p.spr) : SPR(p.spr);
  body.innerHTML = `
    <div class="hero" style="--c1:${c1};--c2:${c2}">
      <span class="dexno">${dexNo(p.dex)}</span>
      <button type="button" class="swap" id="swapArt">${artMode === "art" ? "Pixel" : "Artwork"}</button>
      <img class="art ${artMode === "art" ? "" : "pix"}" id="art" alt="${esc(L(p))}" src="${artSrc}">
      <h2>${esc(L(p))}</h2>
      <div class="alt">${esc(other(p) !== L(p) ? other(p) : (it ? "Nome uguale in inglese" : "Same name in Italian"))}</div>
      <div class="types">${p.types.map(t => typeBadge(t)).join("")}</div>
      <div class="acts">
        <button type="button" class="act team ${team.includes(p.id) ? "on" : ""}" data-act="team">${team.includes(p.id) ? "★ In squadra" : "☆ Aggiungi alla squadra"}</button>
        <button type="button" class="act caught ${caught.has(p.id) ? "on" : ""}" data-act="caught">${caught.has(p.id) ? "✓ Catturato" : "○ Catturato"}</button>
      </div>
    </div>
    <section class="sec"><h3>📍 Dove trovarlo <small>(Unbound)</small></h3>${locHtml}</section>
    <section class="sec"><h3>🔁 Evoluzioni</h3>${evoHtml}</section>
    <section class="sec"><h3>⚔️ 4 mosse consigliate</h3><div class="best">${best || '<p class="note">—</p>'}</div>
      <p class="note">Calcolate dal learnset di Unbound: STAB migliori, copertura di tipo e statistiche del Pokémon. Tocca una mossa per la descrizione.</p></section>
    <section class="sec"><h3>📊 Statistiche base</h3><div class="stats">${stats}</div></section>
    <section class="sec"><h3>🛡️ Efficacia dei tipi in difesa</h3><div class="weak">${grp}</div></section>
    <section class="sec"><h3>✨ Abilità</h3><div class="abil">${abil}</div></section>
    <section class="sec"><h3>🥚 Altro</h3><dl class="kv">
      <dt>Gruppi uova</dt><dd>${esc(it ? p.eggIt : p.egg) || "—"}</dd>
      <dt>Strumento</dt><dd>${esc(it ? p.heldIt : p.held) || "—"}</dd></dl></section>
    <section class="sec"><h3>📖 Mosse apprendibili</h3>
      <div class="tabs" id="ltabs">
        ${[["lv", "Livello"], ["tm", "MT/MN"], ["tu", "Tutor"], ["egg", "Uovo"]].map(([k, v]) =>
          `<button type="button" data-k="${k}" class="${k === learnTab ? "on" : ""}">${v} <small>${(p.learn[k] || []).length}</small></button>`).join("")}
      </div>
      <div id="ltable">${learnTable(p)}</div>
    </section>
    <p class="credits">Dati: <a href="https://unboundwiki.com/pokemon/${esc(p.id)}/" target="_blank" rel="noopener">unboundwiki.com</a> · PokeAPI. Pokémon © Nintendo / Game Freak.</p>`;

  const art = $("#art");
  art.onerror = () => { art.onerror = null; art.src = SPR(p.spr); art.classList.add("pix"); };
  $("#swapArt").onclick = () => { artMode = artMode === "art" ? "pix" : "art"; store.set("art", artMode); renderDetail(p, true); };
  body.scrollTop = y;
}

$("#detail").addEventListener("click", e => {
  const act = e.target.closest("[data-act]");
  if (act) { act.dataset.act === "team" ? toggleTeam(current.id) : toggleCaught(current.id); rerender(); return; }
  const rm = e.target.closest("[data-rm]");
  if (rm) { e.stopPropagation(); toggleTeam(rm.dataset.rm); rerender(); return; }
  const go = e.target.closest("[data-go]");
  if (go) { const id = go.dataset.go; if (BY_ID.has(id) && id !== current?.id) openDetail(id); return; }
  if (e.target.closest("[data-addteam]")) { closeAll(); return; }
  const mv = e.target.closest(".mv");
  if (mv) { mv.classList.toggle("open"); return; }
  const tab = e.target.closest("#ltabs button");
  if (tab) {
    learnTab = tab.dataset.k;
    document.querySelectorAll("#ltabs button").forEach(b => b.classList.toggle("on", b === tab));
    $("#ltable").innerHTML = learnTable(current);
  }
});

/* ------------------------------------------------------------------ team & caught */
function toast(msg) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}
function refreshMark(p) {
  cards[p.i].mk.innerHTML = (team.includes(p.id) ? '<span class="t">★</span>' : "") + (caught.has(p.id) ? '<span class="c">✓</span>' : "");
}
function toggleTeam(id) {
  const p = BY_ID.get(id);
  if (team.includes(id)) team = team.filter(x => x !== id);
  else if (team.length >= TEAM_MAX) { toast(`La squadra è piena (max ${TEAM_MAX}). Togline uno prima.`); return; }
  else { team.push(id); toast(`${L(p)} aggiunto alla squadra`); }
  store.set("team", JSON.stringify(team));
  refreshMark(p); renderTeambar();
  if (state.own) apply();
}
function toggleCaught(id) {
  caught.has(id) ? caught.delete(id) : caught.add(id);
  store.set("caught", JSON.stringify([...caught]));
  refreshMark(BY_ID.get(id));
  apply();
}
function renderTeambar() {
  const bar = $("#teambar");
  bar.hidden = !team.length;
  if (!team.length) return;
  const mons = team.map(id => BY_ID.get(id));
  bar.innerHTML = `<span class="lbl">Squadra</span>` + mons.map(p =>
    `<button type="button" class="mon" data-go="${esc(p.id)}" aria-label="${esc(L(p))}" style="--c1:var(--t-${p.types[0]})"><img alt="" src="${SPR(p.spr)}"></button>`).join("") +
    Array.from({ length: TEAM_MAX - team.length }, () => `<span class="mon empty"></span>`).join("") +
    `<button type="button" class="an">Analisi</button>`;
}
function rerender() {
  if (current === "team") renderTeam(true);
  else if (current) renderDetail(current, true);
}

function renderTeam(keepScroll) {
  const body = $("#detail");
  const y = keepScroll && current === "team" ? body.scrollTop : 0;
  current = "team";
  $("#sheetTitle").textContent = `La mia squadra (${team.length}/${TEAM_MAX})`;
  const mons = team.map(id => BY_ID.get(id));
  if (!mons.length) {
    body.innerHTML = `<section class="sec"><h3>★ Squadra vuota</h3><p class="note" style="margin:0">Apri un Pokémon e tocca
      «Aggiungi alla squadra» per averlo sempre a portata di mano nella barra in alto e vedere qui l'analisi della squadra.</p>
      <div class="acts"><button type="button" class="act" data-addteam>Sfoglia i Pokémon</button></div></section>`;
    body.scrollTop = 0; return;
  }
  const grid = `<div class="tgrid">${mons.map(p => `<button type="button" data-go="${esc(p.id)}" style="--c1:var(--t-${p.types[0]})">` +
    `<img alt="" src="${SPR(p.spr)}">${esc(L(p))}<span class="rm" data-rm="${esc(p.id)}">Rimuovi</span></button>`).join("")}</div>`;

  // defence: per attacking type, how many members are weak / resist
  const rows = TYPES.map(t => {
    const ws = mons.map(p => weaknesses(p.types)[t]);
    return { t, weak: ws.filter(x => x > 1).length, res: ws.filter(x => x < 1).length };
  }).sort((a, b) => (b.weak - b.res) - (a.weak - a.res) || b.weak - a.weak);
  const def = `<table class="mx"><tr><th>Attacco di tipo</th><th>Deboli</th><th>Resistono</th></tr>` + rows.map(r =>
    `<tr class="${r.weak >= 2 && r.weak > r.res ? "warn" : ""}"><td>${typeBadge(r.t, "sm")}</td>` +
    `<td class="n ${r.weak ? "bad" : ""}">${r.weak || "–"}</td><td class="n ${r.res ? "ok" : ""}">${r.res || "–"}</td></tr>`).join("") + `</table>`;
  const danger = rows.filter(r => r.weak >= 2 && r.weak > r.res).map(r => typeName(r.t));

  // offence: types hit super-effectively by the recommended attacking moves
  const atkTypes = new Set(mons.flatMap(p => p.best.map(b => MOVES[b.m]).filter(m => m && m.cat !== "Status").map(m => m.type)));
  const hit = TYPES.filter(d => [...atkTypes].some(a => (CHART[a][d] ?? 1) > 1));
  const miss = TYPES.filter(d => !hit.includes(d));
  const cov = `<div class="cov">${TYPES.map(t => typeBadge(t, "sm" + (hit.includes(t) ? "" : " off"))).join("")}</div>` +
    `<p class="note">${miss.length ? `Nessuna mossa consigliata è superefficace contro: <b>${miss.map(typeName).join(", ")}</b>.` : "Copertura completa: colpisci tutti i tipi superefficace!"}</p>`;

  const moves = mons.map(p => `<div class="step" style="grid-template-columns:44px 1fr">` +
    `<button type="button" data-go="${esc(p.id)}"><img alt="" src="${SPR(p.spr)}"></button>` +
    `<div style="display:flex;flex-wrap:wrap;gap:4px">${p.best.map(b => MOVES[b.m]).filter(Boolean).map(m =>
      `<span class="type sm" style="--c:var(--t-${m.type})">${esc(L(m))}</span>`).join("")}</div></div>`).join("");

  body.innerHTML = `
    <section class="sec"><h3>★ Membri <small>tocca per i dettagli</small></h3>${grid}</section>
    <section class="sec"><h3>🛡️ Difesa della squadra</h3>
      ${danger.length ? `<p class="note" style="margin:0 0 10px">⚠️ Punti deboli: <b>${danger.join(", ")}</b> (più membri deboli che resistenti).</p>` : ""}
      ${def}</section>
    <section class="sec"><h3>⚔️ Copertura offensiva</h3>${cov}</section>
    <section class="sec"><h3>📋 Mosse consigliate</h3><div class="steps">${moves}</div></section>`;
  body.scrollTop = y;
}

boot().catch(err => { $("#count").textContent = "Errore nel caricamento dei dati."; console.error(err); });

if ("serviceWorker" in navigator && location.protocol === "https:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
