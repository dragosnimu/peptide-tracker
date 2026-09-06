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
const defaultState = () => ({ v: 1, settings: { am: "06:45", pm: "21:00", notif: false }, plan: {}, days: {}, vials: {}, log: [], notified: {}, labs: [], supplies: { s03: null, s1: null, s3: null, waterMl: null, swabs: null, updated: null }, sync: { token: "", repo: "dragosnimu/peptide-tracker", branch: "data", path: "peptide-backup.json", lastSync: 0, lastError: "", lastSha: "", calId: "", calHash: 0, calAt: 0, calError: "" }, meta: { updatedAt: 0 }, orders: [], auth: { enabled: false, clientId: "", allowed: [], days: 30 } });
let S = load();
function migrate(s) {
  const d = defaultState(); const out = Object.assign(d, s);
  for (const k of ["settings", "sync", "supplies", "meta", "auth"]) out[k] = Object.assign({}, defaultState()[k], (s && s[k]) || {});
  for (const k of ["log", "labs", "orders"]) if (!Array.isArray(out[k])) out[k] = [];
  for (const k of ["plan", "days", "vials", "notified"]) if (!out[k] || typeof out[k] !== "object") out[k] = {};
  const hasData = out.log.length || Object.keys(out.vials).length || out.labs.length;
  if ((!s || !s.meta) && hasData) out.meta.updatedAt = Date.now();
  return out;
}
function load() { try { const s = JSON.parse(localStorage.getItem(SK)); if (s && s.v) return migrate(s); } catch (e) {} return defaultState(); }
let saveTimer = null;
function save(noTouch) {
  if (!noTouch) S.meta.updatedAt = Date.now();
  try { localStorage.setItem(SK, JSON.stringify(S)); } catch (e) { toast("Nu am putut salva datele"); }
  clearTimeout(saveTimer); saveTimer = setTimeout(scheduleUpcoming, 300);
  if (!noTouch) { schedulePush(); scheduleCalPublish(); }
}

/* ---------- plan ---------- */
const sub = id => {
  const b = SUBS.find(s => s.id === id), p = S.plan[id] || {};
  const rk = p.routeKey || "sc";
  const ro = (b.routeOptions && b.routeOptions[rk]) || {};
  return Object.assign({}, b, ro, p, { routeKey: rk });
};
const routeOf = s => ROUTES[s.routeKey || "sc"];
const hasIM = s => !!(s.routeOptions && s.routeOptions.im);
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
    if (s.cycleOn > 0 && s.cycleOff > 0) { const di0 = diffDays(s.from, k); if (di0 >= 0 && (di0 % (s.cycleOn + s.cycleOff)) >= s.cycleOn) return null; }
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
const planWeeks = () => Math.max(PLAN_WEEKS, Math.ceil((diffDays(PLAN_START, planEnd()) + 1) / 7));
const doseCount = s => { let n = 0; for (let k = s.from; k <= s.to; k = addDays(k, 1)) if (scheduled(s, k)) n++; return n; };

/* ---------- UI de baza ---------- */
let view = "today", selDay = todayKey();
const main = $("#main");
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function openSheet(html, mount, noDismiss) {
  const host = $("#sheet");
  host.innerHTML = `<div class="sheet-bg" ${noDismiss ? "" : 'data-act="close-bg"'}><div class="sheet" role="dialog"><div class="handle"></div>${html}</div></div>`;
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
  if (d.logged) actions = `<div class="row wrap"><span class="chip ok">administrat ${esc(d.logged.time || "")} · ${fmtU(d.logged.units)}</span>${d.logged.planned && Math.abs(d.logged.units - d.logged.planned.units) > 0.01 ? `<span class="chip warn">planificat ${fmtU(d.logged.planned.units)}</span>` : ""}${d.logged.feel ? `<span class="feel f${d.logged.feel}">${d.logged.feel}</span>` : ""}<span class="grow"></span><button class="btn small" data-act="log-edit" data-eid="${d.logged.id}">Detalii</button></div>`;
  else if (d.skipped) actions = `<div class="row wrap"><span class="chip">${d.moved ? "mutată pe mâine" : "sărită"}</span><span class="grow"></span><button class="btn small" data-act="unskip" data-id="${s.id}" data-k="${k}">Anulează</button></div>`;
  else actions = `<div class="row wrap"><button class="btn primary small" data-act="log-new" data-id="${s.id}" data-k="${k}">Administrat</button><button class="btn small" data-act="skip" data-id="${s.id}" data-k="${k}">Sari</button>${scheduled(s, addDays(k, 1)) ? "" : `<button class="btn small" data-act="move" data-id="${s.id}" data-k="${k}">Mâine</button>`}<span class="grow"></span><button class="btn small" data-act="dose-edit" data-id="${s.id}" data-k="${k}">Doză</button></div>`;
  return `<div class="dose ${cls}">
    <div class="row between"><span class="name">${esc(s.short)}</span><span class="row" style="gap:6px">${hasIM(s) ? `<button class="chip acc" data-act="route-edit" data-id="${s.id}" title="Schimbă calea">${esc(s.route)} ▾</button>` : `<span class="chip">${esc(s.route)}</span>`}<span class="chip ${s.time}">${tl(s.time)}</span></span></div>
    <div class="row"><span class="u">${fmtU(d.units)}</span><span class="muted">${esc(d.label)}${d.units > 100 ? ` = ${num(d.units / 100)} ml (seringă de 3 ml)` : ""}</span></div>
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
  for (const s of allSubs()) {
    if (s.stopped || !(s.cycleOn > 0 && s.cycleOff > 0) || k <= s.from || k > s.to) continue;
    const di = diffDays(s.from, k), per = s.cycleOn + s.cycleOff, r = di % per;
    if (r === s.cycleOn) a.push(`<div class="alert info"><b>${esc(s.short)}: începe pauza de washout (${s.cycleOff / 7} săpt.)</b>Reia pe ${esc(fmtL(addDays(k, s.cycleOff)))}. Fiola deschisă va expira probabil între timp.</div>`);
    else if (r === 0) a.push(`<div class="alert info"><b>${esc(s.short)}: reia după pauză (ciclul ${Math.floor(di / per) + 1})</b>Verifică dacă fiola activă mai e în termen; altfel prepară una nouă.</div>`);
  }
  a.push(...suppliesAlerts(k));
  if (S.sync.token && S.sync.lastError) a.push(`<div class="alert"><b>Sincronizarea cu GitHub nu funcționează</b>${esc(S.sync.lastError)}. Verifică tokenul în Setări.</div>`);
  const due = labsDue();
  if (due) { const dl = diffDays(k, due.due); if (dl <= 7) a.push(`<div class="alert ${dl < 0 ? "" : "info"}"><b>Analize de sânge ${dl < 0 ? "restante de " + (-dl) + " zile" : dl === 0 ? "scadente azi" : "în " + dl + " zile (" + fmtL(due.due) + ")"}</b>${esc(due.why)}. Le înregistrezi în Jurnal → Analize.</div>`); }
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
  $("#subtitle").textContent = `${fmtFull(k)}${w >= 1 && w <= planWeeks() ? ` · săptămâna ${w} din ${planWeeks()}` : ""}`;
  $("#topaction").innerHTML = ds.some(d => !d.logged && !d.skipped) ? `<button class="btn small primary" data-act="focus-open">Mod injecție</button>` : "";
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
  $("#subtitle").textContent = `Săptămâna ${w + 1}${w + 1 <= planWeeks() ? " din " + planWeeks() : ""} · ${fmt(ws)} – ${fmt(addDays(ws, 6))}`;
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
  h += `<div class="card"><h2>Ansamblu pe ${planWeeks()} săptămâni</h2><p class="tiny" style="margin-bottom:8px">O coloană = o săptămână. Bară plină = zilnic, estompată = 2-3x/săpt., contur punctat = pauză de washout între cicluri. Numărul de lângă substanță = doze planificate până la epuizarea stocului.</p>${gantt()}</div>`;
  h += `<div class="card"><div class="row between"><h2 style="margin:0">Editează planul</h2><button class="btn small" data-act="cycle-open">Planifică ciclul următor</button></div><div class="stack" style="margin-top:8px">${allSubs().map(s => `<div class="row between"><div class="grow"><b>${esc(s.short)}</b> <span class="tiny">${s.stopped ? "oprit" : fmt(s.from) + " – " + fmt(s.to) + " " + fromKey(s.to).getFullYear() + " · " + doseCount(s) + " doze · " + tl(s.time) + " · " + doseLabel(s, s.doseMg) + " = " + fmtU(unitsFor(s, s.doseMg, activeVial(s.id)))}</span>${hasIM(s) ? ` <span class="chip ${s.routeKey === "im" ? "acc" : ""}">${esc(s.route)}</span>` : ""}${S.plan[s.id] ? ' <span class="chip acc">modificat</span>' : ""}</div><button class="btn small" data-act="plan-edit" data-id="${s.id}">Editează</button></div>`).join("")}</div></div>`;
  main.innerHTML = `<div class="view">${h}</div>`;
}
function gantt() {
  const cur = weekOf(todayKey());
  const W = planWeeks();
  let g = `<div class="n h">Substanța · doze</div>`;
  for (let w = 1; w <= W; w++) g += `<div class="h ${w === cur ? "cur" : ""}">${w}</div>`;
  for (const s of allSubs()) {
    g += `<div class="n">${esc(s.short)} <span class="tiny mono">${doseCount(s)}</span></div>`;
    for (let w = 1; w <= W; w++) {
      const ws = addDays(PLAN_START, (w - 1) * 7), we = addDays(ws, 6);
      let any = false; for (let i = 0; i < 7; i++) if (scheduled(s, addDays(ws, i))) { any = true; break; }
      const paused = !s.stopped && ws <= s.to && we >= s.from;
      g += `<div class="b">${any ? `<div class="bar ${s.time} ${s.pattern === "dow" ? "part" : ""}"></div>` : paused ? `<div class="bar off"></div>` : ""}</div>`;
    }
  }
  return `<div class="gantt"><div class="g" style="grid-template-columns:120px repeat(${W},26px);min-width:${120 + W * 26}px">${g}</div></div>`;
}

/* ---------- ecran Fiole ---------- */
function renderVials() {
  $("#title").textContent = "Fiole";
  $("#subtitle").textContent = "Reconstituire, stabilitate, stoc";
  const k = todayKey();
  const list = allSubs().slice().sort((a, b) => a.from.localeCompare(b.from));
  let h = "";
  for (const s of list) {
    const vs = S.vials[s.id] || [], v = activeVial(s.id), used = vs.filter(x => x.opened >= s.from).length, left = s.stock - used;
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
      ${vs.length > 1 ? `<details><summary class="tiny">Istoric fiole (${vs.length})</summary><div class="tiny">${vs.map(x => `#${x.n}: ${fmtL(x.opened)}${x.lot ? ", lot " + esc(x.lot) : ""}${x.discarded ? ", aruncată" : ""}, ${num(x.leftMg)} mg rămase`).join("<br>")}</div></details>` : ""}
    </div>`;
  }
  main.innerHTML = `<div class="view">${suppliesCard()}${ordersCard()}${h}</div>`;
}
function vialSheet(id) {
  const s = sub(id), v = activeVial(id);
  const vs = S.vials[id] || [], n = vs.length + 1, usedNow = vs.filter(x => x.opened >= s.from).length;
  const ords = (S.orders || []).filter(o => (o.items || []).some(it => it.sub === id && it.vials > 0)).sort((a, b) => b.date.localeCompare(a.date));
  const stepsHtml = `<ol class="steps">${s.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol>`;
  const html = `<h2>${s.ready ? "Deschide flacon" : "Prepară fiola"} #${n}: ${esc(s.name)}</h2>
    <p class="muted">${esc(s.what)}</p>
    ${v ? `<div class="alert"><b>Fiola #${v.n} este încă activă</b> (${num(v.leftMg)} mg rămase). Va fi marcată ca aruncată.</div>` : ""}
    ${usedNow >= s.stock ? `<div class="alert"><b>Stocul de ${s.stock} fiole pentru ciclul acesta este consumat</b>Continuă doar dacă ai o comandă nouă (adaug-o în Fiole → Comenzi și loturi).</div>` : ""}
    ${stepsHtml}
    <div class="stack">
      <label class="f">Data ${s.ready ? "deschiderii" : "reconstituirii"}<input type="date" id="v-date" value="${todayKey()}"></label>
      ${s.ready ? "" : `<label class="f">Apă bacteriostatică adăugată (ml)<input type="number" id="v-water" step="0.5" min="0.5" value="${s.waterMl}"></label>`}
      <label class="f">Din comanda / lotul<select id="v-order">${ords.map((o, i) => { const it = o.items.find(x => x.sub === id); return `<option value="${o.id}" ${i === 0 ? "selected" : ""}>${esc(o.supplier)} · ${fmtL(o.date)} ${fromKey(o.date).getFullYear()}${it.lot ? " · lot " + esc(it.lot) : ""}</option>`; }).join("")}<option value="" ${ords.length ? "" : "selected"}>fără comandă înregistrată</option></select></label>
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

/* ---------- verificari de siguranta ---------- */
function safetyWarnings(s, k, units, site, route, vial, isNew) {
  const w = [];
  const mg = units / 100 * conc(s, vial);
  if (vial && diffDays(vial.opened, k) > s.stabilityDays) w.push(`Fiola #${vial.n} este expirată: ${diffDays(vial.opened, k)} zile de la reconstituire, limita e ${s.stabilityDays}. Prepară una nouă.`);
  if (vial && vial.leftMg + 1e-9 < mg) w.push(`Fiola #${vial.n} mai are ${num(vial.leftMg)} mg, mai puțin decât doza de ${num(mg)} mg.`);
  if (s.maxMg && mg > s.maxMg + 1e-9) w.push(`Doza ${doseLabel(s, mg)} depășește maximul din surse: ${doseLabel(s, s.maxMg)} = ${fmtU(unitsFor(s, s.maxMg, vial))}.`);
  if (["dsip", "semax", "selank"].includes(s.id) && units > 20) w.push(`${s.short} se dozează în micrograme. ${fmtU(units)} înseamnă de ${Math.round(units / unitsFor(s, s.doseMg, vial))} ori doza standard. Oprește-te și verifică seringa.`);
  const d = scheduled(s, k);
  if (d && units > d.units * 1.5 + 1e-9) w.push(`Cu ${Math.round((units / d.units - 1) * 100)}% peste doza planificată de ${fmtU(d.units)}.`);
  if (isNew && S.log.some(e => e.date === k && e.sub === s.id)) w.push(`${s.short} este deja înregistrat azi. A doua administrare ar dubla doza zilnică.`);
  const rec = S.log.filter(e => e.site === site && diffDays(e.date, k) >= 0 && diffDays(e.date, k) < 3).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (rec) w.push(`Locul „${site}” a fost folosit ${diffDays(rec.date, k) === 0 ? "azi" : "acum " + diffDays(rec.date, k) + (diffDays(rec.date, k) === 1 ? " zi" : " zile")}. Rotește locul.`);
  const lastLocal = S.log.filter(e => e.site === site && (e.symptoms || []).some(x => LOCAL_SYMPTOMS.includes(x)) && diffDays(e.date, k) < 7)[0];
  if (lastLocal) w.push(`La „${site}” ai notat recent o reacție locală (${lastLocal.symptoms.filter(x => LOCAL_SYMPTOMS.includes(x)).join(", ")}). Alege alt loc.`);
  if (route === "im" && units > 200 && String(site).startsWith("deltoid")) w.push("Peste 2 ml în deltoid: alege coapsa sau fesierul.");
  if (route === "sc" && units > 150) w.push("Peste 1,5 ml subcutanat: volum mare pentru SC. Ia în calcul IM sau două injecții în locuri diferite.");
  return w;
}
function warnBox(warns, idAck) {
  return `<div class="alert warnbox"><b>Verifică înainte de a salva</b><ul style="margin:6px 0 0;padding-left:18px">${warns.map(x => `<li>${esc(x)}</li>`).join("")}</ul><label class="ack"><input type="checkbox" id="${idAck}"> Am verificat și vreau să salvez oricum</label></div>`;
}

/* ---------- grafic de evolutie ---------- */
function chartSVG() {
  const logs = S.log.filter(e => e.date);
  if (!logs.length) return `<p class="muted">Graficul apare după primele administrări cu stare notată.</p>`;
  const first = logs.reduce((m, e) => e.date < m ? e.date : m, todayKey());
  const start = first < PLAN_START ? first : PLAN_START, end = addDays(todayKey(), 1);
  const days = diffDays(start, end) + 1;
  const cw = Math.max(16, Math.min(28, Math.floor(600 / days))), L = 34, T = 18, H = 150, B = 62;
  const W = L + days * cw + 10, HT = T + H + B;
  const x = k => L + diffDays(start, k) * cw + cw / 2, y = f => T + H - (f - 1) / 4 * H;
  let g = "";
  for (let f = 1; f <= 5; f++) g += `<line x1="${L}" x2="${W - 8}" y1="${y(f)}" y2="${y(f)}" stroke="var(--line-soft)"/><text x="${L - 6}" y="${y(f) + 4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${f}</text>`;
  const pts = []; let bars = "", labels = "";
  for (let k = start, i = 0; k <= end; k = addDays(k, 1), i++) {
    const es = logs.filter(e => e.date === k), fe = es.filter(e => e.feel > 0);
    if (fe.length) pts.push({ k, f: fe.reduce((a, e) => a + e.feel, 0) / fe.length });
    const neg = new Set(); es.forEach(e => (e.symptoms || []).forEach(sy => { if (NEG_SYMPTOMS.includes(sy)) neg.add(sy); }));
    if (neg.size) bars += `<rect x="${x(k) - cw / 2 + 2}" y="${T + H + 6}" width="${cw - 4}" height="${Math.min(5, neg.size) * 5}" rx="1" fill="var(--warn)" opacity=".6"><title>${esc([...neg].join(", "))}</title></rect>`;
    const dd = fromKey(k);
    if (dd.getDay() === 1 || i === 0) labels += `<text x="${x(k)}" y="${HT - 30}" text-anchor="middle" font-size="10" fill="var(--ink-3)">${fmt(k)}</text>`;
    if (k === todayKey()) g += `<rect x="${x(k) - cw / 2}" y="${T}" width="${cw}" height="${H}" fill="var(--accent-soft)"/>`;
  }
  let intro = "";
  for (const sb of allSubs()) if (!sb.stopped && sb.from >= start && sb.from <= end) intro += `<line x1="${x(sb.from)}" x2="${x(sb.from)}" y1="${T}" y2="${T + H}" stroke="var(--accent)" stroke-dasharray="3 3"/><text x="${x(sb.from) + 3}" y="${T + 10}" font-size="9.5" fill="var(--accent)" transform="rotate(90 ${x(sb.from) + 3} ${T + 10})">${esc(sb.short)}</text>`;
  let line = "";
  if (pts.length > 1) line = `<polyline points="${pts.map(p => x(p.k) + "," + y(p.f)).join(" ")}" fill="none" stroke="var(--ink-2)" stroke-width="1.5"/>`;
  const dots = pts.map(p => `<circle cx="${x(p.k)}" cy="${y(p.f)}" r="4.5" fill="${p.f < 2.5 ? "var(--warn)" : p.f < 3.5 ? "var(--am)" : "var(--ok)"}"><title>${fmtL(p.k)}: ${num(p.f)}/5</title></circle>`).join("");
  return `<div class="chart"><svg viewBox="0 0 ${W} ${HT}" width="${W}" height="${HT}">${g}${intro}${line}${dots}${bars}${labels}<text x="${L}" y="${HT - 8}" font-size="10.5" fill="var(--ink-3)">● stare 1-5 (medie/zi) · bare roșii = simptome negative · linii punctate = substanță nouă</text></svg></div>`;
}

/* ---------- harta corpului ---------- */
function siteInfo(site) {
  const es = S.log.filter(e => e.site === site).sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));
  if (!es.length) return { days: null, react: false };
  const last = es[0];
  return { days: diffDays(last.date, todayKey()), react: (last.symptoms || []).some(x => LOCAL_SYMPTOMS.includes(x)), last };
}
function bodySVG(sel, pick) {
  const body = `<g fill="var(--surface-2)" stroke="var(--line)" stroke-width="1.2"><circle cx="100" cy="42" r="24"/><rect x="62" y="70" width="76" height="120" rx="22"/><rect x="66" y="185" width="68" height="70" rx="18"/><rect x="34" y="82" width="24" height="112" rx="12"/><rect x="142" y="82" width="24" height="112" rx="12"/><rect x="66" y="250" width="30" height="150" rx="14"/><rect x="104" y="250" width="30" height="150" rx="14"/></g>`;
  let pts = "";
  for (const [site, [px, py]] of Object.entries(BODY_POINTS)) {
    const inf = siteInfo(site);
    const col = inf.days === null ? "var(--line)" : inf.days < 3 ? "var(--warn)" : inf.days < 7 ? "var(--am)" : "var(--ok)";
    const im = !ROUTES.sc.sites.includes(site);
    pts += `<g class="pt ${sel === site ? "sel" : ""}" ${pick ? `data-act="pick-site" data-site="${esc(site)}"` : ""}><title>${esc(site)}: ${inf.days === null ? "nefolosit" : inf.days === 0 ? "folosit azi" : "acum " + inf.days + " zile"}${inf.react ? " · reacție locală" : ""}</title>${inf.react ? `<circle cx="${px}" cy="${py}" r="11" fill="none" stroke="var(--warn)" stroke-width="2"/>` : ""}<circle class="c" cx="${px}" cy="${py}" r="${im ? 6 : 7}" fill="${col}"/>${im ? `<text x="${px}" y="${py + 3}" text-anchor="middle" font-size="7.5" fill="#fff" pointer-events="none">IM</text>` : ""}</g>`;
  }
  return `<svg viewBox="0 0 200 420" role="img" aria-label="Harta locurilor de injecție">${body}${pts}</svg>`;
}
function bodyLegend() {
  const rows = Object.keys(BODY_POINTS).map(site => { const i = siteInfo(site); return { site, i }; }).filter(r => r.i.days !== null).sort((a, b) => a.i.days - b.i.days).slice(0, 6);
  return `<div class="lg"><div><i style="background:var(--warn)"></i>folosit în ultimele 3 zile</div><div><i style="background:var(--am)"></i>acum 3-6 zile</div><div><i style="background:var(--ok)"></i>peste 7 zile, disponibil</div><div><i style="background:var(--line)"></i>nefolosit</div><div>inel roșu = reacție locală notată</div>${rows.length ? `<div style="margin-top:6px"><b>Recente:</b><br>${rows.map(r => `${esc(r.site)}: ${r.i.days === 0 ? "azi" : "acum " + r.i.days + " zile"}${r.i.react ? " ⚠" : ""}`).join("<br>")}</div>` : ""}</div>`;
}

