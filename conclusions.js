/* POPS Assess: conclusions, implications and school support drafted from a child's profile.
   (c) 2026 Positive Outcomes Psychology Services Ltd (POPS UK). Pure functions, no DOM, so it can be tested in Node.
   Everything it writes is a DRAFT for the educational psychologist to edit: it is cautious, hypothesis-led and never diagnostic.

   profile = {
     name: "Alex" | null, yearNum: 0..13 | null (0 = Reception), ageYears: decimal | null,
     eal: bool, confidence: "Good" | "Moderate" | "Limited",
     d: { word|nonword|spell|comp|listen|maths|compOpen: { yr: number|null, attempted: bool }   // yr = highest secure year_num, null if none reached
          flu: { wcpm, acc, below: bool|null, above: bool|null }, pa: { blend|seg|elis|iso: { pct, n } },
          dsf|dsb|wsf: { span }, ran: [ { label, secs } ], letters: { upper: { c, n }, lower: { c, n } },
          spellErr: { plausible, total } }
   }
*/
(function (root) {
  "use strict";
  const yname = n => n === 0 ? "Reception" : "Year " + n;
  const LAB = { word: "single-word reading", nonword: "reading unfamiliar (nonsense) words", spell: "spelling", comp: "reading comprehension", compOpen: "reading comprehension (open questions)", listen: "listening comprehension", maths: "mathematics" };
  const PAL = { blend: "blending sounds", seg: "splitting words into sounds", elis: "removing sounds from words", iso: "finding sounds in words" };

  function refYear(p) {
    if (p.yearNum != null && !isNaN(p.yearNum)) return { y: p.yearNum, basis: "year group" };
    if (p.ageYears != null) return { y: Math.max(0, Math.min(13, Math.floor(p.ageYears) - 4)), basis: "age" };
    return { y: null, basis: null };
  }
  function phase(y) {
    if (y == null) return "unknown";
    if (y <= 0) return "eyfs"; if (y <= 2) return "ks1"; if (y <= 4) return "lks2"; if (y <= 6) return "uks2"; if (y <= 9) return "ks3"; if (y <= 11) return "ks4"; return "post16";
  }
  const PHASE_NAME = { eyfs: "Reception", ks1: "Key Stage 1", lks2: "lower Key Stage 2", uks2: "upper Key Stage 2", ks3: "Key Stage 3", ks4: "Key Stage 4", post16: "post-16", unknown: "this age" };
  const primary = ph => ["eyfs", "ks1", "lks2", "uks2"].includes(ph);

  // classify a graded domain against the reference year
  function cls(dom, ref) {
    if (!dom || !dom.attempted) return null;
    if (ref == null) return { c: dom.yr == null ? "none" : "unknown", yr: dom.yr, gap: null };
    if (dom.yr == null) return { c: "wellbelow", yr: null, gap: null };
    const gap = dom.yr - ref;
    const c = gap >= 2 ? "ahead" : gap >= -1 ? "inline" : gap >= -3 ? "below" : "wellbelow";
    return { c, yr: dom.yr, gap };
  }
  const weak = c => c && (c.c === "below" || c.c === "wellbelow");
  const okay = c => c && (c.c === "inline" || c.c === "ahead");

  function spanLow(span, ageYears, back) {
    if (span == null || ageYears == null) return null;
    const lim = back ? (ageYears < 8 ? 1 : ageYears < 12 ? 2 : 3) : (ageYears < 6 ? 2 : ageYears < 8 ? 3 : 4);
    return span <= lim;
  }

  function build(p) {
    const N = p.name || "the child", P = p.name ? p.name + "'s" : "the child's";
    const d = p.d || {}, rf = refYear(p), ref = rf.y, ph = phase(ref), prim = primary(ph);
    const refTxt = ref == null ? "" : yname(ref);
    const C = {}; ["word", "nonword", "spell", "comp", "compOpen", "listen", "maths"].forEach(k => { C[k] = cls(d[k], ref); });
    const strengths = [], diffs = [], concl = [], impl = [], flags = [];
    const supUni = [], supTgt = [], supMon = [], supHome = [];
    const lvl = (k) => d[k] && d[k].yr != null ? yname(d[k].yr) : null;
    const rel = c => c.gap == null ? "" : (c.gap >= 2 ? `about ${Math.round(c.gap)} years above` : c.gap >= -1 ? "broadly in line with" : `about ${Math.abs(Math.round(c.gap))} years below`);

    // ---------- strengths and difficulties from the graded activities ----------
    const inl = [];
    ["word", "nonword", "spell", "comp", "compOpen", "listen", "maths"].forEach(k => {
      const c = C[k]; if (!c) return;
      if (ref == null) { if (c.yr != null) strengths.push(`${cap(LAB[k])}: secure at ${lvl(k)}.`); return; }
      if (c.c === "ahead") strengths.push(`${cap(LAB[k])} is a clear strength: secure at ${lvl(k)}, ${rel(c)} ${P} year group (${refTxt}).`);
      else if (c.c === "inline") inl.push(k);
      else if (c.c === "below") diffs.push(`${cap(LAB[k])} is ${rel(c)} expectations: secure at ${lvl(k)} (${refTxt} expected).`);
      else diffs.push(`${cap(LAB[k])} is well below expectations: ${c.yr == null ? "no level reached the accuracy needed" : "secure only at " + lvl(k)} (${refTxt} expected).`);
    });
    if (inl.length === 1) strengths.push(`${cap(LAB[inl[0]])} is broadly in line with expectations: secure at ${lvl(inl[0])} (${refTxt} expected).`);
    else if (inl.length > 1) strengths.push(`${cap(list(inl.map(k => LAB[k])))} are broadly in line with expectations for ${refTxt}${rf.basis === "age" ? " (estimated from age)" : ""} (secure levels: ${inl.map(k => lvl(k)).join(", ").replace(/, ([^,]*)$/, " and $1")}).`);
    // relative strengths within the profile
    const gr = ["word", "nonword", "spell", "comp", "listen", "maths"].filter(k => d[k] && d[k].attempted && d[k].yr != null);
    if (gr.length >= 3) {
      const best = gr.reduce((a, b) => d[a].yr >= d[b].yr ? a : b), worst = gr.reduce((a, b) => d[a].yr <= d[b].yr ? a : b);
      if (d[best].yr - d[worst].yr >= 2 && !strengths.some(s => s.startsWith(cap(LAB[best]))))
        strengths.push(`${cap(LAB[best])} (${lvl(best)}) is relatively stronger than ${LAB[worst]} (${lvl(worst)}) within ${P} own profile.`);
    }
    // phonological awareness
    const paK = ["blend", "seg", "elis", "iso"].filter(k => d.pa && d.pa[k] && d.pa[k].n >= 5);
    const paWeak = paK.filter(k => d.pa[k].pct < 60), paStrong = paK.filter(k => d.pa[k].pct >= 80);
    if (paWeak.length) diffs.push(`Phonological awareness was weaker for ${list(paWeak.map(k => PAL[k]))} (under 60% correct).`);
    if (paK.length && paStrong.length === paK.length) strengths.push(`Phonological awareness was secure on every task given (80% or better), which is a good foundation for reading and spelling.`);
    else if (paStrong.length) strengths.push(`Phonological awareness was secure for ${list(paStrong.map(k => PAL[k]))}.`);
    // letters
    if (d.letters) {
      const L1 = d.letters.upper, L2 = d.letters.lower, tot = (L1.n || 0) + (L2.n || 0), c = (L1.c || 0) + (L2.c || 0);
      if (tot && ref != null && ref >= 1 && c / tot < 0.85) diffs.push(`Letter-sound knowledge was not yet secure (${c} of ${tot} letters), which is a gap at ${refTxt}.`);
      else if (tot && c / tot >= 0.95) strengths.push(`Letter recognition was secure (${c} of ${tot}).`);
    }
    // fluency
    if (d.flu) {
      if (d.flu.below === true) diffs.push(`One-minute reading speed (${d.flu.wcpm} words per minute) was below the England median for the first term of Year 1; reading is not yet fluent.`);
      else if (d.flu.acc != null && d.flu.acc < 90) diffs.push(`Reading of connected text was inaccurate (${d.flu.acc}% of words correct), which will limit understanding.`);
      else if (d.flu.acc != null && d.flu.acc >= 97) strengths.push(`Connected reading was accurate (${d.flu.acc}% of words correct).`);
    }
    // memory
    const lowF = d.dsf ? spanLow(d.dsf.span, p.ageYears, false) : null, lowB = d.dsb ? spanLow(d.dsb.span, p.ageYears, true) : null, lowW = d.wsf && p.ageYears != null ? spanLow(d.wsf.span, p.ageYears, false) : null;
    if (lowF === true) diffs.push(`Short-term (forward) digit span was ${d.dsf.span}, at the lower end for ${P} age (approximate guide only).`);
    if (lowB === true) diffs.push(`Working memory (backward digit span ${d.dsb.span}) was at the lower end for ${P} age (approximate guide only).`);
    if (lowF === false && (lowB === false || lowB == null)) strengths.push(`Short-term and working memory for digits was in the typical range for ${P} age (approximate guide only).`);
    const memLow = lowF === true || lowB === true || lowW === true;

    // ---------- reading numbers ----------
    const ni = d.numid; let niLow = false, niRev = 0, niTeen = 0;
    if (ni && ni.p1 && ni.p2) {
      niRev = ni.rev || 0; niTeen = ni.teenty || 0;
      const e1 = ni.p1.n - ni.p1.c, e2 = ni.p2.n - ni.p2.c; niLow = e1 > 0 || e2 >= 3;
      if (e1 === 0 && e2 === 0) strengths.push(`${cap(N)} read every number from 0 to 10 and every number from 11 to 100 correctly.`);
      else if (e1 === 0) strengths.push(`${cap(N)} read all of the numbers from 0 to 10 correctly.`);
      if (e1 > 0) diffs.push(`${cap(N)} did not read all of the numbers from 0 to 10 correctly (${ni.p1.c} of ${ni.p1.n}), so number symbols are not yet secure.`);
      if (e2 > 0) diffs.push(`Reading two- and three-digit numbers was inconsistent (${ni.p2.c} of ${ni.p2.n} correct for numbers between 11 and 100).`);
    }

    // ---------- numerosity (informal; no norms, so cautious and relative) ----------
    const nm = d.numer || {}, nsub = nm.sub, ncmp = nm.cmp;
    const frac = o => o && o.n ? o.c / o.n : null;
    let numLow = false, numFine = false, subLow = false, sizeCue = false;
    if (nsub && nsub.n >= 12) {
      const fs = frac(nsub.small), fl = frac(nsub.large);
      subLow = fs != null && fs < 0.7;
      if (subLow) diffs.push(`Naming very small quantities (1 to 3 dots) at a glance was inconsistent (${nsub.small.c} of ${nsub.small.n} correct). This is an informal activity with no norms, so it is a prompt for further exploration only.`);
      else if (fs != null && fs >= 0.9) strengths.push(`${cap(N)} named small quantities (1 to 3 dots) accurately at a glance (${nsub.small.c} of ${nsub.small.n}).`);
      if (!subLow && fs != null && fl != null && fs >= 0.85 && fl < 0.4) diffs.push(`Larger sets of dots (5 to 9) were rarely named exactly (${nsub.large.c} of ${nsub.large.n}); this is common when there is no time to count, so the pattern of errors matters more than the score.`);
    }
    if (ncmp && ncmp.n >= 16) {
      const fe = frac(ncmp.easy), fh = frac(ncmp.hard);
      numLow = ncmp.pct < 60 || (fe != null && fe < 0.7);
      numFine = ncmp.pct >= 75 && (fe == null || fe >= 0.85);
      const fc = frac(ncmp.cong), fi = frac(ncmp.incong);
      sizeCue = fc != null && fi != null && ncmp.cong.n >= 6 && ncmp.incong.n >= 6 && fc - fi >= 0.3;
      if (numLow) diffs.push(`Judging which of two groups of dots had more, without counting, was difficult (${ncmp.pct}% correct, where guessing gives about 50%), including when the numbers were very different (${ncmp.easy.c} of ${ncmp.easy.n}). This was an informal activity with no norms.`);
      else if (numFine) strengths.push(`${cap(N)} compared quantities of dots well without counting (${ncmp.pct}% correct overall).`);
    }

    // ---------- conclusions (hypothesis-led) ----------
    const wordLevel = ["word", "nonword", "spell"].filter(k => weak(C[k])), litWeak = wordLevel.length;
    const decodeWeak = weak(C.nonword) || (weak(C.word) && weak(C.spell));
    const attemptedGraded = ["word", "nonword", "spell", "comp", "listen", "maths"].filter(k => C[k]);
    const weakAll = attemptedGraded.filter(k => weak(C[k]));

    if (ref == null) flags.push("No year group or date of birth was recorded, so results cannot be compared with expectations for the child's age. Add one of them to see comparisons.");
    if (p.eal) flags.push(`English is an additional language for ${N}: the conclusions below should be read with caution, because stage of English, home language literacy and schooling all affect these results.`);
    if (p.confidence === "Limited" || p.confidence === "Moderate") flags.push(`Confidence in these results is ${p.confidence.toLowerCase()} because of the conditions recorded, so the conclusions are provisional.`);
    if (!attemptedGraded.length && !paK.length) concl.push(`Too few graded activities were completed to draw conclusions about ${P} attainment.`);

    if (litWeak) {
      let s = `On these activities, ${P} word-level literacy (${list(wordLevel.map(k => LAB[k]))}) is below what is typically expected in ${refTxt}.`;
      if (weak(C.nonword) && okay(C.word)) s += " Real-word reading was stronger than nonword reading, which can mean that familiar words are recognised by sight while the skill of decoding unfamiliar words is less secure.";
      concl.push(s);
      if (paWeak.length >= 2 && decodeWeak) concl.push(`Weaker phonological awareness alongside difficulties with decoding and spelling is a pattern commonly seen in children with dyslexia-type literacy difficulties. These informal activities cannot identify dyslexia, but the pattern supports further assessment of phonological processing, rapid naming and literacy using standardised measures.`);
      else if (paWeak.length === 0 && paK.length >= 2 && decodeWeak) concl.push(`Phonological awareness was a relative strength, so the literacy difficulties do not appear to be explained by difficulty with the sound structure of words. It may be worth looking at other factors such as the quality and amount of phonics teaching and practice, visual or attentional factors, and confidence.`);
      const se = d.spellErr;
      if (se && se.total >= 8 && weak(C.spell)) {
        const f = se.plausible / se.total;
        if (f >= 0.5) concl.push(`More than half of ${P} misspellings were phonologically plausible (they sound like the target word), which suggests that sound-to-letter links are developing and that learning spelling patterns, rules and word families is the next step.`);
        else if (f < 0.3) concl.push(`Most of ${P} misspellings did not represent the sounds in the word, which suggests that hearing and ordering the sounds in words, and linking them to letters, still needs explicit teaching.`);
      }
    } else if (okay(C.word) || okay(C.nonword) || okay(C.spell)) {
      concl.push(`${cap(P)} word-level reading and spelling were broadly in line with expectations on these activities.`);
    }
    if (d.flu && !weak(C.word) && d.flu.acc >= 95 && d.flu.below !== true && d.flu.belowExpected === true) concl.push(`Reading was accurate but slower than expected for ${P} year group, which suggests that fluency (automatic, effortless reading) rather than accuracy is the area to develop.`);

    if (C.comp || C.listen) {
      const c = C.comp, l = C.listen, w = C.word;
      if (weak(c) && okay(w) && (!l || okay(l))) concl.push(`Word reading and listening comprehension were stronger than reading comprehension, so the main difficulty seems to be in understanding written text (for example inference, vocabulary in text, or monitoring meaning) rather than in decoding or general language.`);
      else if (weak(c) && weak(w) && l && okay(l)) concl.push(`Listening comprehension was in line with expectations while reading comprehension was not. This suggests that ${P} understanding of language is a strength and that reading accuracy is the main barrier to showing it in written text.`);
      else if (weak(c) && l && weak(l)) concl.push(`Both reading and listening comprehension were below expectations, which points to a broader difficulty with understanding language (vocabulary, sentence structure, inference or attention to spoken information) that is not only about reading.${p.eal ? " Because English is an additional language, this may partly reflect the stage of English acquisition." : ""}`);
      else if (okay(c) && l && weak(l)) concl.push(`Listening comprehension was weaker than reading comprehension. This can reflect difficulty keeping up with information that is only heard (attention, working memory, language processing), or poor sound quality on the call.`);
    }
    if (C.maths) {
      const m = C.maths, anyLit = litWeak || weak(C.comp);
      if (weak(m) && !anyLit && attemptedGraded.some(k => k !== "maths" && okay(C[k]))) concl.push(`Mathematics was below expectations while the literacy activities were not, which suggests a difficulty specific to number and calculation. A fuller assessment of number sense, fact retrieval and calculation would help to clarify this.`);
      else if (weak(m) && anyLit) concl.push(`Mathematics was below expectations alongside weaker literacy. Reading demands, language of mathematics and memory for number facts may all be contributing, so the two areas should be considered together.`);
      else if (okay(m) && anyLit) concl.push(`Mathematics was a relative strength compared with literacy, which suggests that difficulties are focused on reading and writing and not on mathematical reasoning in general.`);
    }
    if (ni && ni.p1 && (niRev || niTeen)) {
      const older = p.ageYears != null && p.ageYears >= 8;
      if (niRev) concl.push(`${cap(N)} reversed the digits of ${niRev} number${niRev > 1 ? "s" : ""} (for example reading 14 as 41). ${older ? "Reversals are common in the early years but are less expected by this age, so" : "Reversals are common while children are learning number symbols, so"} this is best treated as a prompt to check how securely ${N} understands place value (tens and units), not as a sign of a specific difficulty on its own. In English, teen numbers are said units-first but written tens-first, which makes them particularly easy to reverse.`);
      if (niTeen) concl.push(`${cap(N)} confused teen numbers with tens numbers (for example 16 and sixty). This suggests that the spoken forms of -teen and -ty numbers are not yet secure, which affects place value and counting.`);
    } else if (ni && ni.p1 && niLow) concl.push(`Errors in reading numbers were not reversals. They suggest that knowledge of number names and symbols is incomplete, which is worth securing before building on arithmetic.`);
    if (nsub || ncmp) {
      const m = C.maths, mWeak = weak(m);
      if ((numLow || subLow) && mWeak) concl.push(`The informal number-sense activities (seeing and comparing quantities without counting) were weaker, and arithmetic was also below expectations. Research suggests that, on average, children with persistent mathematics difficulties find such tasks harder, so this may point to weak early number foundations. Individual scores on these tasks are not reliable enough to identify a specific learning difficulty, so this is a reason to look closely at number understanding, not a diagnosis.`);
      else if ((numLow || subLow) && !mWeak && m) concl.push(`The informal number-sense activities were weaker even though arithmetic was not below expectations. These activities are not very reliable for individual children, so this is best treated as a prompt to observe how ${N} approaches quantity and number, and to repeat the activities in better conditions before drawing conclusions.`);
      else if (numFine && mWeak) concl.push(`Number sense without counting (comparing quantities) was a relative strength while arithmetic was below expectations. This suggests that the difficulty is more likely to lie in number words, symbols, facts and procedures, or in memory and language demands, than in a basic sense of quantity.`);
      else if (numFine && !numLow) concl.push(`Judging and comparing quantities without counting was secure on these informal activities.`);
      if (sizeCue) concl.push(`Accuracy dropped when the larger group of dots covered less space, so ${N} may have judged by how much space the dots filled rather than by how many there were. Teaching that links quantity explicitly to number (counting, grouping and matching) may help.`);
    }
    if (memLow) concl.push(`Memory span was at the lower end for ${P} age on at least one task. A difficulty holding information in mind can affect following instructions, learning facts and writing, and is worth considering in how tasks are set (see the suggestions).`);
    if (weakAll.length >= 4 && attemptedGraded.length >= 5) concl.push(`${cap(P)} attainment was below expectations across most areas assessed. This broad pattern goes beyond a specific literacy or mathematics difficulty, so a wider assessment of learning (including cognitive skills, language and attention) should be considered.`);
    if (attemptedGraded.length >= 3 && weakAll.length === 0 && !diffs.length) concl.push(`${cap(N)} performed in line with, or above, expectations on every activity given. No significant difficulty was identified on these activities. If staff or family still have concerns, it is worth looking at other factors such as attention, anxiety, confidence, or skills that were not assessed here.`);

    // ---------- implications for learning ----------
    if (litWeak) {
      impl.push(`Reading unfamiliar words independently is likely to be slow and effortful, so ${N} may miss content in subjects such as science, history and geography even when able to understand the ideas if they are read aloud.`);
      if (weak(C.spell)) impl.push(`Written work is likely to be shorter, simpler and less accurate than ${P} spoken ideas, because effort goes into spelling. Marking for spelling alone may understate ${P} understanding.`);
      impl.push(`Gaps in reading and spelling are likely to widen as texts become more demanding unless there is regular, structured teaching.`);
    }
    if (weak(C.comp) || (C.listen && weak(C.listen))) impl.push(`${cap(N)} may need vocabulary, background and the structure of a text explained before reading, and may not pick up the meaning of what is read or said without prompting.`);
    if (memLow) impl.push(`${cap(N)} may lose multi-step spoken instructions, may lose track of what to write while thinking about how to write it, and may need information to be available in a form that can be looked back at.`);
    if ((numLow || subLow) && !weak(C.maths)) impl.push(`${cap(N)} may need extra concrete experience of quantity (for example comparing, grouping and arranging objects) when new number ideas are introduced.`);
    if (niRev || niTeen || niLow) impl.push(`${cap(N)} may misread numbers in questions and on the board, so answers that look wrong may come from misreading the number and not from the calculation.`);
    if (weak(C.maths)) impl.push(`In mathematics ${N} is likely to find new work harder to build on without secure foundations, and to need more practice and concrete or visual support to retain facts and methods.`);
    if (litWeak || weak(C.maths) || weak(C.comp)) impl.push(`Children who find core skills hard can lose confidence and avoid tasks (for example reading aloud, writing, or calculation in front of others). ${cap(N)}'s views and sense of success should be monitored alongside attainment.`);
    if (okay(C.listen) && (weak(C.word) || weak(C.spell) || weak(C.comp)) && !(C.listen && weak(C.listen))) impl.push(`Because ${P} spoken language understanding is stronger than literacy, ${N} is likely to learn well through discussion, listening and visual or practical approaches, and attainment in writing may under-represent ${P} knowledge.`);
    if (p.eal) impl.push(`English is an additional language for ${N}. Stage of English acquisition, home language literacy and previous schooling all affect these results, so difficulties should not be assumed to be special educational needs on this evidence alone.`);

    // ---------- school support, by area and phase ----------
    const SC = ph;
    const phonics = {
      eyfs: `Short daily sessions (5 to 10 minutes) of playful phonological awareness (rhyme, syllable clapping, blending and segmenting orally), alongside letter-sound teaching following the school's phonics programme.`,
      ks1: `Keep ${N} in a systematic synthetic phonics programme and add a daily catch-up session (10 to 15 minutes, individually or in a pair) that revisits the phonics phase ${N} has not yet secured: letter-sound correspondences, blending, and reading and spelling decodable words and sentences.`,
      lks2: `Provide a structured catch-up phonics and spelling programme for ${N} (small group or one-to-one, 15 to 20 minutes, three to four times a week for about 10 to 12 weeks), starting at the point where ${P} decoding breaks down, with decodable texts for practice.`,
      uks2: `Provide a structured, age-respectful phonics and morphology catch-up (small group or one-to-one, 20 minutes, three to four times a week for about 10 to 12 weeks) that fills the phonic gaps and then moves to prefixes, suffixes and word roots. Use older-interest texts so ${N} is not reading material designed for younger children.`,
      ks3: `Provide a structured literacy intervention delivered by a trained adult (for example a secondary-appropriate synthetic phonics and morphology programme), three to four times a week for 15 to 20 minutes, delivered discreetly and not at the expense of subjects ${N} enjoys.`,
      ks4: `Provide targeted, discreet literacy support (phonics and morphology for subject vocabulary), and plan how ${N} will access written exam material (see the access arrangements below).`,
      post16: `Provide discreet literacy and study-skills support, and make sure ${N} has access to assistive technology and any entitled arrangements for assessments.`,
      unknown: `Provide a structured phonics and spelling programme matched to the level where ${P} decoding breaks down.`
    };
    if (paWeak.length || (litWeak && decodeWeak)) supTgt.push(phonics[SC]);
    if (weak(C.spell)) {
      supTgt.push(prim ? `Teach spelling explicitly: sound-to-letter patterns first, then common spelling rules, word families, prefixes and suffixes. Practise a small number of words well (little and often) and revisit them over several weeks, rather than weekly lists that are not retained.` : `Teach spelling of key subject vocabulary explicitly (morphology and word families), keep personal word lists, and teach ${N} to use a spell-checker and dictionary efficiently.`);
      supUni.push(`Do not mark every spelling error in extended writing; agree one or two targets with ${N}, and separate marking for ideas from marking for accuracy.`);
    }
    if (d.flu && (d.flu.below === true || d.flu.belowExpected === true || (weak(C.word) && !weak(C.nonword)))) supTgt.push(`Build fluency with repeated reading of short, matched-level texts with an adult or a more fluent partner (re-read three to four times with feedback on accuracy and phrasing), and with practice on high-frequency and irregular words until they are automatic. Record progress as words correct per minute.`);
    if (litWeak && prim) supUni.push(`Provide decodable books that match the phonics ${N} has been taught, and a reading book that ${N} can read with about 95% accuracy for practice at home and school, alongside shared reading of more challenging texts so that vocabulary and comprehension continue to grow.`);
    if (litWeak && !prim) supUni.push(`Give ${N} support to access subject texts: a short glossary of key words in advance, chunked reading, and the option of having text read aloud or using text-to-speech, so that weak decoding does not limit access to the curriculum.`);
    if (weak(C.comp) || (C.listen && weak(C.listen))) {
      supTgt.push(`Teach reading comprehension strategies explicitly and model them aloud: predicting, questioning, clarifying, summarising and making inferences (for example through reciprocal reading), using short texts at a level ${N} can read accurately.`);
      supUni.push(`Pre-teach key vocabulary and background knowledge before new texts or topics, use visual organisers (such as story maps), and check understanding with short, specific questions during reading and listening.`);
      if (C.listen && weak(C.listen)) supTgt.push(`Add a language-focused programme for vocabulary, sentence structure and narrative (small group, regular, led by a trained adult), and consider a referral to speech and language therapy if oral language difficulties are evident in class.`);
    }
    if (memLow) {
      supUni.push(`Break instructions into one or two steps, say them in the same order they should be done, and give a written or picture checklist. Allow ${N} to ask for repetition without drawing attention to it.`);
      supUni.push(`Reduce memory load during writing and problem solving: provide key words, sentence starters, planning frames and worked examples, and encourage rehearsal, chunking and the use of notes.`);
    }
    if (weak(C.maths)) {
      supTgt.push(prim ? `Provide short, frequent sessions (10 to 15 minutes, several times a week) to secure the early number foundations ${N} is missing: counting, place value, number bonds and the meaning of the operations, using concrete materials, then pictorial representations, then written methods. Add regular retrieval practice for number facts.` : `Revisit the maths foundations ${N} is missing using concrete and visual models where helpful, with short frequent practice on number facts, and teach step-by-step methods with worked examples. Make sure ${N} has a fact sheet or calculator for tasks where recall is not the aim.`);
      supUni.push(`Check that ${N} understands the mathematical vocabulary and the language of word problems, and teach how to break a problem into steps.`);
    }
    if (numLow || subLow || (weak(C.maths) && (nsub || ncmp))) supTgt.push(`Build secure number sense with short, frequent practical activities: subitising and dot-pattern cards (dice, ten frames), comparing and ordering quantities, and linking each quantity to its number word and numeral before moving to written calculation.`);
    if (niRev || niTeen || niLow) supTgt.push(`Teach number reading explicitly with place-value equipment (tens frames, base ten, place-value cards): build a number such as 14 as one ten and four ones, say it, write it and check it. Practise teen and tens pairs (13/30, 16/60) and reversible numbers (14/41, 27/72) side by side, a few minutes at a time.`);
    if (litWeak || weak(C.comp)) supUni.push(`Make sure ${N} is not asked to read aloud or spell in front of others without preparation, and provide alternatives to written recording (for example scribing, speech-to-text, mind maps, oral answers) where the learning goal is not writing itself.`);
    if (okay(C.listen) && (litWeak || weak(C.comp))) supUni.push(`Use ${P} strength in listening and discussion: provide audio versions of texts, discussion before writing, and opportunities to show understanding orally.`);
    if (ph === "uks2") supUni.push(`Plan the transition to secondary school: share this profile, the strategies that work, and any assistive technology so that support continues in Year 7.`);
    if (ph === "ks4" || (ph === "ks3" && ref >= 9) || ph === "post16") supMon.push(`If difficulties persist, the school's SENCO can consider formal access arrangements for examinations (such as extra time, a reader or a word processor). These require evidence of need and normal way of working, and an assessment by a suitably qualified assessor; this informal report cannot be used as that evidence.`);
    if (ph === "ks3" || ph === "ks4" || ph === "post16") supUni.push(`Introduce text-to-speech and speech-to-text tools and touch-typing, and teach ${N} to use them across subjects, as a way of keeping pace with the curriculum while skills are taught.`);

    // monitoring
    supMon.push(`Set one or two specific, measurable targets with ${N} (for example words read correctly per minute, or the number of words in a spelling set spelled correctly), review them every half-term, and adjust the intervention if progress is slower than expected.`);
    supMon.push(`The parallel form of the POPS Assess activities can be used to re-check progress after about 8 to 12 weeks of intervention, giving a comparison of the same skills on different items.`);
    const further = [];
    if (litWeak || weak(C.comp)) further.push("literacy (single-word reading, nonword reading, spelling and reading comprehension)");
    if (paWeak.length || (litWeak && decodeWeak)) further.push("phonological processing (including rapid automatised naming)");
    if (memLow) further.push("working memory");
    if (weak(C.maths) || numLow || subLow || niLow || niRev) further.push("mathematics (number sense, number fluency, calculation, reasoning)");
    if (C.listen && weak(C.listen)) further.push("oral language (vocabulary and sentence structure)");
    if (further.length) supMon.push(`If the school or family wishes to explore the nature of the difficulties further, standardised assessment of ${list(further)} would add reliable, norm-referenced information to these informal results.`);
    if (p.eal) supMon.push(`Because English is an additional language, where possible gather information about ${P} skills in the home language, and interpret English literacy results alongside the length and quality of ${P} exposure to English.`);
    if (p.confidence === "Limited" || p.confidence === "Moderate") supMon.push(`Conditions during the session reduced confidence in the results, so it would be sensible to repeat key activities in better conditions before acting on the findings.`);

    supHome.push(`Share the strengths as well as the difficulties with ${N} and the family, in plain language, and agree what practice at home will realistically look like (little and often, about 10 minutes, and enjoyable).`);
    if (litWeak) supHome.push(`Encourage reading for enjoyment in whatever form ${N} likes, including audiobooks and shared reading, so that vocabulary and love of stories keep growing while decoding skills are being taught.`);
    supHome.push(`Ask ${N} what helps and what makes tasks harder, and record this in a one-page pupil profile for staff.`);

    return { strengths, difficulties: diffs, conclusions: concl, implications: impl, support: { universal: supUni, targeted: supTgt, monitoring: supMon, home: supHome }, flags, ref, refBasis: rf.basis, phase: ph, phaseName: PHASE_NAME[ph] };
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function list(a) { return a.length <= 1 ? (a[0] || "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]; }

  const api = { build, phase, refYear, cls, yname };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.POPSCON = api;
})(typeof window !== "undefined" ? window : globalThis);
