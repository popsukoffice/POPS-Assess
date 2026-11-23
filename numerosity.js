/* POPS Assess: dot arrays for the numerosity activities (quick look and which-has-more).
   (c) 2026 Positive Outcomes Psychology Services Ltd (POPS UK). Pure functions, no DOM, so they can be tested in Node.
   Layouts are generated from a seed with integer arithmetic and rejection sampling, so the child's screen and the assessor's
   preview draw exactly the same dots. Everything is in a 100 x 100 unit square. */
(function (root) {
  "use strict";
  function rng(seed) {                       // mulberry32
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const GAP = 2.2, MARGIN = 2;
  const clash = (d, x, y, r) => d.some(o => { const dx = o.x - x, dy = o.y - y, m = o.r + r + GAP; return dx * dx + dy * dy < m * m; });

  // canonical (dice-like) patterns for 1 to 6 on a 100 x 100 square
  const DICE = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]]
  };
  // groups for 5 to 9 (clusters of dots, as a child might see them grouped)
  const GROUPS = { 5: [3, 2], 6: [3, 3], 7: [4, 3], 8: [4, 4], 9: [3, 3, 3] };
  const ANCH = { 2: [[27, 50], [73, 50]], 3: [[27, 28], [73, 28], [50, 76]] };

  function scatterInto(d, n, radii, rnd, box) {
    // place n dots with the given radii inside box {x0,y0,x1,y1}; returns false if it does not fit
    for (let i = 0; i < n; i++) {
      const r = radii[i]; let ok = false;
      for (let t = 0; t < 600 && !ok; t++) {
        const x = box.x0 + r + rnd() * (box.x1 - box.x0 - 2 * r), y = box.y0 + r + rnd() * (box.y1 - box.y0 - 2 * r);
        if (!clash(d, x, y, r)) { d.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, r }); ok = true; }
      }
      if (!ok) return false;
    }
    return true;
  }

  /* layout({n, seed, kind: "scatter"|"dice"|"grouped", r, radii?}) -> [{x,y,r}] */
  function layout(spec) {
    const n = spec.n, r0 = spec.r || 4.2;
    const radii = spec.radii || Array.from({ length: n }, () => r0);
    const full = { x0: MARGIN, y0: MARGIN, x1: 100 - MARGIN, y1: 100 - MARGIN };
    for (let attempt = 0; attempt < 80; attempt++) {
      const rnd = rng((spec.seed >>> 0) + attempt * 7919), d = [];
      if (spec.kind === "dice" && DICE[n]) {
        DICE[n].forEach((p, i) => d.push({ x: p[0], y: p[1], r: radii[i] }));
        return d;
      }
      if (spec.kind === "grouped" && GROUPS[n]) {
        const gs = GROUPS[n], anc = ANCH[gs.length]; let idx = 0, ok = true;
        for (let g = 0; g < gs.length && ok; g++) {
          const a = anc[g], box = { x0: Math.max(MARGIN, a[0] - 21), y0: Math.max(MARGIN, a[1] - 21), x1: Math.min(100 - MARGIN, a[0] + 21), y1: Math.min(100 - MARGIN, a[1] + 21) };
          ok = scatterInto(d, gs[g], radii.slice(idx, idx + gs[g]), rnd, box); idx += gs[g];
        }
        if (ok) return d;
        continue;
      }
      if (scatterInto(d, n, radii, rnd, full)) return d;
    }
    throw new Error("could not place " + n + " dots (seed " + spec.seed + ")");
  }

  const area = d => d.reduce((a, c) => a + Math.PI * c.r * c.r, 0);

  /* scale radii so that the total dot area equals "target" exactly, after a small random size jitter */
  function sizedRadii(n, target, seed) {
    const rnd = rng(seed + 31), j = Array.from({ length: n }, () => 0.88 + 0.24 * rnd());
    const raw = j.reduce((a, x) => a + Math.PI * x * x, 0), k = Math.sqrt(target / raw);
    return j.map(x => Math.round(x * k * 100) / 100);
  }

  /* cmpLayout({nl, nr, cong, seed, a0}) -> { left, right, areaL, areaR, ratio, more }
     cong = true: the larger set also has the larger total dot area (same dot size).
     cong = false: total areas are swapped, so the larger set has the smaller total area. */
  function cmpLayout(s) {
    const a0 = s.a0 || Math.PI * 3.3 * 3.3, nl = s.nl, nr = s.nr, big = Math.max(nl, nr), small = Math.min(nl, nr);
    const tBig = s.cong ? big * a0 : small * a0, tSmall = s.cong ? small * a0 : big * a0;
    const tl = nl >= nr ? tBig : tSmall, tr = nl >= nr ? tSmall : tBig;
    const left = layout({ n: nl, seed: s.seed, kind: "scatter", radii: sizedRadii(nl, tl, s.seed) });
    const right = layout({ n: nr, seed: s.seed + 1000, kind: "scatter", radii: sizedRadii(nr, tr, s.seed + 1000) });
    return { left, right, areaL: area(left), areaR: area(right), ratio: big / small, more: nl > nr ? 0 : 1 };
  }

  /* svg string for one array. size in px (square). Dots are dark teal on white. */
  function svg(dots, size, fill) {
    const s = size || 300;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${s}" height="${s}" role="img" aria-hidden="true" style="max-width:100%;height:auto">` +
      dots.map(c => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}" fill="${fill || "#10203a"}"/>`).join("") + `</svg>`;
  }

  /* approximate Weber fraction w from comparison trials [{a, b, ok}] (Halberda-style model; indicative only) */
  function erfc(x) {                          // Numerical Recipes, fractional error < 1.2e-7
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const pCorrect = (a, b, w) => Math.min(0.999, Math.max(0.5, 1 - 0.5 * erfc(Math.abs(a - b) / (Math.SQRT2 * w * Math.sqrt(a * a + b * b)))));
  function weber(trials) {
    const t = (trials || []).filter(x => x && x.a > 0 && x.b > 0 && x.a !== x.b);
    if (t.length < 12) return { w: null, n: t.length, note: "too few trials" };
    const acc = t.filter(x => x.ok).length / t.length;
    if (acc <= 0.55) return { w: null, n: t.length, acc, note: "performance was close to chance, so w cannot be estimated" };
    let best = null;
    for (let w = 0.05; w <= 3.0001; w += 0.01) {
      let ll = 0; t.forEach(x => { const p = pCorrect(x.a, x.b, w); ll += Math.log(x.ok ? p : 1 - p); });
      if (!best || ll > best.ll) best = { w: Math.round(w * 100) / 100, ll };
    }
    return { w: best.w, n: t.length, acc, note: best.w <= 0.06 ? "at or below the smallest value the task can estimate" : "" };
  }

  // ---------- reading numbers: parse what the child said, classify the error ----------
  const UNITS = { zero:0, nought:0, naught:0, oh:0, o:0, nil:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19 };
  const TENS = { twenty:20, thirty:30, forty:40, fourty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90 };
  function parseSaid(str) {
    if (str == null) return null;
    const t = String(str).toLowerCase().trim(); if (!t) return null;
    if (/^\d{1,4}$/.test(t)) return parseInt(t, 10);
    const w = t.replace(/[-,]/g, " ").replace(/\band\b/g, " ").split(/\s+/).filter(Boolean);
    if (!w.length) return null;
    let cur = 0, seen = false;
    for (let i = 0; i < w.length; i++) {
      const x = w[i];
      if (x === "a" && w[i + 1] === "hundred") { cur = 1; continue; }
      if (x === "hundred") { cur = (cur || 1) * 100; seen = true; continue; }
      if (Object.prototype.hasOwnProperty.call(TENS, x)) { cur += TENS[x]; seen = true; continue; }
      if (Object.prototype.hasOwnProperty.call(UNITS, x)) { cur += UNITS[x]; seen = true; continue; }
      return null;
    }
    return seen ? cur : null;
  }
  function classifyNumErr(target, said) {
    if (said == null || String(said).trim() === "") return { v: null, cls: "none", label: "no response" };
    const v = parseSaid(said);
    if (v == null) return { v: null, cls: "other", label: "not a recognisable number" };
    if (v === target) return { v, cls: "same", label: "said the correct number" };
    const ts = String(target), vs = String(v);
    if (target >= 11 && target <= 99 && target % 10 !== 0) {
      const rev = parseInt(ts.split("").reverse().join(""), 10);
      if (v === rev && rev !== target) return { v, cls: "reversal", label: `digits reversed (${target} read as ${v})` };
    }
    if (target >= 13 && target <= 19 && v === (target - 10) * 10) return { v, cls: "teenty", label: `teen number read as a tens number (${target} as ${v})` };
    if (target >= 30 && target <= 90 && target % 10 === 0 && v === target / 10 + 10) return { v, cls: "teenty", label: `tens number read as a teen number (${target} as ${v})` };
    if (target === 100) return { v, cls: "place", label: "100 not read correctly" };
    if (target >= 10 && vs.length === ts.length) {
      if (vs[0] === ts[0]) return { v, cls: "tensright", label: "tens digit right, units digit wrong" };
      if (vs[1] === ts[1]) return { v, cls: "unitsright", label: "units digit right, tens digit wrong" };
    }
    if (Math.abs(v - target) === 1) return { v, cls: "close", label: "one more or one less" };
    return { v, cls: "different", label: "a different number" };
  }

  const api = { rng, layout, cmpLayout, svg, weber, area, pCorrect, DICE, parseSaid, classifyNumErr };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.POPSNUM = api;
})(typeof window !== "undefined" ? window : globalThis);