/* ---------- analize de sange ---------- */
function ghkCycleEnds() {
  const g = sub("ghk"); const ends = [];
  if (g.stopped) return ends;
  if (g.cycleOn > 0 && g.cycleOff > 0) { for (let c = 0; c < 20; c++) { const e = addDays(g.from, c * (g.cycleOn + g.cycleOff) + g.cycleOn - 1); if (e >= g.to) { ends.push(g.to); break; } ends.push(e); } }
  else ends.push(g.to);
  return ends;
}
function labsDue() {
  const last = S.labs.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  const items = [];
  if (!last) items.push({ due: PLAN_START, why: "analize de referință înainte de start: hemoleucogramă, glicemie, HbA1c, transaminaze, creatinină, lipide, cupru și zinc" });
  else items.push({ due: addDays(last.date, 84), why: "control la 12 săptămâni de la ultimele analize" });
  for (const e of ghkCycleEnds()) if (!last || e > last.date) items.push({ due: e, why: "sfârșit de ciclu GHK-Cu: cupru și zinc seric" });
  items.sort((a, b) => a.due.localeCompare(b.due));
  return items[0] || null;
}
function labsCard() {
  const labs = S.labs.slice().sort((a, b) => b.date.localeCompare(a.date));
  const due = labsDue();
  let h = `<div class="card labs stack"><div class="row between"><h2 style="margin:0">Analize de sânge</h2><button class="btn small primary" data-act="labs-new">Adaugă analize</button></div>`;
  if (due) { const dl = diffDays(todayKey(), due.due); h += `<div class="alert ${dl < 0 ? "" : "info"}"><b>${dl < 0 ? "Restante de " + (-dl) + " zile" : dl === 0 ? "Scadente azi" : "Următoarele: " + fmtL(due.due) + " (în " + dl + " zile)"}</b>${esc(due.why)}.</div>`; }
  if (!labs.length) return h + `<p class="muted">Nicio analiză înregistrată. Raportul recomandă un set de referință înainte de prima injecție și repetare la 8-12 săptămâni.</p></div>`;
  const cur = labs[0], prev = labs[1];
  let rows = "";
  for (const f of LAB_FIELDS) {
    const v = cur.v[f.k]; if (v == null || v === "") continue;
    const p = prev ? prev.v[f.k] : null;
    const out = f.lo != null && (v < f.lo || v > f.hi);
    const arrow = p == null || p === "" ? "" : v > p ? "↑" : v < p ? "↓" : "=";
    rows += `<tr><td>${esc(f.n)} <span class="tiny">${esc(f.u)}</span></td><td class="v ${out ? "out" : ""}">${num(v)}</td><td class="arrow">${p == null || p === "" ? "" : arrow + " " + num(p)}</td><td class="tiny">${f.lo != null ? num(f.lo) + "–" + (f.hi > 900 ? "" : num(f.hi)) : ""}</td></tr>`;
  }
  h += `<div class="tiny">Ultimele: ${fmtL(cur.date)} ${fromKey(cur.date).getFullYear()}${prev ? " · comparate cu " + fmtL(prev.date) : ""}. Roșu = în afara intervalului orientativ.</div>
    <div style="overflow-x:auto"><table><thead><tr><th>Analiză</th><th>Valoare</th><th>Anterior</th><th>Interval</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${cur.note ? `<div class="m tiny">${esc(cur.note)}</div>` : ""}
    <div class="row wrap">${labs.map(l => `<button class="btn small" data-act="labs-edit" data-lid="${l.id}">${fmtL(l.date)} ${fromKey(l.date).getFullYear()}</button>`).join("")}</div></div>`;
  return h;
}
function labsSheet(entry) {
  const e = entry || { id: Date.now(), date: todayKey(), v: {}, note: "" };
  openSheet(`<h2>${entry ? "Analize din " + fmtL(e.date) : "Analize noi"}</h2>
    <p class="muted">Completează doar ce ai. Valorile se compară automat cu setul anterior și cu intervalul orientativ.</p>
    <div class="stack">
      <label class="f">Data recoltării<input type="date" id="lb-date" value="${e.date}"></label>
      <div class="stack" style="grid-template-columns:1fr 1fr;display:grid">${LAB_FIELDS.map(f => `<label class="f">${esc(f.n)} <span class="tiny">(${esc(f.u)})</span><input type="number" step="any" inputmode="decimal" data-lk="${f.k}" value="${e.v[f.k] ?? ""}"></label>`).join("")}</div>
      <label class="f">Observații (laborator, medic, context)<textarea id="lb-note">${esc(e.note)}</textarea></label>
    </div>
    <div class="row"><button class="btn primary grow" data-act="labs-save" data-lid="${e.id}" data-new="${entry ? "" : "1"}">Salvează</button>${entry ? `<button class="btn danger" data-act="labs-delete" data-lid="${e.id}">Șterge</button>` : ""}<button class="btn" data-act="close">Anulează</button></div>`);
}

