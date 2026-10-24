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
  lang: store.get("lang", "en"), q: "", types: new Set(), gen: 0, how: "", move: "", sort: "dex",
};
let cards = [], current = null, learnTab = "lv", artMode = store.get("art", "art");

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
  buildChrome();
  buildGrid();
  apply();
  route();
}

function buildChrome() {
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

  const fb = $("#filterBtn");
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
  $("#sheetSearch").addEventListener("click", () => {
    const q = $("#q");
    q.focus({ preventScroll: true }); // inside the tap so iOS opens the keyboard
    closeDetail();
    q.select();
  });
  addEventListener("popstate", route);
}

function resetFilters() {
  state.types.clear(); state.gen = 0; state.how = ""; state.move = ""; state.sort = "dex";
  document.querySelectorAll(".chip.on").forEach(c => c.classList.remove("on"));
  for (const seg of ["#genSeg", "#howSeg"]) [...$(seg).children].forEach((x, i) => x.classList.toggle("on", i === 0));
  $("#moveQ").value = ""; $("#sort").value = "dex";
  apply(true);
}

function toggleLang() {
  state.lang = state.lang === "en" ? "it" : "en";
  store.set("lang", state.lang);
  document.body.dataset.lang = state.lang;
  cards.forEach((c, i) => { c.nm.textContent = L(DEX[i]); c.el.setAttribute("aria-label", L(DEX[i])); });
  document.querySelectorAll(".chip span").forEach(s => { s.textContent = typeName(s.parentNode.dataset.t); });
  if (current) renderDetail(current, true);
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
      `<div class="nm"></div><div class="types">${p.types.map(t => `<span class="dot" style="--c:var(--t-${t})"></span>`).join("")}</div>`;
    const nm = el.querySelector(".nm"); nm.textContent = L(p);
    frag.appendChild(el);
    return { el, nm };
  });
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
    cards[i].el.hidden = !ok;
    if (ok) { shown++; vis.push(p); }
  });
  // reorder only when needed
  const key = { dex: p => p.dex * 10000 + p.i, name: null, bst: p => -p.bst, atk: p => -p.stats[1], spa: p => -p.stats[3], spe: p => -p.stats[5] }[state.sort];
  const order = [...DEX].sort(key ? (a, b) => key(a) - key(b) || a.i - b.i : (a, b) => L(a).localeCompare(L(b)));
  const grid = $("#grid");
  const sig = state.sort + state.lang;
  if (grid.dataset.sig !== sig) { order.forEach(p => grid.appendChild(cards[p.i].el)); grid.dataset.sig = sig; }

  const n = (state.types.size ? 1 : 0) + (state.gen ? 1 : 0) + (state.how ? 1 : 0) + (mv ? 1 : 0) + (state.sort !== "dex" ? 1 : 0);
  const fc = $("#filterCount"); fc.hidden = !n; fc.textContent = n;
  $("#count").textContent = `${shown} Pokémon` + (shown !== DEX.length ? ` su ${DEX.length}` : "");
  $("#empty").hidden = shown > 0;
  if (scroll) {
    const y = $("main").offsetTop - $("#top").offsetHeight;
    if (scrollY > y) scrollTo({ top: Math.max(0, y) });
  }
}

/* ------------------------------------------------------------------ routing */
function openDetail(id) {
  history.pushState({ dex: 1 }, "", "#/p/" + encodeURIComponent(id));
  route();
}
function closeDetail() {
  // entries we pushed can be popped (phone back button works too); a deep link is replaced instead
  if (history.state?.dex) history.back();
  else { history.replaceState(null, "", location.pathname + location.search); route(); }
}
function route() {
  const m = location.hash.match(/^#\/p\/(.+)$/);
  const p = m && BY_ID.get(decodeURIComponent(m[1]));
  const sheet = $("#sheet");
  if (p) {
    renderDetail(p);
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
  const go = e.target.closest("[data-go]");
  if (go) { const id = go.dataset.go; if (BY_ID.has(id) && id !== current?.id) openDetail(id); return; }
  const mv = e.target.closest(".mv");
  if (mv) { mv.classList.toggle("open"); return; }
  const tab = e.target.closest("#ltabs button");
  if (tab) {
    learnTab = tab.dataset.k;
    document.querySelectorAll("#ltabs button").forEach(b => b.classList.toggle("on", b === tab));
    $("#ltable").innerHTML = learnTable(current);
  }
});

boot().catch(err => { $("#count").textContent = "Errore nel caricamento dei dati."; console.error(err); });

if ("serviceWorker" in navigator && location.protocol === "https:") {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
