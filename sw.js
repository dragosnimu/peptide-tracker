/* Service worker: cache offline + notificari programate (periodic background sync). */
const CACHE = "peptide-tracker-v12";
const ASSETS = ["./", "./index.html", "./app.js", "./data.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(a => new Request(a, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});

/* IndexedDB minimal (aceeasi schema ca in app.js) */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("peptide-tracker", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function kvGet(k) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction("kv").objectStore("kv").get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
async function kvSet(k, v) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite").objectStore("kv").put(v, k); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }

async function checkDue() {
  const list = (await kvGet("upcoming")) || [];
  const shown = (await kvGet("shown")) || {};
  const now = Date.now();
  for (const n of list) {
    if (n.ts <= now && n.ts > now - 6 * 3600e3 && !shown[n.key]) {
      shown[n.key] = now;
      await self.registration.showNotification(n.title, { body: n.body, tag: n.key, icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", data: { url: "./" }, requireInteraction: true });
    }
  }
  for (const k in shown) if (shown[k] < now - 7 * 86400e3) delete shown[k];
  await kvSet("shown", shown);
}
self.addEventListener("periodicsync", e => { if (e.tag === "check-doses") e.waitUntil(checkDue()); });
self.addEventListener("message", e => { if (e.data === "check") e.waitUntil(checkDue()); });
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow("./");
  }));
});