/* ---------- mod injectie ---------- */
let focusIdx = 0;
function focusPending() { const k = todayKey(); const ds = dosesOn(k).filter(d => !d.logged && !d.skipped); return ds.filter(d => d.sub.time === "am").concat(ds.filter(d => d.sub.time === "pm")); }
function renderFocus() {
  const k = todayKey(), pend = focusPending();
  $("#title").textContent = "Mod injecție";
  $("#subtitle").textContent = fmtFull(k);
  $("#topaction").innerHTML = `<button class="btn small" data-act="focus-exit">Ieși</button>`;
  if (!pend.length) { main.innerHTML = `<div class="view focus"><div class="card"><div class="big">Nimic de administrat</div><p class="muted" style="font-size:18px">Toate dozele de azi sunt bifate sau sărite.</p></div><button class="btn block" data-act="focus-exit">Înapoi la Azi</button></div>`; return; }
  focusIdx = Math.max(0, Math.min(focusIdx, pend.length - 1));
  const d = pend[focusIdx], s = d.sub, r = routeOf(s), site = suggestSite(s.routeKey, d.units / 100), v = d.vial;
  const warns = safetyWarnings(s, k, d.units, site, s.routeKey, v, true);
  let vl = "";
  if (!v) vl = `<div class="alert"><b>Nu ai fiolă activă pentru ${esc(s.short)}</b>Prepară fiola din ecranul Fiole înainte de injecție.</div>`;
  else vl = `<p class="muted" style="font-size:16px">Fiola #${v.n} · ${vialDosesLeft(s, v)} doze rămase · expiră ${fmt(vialExpiry(s, v))}</p>`;
  main.innerHTML = `<div class="view focus">
    <div class="prog">${focusIdx + 1} din ${pend.length} · <span class="chip ${s.time}">${tl(s.time)}</span> <span class="chip">${esc(s.route)}</span></div>
    <div class="card stack">
      <div class="big">${esc(s.name)}</div>
      <div class="units">${fmtU(d.units)}</div>
      <div class="lbl">${esc(d.label)}${d.units > 100 ? ` = ${num(d.units / 100)} ml` : ""} · ${esc(r.name)}</div>
      ${d.note ? `<div class="alert"><b>${esc(d.note)}</b></div>` : ""}
      <div class="site">Loc sugerat: <b>${esc(site)}</b></div>
      ${vl}
      ${warns.length ? warnBox(warns, "f-ack") : ""}
    </div>
    <button class="btn primary block" data-act="focus-log" data-id="${s.id}" data-site="${esc(site)}">Administrat: ${fmtU(d.units)} ${esc(s.short)}</button>
    <div class="row"><button class="btn grow" data-act="focus-skip" data-id="${s.id}">Sari azi</button><button class="btn grow" data-act="focus-next" ${pend.length < 2 ? "disabled" : ""}>Următoarea →</button></div>
    <p class="tiny" style="text-align:center">Se înregistrează cu locul sugerat și fără stare; completezi starea și comentariul din Jurnal.</p>
  </div>`;
}

/* ---------- consumabile ---------- */
function syringeType(units, route) { if (route === "im" || units > 100) return "s3"; if (units <= 30) return "s03"; return "s1"; }
function supplyForecast() {
  const start = todayKey(), end = planEnd();
  const need = { s03: 0, s1: 0, s3: 0, waterMl: 0, swabs: 0 };
  const perSub = {};
  const runsOut = {};
  const st = S.supplies || {};
  const vs = {};
  for (const sb of allSubs()) { const v = activeVial(sb.id); vs[sb.id] = v ? { opened: v.opened, left: v.leftMg } : null; perSub[sb.id] = { vials: 0, used: (S.vials[sb.id] || []).filter(x => x.opened >= sb.from).length, stock: sb.stock, short: sb.short }; }
  for (let k = start; k <= end; k = addDays(k, 1)) {
    for (const dd of dosesOn(k)) {
      if (dd.skipped || (dd.logged && k === start)) continue;
      const sb = dd.sub; const rk = sb.routeKey || "sc";
      need[syringeType(dd.units, rk)]++; if (rk === "im" || dd.units > 100) need.swabs += 0; need.swabs += 2;
      let v = vs[sb.id];
      if (!v || diffDays(v.opened, k) > sb.stabilityDays || v.left + 1e-9 < dd.mg) { v = vs[sb.id] = { opened: k, left: sb.vialMg }; perSub[sb.id].vials++; if (!sb.ready) need.waterMl += sb.waterMl; need.swabs += 1; }
      v.left -= dd.mg;
    }
    for (const key of Object.keys(need)) if (runsOut[key] === undefined && st[key] != null && need[key] > st[key]) runsOut[key] = k;
  }
  return { need, runsOut, perSub, end };
}
function suppliesCard() {
  const f = supplyForecast(), st = S.supplies || {};
  const rows = SUPPLY_ITEMS.map(it => {
    const have = st[it.k], nd = Math.ceil(f.need[it.k]);
    const ro = f.runsOut[it.k];
    const status = have == null ? `<span class="tiny">stoc necunoscut</span>` : ro ? `<span class="low">ajunge până pe ${fmt(ro)}</span>` : `<span style="color:var(--ok)">ajunge până la sfârșit</span>`;
    return `<tr><td>${esc(it.n)}<br><span class="tiny">${esc(it.hint)}</span></td><td class="n">${have == null ? "–" : num(have)}</td><td class="n">${nd}${it.k === "waterMl" ? ` <span class="tiny">(${Math.ceil(nd / 10)} fl.)</span>` : ""}</td><td class="${ro ? "low" : ""}">${status}</td></tr>`;
  }).join("");
  const vialsShort = Object.values(f.perSub).filter(p => p.used + p.vials > p.stock).map(p => `${p.short}: mai trebuie ${p.used + p.vials - p.stock} fiole`);
  return `<div class="card sup stack"><div class="row between"><h2 style="margin:0">Consumabile</h2><button class="btn small primary" data-act="supplies-edit">Actualizează stocul</button></div>
    <p class="tiny">Necesar calculat din calendar, de azi până pe ${fmt(f.end)} ${fromKey(f.end).getFullYear()}, inclusiv fiolele care vor fi preparate${st.updated ? " · stoc introdus " + fmtL(st.updated) : ""}.</p>
    <div style="overflow-x:auto"><table><thead><tr><th>Articol</th><th>Stoc</th><th>Necesar</th><th>Stare</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${vialsShort.length ? `<div class="alert"><b>Fiole insuficiente</b>${esc(vialsShort.join("; "))}.</div>` : `<p class="tiny">Fiolele de substanțe ajung pentru tot planul.</p>`}</div>`;
}
function suppliesSheet() {
  const st = S.supplies || {};
  openSheet(`<h2>Stocul de consumabile</h2><p class="muted">Numără ce ai acum. Aplicația calculează până când ajunge și te anunță cu 14 zile înainte.</p>
    <div class="stack">${SUPPLY_ITEMS.map(it => `<label class="f">${esc(it.n)} (${esc(it.u)})<input type="number" inputmode="numeric" min="0" step="1" data-sk="${it.k}" value="${st[it.k] ?? ""}"></label>`).join("")}</div>
    <div class="row"><button class="btn primary grow" data-act="supplies-save">Salvează</button><button class="btn" data-act="close">Anulează</button></div>`);
}
function suppliesAlerts(k) {
  const st = S.supplies || {}; if (!Object.keys(st).some(x => x !== "updated" && st[x] != null)) return [];
  const f = supplyForecast(); const a = [];
  for (const it of SUPPLY_ITEMS) { const ro = f.runsOut[it.k]; if (ro && diffDays(k, ro) <= 14) a.push(`<div class="alert ${diffDays(k, ro) <= 3 ? "" : "info"}"><b>${esc(it.n)}: ${diffDays(k, ro) <= 0 ? "stoc epuizat" : "ajunge doar până pe " + fmtL(ro)}</b>Necesar până la sfârșitul planului: ${Math.ceil(f.need[it.k])} ${esc(it.u)}. Vezi Fiole → Consumabile.</div>`); }
  return a;
}

/* ---------- raport pentru medic ---------- */
function reportSheet() {
  const first = S.log.reduce((m, e) => e.date < m ? e.date : m, todayKey());
  openSheet(`<h2>Raport pentru medic</h2><p class="muted">Un document tipăribil cu planul, administrările, starea, simptomele, fiolele și analizele din perioada aleasă. Din fereastra de tipărire alegi „Salvează ca PDF”.</p>
    <div class="stack"><div class="row"><label class="f grow">De la<input type="date" id="rp-from" value="${first < PLAN_START ? first : PLAN_START}"></label><label class="f grow">Până la<input type="date" id="rp-to" value="${todayKey()}"></label></div>
    <label class="f">Nume (opțional, apare în antet)<input type="text" id="rp-name" value="${esc(S.settings.patientName || "")}"></label>
    <label class="check"><input type="checkbox" id="rp-comments" checked> Include comentariile din jurnal</label></div>
    <div class="row"><button class="btn primary grow" data-act="report-build">Generează raportul</button><button class="btn" data-act="close">Anulează</button></div>`);
}
function reportHTML(from, to, name, withComments) {
  const inR = k => k >= from && k <= to;
  const logs = S.log.filter(e => inR(e.date)).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const subsIn = allSubs().filter(sb => !sb.stopped && sb.from <= to && sb.to >= from);
  const feels = logs.filter(e => e.feel > 0);
  const avg = feels.length ? feels.reduce((a, e) => a + e.feel, 0) / feels.length : null;
  const symCount = {}; logs.forEach(e => (e.symptoms || []).forEach(x => symCount[x] = (symCount[x] || 0) + 1));
  const symRows = Object.entries(symCount).sort((a, b) => b[1] - a[1]).map(([x, n]) => `${esc(x)} (${n})`).join(", ");
  const local = logs.filter(e => (e.symptoms || []).some(x => LOCAL_SYMPTOMS.includes(x))).length;
  const vialsIn = []; for (const sb of allSubs()) for (const v of (S.vials[sb.id] || [])) if (inR(v.opened)) vialsIn.push({ sb, v });
  vialsIn.sort((a, b) => a.v.opened.localeCompare(b.v.opened));
  const labsIn = S.labs.filter(l => inR(l.date)).sort((a, b) => a.date.localeCompare(b.date));
  const perSub = {}; logs.forEach(e => { const p = perSub[e.sub] = perSub[e.sub] || { n: 0, mg: 0, feels: [] }; p.n++; p.mg += e.mg; if (e.feel > 0) p.feels.push(e.feel); });
  return `<div class="pv-bar"><button class="btn primary" data-act="report-print">Tipărește / Salvează PDF</button><button class="btn" data-act="report-close">Închide</button></div>
  <h1>Raport de administrare peptide</h1>
  <div class="small">${name ? "Pacient: <b>" + esc(name) + "</b> · " : ""}Perioada ${fmtL(from)} ${fromKey(from).getFullYear()} – ${fmtL(to)} ${fromKey(to).getFullYear()} · generat ${fmtFull(todayKey())} · Peptide Tracker v${APP_VERSION}</div>
  <div class="box small">Substanțele de mai jos sunt reactivi de cercetare, neautorizați ca medicamente în România sau UE. Dozele provin din fișa furnizorului și din literatură, nu din prescripție medicală. Raportul este un jurnal de autoadministrare, întocmit pentru consult.</div>
  <h2>Planul în perioadă</h2>
  <table><thead><tr><th>Substanța</th><th>Doză standard</th><th>Cale</th><th>Program</th><th>Perioada</th><th>Administrări</th><th>Total</th><th>Stare medie</th></tr></thead><tbody>
  ${subsIn.map(sb => { const p = perSub[sb.id] || { n: 0, mg: 0, feels: [] }; const fa = p.feels.length ? num(p.feels.reduce((a, b) => a + b, 0) / p.feels.length) : "–"; return `<tr><td><b>${esc(sb.name)}</b><br><span class="small">${esc(sb.what)}</span></td><td>${esc(doseLabel(sb, sb.doseMg))} = ${fmtU(unitsFor(sb, sb.doseMg, activeVial(sb.id)))}</td><td>${esc(routeOf(sb).name)}</td><td>${esc(sb.cycle)}</td><td>${fmt(sb.from)} – ${fmt(sb.to)} ${fromKey(sb.to).getFullYear()}</td><td>${p.n}</td><td>${esc(doseLabel(sb, p.mg))}</td><td>${fa}</td></tr>`; }).join("")}
  </tbody></table>
  <h2>Sumar</h2>
  <p>${logs.length} administrări înregistrate${avg ? `, stare medie ${num(avg)}/5 (${feels.length} evaluări)` : ""}. Reacții locale notate: ${local}. ${symRows ? "Simptome și observații bifate: " + symRows + "." : "Nicio observație bifată."}</p>
  <h2>Administrări</h2>
  ${logs.length ? `<table><thead><tr><th>Data</th><th>Ora</th><th>Substanța</th><th>Doză</th><th>Cale · loc</th><th>Stare</th><th>Observații</th>${withComments ? "<th>Comentariu</th>" : ""}</tr></thead><tbody>
  ${logs.map(e => { const sb = sub(e.sub); const dev = e.planned && Math.abs(e.units - e.planned.units) > 0.01 ? ` <span class="small">(planificat ${fmtU(e.planned.units)})</span>` : ""; return `<tr><td>${fmtL(e.date)} ${fromKey(e.date).getFullYear()}</td><td>${esc(e.time || "")}</td><td>${esc(sb.short)}</td><td>${esc(e.label)} = ${fmtU(e.units)}${dev}</td><td>${(e.route || "sc").toUpperCase()} · ${esc(e.site || "")}</td><td>${e.feel || "–"}</td><td>${esc((e.symptoms || []).join(", "))}</td>${withComments ? `<td>${esc(e.comment || "")}</td>` : ""}</tr>`; }).join("")}
  </tbody></table>` : "<p>Nicio administrare în perioadă.</p>"}
  <h2>Fiole preparate</h2>
  ${vialsIn.length ? `<table><thead><tr><th>Data</th><th>Substanța</th><th>Fiola</th><th>Lot / comandă</th><th>Reconstituire</th><th>Concentrație</th><th>Stare</th></tr></thead><tbody>${vialsIn.map(({ sb, v }) => { const o = (S.orders || []).find(x => x.id === v.orderId); return `<tr><td>${fmtL(v.opened)} ${fromKey(v.opened).getFullYear()}</td><td>${esc(sb.name)}</td><td>#${v.n} · ${sb.vialMg} mg</td><td>${v.lot ? "lot " + esc(v.lot) : ""}${o ? (v.lot ? " · " : "") + esc(o.supplier) + " " + fmt(o.date) : ""}</td><td>${sb.ready ? "gata de uz" : num(v.waterMl) + " ml apă bacteriostatică"}</td><td>${num(conc(sb, v))} mg/ml</td><td>${v.discarded ? "aruncată" : num(v.leftMg) + " mg rămase"}</td></tr>`; }).join("")}</tbody></table>` : "<p>Nicio fiolă preparată în perioadă.</p>"}
  <h2>Analize de sânge</h2>
  ${labsIn.length ? `<table><thead><tr><th>Analiză</th>${labsIn.map(l => `<th>${fmtL(l.date)} ${fromKey(l.date).getFullYear()}</th>`).join("")}<th>Interval orientativ</th></tr></thead><tbody>${LAB_FIELDS.filter(f => labsIn.some(l => l.v[f.k] != null)).map(f => `<tr><td>${esc(f.n)} (${esc(f.u)})</td>${labsIn.map(l => `<td>${l.v[f.k] != null ? num(l.v[f.k]) : ""}</td>`).join("")}<td>${num(f.lo)}–${f.hi > 900 ? "" : num(f.hi)}</td></tr>`).join("")}</tbody></table>${labsIn.some(l => l.note) ? `<p class="small">${labsIn.filter(l => l.note).map(l => fmtL(l.date) + ": " + esc(l.note)).join("<br>")}</p>` : ""}` : "<p>Nicio analiză înregistrată în perioadă.</p>"}
  <h2>Surse și note</h2>
  <p class="small">Doze și reconstituire: fișa furnizorului MKM („dozaj si administrare”), august 2026. Nivelul dovezilor, avertismente și dozele raportate: „Raport de analiză peptide”, 19 august 2026. Certificatele de analiză din dosar acoperă puritatea (HPLC) și identitatea, nu sterilitatea sau endotoxinele.</p>`;
}

