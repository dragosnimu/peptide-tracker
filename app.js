/* Peptide Tracker: plan editabil, fiole, jurnal, notificari, export. Fara dependente. */
(() => {
"use strict";

/* ---------- utilitare ---------- */
const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, "0");
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return toKey(d); };
const diffDays = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5);
const DAYS = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sb"];
const DAYS_L = ["duminică", "luni", "marți", "miercuri", "joi", "vineri", "sâmbătă"];
const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];
const fmt = k => { const d = fromKey(k); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const fmtL = k => `${DAYS[fromKey(k).getDay()]} ${fmt(k)}`;
const fmtFull = k => { const d = fromKey(k); return `${DAYS_L[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const todayKey = () => toKey(new Date());
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = n => String(Math.round(n * 100) / 100).replace(".", ",");
const fmtU = u => num(Math.round(u * 2) / 2) + " U";
const tl = t => t === "am" ? "dimineața" : "seara";
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };

/* ---------- stare ---------- */
const SK = "peptide-tracker-v1";
const defaultState = () => ({ v: 1, settings: { am: "06:45", pm: "21:00", notif: false }, plan: {}, days: {}, vials: {}, log: [], notified: {} });
let S = load();
function load() { try { const s = JSON.parse(localStorage.getItem(SK)); if (s && s.v) return Object.assign(defaultState(), s); } catch (e) {} return defaultState(); }
let saveTimer = null;
function save() {
  try { localStorage.setItem(SK, JSON.stringify(S)); } catch (e) { toast("Nu am putut salva datele"); }
  clearTimeout(saveTimer); saveTimer = setTimeout(scheduleUpcoming, 300);
}

/* ---------- plan ---------- */
const sub = id => { const b = SUBS.find(s => s.id === id); return Object.assign({}, b, S.plan[id] || {}); };
const allSubs = () => SUBS.map(s => sub(s.id));
function doseLabel(s, mg) {
  if (s.unit === "ml") return num(mg / s.mgPerMl) + " ml";
  if (s.unit === "mcg") return num(mg * 1000) + " mcg";
  return num(mg) + " mg";
}
function conc(s, v) { if (s.ready) return s.vialMg / s.vialMl; const w = (v && v.waterMl) || s.waterMl; return s.vialMg / w; }
const unitsFor = (s, mg, v) => mg / conc(s, v) * 100;
function activeVial(id) { const vs = S.vials[id] || []; return vs.filter(v => !v.discarded).slice(-1)[0] || null; }
const vialExpiry = (s, v) => addDays(v.opened, s.stabilityDays);
const vialDosesLeft = (s, v) => Math.max(0, Math.floor(v.leftMg / s.doseMg + 1e-9));

function scheduled(s, k) {
  if (s.stopped) return null;
  const dayo = S.days[k + "|" + s.id] || null;
  const extra = (s.extra || []).includes(k) || !!(dayo && dayo.extra);
  if (!extra) {
    if (k < s.from || k > s.to) return null;
    if ((s.pauses || []).some(p => k >= p[0] && k <= p[1])) return null;
    if (s.pattern === "dow" && !s.dow.includes(fromKey(k).getDay())) return null;
  }
  let mg = s.doseMg, note = "", kind = "standard";
  const di = diffDays(s.from, k);
  if (s.titration && di >= 0) { let acc = 0; for (const t of s.titration) { acc += t.days; if (di < acc) { mg = t.mg; note = t.note; kind = "titration"; break; } } }
  if (s.test && k === s.from) { mg = s.doseMg / 2; note = s.testNote || "test ½ doză"; kind = "test"; }
  if (dayo && dayo.mg != null) { mg = dayo.mg; note = "doză modificată manual"; kind = "custom"; }
  const v = activeVial(s.id);
  return { sub: s, mg, units: unitsFor(s, mg, v), label: doseLabel(s, mg), note, kind, skipped: !!(dayo && dayo.skip), moved: !!(dayo && dayo.moved), logged: S.log.find(e => e.date === k && e.sub === s.id) || null, vial: v };
}
const dosesOn = k => allSubs().map(s => scheduled(s, k)).filter(Boolean);
const planEnd = () => allSubs().reduce((m, s) => s.to > m ? s.to : m, PLAN_START);
const weekOf = k => Math.floor(diffDays(PLAN_START, k) / 7) + 1;

/* ---------- UI de baza ---------- */
let view = "today", selDay = todayKey();
const main = $("#main");
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function openSheet(html, mount) {
  const host = $("#sheet");
  host.innerHTML = `<div class="sheet-bg" data-act="close-bg"><div class="sheet" role="dialog"><div class="handle"></div>${html}</div></div>`;
  if (mount) mount(host);
}
function closeSheet() { $("#sheet").innerHTML = ""; }

function vialLine(d) {
  const s = d.sub, v = d.vial;
  if (s.ready && !v) return `<div class="vl">Flacon: nedeschis încă. <button class="btn small" data-act="vial-new" data-id="${s.id}">Deschide flacon</button></div>`;
  if (!v) return `<div class="vl" style="color:var(--warn)">Fără fiolă reconstituită. <button class="btn small" data-act="vial-new" data-id="${s.id}">Prepară fiola</button></div>`;
  const exp = vialExpiry(s, v), left = vialDosesLeft(s, v), dl = diffDays(todayKey(), exp);
  let w = "";
  if (dl < 0) w = ` · <span style="color:var(--warn)">expirată de ${-dl} zile</span>`;
  else if (dl <= 2) w = ` · <span style="color:var(--warn)">expiră ${dl === 0 ? "azi" : "în " + dl + " zile"}</span>`;
  else w = ` · expiră ${fmt(exp)}`;
  const lw = left < 1 ? ` <span style="color:var(--warn)">(nu mai ajunge, prepară alta)</span>` : "";
  return `<div class="vl">Fiola #${v.n} · ${num(v.leftMg)} ${s.unit === "ml" ? "mg" : "mg"} rămase ≈ ${left} doze${lw}${w}</div>`;
}
function doseCard(d, k) {
  const s = d.sub;
  const cls = d.logged ? "done" : d.skipped ? "skipped" : "";
  let actions;
  if (d.logged) actions = `<div class="row wrap"><span class="chip ok">administrat ${esc(d.logged.time || "")}</span>${d.logged.feel ? `<span class="feel f${d.logged.feel}">${d.logged.feel}</span>` : ""}<span class="grow"></span><button class="btn small" data-act="log-edit" data-eid="${d.logged.id}">Detalii</button></div>`;
  else if (d.skipped) actions = `<div class="row wrap"><span class="chip">${d.moved ? "mutată pe mâine" : "sărită"}</span><span class="grow"></span><button class="btn small" data-act="unskip" data-id="${s.id}" data-k="${k}">Anulează</button></div>`;
  else actions = `<div class="row wrap"><button class="btn primary small" data-act="log-new" data-id="${s.id}" data-k="${k}">Administrat</button><button class="btn small" data-act="skip" data-id="${s.id}" data-k="${k}">Sari</button><button class="btn small" data-act="move" data-id="${s.id}" data-k="${k}">Mâine</button><span class="grow"></span><button class="btn small" data-act="dose-edit" data-id="${s.id}" data-k="${k}">Doză</button></div>`;
  return `<div class="dose ${cls}">
    <div class="row between"><span class="name">${esc(s.short)}</span><span class="chip ${s.time}">${tl(s.time)}</span></div>
    <div class="row"><span class="u">${fmtU(d.units)}</span><span class="muted">${esc(d.label)} · ${esc(s.route)}</span></div>
    ${d.note ? `<div class="note">${esc(d.note)}</div>` : ""}
    ${vialLine(d)}
    ${actions}
  </div>`;
}
function slotBlock(ds, k) {
  const out = [];
  for (const slot of ["am", "pm"]) {
    const list = ds.filter(d => d.sub.time === slot);
    if (!list.length) continue;
    out.push(`<div class="slot"><span class="dot ${slot}"></span>${tl(slot).charAt(0).toUpperCase() + tl(slot).slice(1)} · ${esc(S.settings[slot])}</div>`);
    out.push(list.map(d => doseCard(d, k)).join(""));
  }
  return out.join("");
}

/* ---------- ecran Azi ---------- */
function alertsFor(k) {
  const a = [];
  const ds = dosesOn(k).filter(d => !d.skipped);
  for (const d of ds) {
    const s = d.sub, v = d.vial;
    if (d.logged) continue;
    if (!v) a.push(`<div class="alert"><b>${esc(s.short)}: ${s.ready ? "deschide flaconul" : "prepară o fiolă"} înainte de administrare</b>Ghidul pas cu pas e în butonul „${s.ready ? "Deschide flacon" : "Prepară fiola"}”.</div>`);
    else {
      const dl = diffDays(k, vialExpiry(s, v));
      if (dl < 0) a.push(`<div class="alert"><b>${esc(s.short)}: fiola #${v.n} a expirat</b>Aruncă și prepară alta. ${esc(s.stab)}</div>`);
      else if (v.leftMg + 1e-9 < d.mg) a.push(`<div class="alert"><b>${esc(s.short)}: fiola #${v.n} nu mai ajunge pentru doza de azi</b>Prepară o fiolă nouă.</div>`);
      else if (dl <= 1) a.push(`<div class="alert info"><b>${esc(s.short)}: fiola #${v.n} expiră ${dl === 0 ? "azi" : "mâine"}</b>Pregătește următoarea.</div>`);
    }
  }
  const news = allSubs().filter(s => s.from === k && !s.stopped);
  for (const s of news) a.push(`<div class="alert info"><b>Azi intră ${esc(s.short)}</b>${s.test ? "Prima doză este la jumătate, ca test de tolerabilitate. " : ""}${esc(s.cycle)}.</div>`);
  if (EVENTS[k]) a.push(`<div class="alert info"><b>${esc(fmtL(k))}</b>${esc(EVENTS[k])}</div>`);
  return a.join("");
}
function renderToday() {
  const k = todayKey();
  const ds = dosesOn(k);
  const w = weekOf(k);
  $("#title").textContent = "Azi";
  $("#subtitle").textContent = `${fmtFull(k)}${w >= 1 && w <= PLAN_WEEKS ? ` · săptămâna ${w} din ${PLAN_WEEKS}` : ""}`;
  let h = alertsFor(k);
  if (!ds.length) h += `<div class="card"><h2>Nicio administrare azi</h2><p class="muted">${k < PLAN_START ? "Planul începe pe " + fmtL(PLAN_START) + "." : k > planEnd() ? "Planul s-a încheiat. Washout înainte de un al doilea ciclu." : "Zi liberă în calendar."}</p></div>`;
  else h += slotBlock(ds, k);
  const nxt = nextDay(addDays(k, 1));
  if (nxt) h += `<div class="card"><h3>Următoarea zi cu administrări: ${esc(fmtL(nxt.k))}</h3><p class="muted">${nxt.ds.map(d => `${esc(d.sub.short)} ${fmtU(d.units)}`).join(" · ")}</p></div>`;
  h += `<p class="tiny" style="text-align:center">v${APP_VERSION} · ${fmtL(APP_DATE)}</p>`;
  main.innerHTML = `<div class="view">${h}</div>`;
}
function nextDay(k) { const end = planEnd(); for (let i = 0; i < 60 && k <= end; i++, k = addDays(k, 1)) { const ds = dosesOn(k).filter(d => !d.skipped); if (ds.length) return { k, ds }; } return null; }

/* ---------- ecran Calendar ---------- */
function renderCal() {
  const w = Math.floor(diffDays(PLAN_START, selDay) / 7);
  const ws = addDays(PLAN_START, w * 7);
  $("#title").textContent = "Calendar";
  $("#subtitle").textContent = `Săptămâna ${w + 1}${w + 1 <= PLAN_WEEKS ? " din " + PLAN_WEEKS : ""} · ${fmt(ws)} – ${fmt(addDays(ws, 6))}`;
  const intro = allSubs().filter(s => !s.stopped && s.from >= ws && s.from <= addDays(ws, 6)).map(s => s.short);
  let days = "";
  for (let i = 0; i < 7; i++) {
    const k = addDays(ws, i), n = dosesOn(k).filter(d => !d.skipped).length;
    days += `<button class="day ${k === selDay ? "sel" : ""} ${k === todayKey() ? "today" : ""}" data-act="sel-day" data-k="${k}">${DAYS[fromKey(k).getDay()]}<b>${fromKey(k).getDate()}</b><span class="n ${n ? "" : "z"}">${n || "–"}</span></button>`;
  }
  const ds = dosesOn(selDay);
  let h = `<div class="card flat stack">
    <div class="weeknav"><button class="btn small" data-act="week" data-n="-1">←</button><div class="t">${intro.length ? "Intră: " + esc(intro.join(" + ")) : "Continuă ciclurile active"}<small>${fmt(ws)} – ${fmt(addDays(ws, 6))}</small></div><button class="btn small" data-act="week" data-n="1">→</button></div>
    <div class="days">${days}</div>
    <div class="row between"><h2>${esc(fmtFull(selDay))}</h2><button class="btn small" data-act="sel-day" data-k="${todayKey()}">Azi</button></div>
    ${EVENTS[selDay] ? `<div class="alert info">${esc(EVENTS[selDay])}</div>` : ""}
    ${ds.length ? slotBlock(ds, selDay) : `<p class="muted">Nicio administrare în această zi.</p>`}
  </div>`;
  h += `<div class="card"><h2>Ansamblu pe ${PLAN_WEEKS} săptămâni</h2><p class="tiny" style="margin-bottom:8px">Bară plină = zilnic, estompată = 2-3x/săpt., punctată = pauză. Culoarea = momentul zilei.</p>${gantt()}</div>`;
  h += `<div class="card"><h2>Editează planul</h2><div class="stack">${allSubs().map(s => `<div class="row between"><div class="grow"><b>${esc(s.short)}</b> <span class="tiny">${s.stopped ? "oprit" : fmt(s.from) + " – " + fmt(s.to) + " · " + tl(s.time) + " · " + doseLabel(s, s.doseMg) + " = " + fmtU(unitsFor(s, s.doseMg, activeVial(s.id)))}</span>${S.plan[s.id] ? ' <span class="chip acc">modificat</span>' : ""}</div><button class="btn small" data-act="plan-edit" data-id="${s.id}">Editează</button></div>`).join("")}</div></div>`;
  main.innerHTML = `<div class="view">${h}</div>`;
}
function gantt() {
  const cur = weekOf(todayKey());
  let g = `<div class="n h">Substanța</div>`;
  for (let w = 1; w <= PLAN_WEEKS; w++) g += `<div class="h ${w === cur ? "cur" : ""}">${w}</div>`;
  for (const s of allSubs()) {
    g += `<div class="n">${esc(s.short)}</div>`;
    for (let w = 1; w <= PLAN_WEEKS; w++) {
      const ws = addDays(PLAN_START, (w - 1) * 7), we = addDays(ws, 6);
      let any = false; for (let i = 0; i < 7; i++) if (scheduled(s, addDays(ws, i))) { any = true; break; }
      const paused = (s.pauses || []).some(p => p[0] <= we && p[1] >= ws) && !s.stopped;
      g += `<div class="b">${any ? `<div class="bar ${s.time} ${s.pattern === "dow" ? "part" : ""}"></div>` : paused ? `<div class="bar off"></div>` : ""}</div>`;
    }
  }
  return `<div class="gantt"><div class="g">${g}</div></div>`;
}

/* ---------- ecran Fiole ---------- */
function renderVials() {
  $("#title").textContent = "Fiole";
  $("#subtitle").textContent = "Reconstituire, stabilitate, stoc";
  const k = todayKey();
  const list = allSubs().slice().sort((a, b) => a.from.localeCompare(b.from));
  let h = "";
  for (const s of list) {
    const vs = S.vials[s.id] || [], v = activeVial(s.id), used = vs.length, left = s.stock - used;
    const active = scheduled(s, k) || (s.from <= addDays(k, 7) && s.to >= k && !s.stopped);
    let body;
    if (v) {
      const exp = vialExpiry(s, v), dl = diffDays(k, exp), pct = Math.max(0, Math.min(100, v.leftMg / s.vialMg * 100));
      body = `<div class="stockrow"><span>Fiola #${v.n}, ${s.ready ? "deschisă" : "reconstituită"} ${fmtL(v.opened)}${s.ready ? "" : " cu " + num(v.waterMl) + " ml apă"}</span><span class="mono">${num(conc(s, v))} mg/ml</span></div>
        <div class="meter"><i class="${pct < 20 ? "low" : ""}" style="width:${pct}%"></i></div>
        <div class="stockrow"><span>${num(v.leftMg)} mg rămase ≈ <b>${vialDosesLeft(s, v)} doze</b> de ${esc(doseLabel(s, s.doseMg))}</span><span class="mono" style="color:${dl < 0 ? "var(--warn)" : dl <= 2 ? "var(--am)" : "inherit"}">${dl < 0 ? "expirată" : dl === 0 ? "expiră azi" : "expiră " + fmt(exp)}</span></div>
        <div class="stockrow"><span>Doza standard cu această fiolă</span><span class="mono"><b>${fmtU(unitsFor(s, s.doseMg, v))}</b></span></div>
        <div class="row wrap"><button class="btn small" data-act="vial-new" data-id="${s.id}">Fiolă nouă</button><button class="btn small danger" data-act="vial-discard" data-id="${s.id}">Aruncă fiola #${v.n}</button></div>`;
    } else {
      body = `<p class="muted">${s.ready ? "Niciun flacon deschis." : "Nicio fiolă reconstituită."} ${active ? "Este nevoie de una pentru administrările din perioada aceasta." : ""}</p>
        <div class="row"><button class="btn ${active ? "primary" : ""} small" data-act="vial-new" data-id="${s.id}">${s.ready ? "Deschide flacon" : "Prepară fiola"} (ghid pas cu pas)</button></div>`;
    }
    h += `<div class="vial"><div class="row between"><span class="name">${esc(s.name)}</span><span class="chip ${left <= 0 ? "warn" : ""}">${used} / ${s.stock} folosite</span></div>
      <div class="tiny">${esc(s.cycle)} · ${esc(s.stab)}</div>${body}
      ${vs.length > 1 ? `<details><summary class="tiny">Istoric fiole (${vs.length})</summary><div class="tiny">${vs.map(x => `#${x.n}: ${fmtL(x.opened)}${x.discarded ? ", aruncată" : ""}, ${num(x.leftMg)} mg rămase`).join("<br>")}</div></details>` : ""}
    </div>`;
  }
  main.innerHTML = `<div class="view">${h}</div>`;
}
function vialSheet(id) {
  const s = sub(id), v = activeVial(id);
  const vs = S.vials[id] || [], n = vs.length + 1;
  const stepsHtml = `<ol class="steps">${s.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>`;
  const html = `<h2>${s.ready ? "Deschide flacon" : "Prepară fiola"} #${n}: ${esc(s.name)}</h2>
    <p class="muted">${esc(s.what)}</p>
    ${v ? `<div class="alert"><b>Fiola #${v.n} este încă activă</b> (${num(v.leftMg)} mg rămase). Va fi marcată ca aruncată.</div>` : ""}
    ${vs.length >= s.stock ? `<div class="alert"><b>Stocul de ${s.stock} fiole este consumat</b>Continuă doar dacă ai o comandă nouă.</div>` : ""}
    ${stepsHtml}
    <div class="stack">
      <label class="f">Data ${s.ready ? "deschiderii" : "reconstituirii"}<input type="date" id="v-date" value="${todayKey()}"></label>
      ${s.ready ? "" : `<label class="f">Apă bacteriostatică adăugată (ml)<input type="number" id="v-water" step="0.5" min="0.5" value="${s.waterMl}"></label>`}
      <div class="alert info" id="v-calc"></div>
    </div>
    ${s.flag ? `<div class="alert"><b>De reținut</b>${esc(s.flag)}</div>` : ""}
    <div class="row"><button class="btn primary grow" data-act="vial-save" data-id="${id}">Am ${s.ready ? "deschis flaconul" : "reconstituit fiola"}</button><button class="btn" data-act="close">Anulează</button></div>`;
  openSheet(html, host => {
    const calc = () => {
      const w = s.ready ? 0 : parseFloat(host.querySelector("#v-water").value) || s.waterMl;
      const c = s.ready ? s.vialMg / s.vialMl : s.vialMg / w;
      const u = s.doseMg / c * 100;
      const half = s.doseMg / 2 / c * 100;
      let t = `<b>Cu ${s.ready ? num(s.vialMl) + " ml" : num(w) + " ml apă"}: ${num(c)} mg/ml</b>Doza standard ${esc(doseLabel(s, s.doseMg))} = <b>${fmtU(u)}</b>. Doza de test (½) = ${fmtU(half)}. Fiola conține ${Math.floor(s.vialMg / s.doseMg)} doze standard.`;
      if (s.titration) t += `<br>Titrare: ` + s.titration.map(x => `${x.mg} mg = ${fmtU(x.mg / c * 100)}`).join(" · ") + `.`;
      if (u > 100) t += `<br><span style="color:var(--warn)">Doza depășește o seringă de 1 ml: două seringi sau mai puțină apă.</span>`;
      host.querySelector("#v-calc").innerHTML = t;
    };
    calc();
    const wi = host.querySelector("#v-water"); if (wi) wi.addEventListener("input", calc);
  });
}

/* ---------- ecran Jurnal ---------- */
let logFilter = "";
function renderLog() {
  $("#title").textContent = "Jurnal";
  const entries = S.log.slice().sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));
  const last7 = entries.filter(e => e.feel && diffDays(e.date, todayKey()) <= 7);
  const avg = last7.length ? (last7.reduce((a, e) => a + e.feel, 0) / last7.length) : null;
  $("#subtitle").textContent = `${S.log.length} administrări înregistrate${avg ? ` · stare medie 7 zile: ${num(avg)}/5` : ""}`;
  const list = entries.filter(e => !logFilter || e.sub === logFilter);
  let h = `<div class="card flat"><label class="f">Filtrează<select id="log-filter"><option value="">Toate substanțele</option>${SUBS.map(s => `<option value="${s.id}" ${logFilter === s.id ? "selected" : ""}>${esc(s.short)}</option>`).join("")}</select></label></div>`;
  h += `<div class="card">${list.length ? list.map(e => {
    const s = sub(e.sub);
    return `<div class="entry"><div class="h"><span>${esc(s.short)} · ${esc(e.label)} = ${fmtU(e.units)}</span><span>${fmtL(e.date)} ${esc(e.time || "")}</span></div>
      <div class="m row wrap">${e.feel ? `<span class="feel f${e.feel}">${e.feel}</span>` : ""}<span>${esc(e.site || "")}</span>${(e.symptoms || []).map(x => `<span class="chip">${esc(x)}</span>`).join("")}</div>
      ${e.comment ? `<div class="m">${esc(e.comment)}</div>` : ""}
      <div class="row"><button class="btn small" data-act="log-edit" data-eid="${e.id}">Editează</button></div></div>`;
  }).join("") : `<p class="muted">Nicio înregistrare${logFilter ? " pentru această substanță" : ""}.</p>`}</div>`;
  main.innerHTML = `<div class="view">${h}</div>`;
  $("#log-filter").addEventListener("change", e => { logFilter = e.target.value; renderLog(); });
}
function suggestSite() {
  const last = S.log.slice().sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")))[0];
  if (!last || !last.site) return SITES[0];
  const i = SITES.indexOf(last.site); return SITES[(i + 1) % SITES.length];
}
function logSheet(id, k, entry) {
  const s = sub(id);
  const d = entry ? null : scheduled(s, k);
  const e = entry || { id: Date.now(), date: k, time: nowHM(), sub: id, mg: d.mg, units: d.units, label: d.label, site: suggestSite(), feel: 0, symptoms: [], comment: "" };
  const html = `<h2>${entry ? "Administrare" : "Administrat"}: ${esc(s.short)}</h2>
    <div class="row"><span class="u mono" style="font-size:22px;font-weight:700">${fmtU(e.units)}</span><span class="muted">${esc(e.label)} · ${esc(s.route)} · ${esc(fmtL(e.date))}</span></div>
    ${!entry && d && !d.vial ? `<div class="alert"><b>Nu ai o fiolă activă pentru ${esc(s.short)}</b>Poți salva oricum, dar stocul din fiolă nu va fi scăzut.</div>` : ""}
    <div class="stack">
      <label class="f">Ora<input type="time" id="l-time" value="${esc(e.time)}"></label>
      <label class="f">Locul injecției<select id="l-site">${SITES.map(x => `<option ${x === e.site ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <div><div class="tiny" style="margin-bottom:4px">Cum te simți (1 = rău, 5 = foarte bine)</div><div class="scale" id="l-feel">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="${e.feel === i ? "on" : ""}" data-f="${i}">${i}</button>`).join("")}</div><div class="scale-l"><span>rău</span><span>foarte bine</span></div></div>
      <div><div class="tiny" style="margin-bottom:6px">Simptome / observații</div><div class="chips" id="l-sym">${SYMPTOMS.map(x => `<button type="button" class="tog ${(e.symptoms || []).includes(x) ? "on" : ""}" data-s="${esc(x)}">${esc(x)}</button>`).join("")}</div></div>
      <label class="f">Comentariu<textarea id="l-comment" placeholder="ex. ușoară usturime 2 min, apoi nimic">${esc(e.comment)}</textarea></label>
    </div>
    <div class="row"><button class="btn primary grow" data-act="log-save" data-eid="${e.id}" data-id="${id}" data-k="${e.date}" data-new="${entry ? "" : "1"}">Salvează</button>${entry ? `<button class="btn danger" data-act="log-delete" data-eid="${e.id}">Șterge</button>` : ""}<button class="btn" data-act="close">Anulează</button></div>`;
  openSheet(html, host => {
    host.__draft = { mg: e.mg, units: e.units, label: e.label, feel: e.feel, symptoms: (e.symptoms || []).slice() };
    host.querySelector("#l-feel").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; host.__draft.feel = +b.dataset.f; host.querySelectorAll("#l-feel button").forEach(x => x.classList.toggle("on", x === b)); });
    host.querySelector("#l-sym").addEventListener("click", ev => { const b = ev.target.closest("button"); if (!b) return; b.classList.toggle("on"); const v = b.dataset.s; const i = host.__draft.symptoms.indexOf(v); if (i >= 0) host.__draft.symptoms.splice(i, 1); else host.__draft.symptoms.push(v); });
  });
}

/* ---------- editare plan si doza ---------- */
function planSheet(id) {
  const s = sub(id);
  const dv = s.unit === "ml" ? s.doseMg / s.mgPerMl : s.unit === "mcg" ? s.doseMg * 1000 : s.doseMg;
  const html = `<h2>Plan: ${esc(s.name)}</h2>
    <p class="muted">${esc(s.cycle)}. Modificările se aplică de acum înainte; administrările deja înregistrate rămân.</p>
    <div class="stack">
      <label class="check"><input type="checkbox" id="p-stopped" ${s.stopped ? "checked" : ""}> Oprit (nu mai apare în calendar)</label>
      <label class="f">Începe<input type="date" id="p-from" value="${s.from}"></label>
      <label class="check"><input type="checkbox" id="p-shift" checked> Când mut startul, mută și sfârșitul și pauzele cu același număr de zile</label>
      <label class="f">Se termină<input type="date" id="p-to" value="${s.to}"></label>
      <label class="f">Moment<select id="p-time"><option value="am" ${s.time === "am" ? "selected" : ""}>dimineața</option><option value="pm" ${s.time === "pm" ? "selected" : ""}>seara</option></select></label>
      <label class="f">Frecvență<select id="p-pattern"><option value="daily" ${s.pattern === "daily" ? "selected" : ""}>zilnic</option><option value="dow" ${s.pattern === "dow" ? "selected" : ""}>anumite zile</option></select></label>
      <div id="p-dow" class="chips ${s.pattern === "dow" ? "" : "hide"}">${[1, 2, 3, 4, 5, 6, 0].map(i => `<button type="button" class="tog ${(s.dow || []).includes(i) ? "on" : ""}" data-d="${i}">${DAYS[i]}</button>`).join("")}</div>
      <label class="f">Doză standard (${s.unit})<input type="number" id="p-dose" step="any" min="0" value="${num(dv).replace(",", ".")}"></label>
      <div class="alert info" id="p-calc"></div>
    </div>
    <div class="row"><button class="btn primary grow" data-act="plan-save" data-id="${id}">Salvează</button>${S.plan[id] ? `<button class="btn" data-act="plan-reset" data-id="${id}">Resetează</button>` : ""}<button class="btn" data-act="close">Anulează</button></div>`;
  openSheet(html, host => {
    host.querySelector("#p-pattern").addEventListener("change", ev => host.querySelector("#p-dow").classList.toggle("hide", ev.target.value !== "dow"));
    host.querySelector("#p-dow").addEventListener("click", ev => { const b = ev.target.closest("button"); if (b) b.classList.toggle("on"); });
    const calc = () => { const mg = toMg(s, parseFloat(host.querySelector("#p-dose").value) || 0); host.querySelector("#p-calc").innerHTML = `<b>${esc(doseLabel(s, mg))} = ${fmtU(unitsFor(s, mg, activeVial(id)))}</b> cu fiola ${activeVial(id) ? "activă" : "reconstituită standard (" + num(s.waterMl || s.vialMl) + " ml)"}`; };
    host.querySelector("#p-dose").addEventListener("input", calc); calc();
    host.querySelector("#p-from").addEventListener("change", ev => { if (host.querySelector("#p-shift").checked) { const delta = diffDays(s.from, ev.target.value); host.querySelector("#p-to").value = addDays(s.to, delta); } });
  });
}
const toMg = (s, v) => s.unit === "ml" ? v * s.mgPerMl : s.unit === "mcg" ? v / 1000 : v;
function doseSheet(id, k) {
  const s = sub(id), d = scheduled(s, k);
  const dv = s.unit === "ml" ? d.mg / s.mgPerMl : s.unit === "mcg" ? d.mg * 1000 : d.mg;
  openSheet(`<h2>Doza pentru ${esc(fmtL(k))}: ${esc(s.short)}</h2><p class="muted">Doar pentru această zi. Doza planificată: ${esc(doseLabel(s, s.doseMg))}.</p>
    <div class="stack"><label class="f">Doză (${s.unit})<input type="number" id="d-dose" step="any" min="0" value="${num(dv).replace(",", ".")}"></label><div class="alert info" id="d-calc"></div></div>
    <div class="row"><button class="btn primary grow" data-act="dose-save" data-id="${id}" data-k="${k}">Salvează</button><button class="btn" data-act="dose-reset" data-id="${id}" data-k="${k}">Doza din plan</button><button class="btn" data-act="close">Anulează</button></div>`, host => {
    const calc = () => { const mg = toMg(s, parseFloat(host.querySelector("#d-dose").value) || 0); host.querySelector("#d-calc").innerHTML = `<b>${esc(doseLabel(s, mg))} = ${fmtU(unitsFor(s, mg, activeVial(id)))}</b>`; };
    host.querySelector("#d-dose").addEventListener("input", calc); calc();
  });
}

/* ---------- ecran Setari ---------- */
function renderSettings() {
  $("#title").textContent = "Setări";
  $("#subtitle").textContent = "Remindere, notificări, backup";
  const perm = ("Notification" in window) ? Notification.permission : "unsupported";
  const h = `<div class="card stack"><h2>Remindere</h2>
      <label class="f">Dimineața<input type="time" id="s-am" value="${esc(S.settings.am)}"></label>
      <label class="f">Seara<input type="time" id="s-pm" value="${esc(S.settings.pm)}"></label>
      <button class="btn" data-act="settings-save">Salvează orele</button></div>
    <div class="card stack"><h2>Notificări</h2>
      <p class="muted">Stare: <b>${perm === "granted" ? "permise" : perm === "denied" ? "blocate din setările telefonului" : perm === "unsupported" ? "browserul nu le suportă" : "neactivate"}</b>. Notificările din aplicație apar când aplicația e deschisă sau când Android o trezește în fundal (Chrome, aplicație instalată). Pentru alarme garantate, importă calendarul .ics în Google Calendar.</p>
      <div class="row wrap"><button class="btn primary" data-act="notif-enable" ${perm === "granted" ? "disabled" : ""}>Activează notificările</button><button class="btn" data-act="notif-test" ${perm !== "granted" ? "disabled" : ""}>Notificare de test</button><button class="btn" data-act="notif-now" ${perm !== "granted" ? "disabled" : ""}>Trimite reminderul de azi</button></div>
      <p class="tiny" id="s-sync"></p></div>
    <div class="card stack"><h2>Calendar telefon</h2>
      <p class="muted">Un eveniment cu alarmă pentru fiecare sesiune (dimineața și seara), cu substanțele, doza și unitățile în titlu. Importă fișierul în Google Calendar.</p>
      <button class="btn" data-act="ics">Exportă calendar (.ics)</button></div>
    <div class="card stack"><h2>Backup</h2>
      <p class="muted">Datele stau doar în acest browser. Exportă periodic și păstrează fișierul în Drive sau OneDrive.</p>
      <div class="row wrap"><button class="btn" data-act="export">Exportă datele (JSON)</button><label class="btn" style="display:inline-flex;align-items:center">Importă JSON<input type="file" id="s-import" accept="application/json" class="hide"></label></div></div>
    <div class="card stack"><h2>Resetare</h2>
      <div class="row wrap"><button class="btn" data-act="plan-reset-all">Resetează planul la cel inițial</button><button class="btn danger" data-act="wipe">Șterge toate datele</button></div></div>
    <div class="card stack"><h2>Versiune</h2><p>Peptide Tracker <b class="mono">v${APP_VERSION}</b> · ${fmtL(APP_DATE)} ${fromKey(APP_DATE).getFullYear()}</p><p class="tiny" id="s-upd">${navigator.serviceWorker && navigator.serviceWorker.controller ? "Rulează din cache offline; actualizările se descarcă automat la deschidere." : "Prima încărcare."}</p><div class="row wrap"><button class="btn" data-act="update-check">Caută versiune nouă</button><button class="btn" data-act="reload">Reîncarcă aplicația</button></div></div>
    <div class="card"><p class="tiny">Peptide Tracker · plan din fișa furnizorului MKM și raportul de analiză (19 aug 2026). Nu este recomandare medicală. Dozele sunt cele raportate în literatură și comunitate, nevalidate clinic.</p></div>`;
  main.innerHTML = `<div class="view">${h}</div>`;
  $("#s-import").addEventListener("change", importJSON);
  navigator.serviceWorker?.ready.then(r => { $("#s-sync") && ($("#s-sync").textContent = ("periodicSync" in r) ? "Verificare periodică în fundal: suportată de acest browser." : "Verificare periodică în fundal: nesuportată; notificările apar doar cu aplicația deschisă."); });
}

/* ---------- notificari ---------- */
function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: title + body.slice(0, 20), requireInteraction: true };
  if (navigator.serviceWorker) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => { try { new Notification(title, opts); } catch (e) {} });
  else { try { new Notification(title, opts); } catch (e) {} }
}
function checkDueNow(force) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const k = todayKey(), hm = nowHM();
  let changed = false;
  for (const slot of ["am", "pm"]) {
    if (!force && hm < S.settings[slot]) continue;
    const key = k + "|" + slot; if (S.notified[key] && !force) continue;
    const ds = dosesOn(k).filter(d => d.sub.time === slot && !d.logged && !d.skipped);
    if (!ds.length) continue;
    S.notified[key] = 1; changed = true;
    notify(`Administrare ${tl(slot)}`, ds.map(d => `${d.sub.short} ${d.label} = ${fmtU(d.units)}`).join(", "));
  }
  for (const key in S.notified) if (diffDays(key.slice(0, 10), k) > 7) { delete S.notified[key]; changed = true; }
  if (changed) save();
}
/* IndexedDB pentru service worker */
function idb() { return new Promise((res, rej) => { if (!("indexedDB" in window)) return rej(); const r = indexedDB.open("peptide-tracker", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function kvSet(k, v) { try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction("kv", "readwrite").objectStore("kv").put(v, k); t.onsuccess = res; t.onerror = rej; }); } catch (e) {} }
async function scheduleUpcoming() {
  const list = [];
  let k = todayKey();
  for (let i = 0; i < 14; i++, k = addDays(k, 1)) for (const slot of ["am", "pm"]) {
    const ds = dosesOn(k).filter(d => d.sub.time === slot && !d.skipped);
    if (!ds.length || ds.every(d => d.logged)) continue;
    const [h, m] = S.settings[slot].split(":").map(Number);
    const dt = fromKey(k); dt.setHours(h, m, 0, 0);
    list.push({ key: k + "|" + slot, ts: dt.getTime(), title: `Administrare ${tl(slot)}`, body: ds.filter(d => !d.logged).map(d => `${d.sub.short} ${d.label} = ${fmtU(d.units)}`).join(", ") });
  }
  await kvSet("upcoming", list);
}
async function enableNotifications() {
  if (!("Notification" in window)) return toast("Browserul nu suportă notificări");
  const p = await Notification.requestPermission();
  S.settings.notif = p === "granted"; save();
  if (p === "granted") {
    toast("Notificări activate");
    S.notified = {}; save(); setTimeout(() => checkDueNow(true), 500);
    try {
      const reg = await navigator.serviceWorker.ready;
      if ("periodicSync" in reg) { const st = await navigator.permissions.query({ name: "periodic-background-sync" }); if (st.state === "granted") await reg.periodicSync.register("check-doses", { minInterval: 15 * 60 * 1000 }); }
    } catch (e) {}
  } else toast("Permisiunea nu a fost acordată");
  render();
}

/* ---------- export / import ---------- */
function download(name, content, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
const icsText = s => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const icsFold = l => { const out = []; while (l.length > 73) { out.push(l.slice(0, 73)); l = " " + l.slice(73); } out.push(l); return out.join("\r\n"); };
function buildICS() {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Peptide Tracker//RO", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Peptide"];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const end = planEnd();
  for (let k = PLAN_START; k <= end; k = addDays(k, 1)) for (const slot of ["am", "pm"]) {
    const ds = dosesOn(k).filter(d => d.sub.time === slot && !d.skipped);
    if (!ds.length) continue;
    const [h, m] = S.settings[slot].split(":");
    const dt = k.replace(/-/g, "") + "T" + h + m + "00";
    const summary = `Peptide ${tl(slot)}: ` + ds.map(d => `${d.sub.short} ${fmtU(d.units)}`).join(", ");
    const desc = ds.map(d => `${d.sub.short}: ${d.label} = ${fmtU(d.units)}, ${d.sub.route}${d.note ? " (" + d.note + ")" : ""}`).join("\n") + (EVENTS[k] ? "\n\n" + EVENTS[k] : "");
    L.push("BEGIN:VEVENT", `UID:${k}-${slot}@peptide-tracker`, `DTSTAMP:${stamp}`, `DTSTART:${dt}`, "DURATION:PT15M", icsFold("SUMMARY:" + icsText(summary)), icsFold("DESCRIPTION:" + icsText(desc)), "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:PT0M", icsFold("DESCRIPTION:" + icsText(summary)), "END:VALARM", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}
function importJSON(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { const s = JSON.parse(r.result); if (!s || !s.v || !Array.isArray(s.log)) throw 0; if (!confirm(`Import: ${s.log.length} administrări, ${Object.keys(s.vials || {}).length} substanțe cu fiole. Datele curente vor fi înlocuite.`)) return; S = Object.assign(defaultState(), s); save(); toast("Date importate"); render(); } catch (e) { toast("Fișier invalid"); } };
  r.readAsText(f);
}

/* ---------- actiuni ---------- */
const A = {
  "close": closeSheet,
  "close-bg": (d, el, e) => { if (e.target === el) closeSheet(); },
  "sel-day": d => { selDay = d.k; render(); },
  "week": d => { selDay = addDays(selDay, 7 * +d.n); render(); },
  "vial-new": d => vialSheet(d.id),
  "vial-save": (d, el) => {
    const s = sub(d.id), host = $("#sheet");
    const opened = host.querySelector("#v-date").value || todayKey();
    const wi = host.querySelector("#v-water"); const waterMl = s.ready ? s.vialMl : (parseFloat(wi.value) || s.waterMl);
    const vs = S.vials[d.id] = S.vials[d.id] || [];
    vs.forEach(v => { if (!v.discarded) v.discarded = true; });
    vs.push({ n: vs.length + 1, opened, waterMl, leftMg: s.vialMg, discarded: false });
    save(); closeSheet(); toast(`Fiola #${vs.length} ${s.ready ? "deschisă" : "reconstituită"}: ${fmtU(unitsFor(s, s.doseMg, vs[vs.length - 1]))} per doză`); render();
  },
  "vial-discard": d => { const v = activeVial(d.id); if (v && confirm(`Arunci fiola #${v.n} de ${sub(d.id).short}?`)) { v.discarded = true; save(); render(); } },
  "log-new": d => logSheet(d.id, d.k, null),
  "log-edit": d => { const e = S.log.find(x => x.id === +d.eid); if (e) logSheet(e.sub, e.date, e); },
  "log-save": d => {
    const host = $("#sheet"), dr = host.__draft;
    const time = host.querySelector("#l-time").value, site = host.querySelector("#l-site").value, comment = host.querySelector("#l-comment").value.trim();
    if (d.new) {
      const s = sub(d.id), v = activeVial(d.id);
      S.log.push({ id: +d.eid, date: d.k, time, sub: d.id, mg: dr.mg, units: dr.units, label: dr.label, site, feel: dr.feel, symptoms: dr.symptoms, comment, vial: v ? v.n : null });
      if (v) v.leftMg = Math.max(0, Math.round((v.leftMg - dr.mg) * 1000) / 1000);
      const dk = S.days[d.k + "|" + d.id]; if (dk && dk.skip) { delete dk.skip; delete dk.moved; }
      toast(`${s.short} înregistrat`);
    } else {
      const e = S.log.find(x => x.id === +d.eid); Object.assign(e, { time, site, feel: dr.feel, symptoms: dr.symptoms, comment }); toast("Actualizat");
    }
    save(); closeSheet(); render();
  },
  "log-delete": d => {
    const i = S.log.findIndex(x => x.id === +d.eid); if (i < 0 || !confirm("Ștergi această înregistrare?")) return;
    const e = S.log[i]; const vs = S.vials[e.sub] || []; const v = vs.find(x => x.n === e.vial); if (v) v.leftMg = Math.min(sub(e.sub).vialMg, v.leftMg + e.mg);
    S.log.splice(i, 1); save(); closeSheet(); render();
  },
  "skip": d => { S.days[d.k + "|" + d.id] = Object.assign(S.days[d.k + "|" + d.id] || {}, { skip: true }); save(); render(); },
  "move": d => {
    const t = addDays(d.k, 1);
    S.days[d.k + "|" + d.id] = Object.assign(S.days[d.k + "|" + d.id] || {}, { skip: true, moved: true });
    S.days[t + "|" + d.id] = Object.assign(S.days[t + "|" + d.id] || {}, { extra: true });
    save(); toast(`${sub(d.id).short} mutat pe ${fmtL(t)}`); render();
  },
  "unskip": d => { const o = S.days[d.k + "|" + d.id]; if (o) { if (o.moved) { const t = d.k && addDays(d.k, 1); const ot = S.days[t + "|" + d.id]; if (ot) { delete ot.extra; if (!Object.keys(ot).length) delete S.days[t + "|" + d.id]; } } delete o.skip; delete o.moved; if (!Object.keys(o).length) delete S.days[d.k + "|" + d.id]; } save(); render(); },
  "dose-edit": d => doseSheet(d.id, d.k),
  "dose-save": d => { const s = sub(d.id); const mg = toMg(s, parseFloat($("#d-dose").value) || 0); if (mg <= 0) return toast("Doză invalidă"); S.days[d.k + "|" + d.id] = Object.assign(S.days[d.k + "|" + d.id] || {}, { mg }); save(); closeSheet(); render(); },
  "dose-reset": d => { const o = S.days[d.k + "|" + d.id]; if (o) { delete o.mg; if (!Object.keys(o).length) delete S.days[d.k + "|" + d.id]; } save(); closeSheet(); render(); },
  "plan-edit": d => planSheet(d.id),
  "plan-save": d => {
    const s = sub(d.id), host = $("#sheet");
    const from = host.querySelector("#p-from").value, to = host.querySelector("#p-to").value;
    if (!from || !to || to < from) return toast("Interval invalid");
    const shift = host.querySelector("#p-shift").checked, delta = diffDays(s.from, from);
    const pattern = host.querySelector("#p-pattern").value;
    const dow = [...host.querySelectorAll("#p-dow .tog.on")].map(b => +b.dataset.d);
    if (pattern === "dow" && !dow.length) return toast("Alege cel puțin o zi");
    const mg = toMg(s, parseFloat(host.querySelector("#p-dose").value) || 0); if (mg <= 0) return toast("Doză invalidă");
    const o = { from, to, time: host.querySelector("#p-time").value, pattern, dow, doseMg: mg, stopped: host.querySelector("#p-stopped").checked };
    if (shift && delta) { o.pauses = (s.pauses || []).map(p => [addDays(p[0], delta), addDays(p[1], delta)]); o.extra = (s.extra || []).map(x => addDays(x, delta)); }
    S.plan[d.id] = Object.assign({}, S.plan[d.id] || {}, o); save(); closeSheet(); toast("Plan actualizat"); render();
  },
  "plan-reset": d => { delete S.plan[d.id]; save(); closeSheet(); render(); },
  "plan-reset-all": () => { if (confirm("Resetezi toate modificările planului (datele, fiolele și jurnalul rămân)?")) { S.plan = {}; S.days = {}; save(); toast("Plan resetat"); render(); } },
  "settings-save": () => { S.settings.am = $("#s-am").value || "06:45"; S.settings.pm = $("#s-pm").value || "21:00"; S.notified = {}; save(); toast("Ore salvate"); render(); },
  "notif-enable": enableNotifications,
  "update-check": async () => { try { const r = await navigator.serviceWorker.getRegistration(); if (!r) return toast("Service worker inactiv"); toast("Verific..."); await r.update(); setTimeout(() => { if (!updateReady) toast("Ești la ultima versiune (v" + APP_VERSION + ")"); }, 2500); } catch (e) { toast("Nu am putut verifica (offline?)"); } },
  "reload": () => location.reload(),
  "notif-now": () => { const k = todayKey(); const ds = dosesOn(k).filter(d => !d.logged && !d.skipped); if (!ds.length) return toast("Nimic de administrat azi"); checkDueNow(true); toast("Reminder trimis"); },
  "notif-test": () => notify("Peptide Tracker", "Notificările funcționează. Așa vei fi anunțat la " + S.settings.am + " și " + S.settings.pm + "."),
  "ics": () => download("peptide-plan.ics", buildICS(), "text/calendar"),
  "export": () => download(`peptide-backup-${todayKey()}.json`, JSON.stringify(S, null, 1), "application/json"),
  "wipe": () => { if (confirm("Ștergi TOATE datele (jurnal, fiole, plan)? Nu se poate anula.") && confirm("Sigur? Exportă mai întâi un backup dacă vrei să le păstrezi.")) { S = defaultState(); save(); render(); } }
};
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const fn = A[el.dataset.act]; if (fn) fn(el.dataset, el, e);
});
$("#nav").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (!b) return; view = b.dataset.v; render(); window.scrollTo(0, 0); });

