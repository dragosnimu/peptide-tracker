/* Datele planului: substantele din comanda MKM (august 2026), dozele standard din fisa
   furnizorului si avertismentele din raportul de analiza. Tot ce e aici poate fi
   suprascris din aplicatie (Calendar -> Editeaza planul). */
const APP_VERSION = "1.4";
const APP_DATE = "2026-09-05";
const PLAN_START = "2026-09-05";
const PLAN_WEEKS = 16;

const SUBS = [
  {
    id: "shb", name: "SUPER Human Blend", short: "SHB",
    from: "2026-09-05", to: "2027-05-12", time: "am", route: "SC", cycleOn: 56, cycleOff: 14,
    pattern: "dow", dow: [1, 3, 5], extra: ["2026-09-05"], pauses: [],
    unit: "ml", doseMg: 86.5, mgPerMl: 86.5,
    vialMg: 865, vialMl: 10, ready: true, waterMl: 0, stabilityDays: 21, stock: 10,
    test: true, testNote: "test ½ doză, la prânz (SS-31 dimineața)",
    what: "Amestec de aminoacizi liberi (arginină, ornitină, citrulină, lizină, glutamină, prolină, taurină, carnitină, NAC). Nu este peptidă.",
    steps: [
      "Răstoarnă ușor flaconul ca să se omogenizeze. Nu agita. Cristalele fine sunt normale.",
      "Dezinfectează dopul cu alcool și lasă-l să se usuce.",
      "Trage 1,0 ml = 100 U cu seringa U-100, elimină aerul.",
      "Dezinfectează pielea. Pliu cutanat, ac la 45-90°, injectează lent, ține 5-10 s.",
      "Notează data primei puncții pe flacon."
    ],
    stab: "După prima puncție: 14-21 zile, la întuneric, nu se congelează.",
    flag: "Doze subterapeutice (raport): aceleași substanțe se obțin oral la doze de 10-20x mai mari.",
    cycle: "L/Mi/V în cicluri de 8 săpt. + 2 săpt. pauză, până la epuizarea stocului: 90 doze, până pe 12 mai 2027"
  },
  {
    id: "ss31", name: "SS-31 (Elamipretide)", short: "SS-31",
    from: "2026-09-05", to: "2026-09-24", time: "am", route: "SC", cycleOn: 0, cycleOff: 0,
    pattern: "daily", unit: "mg", doseMg: 5,
    vialMg: 10, waterMl: 2, stabilityDays: 28, stock: 10,
    test: true, testNote: "test ½ doză, dimineața",
    what: "Tetrapeptidă care se leagă de cardiolipina mitocondrială. Singurul compus cu studii clinice de fază 3 (rezultate mixte).",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "Trage 2 ml apă bacteriostatică și injecteaz-o lent pe peretele fiolei, nu pe pulbere.",
      "Rotește ușor între palme. Nu agita. Lichid limpede, incolor; tulbure sau gălbui = aruncă.",
      "Rezultat: 5 mg/ml. 5 mg = 1,0 ml = 100 U (seringă plină).",
      "Scrie data pe fiolă și pune-o la frigider (2-8 °C), ferită de lumină."
    ],
    stab: "Reconstituit: 21-28 zile la 2-8 °C. La 5 mg/zi fiola se termină în 2 zile.",
    flag: "Stoc: 10 fiole = 20 de zile la 5 mg/zi. Ciclul raportat este 4-8 săptămâni; ar mai trebui 1-3 cutii.",
    cycle: "zilnic, 20 zile: 10 fiole × 2 doze, până pe 24 sep"
  },
  {
    id: "bb10", name: "BB10 (BPC-157 + TB-500)", short: "BB10",
    from: "2026-09-12", to: "2027-05-25", time: "am", route: "SC", cycleOn: 42, cycleOff: 14,
    pattern: "daily", unit: "mg", doseMg: 0.5,
    vialMg: 10, waterMl: 2, stabilityDays: 28, stock: 10,
    test: true, testNote: "test ½ doză",
    what: "Blend 1:1 de peptide de reparare tisulară. Date preclinice; interzise WADA.",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "2 ml apă bacteriostatică pe peretele fiolei. Dacă rămâne tulbure, se poate folosi apă cu acid acetic 0,6%.",
      "Rotește ușor. Nu agita.",
      "Rezultat: 5 mg/ml. 0,5 mg = 0,1 ml = 10 U. Folosește seringă de 0,3-0,5 ml.",
      "Scrie data pe fiolă; frigider 2-8 °C."
    ],
    stab: "Reconstituit: 21-28 zile la 2-8 °C. O fiolă = 20 de doze.",
    flag: "Antidoping: BPC-157 (S0) și TB-500 (S2) sunt interzise WADA. Planul urmează cicluri de 6 săpt. cu 2 săpt. pauză.",
    cycle: "zilnic în cicluri de 6 săpt. + 2 săpt. pauză (raport: 4-6 săpt.), până la epuizarea stocului: 200 doze, până pe 25 mai 2027"
  },
  {
    id: "nad", name: "NAD+", short: "NAD+",
    from: "2026-09-19", to: "2027-02-01", time: "am", route: "SC lent", cycleOn: 28, cycleOff: 14,
    pattern: "daily", unit: "mg", doseMg: 100,
    vialMg: 1000, waterMl: 3, stabilityDays: 14, stock: 10,
    test: false, titration: [{ days: 3, mg: 25, note: "titrare, zile 1-3" }, { days: 4, mg: 50, note: "titrare, zile 4-7" }],
    what: "Coenzimă, nu peptidă. Injectarea directă e slab justificată farmacocinetic (raport); injecția e notoriu dureroasă.",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "3 ml apă bacteriostatică, foarte lent pe perete. Nu agita: NAD+ se degradează ușor.",
      "Lichid limpede, incolor. Galben sau tulbure = aruncă.",
      "Rezultat: 333 mg/ml. 25 mg = 7,5 U · 50 mg = 15 U · 100 mg = 30 U.",
      "Injectează foarte lent. Arsură locală, căldură sau greață apar dacă se injectează repede.",
      "Frigider 2-8 °C, ferit de lumină. Nu congela."
    ],
    stab: "Reconstituit: max 14 zile (cel mult 21). La 100 mg/zi fiola se termină în ~10 zile.",
    flag: "Începe cu doză mică și crește treptat (fișa furnizorului). Nu crește dacă reacția locală e intensă.",
    cycle: "zilnic în cicluri de 4 săpt. + 2 săpt. pauză (raport: 2-4 săpt.), cu titrare la început; ≈94 doze, până pe 1 feb 2027"
  },
  {
    id: "gsh", name: "Glutation", short: "Glutation",
    from: "2026-09-28", to: "2026-12-18", time: "pm", route: "SC", cycleOn: 56, cycleOff: 14,
    pattern: "dow", dow: [1, 3, 5], unit: "mg", doseMg: 200,
    vialMg: 600, waterMl: 3, stabilityDays: 14, stock: 10,
    test: true, testNote: "test ½ doză",
    what: "Principalul antioxidant intracelular. Injectabil: avertizări de reglementare pentru preparate nesterile.",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "3 ml apă bacteriostatică pe perete, cu cât mai puțin contact cu aerul.",
      "Rotește ușor. Lichid incolor; galben = oxidat, aruncă.",
      "Rezultat: 200 mg/ml. 200 mg = 1,0 ml = 100 U. O fiolă = 3 doze = o săptămână.",
      "Soluția e acidă: usturimea la injectare e obișnuită. Ține 5-10 s înainte de a scoate acul.",
      "Frigider 2-8 °C. Fiolă nouă în fiecare luni."
    ],
    stab: "Reconstituit: 7-14 zile, nu mai mult. Galben = aruncă.",
    flag: "Nu prelungi fiola peste 14 zile.",
    cycle: "L/Mi/V în cicluri de 8 săpt. + 2 săpt. pauză (raport: 4-8 săpt.): 30 doze, până pe 18 dec"
  },
  {
    id: "motsc", name: "MOTS-c", short: "MOTS-c",
    from: "2026-10-05", to: "2026-12-24", time: "am", route: "SC", cycleOn: 56, cycleOff: 14,
    pattern: "dow", dow: [1, 4], unit: "mg", doseMg: 5,
    vialMg: 10, waterMl: 2, stabilityDays: 14, stock: 10,
    test: true, testNote: "test ½ doză",
    what: "Peptidă codificată mitocondrial, activator AMPK. Cele mai bune date preclinice din grupul de longevitate.",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "2 ml apă bacteriostatică pe perete. Rotește, nu agita. 1-2 minute până se dizolvă.",
      "Rezultat: 5 mg/ml. 5 mg = 1,0 ml = 100 U. O fiolă = 2 doze (luni și joi).",
      "Dimineața. Frigider 2-8 °C."
    ],
    stab: "Reconstituit: 7-14 zile (max 21-28). Stabilitate mai slabă decât alte peptide.",
    flag: "Efect pe glicemie în modele animale. Cu antidiabetice sau hipoglicemii, monitorizează.",
    cycle: "L/J în cicluri de 8 săpt. + 2 săpt. pauză (raport: 4-8 săpt.): 20 doze, până pe 24 dec"
  },
  {
    id: "ghk", name: "GHK-Cu", short: "GHK-Cu",
    from: "2026-10-10", to: "2027-07-20", time: "pm", route: "SC", cycleOn: 56, cycleOff: 28,
    pattern: "daily", unit: "mg", doseMg: 2.5,
    vialMg: 50, waterMl: 5, stabilityDays: 28, stock: 10,
    test: true, testNote: "test ½ doză",
    what: "Tripeptidă de cupru. Dovezi bune topic; injectabil sistemic slab documentat.",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "5 ml apă bacteriostatică pe perete. Rotește ușor.",
      "Soluția albastru-deschis este normală. Tulbure sau precipitat = aruncă.",
      "Rezultat: 10 mg/ml. 2,5 mg = 0,25 ml = 25 U. O fiolă = 20 de zile.",
      "Seara. Ține 5-10 s înainte de a scoate acul. Frigider 2-8 °C."
    ],
    stab: "Reconstituit: 21-28 zile la 2-8 °C.",
    flag: "Încărcare cu cupru: 2,5 mg/zi ≈ 0,4 mg cupru injectat, fără filtrul intestinal; pe 200 de doze ≈ 86 mg cupru în total. Analize cupru și zinc seric la sfârșitul fiecărui ciclu de 8 săpt.; nu începe ciclul următor dacă valorile au crescut.",
    cycle: "zilnic în cicluri de 8 săpt. + 4 săpt. pauză (raport: 8-12 săpt.), până la epuizarea stocului: 200 doze, până pe 20 iul 2027"
  },
  {
    id: "epi", name: "Epithalon", short: "Epithalon",
    from: "2026-10-17", to: "2026-11-05", time: "pm", route: "SC", cycleOn: 0, cycleOff: 0,
    pattern: "daily", unit: "mg", doseMg: 5,
    vialMg: 10, waterMl: 2, stabilityDays: 30, stock: 10,
    test: true, testNote: "test ½ doză, seara devreme",
    what: "Tetrapeptidă Khavinson. Dovezi slabe, dintr-un singur grup.",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "2 ml apă bacteriostatică pe perete. Rotește ușor.",
      "Rezultat: 5 mg/ml. 5 mg = 1,0 ml = 100 U. O fiolă = 2 zile.",
      "Seara, conform ritmului pineal. Frigider 2-8 °C."
    ],
    stab: "Reconstituit: 21-30 zile la 2-8 °C.",
    flag: "Activare telomerază: fără date de siguranță pe termen lung. De evitat la antecedente oncologice personale sau familiale.",
    cycle: "zilnic, 20 zile: 10 fiole × 2 doze, până pe 5 nov; se repetă la 6 luni"
  },
  {
    id: "pin", name: "Pinealon", short: "Pinealon",
    from: "2026-10-24", to: "2026-11-12", time: "pm", route: "SC", cycleOn: 0, cycleOff: 0,
    pattern: "daily", unit: "mg", doseMg: 5,
    vialMg: 10, waterMl: 2, stabilityDays: 28, stock: 10,
    test: true, testNote: "test ½ doză",
    what: "Tripeptidă Khavinson pentru creier. Cele mai slabe dovezi din comandă.",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "2 ml apă bacteriostatică pe perete. Rotește, nu agita.",
      "Rezultat: 5 mg/ml. 5 mg = 1,0 ml = 100 U. O fiolă = 2 zile.",
      "Înainte de culcare. Frigider 2-8 °C."
    ],
    stab: "Reconstituit: 21-28 zile la 2-8 °C.",
    flag: "Se suprapune cu Epithalon 24 oct–5 nov (aceeași familie). Un efect apărut în acest interval nu poate fi atribuit.",
    cycle: "zilnic, 20 zile: 10 fiole × 2 doze, până pe 12 nov"
  },
  {
    id: "dsip", name: "DSIP", short: "DSIP",
    from: "2026-10-31", to: "2027-10-27", time: "pm", route: "SC", cycleOn: 28, cycleOff: 14,
    pattern: "daily", unit: "mcg", doseMg: 0.2,
    vialMg: 5, waterMl: 2, stabilityDays: 28, stock: 10,
    test: true, testNote: "test ½ doză",
    what: "Nonapeptidă din 1974, mecanism neclar. Studii vechi și contradictorii.",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "2 ml apă bacteriostatică pe perete. Rotește ușor.",
      "Rezultat: 2,5 mg/ml = 2500 mcg/ml. 200 mcg = 0,08 ml = 8 U. Seringă de 0,3 ml.",
      "ATENȚIE: o seringă plină (100 U) = 2,5 mg = de 12 ori doza.",
      "Cu 30-60 min înainte de culcare. Frigider 2-8 °C."
    ],
    stab: "Reconstituit: 21-28 zile. O fiolă = 25 de doze.",
    flag: "Micrograme, nu miligrame. Doza corectă este 8 U, nu seringă plină. Planul urmează cicluri de 4 săpt. cu 2 săpt. pauză; poți sări zilele în care nu e nevoie.",
    cycle: "zilnic în cicluri de 4 săpt. + 2 săpt. pauză (fișa: 4-8 săpt.), până la epuizarea stocului: 250 doze, până pe 27 oct 2027"
  },
  {
    id: "semax", name: "Semax", short: "Semax",
    from: "2026-11-07", to: "2027-05-27", time: "am", route: "SC", cycleOn: 42, cycleOff: 14,
    pattern: "daily", unit: "mcg", doseMg: 0.3,
    vialMg: 5, waterMl: 2, stabilityDays: 28, stock: 10,
    test: true, testNote: "test ½ doză",
    what: "Fragment ACTH(4-7)-Pro-Gly-Pro. Medicament în Rusia; studiat intranazal.",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "2 ml apă bacteriostatică pe perete. Rotește ușor.",
      "Rezultat: 2,5 mg/ml. 300 mcg = 0,12 ml = 12 U. Seringă de 0,3 ml.",
      "Dimineața sau până după-amiază; seara dă insomnie. Frigider 2-8 °C."
    ],
    stab: "Reconstituit: 21-28 zile. O fiolă = 16 doze.",
    flag: "Formularea studiată clinic este intranazală. Micrograme: 12 U, nu seringă plină. Planul urmează cicluri de 6 săpt. cu 2 săpt. pauză.",
    cycle: "zilnic în cicluri de 6 săpt. + 2 săpt. pauză (fișa: 4-6 săpt.), până la epuizarea stocului: 160 doze, până pe 27 mai 2027"
  },
  {
    id: "selank", name: "Selank", short: "Selank",
    from: "2026-11-14", to: "2027-06-03", time: "pm", route: "SC", cycleOn: 42, cycleOff: 14,
    pattern: "daily", unit: "mcg", doseMg: 0.3,
    vialMg: 5, waterMl: 2, stabilityDays: 30, stock: 10,
    test: true, testNote: "test ½ doză",
    what: "Tuftsin-Pro-Gly-Pro, anxiolitic fără sedare în studiile rusești.",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "2 ml apă bacteriostatică pe perete. Rotește ușor.",
      "Rezultat: 2,5 mg/ml. 300 mcg = 0,12 ml = 12 U. Seringă de 0,3 ml.",
      "Seara, separat de Semax (dimineața). Frigider 2-8 °C."
    ],
    stab: "Reconstituit: 21-30 zile. O fiolă = 16 doze.",
    flag: "Formularea studiată clinic este intranazală. Micrograme: 12 U, nu seringă plină. Planul urmează cicluri de 6 săpt. cu 2 săpt. pauză.",
    cycle: "zilnic în cicluri de 6 săpt. + 2 săpt. pauză (fișa: 4-6 săpt.), până la epuizarea stocului: 160 doze, până pe 3 iun 2027"
  }
];

