#!/usr/bin/env python3
"""POPS Assess: calibrate item difficulty (Rasch), reliability and level thresholds from pooled data.

Input : the CSV exported by Admin > Pooled data (columns: batch, test_key, item_id, level, form, probe, mark, ms, ...).
Output: <outdir>/items_<test>.csv, <outdir>/levels_<test>.csv and <outdir>/calibration_report.md

Method (kept deliberately simple and transparent):
  * Each session (batch) is a person, each item_id an item, mark 0/1. Items a child was not given are missing,
    not wrong (the stop rule and boundary probes make the design deliberately incomplete).
  * Rasch model, joint maximum likelihood with a bias correction (n-1)/n for item difficulties, anchored so mean
    difficulty is 0. Persons with all 0s or all 1s are excluded from item estimation.
  * Reliability: KR-20 on persons who were given all base items of the test (complete cases only), and the Rasch
    person separation reliability for everyone.
  * Item fit: infit and outfit mean squares; flags infit outside 0.7 to 1.3 or outfit above 2.0 (screening ranges, not tests; outfit is noisy for very easy or hard items).
  * Levels: mean difficulty per level, monotonicity checks, and the ability (logits) at which an average item of that
    level is answered correctly with probability = the accuracy threshold used by the tool.
Extra checks (v5):
  * Dimensionality: principal components of standardised Rasch residuals. A first-contrast eigenvalue above about 2.0 suggests a second
    dimension (e.g. maths number versus word problems); the items loading at each pole are listed. Missing responses are set to zero residual, so treat as a screen.
  * DIF (differential item functioning): items calibrated separately for EAL versus not, and for younger versus older half (median age or year group).
    Contrast = difficulty(group 2) - difficulty(group 1) in logits; flagged when |contrast| >= 0.5 and |t| >= 3.0 (screening, many items are tested at once).
    Sex is not collected, so sex DIF cannot be tested.
  * Test-retest and reliable change: sessions with the same child_link in the same test are paired in time order; r on Rasch ability, SEM, and the
    change in logits that is unlikely (80% and 95%) to be measurement error alone.
  * Second marker: Cohen's kappa on spelling error type (cls vs cls2) and weighted kappa on open comprehension scores (score vs score2). Target kappa >= 0.70.
Do not act on results with fewer than about 100 sessions per test: standard errors are large. The report prints them.
Usage: python3 calibrate.py pooled.csv [outdir]
"""
import sys, os, math
import numpy as np
import pandas as pd

THR = {"word": .8, "nonword": .75, "spell": .75, "comp": .75, "comp_open": .75, "maths": .8, "listen": .75}
MIN_SESSIONS = 100
MIN_RESP = 30   # items answered by fewer sessions than this are left out of the level table


def build_matrix(df):
    persons = {b: i for i, b in enumerate(sorted(df.batch.unique()))}
    items = {it: j for j, it in enumerate(sorted(df.item_id.unique()))}
    X = np.full((len(persons), len(items)), np.nan)
    for b, it, m in zip(df.batch, df.item_id, df.mark):
        X[persons[b], items[it]] = float(m)
    return X, list(persons), list(items)


def rasch_jmle(X, iters=200, tol=1e-4):
    obs = ~np.isnan(X); R = np.where(obs, X, 0.0)
    r = R.sum(1); n_i = obs.sum(0); s = R.sum(0)
    keep_p = (r > 0) & (r < obs.sum(1)); keep_i = (s > 0) & (s < n_i)
    Xp = obs[keep_p][:, keep_i]; Rp = R[keep_p][:, keep_i]
    P, I = Rp.shape
    if P < 20 or I < 5:
        raise ValueError("too little data to calibrate")
    rp = Rp.sum(1); si = Rp.sum(0); ni = Xp.sum(0); np_ = Xp.sum(1)
    theta = np.log((rp + .5) / (np_ - rp + .5)); d = -np.log((si + .5) / (ni - si + .5)); d -= d.mean()
    for _ in range(iters):
        p = 1 / (1 + np.exp(-(theta[:, None] - d[None, :]))); p = np.where(Xp, p, 0)
        w = p * (1 - p)
        g = rp - p.sum(1); h = w.sum(1) + 1e-9
        step = np.clip(g / h, -1, 1); theta += step
        p = 1 / (1 + np.exp(-(theta[:, None] - d[None, :]))); p = np.where(Xp, p, 0); w = p * (1 - p)
        gi = p.sum(0) - si; hi = w.sum(0) + 1e-9
        stepi = np.clip(gi / hi, -1, 1); d += stepi; d -= d.mean()
        if max(abs(step).max(), abs(stepi).max()) < tol: break
    d *= (ni - 1) / ni  # bias correction for JMLE
    d -= d.mean()
    p = 1 / (1 + np.exp(-(theta[:, None] - d[None, :]))); p = np.where(Xp, p, 0); w = np.where(Xp, p * (1 - p), 0)
    se_i = 1 / np.sqrt(w.sum(0) + 1e-9); se_p = 1 / np.sqrt(w.sum(1) + 1e-9)
    res = np.where(Xp, Rp - p, 0)
    outfit = (np.where(Xp, res ** 2 / np.where(w > 0, w, 1), 0)).sum(0) / ni
    infit = (res ** 2).sum(0) / (w.sum(0) + 1e-9)
    # person separation reliability
    var_t = theta.var(ddof=1); mse = (se_p ** 2).mean(); sep_rel = max(0.0, (var_t - mse) / var_t) if var_t > 0 else float("nan")
    Z = np.where(Xp, res / np.sqrt(np.where(w > 0, w, 1)), 0.0)
    return dict(Z=Z, keep_i=keep_i, keep_p=keep_p, theta=theta, d=d, se=se_i, infit=infit, outfit=outfit, sep_rel=sep_rel, P=P)


