/* POPS Assess: pure scoring helpers (no DOM, no network). Loaded by assessor.html; also tested in Node.
   (c) Positive Outcomes Psychology Services Ltd (POPS UK). */
(function (root) {
  "use strict";

  /* ---------- confidence intervals and bands ---------- */
  // Wilson score interval; z = 1.2816 gives an 80% two-sided interval.
  function wilson(k, n, z) {
    z = z || 1.2816;
    if (!n) return [0, 1];
    const p = k / n, z2 = z * z, d = 1 + z2 / n;
    const c = (p + z2 / (2 * n)) / d, w = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / d;
    return [Math.max(0, c - w), Math.min(1, c + w)];
  }
  // P(X >= k) for X ~ Binomial(n, p)
  function binomTail(k, n, p) {
    if (k <= 0) return 1; if (k > n) return 0;
    let s = 0, c = 1; // c = C(n,i)
    const lc = [1]; for (let i = 1; i <= n; i++) lc.push(lc[i - 1] * (n - i + 1) / i);
    for (let i = k; i <= n; i++) s += lc[i] * Math.pow(p, i) * Math.pow(1 - p, n - i);
    return Math.min(1, s);
  }
  // byLevel: { level: {n: items in level, c: correct, a: attempted} }, thr = accuracy needed for "secure"
  function levelBand(byLevel, thr) {
    const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);
    const info = {};
    let point = null;
    levels.forEach(l => {
      const o = byLevel[l]; if (!o.a) return;
      const [lo, hi] = wilson(o.c, o.a);
      info[l] = { c: o.c, a: o.a, n: o.n, p: o.c / o.n, lo, hi, secure: o.c / o.n >= thr };
      if (o.c / o.n >= thr) point = l;
    });
    let firm = null, plaus = null;
    levels.forEach(l => {
      const x = info[l]; if (!x) return;
      if (x.a >= 4 && x.lo >= thr && x.secure) firm = l;
      if (x.a >= 3 && x.hi >= thr) plaus = l;
    });
    if (plaus != null && point != null && plaus < point) plaus = point;
    if (plaus == null) plaus = point;
    // next level above the point estimate that was attempted
    let next = null; for (const l of levels) { if (info[l] && (point == null || l > point)) { next = l; break; } }
    const nx = next != null ? info[next] : null;
    const probablyEmerging = !!(nx && !nx.secure && nx.p >= 0.5);
    const uncertain = levels.filter(l => info[l] && info[l].a >= 3 && info[l].lo < thr && info[l].hi >= thr);
    const minItems = point != null && info[point] ? info[point].a : 0;
    return { point, firm, plausible: plaus, next, probablyEmerging, uncertain, info, thin: point != null && info[point] && info[point].n < 10 };
  }
  // Which levels could be probed to firm up the boundary? Returns up to 3 levels, nearest the boundary first.
  function probeLevels(band, available) {
    const centre = (band.point == null ? 0 : band.point) + 0.5;
    const cand = Object.keys(band.info).map(Number).filter(l => band.info[l].a >= 2 && band.info[l].lo < 0.999 && (band.uncertain.includes(l) || l === band.point || l === band.next));
    return cand.filter(l => (available[l] || 0) > 0).sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre)).slice(0, 3).sort((a, b) => a - b);
  }

  /* ---------- timing ---------- */
  function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  // rows: [{level, mark, ms}] -> medians (seconds) of correct, plausible timings only
  function latencySummary(rows) {
    const ok = rows.filter(r => r.mark === 1 && r.ms != null && r.ms >= 300 && r.ms <= 30000);
    const by = {};
    ok.forEach(r => (by[r.level] = by[r.level] || []).push(r.ms));
    const perLevel = {}; Object.keys(by).forEach(l => { perLevel[l] = { n: by[l].length, med: median(by[l]) / 1000 }; });
    const all = ok.map(r => r.ms);
    return { n: ok.length, med: all.length ? median(all) / 1000 : null, perLevel };
  }

  /* ---------- spelling analysis ---------- */
  // Irregular words: target "sound keys" written by hand in the same symbol set the rules produce.
  // Symbols: digits 1-9 long/diphthong vowels (1 ay, 2 ee, 3 eye, 4 oh, 5 oo, 6 ow, 7 oy, 8 ar, 9 or), R er, A air, I ear/eer,
  // L final -le/-el, S sh, C ch, T th, N ng, J j, Q kw, lower-case letters otherwise (short vowels a e i o u).
  const PRON = {
    beautiful: "b5tiful",
    the: "Tu", a: "u", of: "uv", to: "t5", too: "t5", two: "t5", do: "d5", you: "y5", your: "y9", were: "wR", was: "woz", is: "iz", his: "hiz", has: "haz", as: "az", are: "8",
    he: "h2", she: "S2", we: "w2", me: "m2", be: "b2", no: "n4", so: "s4", go: "g4", by: "b3", my: "m3", why: "w3", try: "tr3", fly: "fl3", sky: "sk3", cry: "kr3", dry: "dr3",
    said: "sed", says: "sez", they: "T1", their: "TA", there: "TA", where: "wA", here: "hI", what: "wot", when: "wen", who: "h5", one: "wun", once: "wuns", some: "sum", come: "kum", done: "dun", gone: "gon", love: "luv", give: "giv", live: "liv", have: "hav",
    friend: "frend", could: "kud", would: "wud", should: "Sud", put: "put", push: "puS", pull: "pul", full: "ful", sugar: "SugR", busy: "biz2", people: "p2pL", because: "bukuz",
    water: "w9tR", want: "wont", watch: "woC", wash: "woS", any: "en2", many: "men2", only: "4nl2", very: "ver2", every: "evr2", pretty: "prit2", great: "gr1t", break: "br1k",
    door: "d9", floor: "fl9", poor: "p9", four: "f9", through: "Tr5", though: "T4", thought: "T9t", bought: "b9t", brought: "br9t", enough: "unuf", rough: "ruf", tough: "tuf", laugh: "l8f", country: "kuntr2", young: "yuN", trouble: "trubL", double: "dubL",
    mind: "m3nd", find: "f3nd", kind: "k3nd", child: "C3ld", wild: "w3ld", climb: "kl3m", old: "4ld", cold: "k4ld", gold: "g4ld", hold: "h4ld", told: "t4ld", most: "m4st", both: "b4T",
    key: "k2", monkey: "munk2", donkey: "donk2", money: "mun2", eight: "1t", weight: "w1t", neighbour: "n1bR", height: "h3t", sure: "S9", pure: "py5R",
    again: "ugen", against: "ugenst", head: "hed", bread: "bred", ready: "red2", heard: "hRd", learn: "lRn", earth: "RT", early: "Rl2", heart: "h8t", bear: "bA", wear: "wA", pear: "pA",
    path: "p8T", bath: "b8T", grass: "gr8s", pass: "p8s", last: "l8st", fast: "f8st", class: "kl8s", glass: "gl8s", plant: "pl8nt", ask: "8sk", after: "8ftR", father: "f8TR", half: "h8f", calm: "k8m", branch: "br8nC", chance: "C8ns", dance: "d8ns",
    walk: "w9k", talk: "t9k", chalk: "C9k", ocean: "4Sun", special: "speSL", guard: "g8d", guess: "ges", guide: "g3d", build: "bild", built: "bilt", biscuit: "biskit",
    school: "sk5l", chemist: "kemist", scheme: "sk2m", chorus: "k9rus", ache: "1k", stomach: "stumuk", character: "karuktR", chef: "Sef", machine: "muS2n", scene: "s2n", science: "s3uns", scissors: "sizRz",
    answer: "8nsR", castle: "kasL", listen: "lisn", whistle: "wisL", Christmas: "krismus", christmas: "krismus", island: "3lund", knight: "n3t", night: "n3t", light: "l3t", right: "r3t", bright: "br3t", flight: "fl3t", fight: "f3t", might: "m3t", sight: "s3t", tight: "t3t", straight: "str1t",
    cousin: "kuzin", mountain: "m6ntin", fountain: "f6ntin", captain: "kaptin", chicken: "Cikin", kitchen: "kiCin", garden: "g8dn", children: "Cildrun", woman: "wumun", women: "wimin", minute: "minit", orange: "orinJ"
  };

  // Pronunciation given as a plain phonetic respelling; its key is computed with the same rules as the attempt.
  const PRONSP = {
    rendezvous: "rondayvoo", chauffeur: "shoafur", haemorrhage: "hemurij", kaleidoscope: "kalidoscope", onomatopoeia: "onomatopeea", pneumonia: "numonia",
    bourgeoisie: "boorjwazee", bourgeois: "boorjwaa", cataclysm: "kataklizm", anachronism: "anakrunizm", choreography: "koreografee", perseverance: "persuveerans",
    sacrilegious: "sakrulijus", tyrannical: "tiranikel", plagiarism: "playjurizm", archaeology: "arkeolujee", quintessential: "kwintusenshul", exuberant: "igzooburunt",
    embarrassment: "embarasmunt", acknowledge: "aknolij", exhilarate: "igzilurate", harassment: "harusmunt", bureaucratic: "byoorukratik", incongruous: "inkongrooius",
    nutrition: "nootrishun", privilege: "privulij", vegetable: "vejtubel", twelfth: "twelfth", competition: "kompatishun", desperate: "despurut", dictionary: "dikshunaree",
    temperature: "temprichur", category: "katugoree", available: "uvaylubel", mayonnaise: "mayunaze", rhinoceros: "rynosuris", pseudonym: "soodunim", hypocrisy: "hipokrusee",
    sufficient: "sufishunt", necessarily: "nesusairulee", unnecessary: "unnesusairee", occurrence: "okurens", accommodation: "akomudayshun", phenomenon: "funomunon",
    pronunciation: "pronunsee-ayshun", condescending: "kondusending", discrepancy: "diskrepunsee", entrepreneurial: "ontrupruneerial", eccentric: "eksentrik", marvellous: "marvelus",
    recognise: "rekugnize", familiar: "fumilyur", frequently: "freekwuntlee", interrupt: "interupt", excellent: "eksulunt", sacrifice: "sakrifise", pharmacy: "farmusee", chronic: "kronik",
    exhaust: "igzorst", boutique: "booteek", rhapsody: "rapsudee", liaise: "leeayz", cacophony: "kakofunee", pneumatic: "newmatik", mnemonic: "nimonik", paraphernalia: "parufunaylyu",
    camouflage: "kamufluzh", onomatopoeic: "onomatopeeik", aficionado: "ufishyunaado", lugubrious: "lugoobreeus", kaleidoscope2: "kalidoskope", restaurant: "restront", ancestor: "ansestur",
    sapphire: "safire", amateur: "amuchur", queue: "kew", environment: "envyrunmunt", apparent: "upparunt", conscious: "konshus", cheque: "chek",
    aggressive: "ugresiv", committee: "kumitee", achieve: "uchieve", awkward: "orkwurd", bruise: "brooz", determined: "ditermind", believe: "beleev", breath: "breth", decide: "deside", guard: "gard",
    heart: "hart", circle: "sirkle", fruit: "froot", length: "length", surprise: "surprize", weight: "wayt", remember: "remembur", sentence: "sentuns", competition2: "kompatishun",
    investigate: "investigayt", nutrition2: "nootrishun", organisation: "organizayshun", original: "uriJunul", twelve: "twelv", plagiarism2: "playjurizm", exuberant2: "igzooburunt",
    wednesday: "wenzday", february: "febrooaree", library: "lybrairee", separate: "seprut", definitely: "definutlee", government: "guvurnmunt", environment2: "envyrunmunt"
  };
  const LONG = { a: "1", e: "2", i: "3", o: "4", u: "5" };
  function norm(k) { return String(k).replace(/z/g, "s").replace(/n(?=k)/g, "N").replace(/([bcdfgkpstz])l$/, "$1L"); }
  function soundKey(word) {
    let w = String(word || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!w) return "";
    if (PRON[w]) return norm(PRON[w]);
    if (PRONSP[w] && !arguments[1]) return soundKey(PRONSP[w], true);
    const groups = (w.match(/[aeiouy]+/g) || []).length;
    let s = w;
    s = s.replace(/^kn/, "n").replace(/^wr/, "r").replace(/^gn/, "n").replace(/^ps/, "s").replace(/^wh/, "w").replace(/^rh/, "r").replace(/^gh/, "g").replace(/^pn/, "n");
    s = s.replace(/([bdfghjklmnprstvz])\1/g, "$1").replace(/qu/g, "kw").replace(/x/g, "ks");
    s = s.replace(/(tion|sion|cian|tian)/g, "Sun").replace(/ture$/, "CR").replace(/sure$/, "JR");
    s = s.replace(/mb$/, "m").replace(/tch/g, "C").replace(/dge/g, "J");
    s = s.replace(/ed$/, (m, off) => (off >= 2 && /[aeiouy]/.test(s.slice(0, off)) && /[^aeiou]$/.test(s.slice(0, off)) ? "D" : "ed"));
    if (groups >= 2) s = s.replace(/([^aeiou])re$/, "$1R").replace(/(ar|er|or|ur)$/, "R").replace(/(le|el|al|il)$/, "L");
    s = s.replace(/are$/, "A").replace(/ere$/, "I").replace(/ore$/, "9").replace(/(oor|oar)/g, "9").replace(/air/g, "A").replace(/eer/g, "I");
    const cmap = { c: "s", g: "J", s: "s", v: "v" };
    s = s.replace(/(^|[^aeiou])([aeiou])(ck|sh|ch|th|ng|[bcdfghjklmnprstvwz])e$/, (m, p, v, c) => p + (LONG[v] || v) + (cmap[c] || c));
    s = s.replace(/ce$/, "s").replace(/ge$/, "J").replace(/se$/, "s").replace(/ve$/, "v");
    if (groups >= 2) s = s.replace(/([bcdfghjklmnprstvwz])e$/, "$1");
    s = s.replace(/c(?=[eiy])/g, "s").replace(/g(?=[eiy])/g, "G");
    s = s.replace(/igh/g, "3").replace(/eigh/g, "1").replace(/augh|ough/g, "9");
    s = s.replace(/ey$/, "2").replace(/ie$/, groups >= 2 ? "2" : "3").replace(/ai|ay|ei|ey/g, "1").replace(/ee|ea|ie/g, "2");
    s = s.replace(/oa|oe/g, "4").replace(/ou|ow/g, "6").replace(/oo|ew|eu|ue|ui/g, "5").replace(/oi|oy/g, "7");
    s = s.replace(/aw|au/g, "9").replace(/al(?=[lk])/g, "9").replace(/ar/g, "8").replace(/or/g, "9").replace(/er|ir|ur/g, "R");
    s = s.replace(/ch/g, "C").replace(/sh/g, "S").replace(/th/g, "T").replace(/ph/g, "f").replace(/ck/g, "k").replace(/ng/g, "N").replace(/gh/g, "");
    s = s.replace(/c/g, "k").replace(/z/g, "s").replace(/j/g, "J");
    s = s.replace(/y$/, groups <= 1 ? "3" : "2").replace(/y(?=[bcdfghjklmnpqrstvwxz])/g, "i");
    s = s.replace(/([^aeiou0-9])o$/, "$14").replace(/([^aeiou0-9])u$/, "$15");
    s = s.replace(/([a-z])\1/g, "$1");
    return norm(s);
  }
  function endingVariants(target) {
    const t = String(target).toLowerCase(), v = [];
    const m = t.match(/^(.*[aeiouy].*[^aeiou])ed$/);
    if (m) { const k = soundKey(m[1]); v.push(k + "t", k + "d", k + "id"); }
    return v;
  }
  // token match with the tolerances needed for English spelling (schwa u, soft g, 5 as u)
  function tokMatch(t, a) {
    if (t === a) return true;
    if (t === "u" && /[aeiou]/.test(a)) return true;
    if (t === "5" && a === "u") return true;
    if ((t === "G" && (a === "g" || a === "J")) || (a === "G" && (t === "g" || t === "J"))) return true;
    return false;
  }
  function keysMatch(kt, ka) { if (kt.length !== ka.length) return false; for (let i = 0; i < kt.length; i++) if (!tokMatch(kt[i], ka[i])) return false; return true; }
  const REV = { b: "d", d: "b", p: "q", q: "p" };
  function align(t, a) { // Levenshtein with operations
    const m = t.length, n = a.length, d = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) d[i][0] = i; for (let j = 0; j <= n; j++) d[0][j] = j;
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (t[i - 1] === a[j - 1] ? 0 : 1));
    const ops = []; let i = m, j = n;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (t[i - 1] === a[j - 1] ? 0 : 1)) { if (t[i - 1] !== a[j - 1]) ops.push({ op: "sub", t: t[i - 1], a: a[j - 1], i: i - 1 }); i--; j--; }
      else if (i > 0 && d[i][j] === d[i - 1][j] + 1) { ops.push({ op: "del", t: t[i - 1], i: i - 1 }); i--; }
      else { ops.push({ op: "ins", a: a[j - 1], i }); j--; }
    }
    return ops.reverse();
  }
  const VOW = /[aeiou]/;
  // returns { cls: correct | plausible | nonplausible | none, tags: [...] }
  function spellAnalyse(target, attempt) {
    const t = String(target || "").toLowerCase().trim(), a = String(attempt == null ? "" : attempt).toLowerCase().trim().replace(/[^a-z' -]/g, "");
    if (!a) return { cls: "none", tags: [] };
    if (a === t) return { cls: "correct", tags: [] };
    const tags = [], ops = align(t, a);
    const subs = ops.filter(o => o.op === "sub"), dels = ops.filter(o => o.op === "del"), ins = ops.filter(o => o.op === "ins");
    for (let i = 0; i + 1 < t.length; i++) { if (t[i] !== t[i + 1] && a === t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2)) { tags.push("letters swapped"); break; } }
    if (subs.some(o => REV[o.t] === o.a)) tags.push("b/d/p/q confusion");
    if (dels.length && !subs.length && !ins.length) tags.push(dels.every(o => VOW.test(o.t)) ? "vowel omitted" : "letter omitted");
    if (ins.length && !subs.length && !dels.length) tags.push("extra letter");
    if (/(.)\1/.test(t) && !/(.)\1/.test(a) && dels.length === 1 && dels[0].t === t[dels[0].i] ) tags.push("doubling missed");
    if (ops.length && ops.every(o => (o.t && VOW.test(o.t)) || (o.a && VOW.test(o.a)))) { if (!tags.includes("vowel omitted")) tags.push("vowel error only"); }
    if (/ed$/.test(t) && /(t|d|id)$/.test(a) && !/ed$/.test(a)) tags.push("past tense ending");
    if (/ing$/.test(t) && !/ing$/.test(a)) tags.push("-ing ending");
    const kt = [soundKey(t), soundKey(t, true), ...endingVariants(t)], ka = soundKey(a);
    let plaus = kt.some(k => keysMatch(k, ka));
    if (!plaus && t.length >= 8) {
      const maxV = t.length >= 10 ? 2 : 1, isV = c => /[aeiou1-9RAI]/.test(c);
      plaus = kt.some(k => { if (k.length !== ka.length) return false; let n = 0; for (let i = 0; i < k.length; i++) { if (tokMatch(k[i], ka[i])) continue; if (isV(k[i]) && isV(ka[i])) n++; else return false; } return n > 0 && n <= maxV; });
      if (plaus) tags.push("vowel variation in a long word");
    }
    return { cls: plaus ? "plausible" : "nonplausible", tags: [...new Set(tags)], key: ka };
  }

  // Cohen's kappa for two raters. pairs = [[a,b],...]. weighted=true uses linear weights for ordered numeric categories.
  function kappa(pairs, weighted) {
    const n = pairs.length; if (n < 2) return { n, kappa: null, agree: null };
    const cats = [...new Set(pairs.flat())].sort((x, y) => (typeof x === "number" ? x - y : String(x).localeCompare(String(y))));
    const k = cats.length, ix = c => cats.indexOf(c), m = Array.from({ length: k }, () => Array(k).fill(0));
    pairs.forEach(([a, b]) => m[ix(a)][ix(b)]++);
    const r = m.map(row => row.reduce((x, y) => x + y, 0)), c = cats.map((_, j) => m.reduce((x, row) => x + row[j], 0));
    const w = (i, j) => weighted && k > 1 ? 1 - Math.abs(i - j) / (k - 1) : (i === j ? 1 : 0);
    let po = 0, pe = 0;
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) { po += w(i, j) * m[i][j] / n; pe += w(i, j) * r[i] * c[j] / (n * n); }
    const agree = pairs.filter(([a, b]) => a === b).length / n;
    return { n, kappa: pe >= 1 ? null : (po - pe) / (1 - pe), agree, cats };
  }

  const api = { wilson, binomTail, levelBand, probeLevels, median, latencySummary, soundKey, spellAnalyse, kappa };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.POPSLIB = api;
})(typeof window !== "undefined" ? window : globalThis);