const EVENTS = {
  "2026-09-05": "Start. SS-31 test dimineața (50 U), SHB test la prânz (50 U), la ore diferite ca să poți atribui o reacție.",
  "2026-09-24": "Ultima zi SS-31: stocul de 10 fiole s-a terminat.",
  "2026-09-26": "NAD+ trece la 100 mg = 30 U dacă 50 mg a fost tolerat.",
  "2026-10-16": "NAD+: sfârșitul ciclului 1. Pauză 2 săptămâni, reia pe 31 oct.",
  "2026-10-23": "BB10: sfârșitul ciclului 1. Pauză 2 săptămâni, reia pe 7 nov.",
  "2026-10-24": "Pinealon în paralel cu Epithalon până pe 5 nov.",
  "2026-10-30": "SHB: sfârșitul ciclului 1. Pauză 2 săptămâni, reia pe 16 nov.",
  "2026-11-05": "Ultima zi Epithalon (stoc epuizat). Se repetă peste 6 luni.",
  "2026-11-12": "Ultima zi Pinealon (stoc epuizat).",
  "2026-11-20": "Glutation: sfârșitul ciclului 1 (24 doze). Pauză 2 săptămâni, reia pe 7 dec pentru ultimele 6 doze.",
  "2026-11-26": "MOTS-c: sfârșitul ciclului 1 (16 doze). Pauză 2 săptămâni, reia pe 10 dec pentru ultimele 4 doze.",
  "2026-11-27": "DSIP: sfârșitul ciclului 1. Pauză 2 săptămâni, reia pe 12 dec.",
  "2026-12-04": "GHK-Cu: sfârșitul ciclului 1. Pauză 4 săptămâni, reia pe 2 ian. Analize cupru și zinc seric.",
  "2026-12-18": "Ultima zi Glutation (stoc epuizat). Semax: sfârșitul ciclului 1, pauză 2 săptămâni.",
  "2026-12-24": "Ultima zi MOTS-c (stoc epuizat).",
  "2026-12-25": "Selank: sfârșitul ciclului 1. Pauză 2 săptămâni, reia pe 9 ian.",
  "2027-02-01": "Ultima zi NAD+ (stoc epuizat).",
  "2027-02-26": "GHK-Cu: sfârșitul ciclului 2. Pauză 4 săptămâni. Analize cupru și zinc.",
  "2027-05-12": "Ultima zi SHB (stoc epuizat).",
  "2027-05-21": "GHK-Cu: sfârșitul ciclului 3. Pauză 4 săptămâni. Analize cupru și zinc.",
  "2027-05-25": "Ultima zi BB10 (stoc epuizat).",
  "2027-05-27": "Ultima zi Semax (stoc epuizat).",
  "2027-06-03": "Ultima zi Selank (stoc epuizat).",
  "2027-07-20": "Ultima zi GHK-Cu (stoc epuizat).",
  "2027-10-27": "Ultima zi DSIP (stoc epuizat). Sfârșitul planului."
};

const SITES = ["abdomen stânga", "abdomen dreapta", "coapsă stângă", "coapsă dreaptă", "braț stâng", "braț drept"];
const SYMPTOMS = ["usturime", "roșeață locală", "umflătură", "greață", "durere de cap", "amețeală", "somn bun", "somn prost", "energie", "oboseală", "anxietate", "palpitații"];
