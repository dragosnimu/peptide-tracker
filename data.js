/* Datele planului: substantele din comanda MKM (august 2026), dozele standard din fisa
   furnizorului si avertismentele din raportul de analiza. Tot ce e aici poate fi
   suprascris din aplicatie (Calendar -> Editeaza planul). */
const APP_VERSION = "2.1";
const APP_DATE = "2026-09-05";
const PLAN_START = "2026-09-05";
const PLAN_WEEKS = 16;

const SUBS = [
  {
    id: "shb", name: "SUPER Human Blend", short: "SHB",
    from: "2026-09-05", to: "2027-04-26", time: "am", route: "SC", cycleOn: 56, cycleOff: 14,
    pattern: "dow", dow: [1, 3, 5], extra: ["2026-09-05"], pauses: [],
    unit: "ml", doseMg: 86.5, mgPerMl: 86.5,
    vialMg: 865, vialMl: 10, ready: true, waterMl: 0, stabilityDays: 21, stock: 10, maxMg: 173,
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
    routeNotes: {
      sc: "Fișa furnizorului: 0,5-1 ml SC, 1-3x/săpt. Injecție de 1 ml, ușor de făcut în abdomen.",
      im: "Raportul: 1-2 ml IM sau SC, 2-3x/săpt. Același program (L/Mi/V) și aceeași doză de 1 ml; IM permite 2 ml dacă vrei capătul de sus al dozei, cu stocul consumat de două ori mai repede."
    },
    routeOptions: {
      im: { route: "IM", cycle: "L/Mi/V intramuscular, 1 ml (raport: 1-2 ml), cicluri de 8 săpt. + 2 săpt. pauză" }
    },
    cycle: "L/Mi/V în cicluri de 8 săpt. + 2 săpt. pauză, până la epuizarea stocului: 83 doze (fiolele expiră în pauze), până pe 26 apr 2027"
  },
  {
    id: "ss31", name: "SS-31 (Elamipretide)", short: "SS-31",
    from: "2026-09-05", to: "2026-09-24", time: "am", route: "SC", cycleOn: 0, cycleOff: 0,
    pattern: "daily", unit: "mg", doseMg: 5,
    vialMg: 10, waterMl: 1, stabilityDays: 28, stock: 10, maxMg: 10,
    test: false,
    what: "Tetrapeptidă care se leagă de cardiolipina mitocondrială. Singurul compus cu studii clinice de fază 3 (rezultate mixte).",
    steps: [
      "Fiola la temperatura camerei. Dezinfectează dopul.",
      "Trage 1 ml apă bacteriostatică și injecteaz-o lent pe peretele fiolei, nu pe pulbere.",
      "Rotește ușor între palme. Nu agita. Lichid limpede, incolor; tulbure sau gălbui = aruncă.",
      "Rezultat: 10 mg/ml. 5 mg = 0,5 ml = 50 U.",
      "Scrie data pe fiolă și pune-o la frigider (2-8 °C), ferită de lumină."
    ],
    stab: "Reconstituit: 21-28 zile la 2-8 °C. La 5 mg/zi fiola se termină în 2 zile.",
    flag: "Stoc: 10 fiole = 20 de zile la 5 mg/zi. Ciclul raportat este 4-8 săptămâni; ar mai trebui 1-3 cutii.",
    cycle: "zilnic, 20 zile: 10 fiole × 2 doze, până pe 24 sep"
  },
  {
    id: "bb10", name: "BB10 (BPC-157 + TB-500)", short: "BB10",
    from: "2026-09-12", to: "2027-05-06", time: "am", route: "SC", cycleOn: 42, cycleOff: 14,
    pattern: "daily", unit: "mg", doseMg: 0.5,
    vialMg: 10, waterMl: 2, stabilityDays: 28, stock: 10, maxMg: 1,
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
    cycle: "zilnic în cicluri de 6 săpt. + 2 săpt. pauză (raport: 4-6 săpt.), până la epuizarea stocului: 181 doze (fiolele expiră în pauze), până pe 6 mai 2027"
  },
  {
    id: "nad", name: "NAD+", short: "NAD+",
    from: "2026-09-19", to: "2027-02-01", time: "am", route: "SC lent", cycleOn: 28, cycleOff: 14,
    pattern: "daily", unit: "mg", doseMg: 100,
    vialMg: 1000, waterMl: 3, stabilityDays: 14, stock: 10, maxMg: 100,
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
    vialMg: 600, waterMl: 3, stabilityDays: 14, stock: 10, maxMg: 600,
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
    cycle: "L/Mi/V în cicluri de 8 săpt. + 2 săpt. pauză (raport: 4-8 săpt.): 30 doze, până pe 18 dec",
    routeNotes: {
      sc: "Fișa furnizorului: 100-200 mg SC, 2-3x/săpt. Doză mică, injecție de 1 ml. Usturimea e obișnuită (soluție acidă). O fiolă = 3 doze.",
      im: "Raportul: 600-1200 mg IM sau IV lent, 1-3x/săpt. Aici o fiolă întreagă (600 mg = 3 ml) de 2x/săpt., luni și joi, în coapsă sau fesier (nu deltoid, volum prea mare). Cele 10 fiole ajung 5 săptămâni, fără doză de test."
    },
    routeOptions: {
      im: { route: "IM", doseMg: 600, pattern: "dow", dow: [1, 4], to: "2026-10-29", cycleOn: 0, cycleOff: 0, test: false,
        cycle: "L/J intramuscular, o fiolă întreagă (600 mg = 3 ml): 10 doze, până pe 29 oct" }
    }
  },
  {
    id: "motsc", name: "MOTS-c", short: "MOTS-c",
    from: "2026-10-05", to: "2026-12-24", time: "am", route: "SC", cycleOn: 56, cycleOff: 14,
    pattern: "dow", dow: [1, 4], unit: "mg", doseMg: 5,
    vialMg: 10, waterMl: 2, stabilityDays: 14, stock: 10, maxMg: 10,
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
    from: "2026-10-10", to: "2027-07-08", time: "pm", route: "SC", cycleOn: 56, cycleOff: 28,
    pattern: "daily", unit: "mg", doseMg: 2.5,
    vialMg: 50, waterMl: 5, stabilityDays: 28, stock: 10, maxMg: 5,
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
    cycle: "zilnic în cicluri de 8 săpt. + 4 săpt. pauză (raport: 8-12 săpt.), până la epuizarea stocului: 188 doze (fiolele expiră în pauze), până pe 8 iul 2027"
  },
  {
    id: "epi", name: "Epithalon", short: "Epithalon",
    from: "2026-10-17", to: "2026-11-05", time: "pm", route: "SC", cycleOn: 0, cycleOff: 0,
    pattern: "daily", unit: "mg", doseMg: 5,
    vialMg: 10, waterMl: 2, stabilityDays: 30, stock: 10, maxMg: 10,
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
    vialMg: 10, waterMl: 2, stabilityDays: 28, stock: 10, maxMg: 10,
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
    from: "2026-10-31", to: "2027-08-03", time: "pm", route: "SC", cycleOn: 28, cycleOff: 14,
    pattern: "daily", unit: "mcg", doseMg: 0.2,
    vialMg: 5, waterMl: 2, stabilityDays: 28, stock: 10, maxMg: 0.5,
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
    cycle: "zilnic în cicluri de 4 săpt. + 2 săpt. pauză (fișa: 4-8 săpt.), până la epuizarea stocului: 193 doze (fiolele expiră în pauze), până pe 3 aug 2027"
  },
  {
    id: "semax", name: "Semax", short: "Semax",
    from: "2026-11-07", to: "2027-05-25", time: "am", route: "SC", cycleOn: 42, cycleOff: 14,
    pattern: "daily", unit: "mcg", doseMg: 0.3,
    vialMg: 5, waterMl: 2, stabilityDays: 28, stock: 10, maxMg: 0.5,
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
    cycle: "zilnic în cicluri de 6 săpt. + 2 săpt. pauză (fișa: 4-6 săpt.), până la epuizarea stocului: 158 doze, până pe 25 mai 2027"
  },
  {
    id: "selank", name: "Selank", short: "Selank",
    from: "2026-11-14", to: "2027-06-04", time: "pm", route: "SC", cycleOn: 42, cycleOff: 14,
    pattern: "daily", unit: "mcg", doseMg: 0.3,
    vialMg: 5, waterMl: 2, stabilityDays: 30, stock: 10, maxMg: 0.5,
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
    cycle: "zilnic în cicluri de 6 săpt. + 2 săpt. pauză (fișa: 4-6 săpt.), până la epuizarea stocului: 161 doze, până pe 4 iun 2027"
  }
];