def kr20(X):
    """KR-20 on complete cases (rows with no missing)."""
    comp = X[~np.isnan(X).any(1)]
    if comp.shape[0] < 20 or comp.shape[1] < 3: return float("nan"), comp.shape[0]
    k = comp.shape[1]; p = comp.mean(0); tot = comp.sum(1); v = tot.var(ddof=1)
    return (k / (k - 1)) * (1 - (p * (1 - p)).sum() / v) if v > 0 else float("nan"), comp.shape[0]


def _std_group(g):
    return str(g).strip().lower()


def residual_pca(r, ids):
    Z = r["Z"]
    if Z.shape[0] < 30 or Z.shape[1] < 8: return None
    C = np.corrcoef(Z, rowvar=False); C = np.nan_to_num(C)
    vals, vecs = np.linalg.eigh(C); order = np.argsort(vals)[::-1]; vals, vecs = vals[order], vecs[:, order]
    load = vecs[:, 0]; top = np.argsort(load)
    # eigenvalue in item units (sum of eigenvalues = number of items)
    return dict(first=float(vals[0]), second=float(vals[1]), pos=list(np.array(ids)[top[-4:]][::-1]), neg=list(np.array(ids)[top[:4]]))


def dif(d, groups, label, min_group=50, min_n=40):
    """groups: Series indexed by batch, values 0/1. Returns list of lines."""
    out = []
    est = {}
    for g in (0, 1):
        b = groups[groups == g].index
        dg = d[d.batch.isin(b)]
        if dg.batch.nunique() < min_group: return [f"- {label}: skipped (group sizes {int((groups == 0).sum())} and {int((groups == 1).sum())}; need {min_group}+ sessions in each)."]
        X, persons, items = build_matrix(dg)
        try: rr = rasch_jmle(X)
        except ValueError: return [f"- {label}: skipped (too little data in one group)."]
        ids = np.array(items)[rr["keep_i"]]; n = [(~np.isnan(X[:, items.index(i)])).sum() for i in ids]
        est[g] = pd.DataFrame({"d": rr["d"], "se": rr["se"], "n": n}, index=ids)
    common = est[0].index.intersection(est[1].index)
    a, b = est[0].loc[common], est[1].loc[common]
    ok = (a.n >= min_n) & (b.n >= min_n)
    a, b = a[ok], b[ok]
    if len(a) < 8: return [f"- {label}: skipped (too few items answered by enough children in both groups)."]
    da, db = a.d - a.d.mean(), b.d - b.d.mean()   # re-centre on the common items
    con = db - da; t = con / np.sqrt(a.se ** 2 + b.se ** 2)
    flag = (con.abs() >= .5) & (t.abs() >= 3.0)
    out.append(f"- {label}: {len(a)} items compared; {int(flag.sum())} flagged (|contrast| >= 0.5 logits and |t| >= 3.0).")
    for i in con[flag].abs().sort_values(ascending=False).index[:8]:
        out.append(f"    - {i}: {con[i]:+.2f} logits (t = {t[i]:+.1f}); positive means harder for the second group")
    return out


def second_marker(d):
    L = []
    for a_c, b_c, name, w in (("cls", "cls2", "spelling error type", False), ("score", "score2", "open comprehension score", True)):
        if a_c in d.columns and b_c in d.columns:
            dd = d[d[a_c].notna() & d[b_c].notna()]
            if len(dd) >= 2:
                k = kappa(list(zip(dd[a_c], dd[b_c])), w)
                L += ["", f"Second marker, {name}: {len(dd)} double-marked responses; agreement {100 * k[1]:.0f}%; {'weighted ' if w else ''}kappa {k[0]:.2f}" + (" (below the 0.70 target: revise the rubric or train markers)." if k[0] < .70 else ".")]
    return L


