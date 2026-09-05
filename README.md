# Peptide Tracker

Aplicație web instalabilă (PWA) pentru planul de administrare al comenzii MKM: ce administrezi azi și în ce doză, când prepari fiolele, jurnal cu stare și comentarii, remindere.

Fără build, fără dependențe. Fișiere:

- `index.html` interfața și stilurile
- `data.js` substanțele, dozele standard, pașii de reconstituire, avertismentele
- `app.js` logica (plan, fiole, jurnal, notificări, export)
- `sw.js` service worker: cache offline și notificări în fundal
- `manifest.webmanifest` manifestul PWA
- `icons/` icoanele (regenerabile cu `node tools/make-icons.js`)

Datele (jurnal, fiole, modificări de plan) stau doar în browserul telefonului. Fă backup din Setări → Exportă datele.

## Publicare pe GitHub Pages

1. Creează un repo pe github.com (privat cere GitHub Pro pentru Pages).
2. Din acest folder:

```bash
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

3. Pe GitHub: Settings → Pages → Source: „Deploy from a branch”, Branch: `main`, folder `/ (root)`. Salvează.
4. După 1-2 minute, aplicația e la `https://<user>.github.io/<repo>/`.

## Instalare pe Android

1. Deschide URL-ul în Chrome.
2. Meniu (⋮) → „Adaugă pe ecranul principal” / „Instalează aplicația”.
3. În aplicație: Setări → „Activează notificările” și acceptă permisiunea.
4. Pentru alarme garantate: Setări → „Exportă calendar (.ics)” și importă fișierul în Google Calendar.

## Testare locală

```bash
npx serve .
```

sau orice server static. Service worker-ul și instalarea au nevoie de `localhost` sau HTTPS.