const EVENTS = {
  "2026-09-05": "Start. SS-31 5 mg = 50 U dimineața (fiolă cu 1 ml apă), SHB test la prânz (50 U).",
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
  "2027-04-26": "Ultima zi SHB (stoc epuizat).",
  "2027-05-06": "Ultima zi BB10 (stoc epuizat).",
  "2027-05-21": "GHK-Cu: sfârșitul ciclului 3. Pauză 4 săptămâni. Analize cupru și zinc.",
  "2027-05-25": "Ultima zi Semax (stoc epuizat).",
  "2027-06-04": "Ultima zi Selank (stoc epuizat).",
  "2027-07-08": "Ultima zi GHK-Cu (stoc epuizat).",
  "2027-08-03": "Ultima zi DSIP (stoc epuizat). Sfârșitul planului."
};

/* Cai de administrare: procedura pas cu pas, avantaje, dezavantaje, locuri. */
const ROUTES = {
  sc: {
    key: "sc", label: "SC", name: "Subcutanat (SC)",
    summary: "Injecție în țesutul gras de sub piele, cu ac scurt de insulină. Calea din fișa furnizorului pentru toate substanțele.",
    pros: [
      "Cea mai simplă autoadministrare: ac scurt (4-8 mm), pliu cutanat, fără risc de vas sau nerv important.",
      "Absorbție lentă și constantă, potrivită peptidelor.",
      "Locuri multe și ușor de rotit: abdomen, coapsă, braț.",
      "Este calea descrisă în fișa furnizorului și în majoritatea protocoalelor pentru peptide."
    ],
    cons: [
      "Volum limitat: confortabil până la 1 ml per injecție (max ~1,5 ml).",
      "Soluțiile acide (Glutation) și NAD+ ustură sau ard local.",
      "Noduli, roșeață sau vânătăi la locul injecției dacă nu rotești locurile."
    ],
    sites: ["abdomen stânga", "abdomen dreapta", "coapsă stângă", "coapsă dreaptă", "braț stâng", "braț drept"],
    needle: "Seringă de insulină U-100 (0,3-1 ml), ac 4-8 mm, 29-31 G.",
    steps: [
      "Spală-te pe mâini. Pregătește seringa, tampoane cu alcool, containerul pentru ace.",
      "Alege locul: abdomen la peste 5 cm de ombilic, fața externă a coapsei sau spatele brațului. Nu repeta locul de ieri.",
      "Dezinfectează dopul fiolei și pielea cu alcool; lasă să se usuce complet (altfel ustură).",
      "Trage doza în seringă, elimină bulele de aer bătând ușor cilindrul și împingând pistonul până apare o picătură.",
      "Prinde un pliu de piele între degete (2-3 cm).",
      "Introdu acul în pliu la 45-90° (90° cu ac de 4-6 mm), dintr-o singură mișcare.",
      "Injectează lent și uniform. La NAD+ foarte lent.",
      "Așteaptă 5-10 secunde, scoate acul, eliberează pliul. Apasă ușor cu un tampon, nu masa.",
      "Aruncă seringa în container. Notează locul în jurnal."
    ]
  },
  im: {
    key: "im", label: "IM", name: "Intramuscular (IM)",
    summary: "Injecție în mușchi, cu ac mai lung. Permite volume mai mari și dozele intramusculare din raport.",
    pros: [
      "Volum mare per injecție: 2-3 ml în deltoid, până la 5 ml în fesier sau coapsă.",
      "Absorbție mai rapidă decât subcutanat.",
      "Soluțiile acide ustură mai puțin în mușchi decât sub piele.",
      "Permite doza din raport la Glutation (600-1200 mg, adică o fiolă întreagă)."
    ],
    cons: [
      "Ac mai lung (25-38 mm) și mai gros (22-25 G): mai dureros, mai greu de autoadministrat, mai ales în fesier.",
      "Risc de a atinge un vas sau nervul sciatic dacă locul e ales greșit; ventrogluteal este locul sigur, nu cadranul superior-extern clasic.",
      "Durere musculară 1-2 zile, uneori hematom.",
      "Pentru Glutation, IM nu este calea din fișa furnizorului; raportul avertizează că riscul principal la injectabile vine din preparate nesterile, indiferent de cale."
    ],
    sites: ["deltoid stâng (max 2 ml)", "deltoid drept (max 2 ml)", "fesier stâng (ventrogluteal)", "fesier drept (ventrogluteal)", "coapsă stângă (vastus lateralis)", "coapsă dreaptă (vastus lateralis)"],
    needle: "Seringă de 3 ml cu ac 25 mm (coapsă, deltoid) sau 38 mm (fesier), 22-25 G. Poți trage cu un ac gros și injecta cu unul mai subțire.",
    steps: [
      "Spală-te pe mâini. Pregătește seringa de 3 ml, două ace (unul pentru tras, unul pentru injectat), tampoane cu alcool.",
      "Alege locul. Coapsă (vastus lateralis): treimea mijlocie a feței antero-externe, cel mai ușor pentru autoadministrare. Deltoid: 3 degete sub acromion, doar pentru volume ≤ 2 ml. Fesier ventrogluteal: palma pe trohanter, degetul arătător pe spina iliacă antero-superioară, mediusul spre creasta iliacă; injectezi în V-ul dintre degete.",
      "Dezinfectează dopul fiolei și pielea; lasă să se usuce.",
      "Trage doza cu acul gros, schimbă acul, elimină aerul.",
      "Întinde pielea cu mâna liberă (nu pliu). Relaxează mușchiul.",
      "Introdu acul la 90°, rapid și ferm, până aproape de garda acului.",
      "Injectează lent: aproximativ 10 secunde per ml.",
      "Așteaptă 10 secunde, scoate acul în aceeași direcție, apasă cu un tampon. Nu masa locul.",
      "Aruncă acele în container. Alternează partea stângă/dreaptă la fiecare injecție. Notează locul în jurnal."
    ]
  }
};