def extra_checks(d, X, persons, items, r, ids, test):
    L = []
    pc = residual_pca(r, ids)
    if pc:
        flag = "possible second dimension" if pc["first"] > 2.0 else "no strong second dimension"
        L += ["", f"Dimensionality (residual PCA): first contrast eigenvalue {pc['first']:.2f}, second {pc['second']:.2f}: {flag}."]
        if pc["first"] > 2.0: L.append(f"  Poles: {', '.join(pc['pos'])} versus {', '.join(pc['neg'])}.")
    # DIF
    per = d.drop_duplicates("batch").set_index("batch")
    L += ["", "Differential item functioning:"]
    eal = per.eal.fillna("").map(_std_group)
    L += dif(d, (eal.str.startswith("eal")).astype(int).reindex(per.index), "EAL (second group) versus not")
    ag = per.age_years if per.age_years.notna().sum() > 0.8 * len(per) else per.year_group
    if ag.notna().sum() >= 100:
        med = ag.median(); grp = (ag > med).astype(int); grp = grp[ag.notna()]
        L += dif(d, grp, f"older (above {med:g}) versus younger or equal")
    # retest
    if "child_link" in d.columns and d.child_link.notna().any():
        th = pd.Series(r["theta"], index=np.array(persons)[r["keep_p"]])
        link = per.child_link; wk = pd.to_datetime(per.week, errors="coerce")
        df = pd.DataFrame({"link": link, "wk": wk, "theta": th}).dropna()
        pairs = []
        for _, g in df.groupby("link"):
            g = g.sort_values("wk")
            if len(g) >= 2: pairs.append((g.theta.iloc[0], g.theta.iloc[1], (g.wk.iloc[1] - g.wk.iloc[0]).days))
        if len(pairs) >= 10:
            a_, b_, days = (np.array(x) for x in zip(*pairs))
            rr_ = float(np.corrcoef(a_, b_)[0, 1]); sd = float(np.sqrt((a_.var(ddof=1) + b_.var(ddof=1)) / 2))
            sem = sd * math.sqrt(max(0, 1 - rr_)); sed = sem * math.sqrt(2)
            L += ["", f"Test-retest: {len(pairs)} children with two sessions (median gap {np.median(days):.0f} days). r = {rr_:.2f}; SEM = {sem:.2f} logits; "
                  f"a change larger than {1.28 * sed:.2f} logits (80%) or {1.96 * sed:.2f} logits (95%) is unlikely to be measurement error alone. Mean change {float((b_ - a_).mean()):+.2f} logits (practice or growth)."]
        else:
            L += ["", f"Test-retest: only {len(pairs)} linked pairs so far (need 10+)."]
    return L


def kappa(pairs, weighted=False):
    cats = sorted(set(x for p in pairs for x in p), key=lambda v: (str(type(v)), v)); k = len(cats); n = len(pairs)
    ix = {c: i for i, c in enumerate(cats)}; m = np.zeros((k, k))
    for a, b in pairs: m[ix[a], ix[b]] += 1
    rr, cc = m.sum(1), m.sum(0)
    W = np.array([[1 - abs(i - j) / (k - 1) if weighted and k > 1 else float(i == j) for j in range(k)] for i in range(k)])
    po = (W * m).sum() / n; pe = (W * np.outer(rr, cc)).sum() / n ** 2
    ag = sum(1 for a, b in pairs if a == b) / n
    return ((po - pe) / (1 - pe) if pe < 1 else float("nan")), ag