/* ---------- randare ---------- */
function render() {
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === view));
  ({ today: renderToday, cal: renderCal, vials: renderVials, log: renderLog, settings: renderSettings })[view]();
  const pending = dosesOn(todayKey()).filter(d => !d.logged && !d.skipped).length;
  const nb = $("#nav button[data-v=today]"); let badge = nb.querySelector(".badge");
  if (pending) { if (!badge) { badge = document.createElement("span"); badge.className = "badge"; nb.appendChild(badge); } badge.textContent = pending; } else if (badge) badge.remove();
}

/* ---------- pornire ---------- */
let updateReady = false;
function showUpdateBar() {
  updateReady = true;
  if ($("#updbar")) return;
  const b = document.createElement("div"); b.id = "updbar"; b.className = "alert ok"; b.style.cssText = "position:fixed;left:12px;right:12px;bottom:calc(var(--nav-h) + 12px);z-index:15;display:flex;align-items:center;gap:10px";
  b.innerHTML = `<span class="grow"><b>Versiune nouă descărcată</b>Reîncarcă pentru a o folosi.</span><button class="btn small primary" data-act="reload">Reîncarcă</button>`;
  document.body.appendChild(b);
}
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(r => {
    if (r.active) r.active.postMessage("check");
    if (r.waiting && navigator.serviceWorker.controller) showUpdateBar();
    r.addEventListener("updatefound", () => { const w = r.installing; if (!w) return; w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) showUpdateBar(); }); });
  }).catch(() => {});
  let refreshed = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (updateReady && !refreshed) { refreshed = true; location.reload(); } });
}
render();
checkDueNow(); scheduleUpcoming();
setInterval(checkDueNow, 60 * 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { checkDueNow(); render(); } });
})();