const SITES = ["abdomen stânga", "abdomen dreapta", "coapsă stângă", "coapsă dreaptă", "braț stâng", "braț drept"];
const SYMPTOMS = ["usturime", "roșeață locală", "umflătură", "greață", "durere de cap", "amețeală", "somn bun", "somn prost", "energie", "oboseală", "anxietate", "palpitații"];


/* Analize de sange: campuri urmarite (valori de referinta orientative pentru adult). */
const LAB_FIELDS = [
  { k: "hb", n: "Hemoglobină", u: "g/dl", lo: 13, hi: 17.5 },
  { k: "wbc", n: "Leucocite", u: "×10³/µl", lo: 4, hi: 10 },
  { k: "plt", n: "Trombocite", u: "×10³/µl", lo: 150, hi: 400 },
  { k: "glu", n: "Glicemie à jeun", u: "mg/dl", lo: 70, hi: 99 },
  { k: "hba1c", n: "HbA1c", u: "%", lo: 4, hi: 5.6 },
  { k: "alt", n: "ALT (TGP)", u: "U/l", lo: 0, hi: 41 },
  { k: "ast", n: "AST (TGO)", u: "U/l", lo: 0, hi: 40 },
  { k: "crea", n: "Creatinină", u: "mg/dl", lo: 0.7, hi: 1.2 },
  { k: "chol", n: "Colesterol total", u: "mg/dl", lo: 0, hi: 200 },
  { k: "ldl", n: "LDL", u: "mg/dl", lo: 0, hi: 130 },
  { k: "hdl", n: "HDL", u: "mg/dl", lo: 40, hi: 999 },
  { k: "tg", n: "Trigliceride", u: "mg/dl", lo: 0, hi: 150 },
  { k: "cu", n: "Cupru seric", u: "µg/dl", lo: 70, hi: 140 },
  { k: "zn", n: "Zinc seric", u: "µg/dl", lo: 60, hi: 120 }
];