def analyse(df, test, out):
    d = df[df.test_key == test].copy()
    d = d[d.mark.isin([0, 1])]
    if d.empty: return None
    X, persons, items = build_matrix(d)
    meta = d.drop_duplicates("item_id").set_index("item_id")[["level", "form", "probe"]]
    lines = [f"## {test}", f"Sessions: {len(persons)}; items: {len(items)}; responses: {len(d)}"]
    if len(persons) < MIN_SESSIONS: lines.append(f"**Warning:** fewer than {MIN_SESSIONS} sessions, so estimates are provisional.")
    sm = second_marker(d)
    try:
        r = rasch_jmle(X)
    except ValueError as e:
        lines.append(f"Not calibrated: {e}"); return "\n".join(lines + sm)
    ids = np.array(items)[r["keep_i"]]
    it = pd.DataFrame({"item_id": ids, "difficulty": r["d"], "se": r["se"], "infit": r["infit"], "outfit": r["outfit"]})
    it = it.join(meta, on="item_id"); it["n"] = [int((~np.isnan(X[:, items.index(i)])).sum()) for i in ids]
    it["pct_correct"] = [float(np.nanmean(X[:, items.index(i)])) for i in ids]
    it["flag"] = np.where((it.n >= MIN_RESP) & ((it.infit < .7) | (it.infit > 1.3) | (it.outfit > 2.0)), "misfit", "")
    it.to_csv(os.path.join(out, f"items_{test}.csv"), index=False)
    # level table
    it["low_n"] = it.n < MIN_RESP
    lv = it[~it.low_n].groupby("level").agg(items=("item_id", "count"), mean_difficulty=("difficulty", "mean"), mean_se=("se", "mean"), pct_correct=("pct_correct", "mean")).reset_index()
    thr = THR.get(test, .8); off = math.log(thr / (1 - thr))
    lv["ability_for_threshold"] = lv.mean_difficulty + off
    lv["gap_to_next"] = lv.mean_difficulty.shift(-1) - lv.mean_difficulty
    lv.to_csv(os.path.join(out, f"levels_{test}.csv"), index=False)
    kr, ncomp = kr20(X)
    lines += [f"Person separation reliability (Rasch): {r['sep_rel']:.2f}", f"KR-20 (complete cases, n={ncomp}): {'n/a' if np.isnan(kr) else f'{kr:.2f}'}",
              f"Items with fewer than {MIN_RESP} responses (left out of the level table): {int((it.n < MIN_RESP).sum())}",
              f"Misfitting items (infit outside 0.7 to 1.3 or outfit above 2.0, items with enough responses only): {int((it.flag == 'misfit').sum())} of {len(it)}", ""]
    lines.append("| Level | Items | Mean difficulty (logits) | Mean SE | % correct | Ability for accuracy threshold | Gap to next level |")
    lines.append("|---|---|---|---|---|---|---|")
    for _, x in lv.iterrows():
        gap = "" if pd.isna(x.gap_to_next) else f"{x.gap_to_next:+.2f}"
        lines.append(f"| {int(x.level)} | {int(x['items'])} | {x.mean_difficulty:+.2f} | {x.mean_se:.2f} | {100 * x.pct_correct:.0f}% | {x.ability_for_threshold:+.2f} | {gap} |")
    notes = []
    for i in range(len(lv) - 1):
        g = lv.gap_to_next.iloc[i]
        if g < 0: notes.append(f"Level {int(lv.level.iloc[i])} is harder than level {int(lv.level.iloc[i + 1])} (inversion of {abs(g):.2f} logits): move items or relabel.")
        elif g < 0.3: notes.append(f"Levels {int(lv.level.iloc[i])} and {int(lv.level.iloc[i + 1])} are only {g:.2f} logits apart and are hard to tell apart: consider merging.")
    if notes: lines += ["", "Level order and spacing:"] + [f"- {n}" for n in notes]
    bad = it[it.flag == "misfit"].sort_values("outfit", ascending=False).head(12)
    if len(bad): lines += ["", "Items to review (largest misfit):", "", "| Item | Level | Difficulty | Infit | Outfit |", "|---|---|---|---|---|"] + [f"| {b.item_id} | {int(b.level)} | {b.difficulty:+.2f} | {b.infit:.2f} | {b.outfit:.2f} |" for _, b in bad.iterrows()]
    lines += extra_checks(d, X, persons, items, r, ids, test) + sm
    # form equivalence
    if it.form.notna().any():
        ff = it[it.probe != True].groupby(it.form.fillna("A")).difficulty.agg(["count", "mean"])
        if len(ff) > 1: lines += ["", "Form equivalence (mean item difficulty, logits): " + "; ".join(f"Form {k}: {v['mean']:+.2f} (n={int(v['count'])})" for k, v in ff.iterrows()) + ". Difference larger than about 0.3 logits means the forms are not interchangeable."]
    return "\n".join(lines)


def main():
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    df = pd.read_csv(sys.argv[1]); out = sys.argv[2] if len(sys.argv) > 2 else "calibration_out"; os.makedirs(out, exist_ok=True)
    for c in ("eal", "cls", "cls2", "child_link", "week", "age_years", "year_group", "score", "score2"):
        if c not in df.columns: df[c] = np.nan
    df["probe"] = df["probe"].astype(str).str.lower().isin(["true", "t", "1"])
    parts = ["# POPS Assess calibration report", "", "Generated from pooled, anonymised item data. Estimates are on the logit scale (0 = mean item difficulty within each test). Calibrate each test separately.", ""]
    for t in ["word", "nonword", "spell", "comp", "comp_open", "maths", "listen"]:
        r = analyse(df, t, out)
        if r: parts += [r, ""]
    open(os.path.join(out, "calibration_report.md"), "w").write("\n".join(parts)); print("\n".join(parts))


if __name__ == "__main__":
    main()