/* ---------- sincronizare GitHub (backup automat + intre dispozitive) ---------- */
let pushTimer = null, syncBusy = false;
const ghCfg = () => S.sync || {};
function ghUrl() { const c = ghCfg(); return `https://api.github.com/repos/${c.repo}/contents/${c.path}`; }
function ghHeaders() { return { "Authorization": "Bearer " + ghCfg().token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }; }
const b64enc = str => btoa(unescape(encodeURIComponent(str)));
const b64dec = b => decodeURIComponent(escape(atob(b.replace(/\n/g, ""))));
function exportable() { const c = JSON.parse(JSON.stringify(S)); if (c.sync) c.sync = Object.assign({}, c.sync, { token: "" }); delete c.notified; return c; }
async function ghGet() {
  const r = await fetch(ghUrl() + "?ref=" + encodeURIComponent(ghCfg().branch) + "&t=" + Date.now(), { headers: ghHeaders(), cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("GitHub " + r.status + (r.status === 401 ? ": token invalid" : r.status === 403 ? ": fără drepturi pe repo" : ""));
  const j = await r.json();
  let data = null; try { data = JSON.parse(b64dec(j.content)); } catch (e) {}
  return { sha: j.sha, data };
}
async function ghPut(obj, sha) {
  const body = { message: "Peptide Tracker backup " + new Date().toISOString(), content: b64enc(JSON.stringify(obj)), branch: ghCfg().branch };
  if (sha) body.sha = sha;
  const r = await fetch(ghUrl(), { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, ghHeaders()), body: JSON.stringify(body) });
  if (!r.ok) throw new Error("GitHub " + r.status + (r.status === 401 ? ": token invalid" : r.status === 403 ? ": token fără drept de scriere" : r.status === 409 ? ": conflict, reîncearcă" : r.status === 404 ? ": repo sau ramură inexistentă" : ""));
  return (await r.json()).content.sha;
}
function schedulePush() { if (!ghCfg().token || /401/.test(ghCfg().lastError || "")) return; clearTimeout(pushTimer); pushTimer = setTimeout(() => pushSync(false), 4000); }
let pendingConflict = null;
const localHasData = () => !!(S.log.length || Object.keys(S.vials).length || S.labs.length || (S.orders || []).length);
function raiseConflict(cur) { if ($("#sheet").innerHTML) pendingConflict = cur; else conflictSheet(cur); }
async function pushSync(manual) {
  if (!ghCfg().token || syncBusy || !navigator.onLine) return;
  syncBusy = true;
  try {
    const cur = await ghGet();
    const seen = S.sync.lastSha || "";
    if (cur && cur.sha !== seen && (seen || (cur.data && localHasData()))) { syncBusy = false; return raiseConflict(cur); }
    const sha = await ghPut(exportable(), cur && cur.sha);
    S.sync.lastSha = sha; S.sync.lastSync = Date.now(); S.sync.lastError = ""; save(true);
    if (manual) toast("Sincronizat cu GitHub");
  } catch (e) { S.sync.lastError = e.message; save(true); if (manual) toast(e.message); }
  syncBusy = false;
  const el = $("#sync-status"); if (el) el.innerHTML = syncStatusHTML();
}
async function pullSync(manual) {
  if (!ghCfg().token || syncBusy || !navigator.onLine || (!manual && /401/.test(ghCfg().lastError || ""))) return;
  syncBusy = true;
  try {
    const cur = await ghGet();
    S.sync.lastError = "";
    const localDirty = S.meta.updatedAt > (S.sync.lastSync || 0);
    if (!cur || !cur.data) { syncBusy = false; if (manual) toast("Nimic în cloud încă; trimit datele locale"); return pushSync(manual); }
    const seen = S.sync.lastSha || "";
    if (cur.sha === seen) { syncBusy = false; if (localDirty) return pushSync(manual); if (manual) toast("Totul e sincronizat"); save(true); const el0 = $("#sync-status"); if (el0) el0.innerHTML = syncStatusHTML(); return; }
    if (!localDirty && (seen || !localHasData())) { adoptRemote(cur.data, cur.sha); if (manual) toast("Date actualizate din cloud"); }
    else { syncBusy = false; return raiseConflict(cur); }
  } catch (e) { S.sync.lastError = e.message; save(true); if (manual) toast(e.message); }
  syncBusy = false;
  const el = $("#sync-status"); if (el) el.innerHTML = syncStatusHTML();
}
function adoptRemote(data, sha) {
  const keep = S.sync;
  S = migrate(data);
  S.sync = Object.assign({}, S.sync, keep, { calId: (data.sync && data.sync.calId) || keep.calId || "", lastSync: Date.now(), lastSha: sha || keep.lastSha || "", lastError: "" });
  save(true); render();
  if (!authValid()) showLock("lock");
}
function conflictSheet(cur) {
  const rem = cur.data;
  openSheet(`<h2>Date diferite pe telefon și în cloud</h2>
    <p class="muted">Ambele au fost modificate de la ultima sincronizare. Alege care versiune rămâne; cealaltă se pierde.</p>
    <div class="stack">
      <div class="card"><b>Telefonul acesta</b><br><span class="tiny">${S.log.length} administrări · ${Object.values(S.vials).flat().length} fiole · ${S.labs.length} analize · modificat ${new Date(S.meta.updatedAt).toLocaleString("ro-RO")}</span></div>
      <div class="card"><b>Cloud (GitHub)</b><br><span class="tiny">${(rem.log || []).length} administrări · ${Object.values(rem.vials || {}).flat().length} fiole · ${(rem.labs || []).length} analize · modificat ${new Date(rem.meta ? rem.meta.updatedAt : 0).toLocaleString("ro-RO")}</span></div>
    </div>
    <div class="row"><button class="btn primary grow" data-act="sync-keep-local">Păstrează telefonul</button><button class="btn grow" data-act="sync-keep-remote">Ia versiunea din cloud</button></div>`, null, true);
  window.__conflict = cur;
}
function syncStatusHTML() {
  const c = ghCfg();
  if (!c.token) return `<span class="sync-status">Neconfigurat. Datele stau doar pe acest telefon.</span>`;
  const dirty = S.meta.updatedAt > (c.lastSync || 0);
  return `<span class="sync-status">${c.lastError ? `<b class="err">Eroare: ${esc(c.lastError)}</b>` : dirty ? `<b style="color:var(--am)">Modificări nesincronizate</b>` : `<b>Sincronizat</b>`}${c.lastSync ? ` · ultima sincronizare ${new Date(c.lastSync).toLocaleString("ro-RO")}` : ""} · ${esc(c.repo)} @ ${esc(c.branch)}/${esc(c.path)}</span>`;
}

/* ---------- comenzi si loturi ---------- */
function ordersCard() {
  const os = (S.orders || []).slice().sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="card orders stack"><div class="row between"><h2 style="margin:0">Comenzi și loturi</h2><button class="btn small primary" data-act="order-new">Adaugă comandă</button></div>
    <p class="tiny">Fiecare fiolă preparată se leagă de comanda și lotul din care provine, ca să știi de unde vine o reacție. Certificatele de analiză le păstrezi ca linkuri sau nume de fișier.</p>
    ${os.length ? os.map(o => `<div class="o"><div class="row between"><b>${esc(o.supplier)}</b><span class="tiny">${fmtL(o.date)} ${fromKey(o.date).getFullYear()}</span></div>
      <div>${(o.items || []).filter(it => it.vials > 0).map(it => { const sb = SUBS.find(x => x.id === it.sub); const used = (S.vials[it.sub] || []).filter(v => v.orderId === o.id).length; return `${esc(sb ? sb.short : it.sub)} ×${it.vials}${it.lot ? " (lot " + esc(it.lot) + ")" : ""}${used ? ` <span class="tiny">${used} deschise</span>` : ""}`; }).join(" · ")}</div>
      ${o.certs ? `<div class="tiny">Certificate: ${esc(o.certs).replace(/\n/g, " · ")}</div>` : ""}${o.notes ? `<div class="tiny">${esc(o.notes)}</div>` : ""}
      <div class="row"><button class="btn small" data-act="order-edit" data-oid="${o.id}">Editează</button></div></div>`).join("") : `<p class="muted">Nicio comandă înregistrată. Prima este comanda MKM din august 2026: adaug-o cu „Adaugă comandă”, cu loturile de pe fiole.</p>`}</div>`;
}
function orderSheet(entry) {
  const o = entry || { id: Date.now(), supplier: "MKM", date: "2026-08-19", items: SUBS.map(sb => ({ sub: sb.id, vials: 10, lot: "" })), certs: "", notes: "" };
  const itemOf = id => (o.items || []).find(x => x.sub === id) || { vials: 0, lot: "" };
  openSheet(`<h2>${entry ? "Comanda " + esc(o.supplier) : "Comandă nouă"}</h2>
    <div class="stack">
      <div class="row"><label class="f grow">Furnizor<input type="text" id="o-sup" value="${esc(o.supplier)}"></label><label class="f" style="width:150px">Data<input type="date" id="o-date" value="${o.date}"></label></div>
      <div class="itemgrid"><span class="hd">Substanța</span><span class="hd">Fiole</span><span class="hd">Lot (de pe fiolă)</span>
      ${SUBS.map(sb => { const it = itemOf(sb.id); return `<span>${esc(sb.short)}</span><input type="number" min="0" step="1" inputmode="numeric" data-ov="${sb.id}" value="${it.vials || ""}"><input type="text" data-ol="${sb.id}" value="${esc(it.lot || "")}" placeholder="ex. ET10-2607">`; }).join("")}</div>
      <label class="f">Certificate de analiză (un rând fiecare: link sau nume de fișier)<textarea id="o-certs" placeholder="ex. SS-31 10mg purity.pdf (folder mkm)&#10;https://...">${esc(o.certs || "")}</textarea></label>
      <label class="f">Note (AWB, preț, observații la primire)<textarea id="o-notes">${esc(o.notes || "")}</textarea></label>
    </div>
    <div class="row"><button class="btn primary grow" data-act="order-save" data-oid="${o.id}" data-new="${entry ? "" : "1"}">Salvează</button>${entry ? `<button class="btn danger" data-act="order-delete" data-oid="${o.id}">Șterge</button>` : ""}<button class="btn" data-act="close">Anulează</button></div>`);
}

/* ---------- planificator ciclul urmator ---------- */
function simulateEnd(base, from, vials) {
  const eff = Object.assign({}, base, { from, to: "2099-12-31", stopped: false });
  let v = null, n = 0, last = null, doses = 0;
  for (let k = from, i = 0; i < 1500; i++, k = addDays(k, 1)) {
    const dd = scheduled(eff, k); if (!dd) continue;
    if (!v || diffDays(v.opened, k) > eff.stabilityDays || v.left + 1e-9 < dd.mg) { if (n >= vials) break; v = { opened: k, left: eff.vialMg }; n++; }
    v.left -= dd.mg; doses++; last = k;
  }
  return { to: last, doses, vials: n };
}
function cycleSheet() {
  const k = todayKey();
  const rows = allSubs().map(s => {
    const done = s.to < k || s.stopped;
    const used = (S.vials[s.id] || []).filter(x => x.opened >= s.from).length;
    return `<div class="row" style="gap:8px"><label class="check grow" style="padding:4px 0"><input type="checkbox" data-cs="${s.id}" ${done ? "checked" : ""}> <b>${esc(s.short)}</b> <span class="tiny">${s.stopped ? "oprit" : "până pe " + fmt(s.to) + " " + fromKey(s.to).getFullYear()} · ${used}/${s.stock} fiole folosite</span></label><input type="number" class="mono" data-cv="${s.id}" min="1" step="1" value="10" style="width:64px;border:1px solid var(--line);border-radius:6px;padding:6px;background:var(--surface);color:var(--ink)" title="fiole"></div>`;
  }).join("");
  openSheet(`<h2>Planifică ciclul următor</h2>
    <p class="muted">Bifează substanțele, pune câte fiole ai pentru fiecare și data de start. Aplicația calculează sfârșitul cu aceleași reguli: cicluri, pauze, fiole care expiră. Substanțele terminate sunt bifate implicit.</p>
    <div class="stack">
      <div class="row"><label class="f grow">Data de start<input type="date" id="c-start" value="${addDays(k, 14)}"></label><label class="f grow">Introducere<select id="c-intro"><option value="0">toate în ziua de start</option><option value="7" selected>câte una pe săptămână, în ordinea listei</option><option value="14">câte una la două săptămâni</option></select></label></div>
      <p class="tiny">Raportul recomandă o pauză de washout înainte de un ciclu nou și analize de control; startul propus este peste 14 zile.</p>
      <div class="stack" style="gap:2px">${rows}</div>
      <div class="alert info" id="c-preview">Bifează substanțele ca să vezi calendarul rezultat.</div>
    </div>
    <div class="row"><button class="btn primary grow" data-act="cycle-apply">Aplică în plan</button><button class="btn" data-act="close">Anulează</button></div>`, host => {
    const preview = () => {
      const start = host.querySelector("#c-start").value, step = +host.querySelector("#c-intro").value;
      if (!start) return;
      const picks = [...host.querySelectorAll("[data-cs]:checked")].map(i => i.dataset.cs);
      if (!picks.length) { host.querySelector("#c-preview").textContent = "Nimic bifat."; return; }
      let i = 0, out = [];
      for (const id of picks) { const b = SUBS.find(x => x.id === id); const vials = +host.querySelector(`[data-cv="${id}"]`).value || 10; const from = addDays(start, i * step); const r = simulateEnd(Object.assign({}, sub(id), { test: false }), from, vials); out.push(`<b>${esc(b.short)}</b>: ${fmtL(from)} → ${r.to ? fmtL(r.to) + " " + fromKey(r.to).getFullYear() : "?"} · ${r.doses} doze · ${r.vials} fiole`); i++; }
      host.querySelector("#c-preview").innerHTML = out.join("<br>");
    };
    host.querySelectorAll("[data-cs],[data-cv],#c-start,#c-intro").forEach(el => el.addEventListener("change", preview));
    host.querySelectorAll("[data-cv]").forEach(el => el.addEventListener("input", preview));
    preview();
  });
}

/* ---------- calendar abonat (ICS publicat pe GitHub Pages) ---------- */
let calTimer = null;
function icsHash(str) { let h = 0; const t = str.replace(/DTSTAMP:[^\r\n]*/g, ""); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h; }
function calUrl() { const c = ghCfg(); if (!c.calId) return ""; const [u, r] = c.repo.split("/"); return `https://${u}.github.io/${r}/cal/${c.calId}.ics`; }
function scheduleCalPublish() { if (!ghCfg().token || !ghCfg().calId || /401/.test((ghCfg().lastError || "") + (ghCfg().calError || ""))) return; clearTimeout(calTimer); calTimer = setTimeout(() => publishCal(false), 15000); }
async function publishCal(manual) {
  const c = ghCfg(); if (!c.token || !c.calId || !navigator.onLine) return;
  const ics = buildICS(), hs = icsHash(ics);
  if (!manual && hs === c.calHash) return;
  const path = `cal/${c.calId}.ics`;
  try {
    const cur = await ghGetPath(path, "main");
    await ghPutPath(path, "main", ics, cur && cur.sha, "Calendar Peptide Tracker " + new Date().toISOString());
    c.calHash = hs; c.calAt = Date.now(); c.calError = ""; save(true);
    if (manual) toast("Calendar publicat; GitHub Pages îl servește în 1-2 minute");
  } catch (e) { c.calError = e.message; save(true); if (manual) toast(e.message); }
  const el = $("#cal-status"); if (el) el.innerHTML = calStatusHTML();
}
function calStatusHTML() {
  const c = ghCfg();
  if (!c.token) return `<span class="sync-status"><b class="err">Configurează întâi tokenul GitHub</b> din cardul de sincronizare.</span>`;
  if (!c.calId) return `<span class="sync-status">Nepublicat încă.</span>`;
  return `<span class="sync-status">${c.calError ? `<b class="err">Eroare: ${esc(c.calError)}</b>` : `<b>Publicat</b>`}${c.calAt ? ` · ultima publicare ${new Date(c.calAt).toLocaleString("ro-RO")}` : ""}</span><div class="url" style="margin-top:6px">${esc(calUrl())}</div>`;
}
async function ghGetPath(path, branch) {
  const c = ghCfg();
  const r = await fetch(`https://api.github.com/repos/${c.repo}/contents/${path}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`, { headers: ghHeaders(), cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("GitHub " + r.status);
  const j = await r.json(); return { sha: j.sha };
}
async function ghPutPath(path, branch, content, sha, message) {
  const c = ghCfg();
  const body = { message, content: b64enc(content), branch }; if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${c.repo}/contents/${path}`, { method: "PUT", headers: Object.assign({ "Content-Type": "application/json" }, ghHeaders()), body: JSON.stringify(body) });
  if (!r.ok) throw new Error("GitHub " + r.status + (r.status === 401 ? ": token invalid" : r.status === 403 ? ": token fără drept de scriere" : r.status === 409 ? ": conflict, reîncearcă" : ""));
  return (await r.json()).content.sha;
}

/* ---------- autentificare Google (blocare la deschidere) ---------- */
const AK = "peptide-auth-session";
function authSession() { try { return JSON.parse(localStorage.getItem(AK) || "null"); } catch (e) { return null; } }
function authValid() { const a = S.auth || {}; if (!a.enabled) return true; const ss = authSession(); if (!ss || !ss.email) return false; if (a.allowed && a.allowed.length && !a.allowed.includes(ss.email)) return false; return Date.now() - ss.at < (a.days || 30) * 86400e3; }
let gisPromise = null;
function loadGIS() {
  if (window.google && google.accounts && google.accounts.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((res, rej) => {
    const sc = document.createElement("script"); sc.src = "https://accounts.google.com/gsi/client"; sc.async = true; sc.defer = true;
    sc.onload = () => res(); sc.onerror = () => { gisPromise = null; rej(new Error("gis")); };
    document.head.appendChild(sc);
    setTimeout(() => { if (!(window.google && google.accounts)) { gisPromise = null; rej(new Error("timeout")); } }, 8000);
  });
  return gisPromise;
}
function jwtPayload(tok) { try { const p = tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(decodeURIComponent(escape(atob(p + "=".repeat((4 - p.length % 4) % 4))))); } catch (e) { return null; } }
let lockMode = "lock"; // "lock" sau "enable"
function showLock(mode) {
  lockMode = mode || "lock";
  const el = $("#lock"); const a = S.auth || {}; const ss = authSession();
  el.innerHTML = `<div class="box">
    <div style="font-size:40px">💉</div>
    <h1>${lockMode === "enable" ? "Conectează-te ca să activezi blocarea" : "Peptide Tracker este blocat"}</h1>
    <p class="st">${lockMode === "enable" ? "Contul cu care te conectezi acum devine singurul cont care poate deschide aplicația." : (a.allowed && a.allowed.length ? "Conectează-te cu " + esc(a.allowed.join(" sau ")) + "." : "Conectează-te cu contul Google configurat.")}</p>
    <div class="gbtn" id="gbtn"><span class="st">Se încarcă butonul Google...</span></div>
    <div class="st" id="lock-st"></div>
    ${lockMode === "enable" ? `<button class="btn" data-act="lock-cancel">Renunță</button>` : ""}
  </div>`;
  el.classList.add("on"); el.setAttribute("aria-hidden", "false");
  loadGIS().then(() => {
    google.accounts.id.initialize({ client_id: a.clientId, callback: handleCredential, auto_select: false, itp_support: true });
    const host = $("#gbtn"); host.innerHTML = "";
    google.accounts.id.renderButton(host, { theme: "outline", size: "large", text: "signin_with", shape: "pill", locale: "ro" });
    if (lockMode === "lock") google.accounts.id.prompt();
  }).catch(() => {
    $("#gbtn").innerHTML = `<span class="st" style="color:var(--warn)">Nu pot încărca autentificarea Google (fără internet?).</span>`;
    if (lockMode === "lock" && ss && ss.email && (!a.allowed.length || a.allowed.includes(ss.email))) $("#lock-st").innerHTML = `<p>Ultima conectare: ${esc(ss.email)}, ${new Date(ss.at).toLocaleDateString("ro-RO")}.</p><button class="btn primary" data-act="lock-offline">Continuă offline</button>`;
  });
}
function hideLock() { const el = $("#lock"); el.classList.remove("on"); el.setAttribute("aria-hidden", "true"); el.innerHTML = ""; }
function handleCredential(resp) {
  const p = jwtPayload(resp && resp.credential); const a = S.auth;
  const st = $("#lock-st");
  if (!p || !p.email) { if (st) st.textContent = "Răspuns invalid de la Google."; return; }
  if (p.aud !== a.clientId) { if (st) st.textContent = "Client ID diferit de cel configurat."; return; }
  if (p.exp && p.exp * 1000 < Date.now()) { if (st) st.textContent = "Sesiune Google expirată, încearcă din nou."; return; }
  if (p.email_verified === false) { if (st) st.textContent = "Adresa de e-mail nu este verificată la Google."; return; }
  if (lockMode === "lock" && a.allowed && a.allowed.length && !a.allowed.includes(p.email)) { if (st) st.innerHTML = `<span style="color:var(--warn)">Contul ${esc(p.email)} nu are acces la această aplicație.</span>`; return; }
  try { localStorage.setItem(AK, JSON.stringify({ email: p.email, name: p.name || "", at: Date.now() })); } catch (e) {}
  if (lockMode === "enable") { a.enabled = true; if (!a.allowed.includes(p.email)) a.allowed.push(p.email); save(); toast("Blocare activată pentru " + p.email); }
  else toast("Bun venit" + (p.given_name ? ", " + p.given_name : ""));
  hideLock(); render();
}
function authCard() {
  const a = S.auth || {}; const ss = authSession();
  return `<div class="card stack"><h2>Blocare cu cont Google</h2>
    <p class="muted">La deschidere, aplicația cere conectarea cu contul tău Google și refuză alte conturi. Este o încuietoare de acces, nu criptare: datele rămân în memoria telefonului. Sesiunea ține ${a.days || 30} de zile; fără internet, poți continua pe ultima sesiune.</p>
    <p class="sync-status">${a.enabled ? `<b>Activă</b> · ${ss && ss.email ? "conectat ca " + esc(ss.email) : "neconectat"} · conturi permise: ${esc((a.allowed || []).join(", ") || "primul care se conectează")}` : "Inactivă"}</p>
    <label class="f">Client ID OAuth (Google Cloud)<input type="text" id="a-cid" value="${esc(a.clientId || "")}" placeholder="xxxxxxxx.apps.googleusercontent.com" autocomplete="off"></label>
    <div class="row"><label class="f grow">Conturi permise (câte unul pe rând; gol = primul care se conectează)<textarea id="a-allowed" style="min-height:52px">${esc((a.allowed || []).join("\n"))}</textarea></label><label class="f" style="width:110px">Sesiune (zile)<input type="number" id="a-days" min="1" max="365" value="${a.days || 30}"></label></div>
    <div class="row wrap"><button class="btn" data-act="auth-save">Salvează setările</button>${a.enabled ? `<button class="btn" data-act="auth-lock">Blochează acum</button><button class="btn danger" data-act="auth-disable">Dezactivează blocarea</button>` : `<button class="btn primary" data-act="auth-enable">Activează (conectare Google)</button>`}</div>
    <details><summary class="tiny" style="cursor:pointer">Cum obții Client ID-ul (o singură dată, ~5 minute)</summary><ol class="steps" style="font-size:13px;margin-top:6px"><li>console.cloud.google.com → creează un proiect (ex. „Peptide Tracker”).</li><li>APIs &amp; Services → OAuth consent screen: tip External, completează numele aplicației și e-mailul, la „Test users” adaugă contul tău Google. Nu e nevoie de publicare.</li><li>APIs &amp; Services → Credentials → Create credentials → OAuth client ID → Application type: Web application.</li><li>Authorized JavaScript origins: <span class="mono">https://dragosnimu.github.io</span>. Fără redirect URI.</li><li>Copiază Client ID-ul (se termină în .apps.googleusercontent.com) și lipește-l mai sus, apoi „Salvează setările” și „Activează”.</li></ol><p class="tiny">Client ID-ul nu este secret; intră în backup, ca al doilea telefon să îl aibă automat. Google afișează conectarea în numele aplicației tale din Cloud Console.</p></details></div>`;
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
  let h = `<div class="row" style="justify-content:flex-end"><button class="btn small" data-act="report-open">Raport pentru medic (PDF)</button></div>
  <div class="card"><h2>Evoluție</h2>${chartSVG()}</div>
  <div class="card"><h2>Locuri de injecție</h2><div class="bodywrap">${bodySVG(null, false)}${bodyLegend()}</div></div>
  ${labsCard()}
  <div class="card flat"><label class="f">Filtrează<select id="log-filter"><option value="">Toate substanțele</option>${SUBS.map(s => `<option value="${s.id}" ${logFilter === s.id ? "selected" : ""}>${esc(s.short)}</option>`).join("")}</select></label></div>`;
  h += `<div class="card">${list.length ? list.map(e => {
    const s = sub(e.sub);
    return `<div class="entry"><div class="h"><span>${esc(s.short)} · ${esc(e.label)} = ${fmtU(e.units)}${e.planned && Math.abs(e.units - e.planned.units) > 0.01 ? ` <span class="chip warn">planificat ${fmtU(e.planned.units)}</span>` : ""}</span><span>${fmtL(e.date)} ${esc(e.time || "")}</span></div>
      <div class="m row wrap">${e.feel ? `<span class="feel f${e.feel}">${e.feel}</span>` : ""}<span class="chip">${(e.route || "sc").toUpperCase()}</span><span>${esc(e.site || "")}</span>${(e.symptoms || []).map(x => `<span class="chip">${esc(x)}</span>`).join("")}</div>
      ${e.comment ? `<div class="m">${esc(e.comment)}</div>` : ""}
      <div class="row"><button class="btn small" data-act="log-edit" data-eid="${e.id}">Editează</button></div></div>`;
  }).join("") : `<p class="muted">Nicio înregistrare${logFilter ? " pentru această substanță" : ""}.</p>`}</div>`;
  main.innerHTML = `<div class="view">${h}</div>`;
  $("#log-filter").addEventListener("change", e => { logFilter = e.target.value; renderLog(); });
}
function suggestSite(rk, ml) {
  const sites = ROUTES[rk || "sc"].sites.filter(x => !(ml > 2 && x.startsWith("deltoid")));
  let best = sites[0], bestScore = -Infinity;
  for (const st of sites) { const i = siteInfo(st); let sc = i.days === null ? 9999 : i.days; if (i.react && i.days < 7) sc = -1; if (sc > bestScore) { bestScore = sc; best = st; } }
  return best;
}
function logSheet(id, k, entry) {
  const s = sub(id);
  const d = entry ? null : scheduled(s, k);
  const rk0 = entry ? (entry.route || "sc") : (s.routeKey || "sc");
  const e = entry || { id: Date.now(), date: k, time: nowHM(), sub: id, mg: d.mg, units: d.units, label: d.label, site: suggestSite(rk0, d ? d.units / 100 : 0), feel: 0, symptoms: [], comment: "", planned: { mg: d.mg, units: d.units, label: d.label }, route: rk0 };
  const vialOf = entry ? ((S.vials[id] || []).find(x => x.n === entry.vial) || activeVial(id)) : activeVial(id);
  const cc = conc(s, vialOf);
  const planned = e.planned || { mg: e.mg, units: e.units, label: e.label };
  const html = `<h2>${entry ? "Administrare" : "Administrat"}: ${esc(s.short)}</h2>
    <p class="muted">${esc(s.route)} · ${esc(fmtL(e.date))} · recomandat: <b>${esc(planned.label)} = ${fmtU(planned.units)}</b>${vialOf ? ` · fiola #${vialOf.n}${vialOf.lot ? ", lot " + esc(vialOf.lot) : ""}` : ""}</p>
    <label class="f">Unități administrate (seringă U-100)<input type="number" id="l-units" inputmode="decimal" step="0.5" min="0" value="${String(Math.round(e.units * 100) / 100)}"></label>
    <div class="alert info" id="l-calc"></div>
    ${!entry && d && !d.vial ? `<div class="alert"><b>Nu ai o fiolă activă pentru ${esc(s.short)}</b>Poți salva oricum, dar stocul din fiolă nu va fi scăzut.</div>` : ""}
    <div class="stack">
      <label class="f">Ora<input type="time" id="l-time" value="${esc(e.time)}"></label>
      <label class="f">Calea de administrare<select id="l-route"><option value="sc" ${rk0 === "sc" ? "selected" : ""}>Subcutanat (SC)</option><option value="im" ${rk0 === "im" ? "selected" : ""}>Intramuscular (IM)</option></select></label>
      <label class="f">Locul injecției<select id="l-site">${ROUTES[rk0].sites.map(x => `<option ${x === e.site ? "selected" : ""}>${x}</option>`).join("")}</select></label>
      <div class="bodywrap" id="l-body">${bodySVG(e.site, true)}<div class="lg"><b>Apasă un punct ca să alegi locul.</b><br>roșu = ultimele 3 zile, portocaliu = 3-6 zile, verde = liber, inel = reacție locală.</div></div>
      <div id="l-warn"></div>
      <details><summary class="tiny" style="cursor:pointer">Procedura pas cu pas (${ROUTES[rk0].label})</summary><ol class="steps" id="l-proc" style="font-size:13.5px;margin-top:6px">${ROUTES[rk0].steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol><p class="tiny" id="l-needle">${esc(ROUTES[rk0].needle)}</p></details>
      <div><div class="tiny" style="margin-bottom:4px">Cum te simți (1 = rău, 5 = foarte bine)</div><div class="scale" id="l-feel">${[1, 2, 3, 4, 5].map(i => `<button type="button" class="${e.feel === i ? "on" : ""}" data-f="${i}">${i}</button>`).join("")}</div><div class="scale-l"><span>rău</span><span>foarte bine</span></div></div>
      <div><div class="tiny" style="margin-bottom:6px">Simptome / observații</div><div class="chips" id="l-sym">${SYMPTOMS.map(x => `<button type="button" class="tog ${(e.symptoms || []).includes(x) ? "on" : ""}" data-s="${esc(x)}">${esc(x)}</button>`).join("")}</div></div>
      <label class="f">Comentariu<textarea id="l-comment" placeholder="ex. ușoară usturime 2 min, apoi nimic">${esc(e.comment)}</textarea></label>
    </div>
    <div class="row"><button class="btn primary grow" data-act="log-save" data-eid="${e.id}" data-id="${id}" data-k="${e.date}" data-new="${entry ? "" : "1"}">Salvează</button>${entry ? `<button class="btn danger" data-act="log-delete" data-eid="${e.id}">Șterge</button>` : ""}<button class="btn" data-act="close">Anulează</button></div>`;
  openSheet(html, host => {
    host.__draft = { mg: e.mg, units: e.units, label: e.label, feel: e.feel, symptoms: (e.symptoms || []).slice(), planned };
    const calc = () => {
      const u = Math.max(0, parseFloat(host.querySelector("#l-units").value) || 0);
      const mg = u / 100 * cc;
      host.__draft.units = u; host.__draft.mg = mg; host.__draft.label = doseLabel(s, mg);
      const diff = Math.abs(u - planned.units) > 0.01;
      host.querySelector("#l-calc").innerHTML = `<b>${fmtU(u)} = ${esc(doseLabel(s, mg))}</b>${diff ? `<span style="color:var(--warn)">Diferit de doza recomandată (${fmtU(planned.units)}): ${u > planned.units ? "+" : "−"}${num(Math.abs(u - planned.units))} U</span>` : "Doza recomandată."}${u > 100 ? `<br><span style="color:var(--warn)">Peste o seringă de 1 ml.</span>` : ""}`;
    };
    host.querySelector("#l-units").addEventListener("input", calc); calc();
    host.querySelector("#l-site").addEventListener("change", ev => { host.querySelector("#l-body").innerHTML = bodySVG(ev.target.value, true) + host.querySelector("#l-body .lg").outerHTML; });
    host.querySelector("#l-route").addEventListener("change", ev => {
      const r = ROUTES[ev.target.value]; const sel = host.querySelector("#l-site"); const cur = sel.value;
      sel.innerHTML = r.sites.map(x => `<option ${x === cur ? "selected" : ""}>${x}</option>`).join("");
      if (!r.sites.includes(cur)) sel.value = suggestSite(ev.target.value, (parseFloat(host.querySelector("#l-units").value) || 0) / 100);
      host.querySelector("#l-proc").innerHTML = r.steps.map(x => `<li>${esc(x)}</li>`).join("");
      host.querySelector("#l-needle").textContent = r.needle;
      host.querySelector("details summary").textContent = `Procedura pas cu pas (${r.label})`;
    });
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
      ${hasIM(s) ? `<div class="alert info"><b>Cale de administrare: ${esc(routeOf(s).name)}</b>${esc(s.routeNotes[s.routeKey])} <button class="btn small" data-act="route-edit" data-id="${id}" style="margin-top:6px">Schimbă calea (SC / IM)</button></div>` : `<p class="tiny">Cale: ${esc(s.route)}. Sursele nu descriu o alternativă intramusculară pentru această substanță.</p>`}
      <label class="check"><input type="checkbox" id="p-stopped" ${s.stopped ? "checked" : ""}> Oprit (nu mai apare în calendar)</label>
      <label class="f">Începe<input type="date" id="p-from" value="${s.from}"></label>
      <label class="check"><input type="checkbox" id="p-shift" checked> Când mut startul, mută și sfârșitul și pauzele cu același număr de zile</label>
      <label class="f">Se termină<input type="date" id="p-to" value="${s.to}"></label>
      <label class="f">Moment<select id="p-time"><option value="am" ${s.time === "am" ? "selected" : ""}>dimineața</option><option value="pm" ${s.time === "pm" ? "selected" : ""}>seara</option></select></label>
      <label class="f">Frecvență<select id="p-pattern"><option value="daily" ${s.pattern === "daily" ? "selected" : ""}>zilnic</option><option value="dow" ${s.pattern === "dow" ? "selected" : ""}>anumite zile</option></select></label>
      <div id="p-dow" class="chips ${s.pattern === "dow" ? "" : "hide"}">${[1, 2, 3, 4, 5, 6, 0].map(i => `<button type="button" class="tog ${(s.dow || []).includes(i) ? "on" : ""}" data-d="${i}">${DAYS[i]}</button>`).join("")}</div>
      <div class="row"><label class="f grow">Ciclu activ (săpt.)<input type="number" id="p-on" min="0" step="1" value="${Math.round((s.cycleOn || 0) / 7)}"></label><label class="f grow">Pauză (săpt.)<input type="number" id="p-off" min="0" step="1" value="${Math.round((s.cycleOff || 0) / 7)}"></label></div>
      <p class="tiny">0 la ambele = fără pauze. Ciclurile se numără de la data de început.</p>
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
function routeSheet(id) {
  const s = sub(id); if (!hasIM(s)) return;
  const b = SUBS.find(x => x.id === id);
  const opt = rk => {
    const eff = Object.assign({}, b, (b.routeOptions && b.routeOptions[rk]) || {});
    const r = ROUTES[rk];
    const u = unitsFor(eff, eff.doseMg, activeVial(id));
    return `<div class="card" style="padding:12px 14px">
      <label class="check" style="font-weight:600;font-size:16px"><input type="radio" name="rt" value="${rk}" ${s.routeKey === rk ? "checked" : ""}> ${esc(r.name)}${s.routeKey === rk ? ' <span class="chip acc">ales</span>' : ""}</label>
      <p class="muted" style="font-size:14px">${esc(r.summary)}</p>
      <div class="alert info" style="margin:8px 0"><b>Pentru ${esc(s.short)}</b>${esc(b.routeNotes[rk])}<br><span class="mono">Doză: ${esc(doseLabel(eff, eff.doseMg))} = ${fmtU(u)}${u > 100 ? " = " + num(u / 100) + " ml" : ""} · ${esc(eff.cycle)}</span></div>
      <div class="tiny" style="margin-top:6px"><b style="color:var(--ok)">Avantaje</b></div><ul class="steps" style="font-size:13.5px;list-style:disc">${r.pros.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="tiny" style="margin-top:6px"><b style="color:var(--warn)">Dezavantaje</b></div><ul class="steps" style="font-size:13.5px;list-style:disc">${r.cons.map(x => `<li>${esc(x)}</li>`).join("")}</ul>
      <details style="margin-top:8px"><summary class="tiny" style="cursor:pointer">Procedura pas cu pas (${r.label}) · ${esc(r.needle)}</summary><ol class="steps" style="font-size:13.5px;margin-top:6px">${r.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol><p class="tiny">Locuri: ${r.sites.join(", ")}.</p></details>
    </div>`;
  };
  openSheet(`<h2>Calea de administrare: ${esc(s.name)}</h2>
    <p class="muted">Alege o singură cale pentru planificare. La fiecare administrare poți totuși nota altă cale, dacă ai făcut excepție.</p>
    <div class="stack" id="rt-opts">${opt("sc")}${opt("im")}</div>
    <p class="tiny">Schimbarea căii resetează doza, frecvența și data de sfârșit la valorile căii alese; administrările deja înregistrate rămân.</p>
    <div class="row"><button class="btn primary grow" data-act="route-save" data-id="${id}">Salvează calea</button><button class="btn" data-act="close">Anulează</button></div>`);
}
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
    <div class="card stack"><h2>Calendar abonat (actualizat automat)</h2>
      <p class="muted">Aplicația publică un fișier de calendar cu nume aleator pe GitHub Pages și îl republică singură la 15 secunde după orice schimbare de plan. Te abonezi o singură dată în Google Calendar, iar reminderele urmează planul fără import manual.</p>
      <div id="cal-status">${calStatusHTML()}</div>
      <div class="row wrap"><button class="btn primary" data-act="cal-publish" ${S.sync.token ? "" : "disabled"}>${S.sync.calId ? "Republică acum" : "Publică calendarul"}</button><button class="btn" data-act="cal-copy" ${S.sync.calId ? "" : "disabled"}>Copiază adresa</button><button class="btn" data-act="cal-off" ${S.sync.calId ? "" : "disabled"}>Oprește publicarea</button></div>
      <details><summary class="tiny" style="cursor:pointer">Cum te abonezi în Google Calendar</summary><ol class="steps" style="font-size:13px;margin-top:6px"><li>Pe calculator, deschide calendar.google.com.</li><li>În stânga, lângă „Alte calendare”, apasă + → „Din URL”.</li><li>Lipește adresa de mai sus și apasă „Adaugă calendarul”.</li><li>În setările acelui calendar, la „Notificări pentru evenimente”, pune o notificare „la ora evenimentului” (Google ignoră alarmele din fișier la calendarele abonate).</li><li>Pe telefon, în aplicația Google Calendar, activează calendarul „Peptide” din meniul de calendare.</li></ol><p class="tiny">Google reîmprospătează calendarele abonate la câteva ore, uneori până la o zi. Adresa este publică pentru cine o știe, dar numele aleator o face practic imposibil de ghicit; conține doar programul de administrare, nu jurnalul.</p></details></div>
    <div class="card stack"><h2>Calendar telefon</h2>
      <p class="muted">Un eveniment cu alarmă pentru fiecare sesiune (dimineața și seara), cu substanțele, doza și unitățile în titlu. Importă fișierul în Google Calendar.</p>
      <button class="btn" data-act="ics">Exportă calendar (.ics)</button></div>
    ${authCard()}
    <div class="card stack"><h2>Sincronizare și backup automat</h2>
      <p class="muted">Datele se salvează automat în repo-ul tău privat de GitHub, pe ramura <span class="mono">data</span> (neafișată de GitHub Pages), la câteva secunde după fiecare modificare, și se descarcă la deschiderea aplicației pe orice telefon. Ai nevoie de un token GitHub cu drept „Contents: Read and write” doar pe acest repo.</p>
      <div id="sync-status">${syncStatusHTML()}</div>
      <label class="f">Token GitHub (fine-grained)<input type="password" id="s-token" autocomplete="off" value="${esc(S.sync.token || "")}" placeholder="github_pat_..."></label>
      <div class="row"><label class="f grow">Repo<input type="text" id="s-repo" value="${esc(S.sync.repo)}"></label><label class="f" style="width:110px">Ramură<input type="text" id="s-branch" value="${esc(S.sync.branch)}"></label></div>
      <div class="row wrap"><button class="btn primary" data-act="sync-save">Salvează și sincronizează</button><button class="btn" data-act="sync-now" ${S.sync.token ? "" : "disabled"}>Sincronizează acum</button><button class="btn" data-act="sync-off" ${S.sync.token ? "" : "disabled"}>Deconectează</button></div>
      <details><summary class="tiny" style="cursor:pointer">Cum creezi tokenul (o singură dată)</summary><ol class="steps" style="font-size:13px;margin-top:6px"><li>Pe github.com: Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.</li><li>Repository access: „Only select repositories” → peptide-tracker.</li><li>Permissions → Repository permissions → Contents: <b>Read and write</b>. Restul rămân „No access”.</li><li>Expirare: cât mai lungă (max 1 an); când expiră, generezi altul și îl lipești aici.</li><li>Copiază tokenul și lipește-l în câmpul de mai sus, pe fiecare telefon pe care folosești aplicația.</li></ol><p class="tiny">Tokenul rămâne doar în telefon; nu este inclus în backup și nu este trimis nicăieri în afară de api.github.com.</p></details></div>
    <div class="card stack"><h2>Raport pentru medic</h2><p class="muted">Document tipăribil cu planul, administrările, starea, fiolele și analizele dintr-o perioadă. Salvezi ca PDF din fereastra de tipărire.</p><button class="btn" data-act="report-open">Generează raportul</button></div>
    <div class="card stack"><h2>Backup manual</h2>
      <p class="muted">Datele stau doar în acest browser. Exportă periodic și păstrează fișierul în Drive sau OneDrive.</p>
      <div class="row wrap"><button class="btn" data-act="export">Exportă datele (JSON)</button><label class="btn" style="display:inline-flex;align-items:center">Importă JSON<input type="file" id="s-import" accept="application/json" class="hide"></label></div></div>
    <div class="card stack"><h2>Resetare</h2>
      <div class="row wrap"><button class="btn" data-act="plan-reset-all">Resetează planul la cel inițial</button><button class="btn danger" data-act="wipe">Șterge toate datele</button></div></div>
    <div class="card stack"><h2>Versiune</h2><p>Peptide Tracker <b class="mono">v${APP_VERSION}</b> · ${fmtL(APP_DATE)} ${fromKey(APP_DATE).getFullYear()}</p><p class="tiny" id="s-upd">${navigator.serviceWorker && navigator.serviceWorker.controller ? "Rulează din cache offline; actualizările se descarcă automat la deschidere." : "Prima încărcare."}</p><div class="row wrap"><button class="btn primary" data-act="force-update">Versiune nouă: actualizează</button><button class="btn" data-act="update-check">Caută versiune nouă</button></div><p class="tiny">„Actualizează” șterge cache-ul aplicației și o reîncarcă de pe server. Jurnalul, fiolele și planul rămân neatinse.</p></div>
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
  if (changed) save(true);
}
/* IndexedDB pentru service worker */
function idb() { return new Promise((res, rej) => { if (!("indexedDB" in window)) return rej(); const r = indexedDB.open("peptide-tracker", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function kvSet(k, v) { try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction("kv", "readwrite").objectStore("kv").put(v, k); t.onsuccess = res; t.onerror = rej; }); } catch (e) {} }
async function scheduleUpcoming() {
  const list = [];
  let k = todayKey();
  for (let i = 0; i < 14; i++, k = addDays(k, 1)) for (const slot of ["am", "pm"]) {
    const ds = dosesOn(k).filter(d => d.sub.time === slot && !d.skipped);
    if (!ds.length || ds.every(d => d.logged) || S.notified[k + "|" + slot]) continue;
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
  r.onload = () => { try { const s = JSON.parse(r.result); if (!s || !s.v || !Array.isArray(s.log)) throw 0; if (!confirm(`Import: ${s.log.length} administrări, ${Object.keys(s.vials || {}).length} substanțe cu fiole. Datele curente vor fi înlocuite.`)) return; const keep = S.sync; S = migrate(s); S.sync = Object.assign({}, S.sync, { token: keep.token, repo: keep.repo, branch: keep.branch, path: keep.path, lastSync: keep.lastSync, lastSha: keep.lastSha, calId: S.sync.calId || keep.calId }); save(); toast("Date importate"); render(); } catch (e) { toast("Fișier invalid"); } };
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
    const oid = host.querySelector("#v-order") ? host.querySelector("#v-order").value : "";
    const ord = (S.orders || []).find(o => String(o.id) === oid); const oit = ord && ord.items.find(x => x.sub === d.id);
    vs.push({ n: vs.length + 1, opened, waterMl, leftMg: s.vialMg, discarded: false, orderId: ord ? ord.id : null, lot: oit && oit.lot ? oit.lot : "" });
    save(); closeSheet(); toast(`Fiola #${vs.length} ${s.ready ? "deschisă" : "reconstituită"}: ${fmtU(unitsFor(s, s.doseMg, vs[vs.length - 1]))} per doză`); render();
  },
  "vial-discard": d => { const v = activeVial(d.id); if (v && confirm(`Arunci fiola #${v.n} de ${sub(d.id).short}?`)) { v.discarded = true; save(); render(); } },
  "log-new": d => logSheet(d.id, d.k, null),
  "log-edit": d => { const e = S.log.find(x => x.id === +d.eid); if (e) logSheet(e.sub, e.date, e); },
  "log-save": d => {
    const host = $("#sheet"), dr = host.__draft;
    const time = host.querySelector("#l-time").value, site = host.querySelector("#l-site").value, comment = host.querySelector("#l-comment").value.trim(), route = host.querySelector("#l-route").value;
    {
      const s0 = sub(d.id); const e0 = d.new ? null : S.log.find(x => x.id === +d.eid);
      const v0 = d.new ? activeVial(d.id) : ((S.vials[d.id] || []).find(x => x.n === (e0 && e0.vial)) || null);
      const warns = safetyWarnings(s0, d.k, dr.units, site, route, v0, !!d.new).filter(x => d.new || !/deja înregistrat/.test(x));
      const ack = host.querySelector("#l-ack");
      if (warns.length && !(ack && ack.checked)) { host.querySelector("#l-warn").innerHTML = warnBox(warns, "l-ack"); host.querySelector("#l-warn").scrollIntoView({ block: "center" }); toast("Verifică avertizările"); return; }
    }
    if (d.new) {
      const s = sub(d.id), v = activeVial(d.id);
      if (!(dr.units > 0)) return toast("Introdu unitățile administrate");
      const taken = v ? Math.min(dr.mg, v.leftMg) : 0;
      S.log.push({ id: +d.eid, date: d.k, time, sub: d.id, mg: dr.mg, units: dr.units, label: dr.label, site, feel: dr.feel, symptoms: dr.symptoms, comment, vial: v ? v.n : null, planned: dr.planned, route, taken });
      if (v) v.leftMg = Math.max(0, Math.round((v.leftMg - taken) * 1000) / 1000);
      const dk = S.days[d.k + "|" + d.id]; if (dk && dk.skip) { delete dk.skip; delete dk.moved; }
      toast(`${s.short} înregistrat: ${fmtU(dr.units)}`);
    } else {
      const e = S.log.find(x => x.id === +d.eid);
      if (!(dr.units > 0)) return toast("Introdu unitățile administrate");
      const s = sub(e.sub), vs = S.vials[e.sub] || [], v = vs.find(x => x.n === e.vial);
      let taken = e.taken != null ? e.taken : e.mg;
      if (v) { const avail = Math.min(s.vialMg, v.leftMg + taken); taken = Math.min(dr.mg, avail); v.leftMg = Math.max(0, Math.round((avail - taken) * 1000) / 1000); }
      Object.assign(e, { time, site, feel: dr.feel, symptoms: dr.symptoms, comment, mg: dr.mg, units: dr.units, label: dr.label, route, taken }); toast("Actualizat");
    }
    save(); closeSheet(); render();
  },
  "log-delete": d => {
    const i = S.log.findIndex(x => x.id === +d.eid); if (i < 0 || !confirm("Ștergi această înregistrare?")) return;
    const e = S.log[i]; const vs = S.vials[e.sub] || []; const v = vs.find(x => x.n === e.vial); if (v) v.leftMg = Math.min(sub(e.sub).vialMg, v.leftMg + (e.taken != null ? e.taken : e.mg));
    S.log.splice(i, 1); save(); closeSheet(); render();
  },
  "skip": d => { S.days[d.k + "|" + d.id] = Object.assign(S.days[d.k + "|" + d.id] || {}, { skip: true }); save(); render(); },
  "move": d => {
    const t = addDays(d.k, 1);
    if (scheduled(sub(d.id), t)) return toast("Mâine există deja o doză; folosește „Sari”.");
    S.days[d.k + "|" + d.id] = Object.assign(S.days[d.k + "|" + d.id] || {}, { skip: true, moved: true });
    S.days[t + "|" + d.id] = Object.assign(S.days[t + "|" + d.id] || {}, { extra: true });
    save(); toast(`${sub(d.id).short} mutat pe ${fmtL(t)}`); render();
  },
  "unskip": d => { const o = S.days[d.k + "|" + d.id]; if (o) { if (o.moved) { const t = d.k && addDays(d.k, 1); const ot = S.days[t + "|" + d.id]; if (ot) { delete ot.extra; if (!Object.keys(ot).length) delete S.days[t + "|" + d.id]; } } delete o.skip; delete o.moved; if (!Object.keys(o).length) delete S.days[d.k + "|" + d.id]; } save(); render(); },
  "dose-edit": d => doseSheet(d.id, d.k),
  "dose-save": d => { const s = sub(d.id); const mg = toMg(s, parseFloat($("#d-dose").value) || 0); if (mg <= 0) return toast("Doză invalidă"); S.days[d.k + "|" + d.id] = Object.assign(S.days[d.k + "|" + d.id] || {}, { mg }); save(); closeSheet(); render(); },
  "dose-reset": d => { const o = S.days[d.k + "|" + d.id]; if (o) { delete o.mg; if (!Object.keys(o).length) delete S.days[d.k + "|" + d.id]; } save(); closeSheet(); render(); },
  "pick-site": (d, el) => { const host = $("#sheet"); const sel = host && host.querySelector("#l-site"); if (!sel) return; if (![...sel.options].some(o => o.value === d.site)) { const rs = host.querySelector("#l-route"); rs.value = ROUTES.im.sites.includes(d.site) ? "im" : "sc"; rs.dispatchEvent(new Event("change")); } sel.value = d.site; sel.dispatchEvent(new Event("change")); },
  "labs-new": () => labsSheet(null),
  "labs-edit": d => { const e = S.labs.find(x => x.id === +d.lid); if (e) labsSheet(e); },
  "labs-save": d => {
    const host = $("#sheet"); const date = host.querySelector("#lb-date").value; if (!date) return toast("Pune data recoltării");
    const v = {}; host.querySelectorAll("[data-lk]").forEach(i => { const x = parseFloat(i.value); if (!isNaN(x)) v[i.dataset.lk] = x; });
    if (!Object.keys(v).length) return toast("Completează cel puțin o valoare");
    const note = host.querySelector("#lb-note").value.trim();
    if (d.new) S.labs.push({ id: +d.lid, date, v, note }); else Object.assign(S.labs.find(x => x.id === +d.lid), { date, v, note });
    save(); closeSheet(); toast("Analize salvate"); render();
  },
  "labs-delete": d => { const i = S.labs.findIndex(x => x.id === +d.lid); if (i >= 0 && confirm("Ștergi acest set de analize?")) { S.labs.splice(i, 1); save(); closeSheet(); render(); } },
  "focus-open": () => { view = "focus"; focusIdx = 0; render(); window.scrollTo(0, 0); },
  "focus-exit": () => { view = "today"; render(); },
  "focus-next": () => { focusIdx = (focusIdx + 1) % Math.max(1, focusPending().length); render(); },
  "focus-skip": d => { const k = todayKey(); S.days[k + "|" + d.id] = Object.assign(S.days[k + "|" + d.id] || {}, { skip: true }); save(); render(); },
  "focus-log": d => {
    const k = todayKey(), s = sub(d.id), dd = scheduled(s, k); if (!dd) return;
    const ack = $("#f-ack"); if (ack && !ack.checked) { toast("Bifează confirmarea de sub avertizări"); ack.scrollIntoView({ block: "center" }); return; }
    const v = activeVial(d.id);
    const taken = v ? Math.min(dd.mg, v.leftMg) : 0;
    S.log.push({ id: Date.now(), date: k, time: nowHM(), sub: d.id, mg: dd.mg, units: dd.units, label: dd.label, site: d.site, feel: 0, symptoms: [], comment: "", vial: v ? v.n : null, planned: { mg: dd.mg, units: dd.units, label: dd.label }, route: s.routeKey || "sc", taken });
    if (v) v.leftMg = Math.max(0, Math.round((v.leftMg - taken) * 1000) / 1000);
    save(); toast(`${s.short} înregistrat: ${fmtU(dd.units)}, ${d.site}`); focusIdx = 0; render(); window.scrollTo(0, 0);
  },
  "plan-edit": d => planSheet(d.id),
  "route-edit": d => routeSheet(d.id),
  "route-save": d => {
    const rk = ($("#sheet input[name=rt]:checked") || {}).value || "sc";
    const p = S.plan[d.id] = S.plan[d.id] || {};
    if (p.routeKey !== rk) { for (const k of ["doseMg", "pattern", "dow", "to", "cycleOn", "cycleOff", "test"]) delete p[k]; }
    p.routeKey = rk; if (rk === "sc" && Object.keys(p).length === 1) delete S.plan[d.id];
    save(); closeSheet(); toast(`${sub(d.id).short}: ${ROUTES[rk].name}`); render();
  },
  "plan-save": d => {
    const s = sub(d.id), host = $("#sheet");
    const from = host.querySelector("#p-from").value, to = host.querySelector("#p-to").value;
    if (!from || !to || to < from) return toast("Interval invalid");
    const shift = host.querySelector("#p-shift").checked, delta = diffDays(s.from, from);
    const pattern = host.querySelector("#p-pattern").value;
    const dow = [...host.querySelectorAll("#p-dow .tog.on")].map(b => +b.dataset.d);
    if (pattern === "dow" && !dow.length) return toast("Alege cel puțin o zi");
    const mg = toMg(s, parseFloat(host.querySelector("#p-dose").value) || 0); if (mg <= 0) return toast("Doză invalidă");
    const on = 7 * (parseInt(host.querySelector("#p-on").value, 10) || 0), off = 7 * (parseInt(host.querySelector("#p-off").value, 10) || 0);
    const o = { from, to, time: host.querySelector("#p-time").value, pattern, dow, doseMg: mg, stopped: host.querySelector("#p-stopped").checked, cycleOn: on, cycleOff: off };
    if (shift && delta) { o.pauses = (s.pauses || []).map(p => [addDays(p[0], delta), addDays(p[1], delta)]); o.extra = (s.extra || []).map(x => addDays(x, delta)); }
    S.plan[d.id] = Object.assign({}, S.plan[d.id] || {}, o); save(); closeSheet(); toast("Plan actualizat"); render();
  },
  "plan-reset": d => { delete S.plan[d.id]; save(); closeSheet(); render(); },
  "plan-reset-all": () => { if (confirm("Resetezi toate modificările planului (datele, fiolele și jurnalul rămân)?")) { S.plan = {}; S.days = {}; save(); toast("Plan resetat"); render(); } },
  "settings-save": () => { S.settings.am = $("#s-am").value || "06:45"; S.settings.pm = $("#s-pm").value || "21:00"; S.notified = {}; save(); toast("Ore salvate"); render(); },
  "notif-enable": enableNotifications,
  "update-check": async () => {
    try {
      toast("Verific...");
      const txt = await fetch("data.js?t=" + Date.now(), { cache: "no-store" }).then(r => r.text());
      const m = txt.match(/APP_VERSION = "([^"]+)"/); const remote = m ? m[1] : null;
      const r = await navigator.serviceWorker.getRegistration();
      if (r) await r.update();
      if (remote && remote !== APP_VERSION) { toast("Versiunea " + remote + " e pe server; reîncarc..."); updateReady = true; setTimeout(async () => { const r2 = await navigator.serviceWorker.getRegistration(); if (r2 && r2.waiting) { r2.waiting.postMessage("skipWaiting"); setTimeout(() => location.reload(), 2500); } else location.reload(); }, 1200); }
      else toast("Ești la ultima versiune (v" + APP_VERSION + ")");
    } catch (e) { toast("Nu am putut verifica (offline?)"); }
  },
  "reload": async () => { try { const r = await navigator.serviceWorker.getRegistration(); if (r && r.waiting) { updateReady = true; r.waiting.postMessage("skipWaiting"); setTimeout(() => location.reload(), 2500); return; } } catch (e) {} location.reload(); },
  "force-update": async () => {
    toast("Șterg cache-ul și reîncarc de pe server...");
    try {
      if ("serviceWorker" in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); for (const r of regs) await r.unregister(); }
      if ("caches" in window) { const ks = await caches.keys(); for (const k of ks) await caches.delete(k); }
    } catch (e) {}
    setTimeout(() => location.replace(location.pathname + "?v=" + Date.now()), 300);
  },
  "notif-now": () => { const k = todayKey(); const ds = dosesOn(k).filter(d => !d.logged && !d.skipped); if (!ds.length) return toast("Nimic de administrat azi"); checkDueNow(true); toast("Reminder trimis"); },
  "notif-test": () => notify("Peptide Tracker", "Notificările funcționează. Așa vei fi anunțat la " + S.settings.am + " și " + S.settings.pm + "."),
  "ics": () => download("peptide-plan.ics", buildICS(), "text/calendar"),
  "export": () => download(`peptide-backup-${todayKey()}.json`, JSON.stringify(exportable(), null, 1), "application/json"),
  "order-new": () => orderSheet(null),
  "order-edit": d => { const o = (S.orders || []).find(x => x.id === +d.oid); if (o) orderSheet(o); },
  "order-save": d => {
    const host = $("#sheet"); const supplier = host.querySelector("#o-sup").value.trim() || "Furnizor", date = host.querySelector("#o-date").value; if (!date) return toast("Pune data comenzii");
    const items = SUBS.map(sb => ({ sub: sb.id, vials: parseInt(host.querySelector(`[data-ov="${sb.id}"]`).value, 10) || 0, lot: host.querySelector(`[data-ol="${sb.id}"]`).value.trim() }));
    const certs = host.querySelector("#o-certs").value.trim(), notes = host.querySelector("#o-notes").value.trim();
    S.orders = S.orders || [];
    if (d.new) S.orders.push({ id: +d.oid, supplier, date, items, certs, notes }); else Object.assign(S.orders.find(x => x.id === +d.oid), { supplier, date, items, certs, notes });
    save(); closeSheet(); toast("Comandă salvată"); render();
  },
  "order-delete": d => { const i = (S.orders || []).findIndex(x => x.id === +d.oid); if (i >= 0 && confirm("Ștergi această comandă? Fiolele deja legate de ea rămân, dar fără referință.")) { S.orders.splice(i, 1); save(); closeSheet(); render(); } },
  "cycle-open": () => cycleSheet(),
  "cycle-apply": () => {
    const host = $("#sheet"); const start = host.querySelector("#c-start").value, step = +host.querySelector("#c-intro").value; if (!start) return toast("Pune data de start");
    const picks = [...host.querySelectorAll("[data-cs]:checked")].map(i => i.dataset.cs); if (!picks.length) return toast("Bifează cel puțin o substanță");
    if (!confirm(`Aplic ciclul nou pentru ${picks.length} substanțe de la ${fmtL(start)}? Datele de început și sfârșit din plan se rescriu; jurnalul și fiolele rămân.`)) return;
    let i = 0;
    for (const id of picks) {
      const b = SUBS.find(x => x.id === id), p = S.plan[id] || {}; const vials = +host.querySelector(`[data-cv="${id}"]`).value || 10; const from = addDays(start, i * step);
      for (const key of Object.keys(S.days)) if (key.endsWith("|" + id) && key.slice(0, 10) >= from) delete S.days[key];
      const r = simulateEnd(Object.assign({}, sub(id), { test: false }), from, vials);
      S.plan[id] = Object.assign({}, p, { from, to: r.to || from, stopped: false, stock: vials, test: false });
      i++;
    }
    save(); closeSheet(); toast("Ciclul următor este în plan"); render();
  },
  "cal-publish": async () => { if (!S.sync.calId) { const a = new Uint8Array(16); crypto.getRandomValues(a); S.sync.calId = [...a].map(x => x.toString(16).padStart(2, "0")).join(""); save(); } toast("Public calendarul..."); await publishCal(true); render(); },
  "cal-copy": async () => { try { await navigator.clipboard.writeText(calUrl()); toast("Adresa copiată"); } catch (e) { prompt("Copiază adresa:", calUrl()); } },
  "cal-off": () => { if (confirm("Oprești publicarea? Fișierul rămâne pe GitHub până îl ștergi din repo; abonamentul nu va mai primi actualizări.")) { S.sync.calId = ""; S.sync.calHash = 0; S.sync.calAt = 0; S.sync.calError = ""; save(true); render(); } },
  "auth-save": () => {
    const cid = $("#a-cid").value.trim(), allowed = $("#a-allowed").value.split(/\n/).map(x => x.trim().toLowerCase()).filter(Boolean), days = Math.max(1, Math.min(365, parseInt($("#a-days").value, 10) || 30));
    if (S.auth.enabled && !cid) return toast("Client ID-ul nu poate fi gol cât timp blocarea e activă");
    Object.assign(S.auth, { clientId: cid, allowed, days }); save(); toast("Setări salvate"); render();
  },
  "auth-enable": () => { const cid = $("#a-cid").value.trim(); if (!cid) return toast("Pune Client ID-ul"); S.auth.clientId = cid; save(true); showLock("enable"); },
  "auth-disable": () => { if (confirm("Dezactivezi blocarea? Aplicația se va deschide fără conectare.")) { S.auth.enabled = false; save(); try { localStorage.removeItem(AK); } catch (e) {} render(); } },
  "auth-lock": () => { try { localStorage.removeItem(AK); } catch (e) {} showLock("lock"); },
  "lock-cancel": () => hideLock(),
  "lock-offline": () => { const ss = authSession(); if (ss) { ss.at = Date.now(); try { localStorage.setItem(AK, JSON.stringify(ss)); } catch (e) {} } hideLock(); render(); },
  "supplies-edit": () => suppliesSheet(),
  "supplies-save": () => { const st = S.supplies = S.supplies || {}; document.querySelectorAll("#sheet [data-sk]").forEach(i => { const v = parseFloat(i.value); st[i.dataset.sk] = isNaN(v) ? null : v; }); st.updated = todayKey(); save(); closeSheet(); toast("Stoc salvat"); render(); },
  "report-open": () => reportSheet(),
  "report-build": () => {
    const from = $("#rp-from").value, to = $("#rp-to").value, name = $("#rp-name").value.trim(), wc = $("#rp-comments").checked;
    if (!from || !to || to < from) return toast("Perioadă invalidă");
    S.settings.patientName = name; save(true); closeSheet();
    const pv = $("#printview"); pv.innerHTML = reportHTML(from, to, name, wc); pv.classList.add("on"); window.scrollTo(0, 0);
  },
  "report-print": () => window.print(),
  "report-close": () => { const pv = $("#printview"); pv.classList.remove("on"); pv.innerHTML = ""; },
  "sync-save": async () => {
    const token = $("#s-token").value.trim(), repo = $("#s-repo").value.trim(), branch = $("#s-branch").value.trim() || "data";
    if (!token) return toast("Lipsește tokenul");
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return toast("Repo în format utilizator/nume");
    Object.assign(S.sync, { token, repo, branch, lastError: "" }); save(true); toast("Verific conexiunea..."); await pullSync(true); render();
  },
  "sync-now": async () => { await pullSync(true); render(); },
  "sync-off": () => { if (confirm("Deconectezi sincronizarea? Datele rămân pe telefon și în GitHub.")) { S.sync.token = ""; S.sync.lastError = ""; save(true); render(); } },
  "sync-keep-local": async () => { const cur = window.__conflict; closeSheet(); if (!cur) return; try { const sha = await ghPut(exportable(), cur.sha); S.sync.lastSha = sha; S.sync.lastSync = Date.now(); S.sync.lastError = ""; save(true); toast("Telefonul a fost trimis în cloud"); } catch (e) { toast(e.message); } render(); },
  "sync-keep-remote": () => { const cur = window.__conflict; closeSheet(); if (cur && cur.data) { adoptRemote(cur.data, cur.sha); toast("Date luate din cloud"); } },
  "wipe": () => { if (confirm("Ștergi TOATE datele (jurnal, fiole, plan)? Nu se poate anula.") && confirm("Sigur? Exportă mai întâi un backup dacă vrei să le păstrezi.")) { S = defaultState(); save(true); render(); } }
};
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const fn = A[el.dataset.act]; if (fn) fn(el.dataset, el, e);
});
$("#nav").addEventListener("click", e => { const b = e.target.closest("button[data-v]"); if (!b) return; view = b.dataset.v; render(); window.scrollTo(0, 0); });

/* ---------- randare ---------- */
function render() {
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === view || (view === "focus" && b.dataset.v === "today")));
  $("#topaction").innerHTML = "";
  if (pendingConflict && !$("#sheet").innerHTML) { const c = pendingConflict; pendingConflict = null; setTimeout(() => conflictSheet(c), 50); }
  ({ today: renderToday, cal: renderCal, vials: renderVials, log: renderLog, settings: renderSettings, focus: renderFocus })[view]();
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
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(r => {
    if (r.active) r.active.postMessage("check");
    if (r.waiting && navigator.serviceWorker.controller) showUpdateBar();
    r.addEventListener("updatefound", () => { const w = r.installing; if (!w) return; w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) showUpdateBar(); }); });
  }).catch(() => {});
  let refreshed = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (updateReady && !refreshed) { refreshed = true; location.reload(); } });
}
if (new URLSearchParams(location.search).get("mode") === "inject") view = "focus";
render();
if (!authValid()) showLock("lock");
checkDueNow(); scheduleUpcoming();
pullSync(false);
window.addEventListener("online", () => pullSync(false));
setInterval(checkDueNow, 60 * 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { checkDueNow(); render(); pullSync(false); if (!authValid() && !$("#lock").classList.contains("on")) showLock("lock"); } });
})();