/* Harta corpului: coordonate pe silueta 200x420 (vedere din fata; stanga pacientului = dreapta imaginii). */
const BODY_POINTS = {
  "abdomen stânga": [118, 208], "abdomen dreapta": [82, 208],
  "coapsă stângă": [112, 300], "coapsă dreaptă": [88, 300],
  "braț stâng": [156, 172], "braț drept": [44, 172],
  "deltoid stâng (max 2 ml)": [150, 128], "deltoid drept (max 2 ml)": [50, 128],
  "fesier stâng (ventrogluteal)": [146, 238], "fesier drept (ventrogluteal)": [54, 238],
  "coapsă stângă (vastus lateralis)": [132, 318], "coapsă dreaptă (vastus lateralis)": [68, 318]
};
const NEG_SYMPTOMS = ["usturime", "roșeață locală", "umflătură", "greață", "durere de cap", "amețeală", "somn prost", "oboseală", "anxietate", "palpitații"];
const LOCAL_SYMPTOMS = ["usturime", "roșeață locală", "umflătură"];


/* Consumabile urmarite (cheie, nume, unitate). */
const SUPPLY_ITEMS = [
  { k: "s03", n: "Seringi 0,3 ml (U-100)", u: "buc", hint: "doze sub 30 U: DSIP, Semax, Selank, BB10, NAD+ titrare, GHK-Cu" },
  { k: "s1", n: "Seringi 1 ml (U-100)", u: "buc", hint: "doze de 30-100 U: SHB, SS-31, MOTS-c, Epithalon, Pinealon, Glutation SC, NAD+" },
  { k: "s3", n: "Seringi 3 ml + ace IM", u: "buc", hint: "doze peste 1 ml sau intramusculare" },
  { k: "waterMl", n: "Apă bacteriostatică", u: "ml", hint: "flacoane de 10 ml; reconstituire fiole" },
  { k: "swabs", n: "Tampoane cu alcool", u: "buc", hint: "2 per injecție + 1 per fiolă preparată" }
];
