#!/usr/bin/env python3
"""Check the v5 diagnostics on simulated data with known problems: injected DIF (3 items +0.9 logits harder for EAL children),
a second dimension (items w10_* to w12_* partly driven by a second trait), retest pairs with true change, and double-marked responses.
Usage: python3 simulate_v5.py [n_sessions]"""
import sys, subprocess, numpy as np, pandas as pd
rng = np.random.default_rng(5)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 600
true = {f"w{l}_{j}": (l - 6.5) * .6 + rng.normal(0, .25) for l in range(1, 13) for j in range(10)}
ids = list(true); dif_items = ["w5_1", "w6_2", "w7_3"]
rows = []; link = {}
def session(b, th, th2, eal, lk, wk, age):
    run = 0
    for it in ids:
        d = true[it] + (.9 if eal and it in dif_items else 0)
        t = th + (.8 * th2 if int(it[1:].split("_")[0]) >= 10 else 0)
        m = int(rng.random() < 1 / (1 + np.exp(-(t - d))))
        rows.append((b, "word", it, int(it[1:].split("_")[0]), "A", False, m, 1200, "eal" if eal else "", age, lk, wk)); run = 0 if m else run + 1
        if run >= 5: break
for s in range(N):
    th, th2 = rng.normal(0, 1.4), rng.normal(0, 1); eal = rng.random() < .3; age = int(rng.integers(6, 12)); lk = f"c{s}"
    session(f"b{s}", th, th2, eal, lk, "2026-01-05", age)
    if s < 80: session(f"r{s}", th + rng.normal(.2, .3), th2, eal, lk, "2026-02-09", age)
df = pd.DataFrame(rows, columns=["batch", "test_key", "item_id", "level", "form", "probe", "mark", "ms", "eal", "age_years", "child_link", "week"])
df.to_csv("sim5.csv", index=False)
# second-marker data: spelling error type (agreement ~85%) and open scores (weighted agreement)
sp = []
for s in range(120):
    for j in range(6):
        a = rng.choice(["plausible", "nonplausible"]); b = a if rng.random() < .85 else ("plausible" if a == "nonplausible" else "nonplausible")
        sp.append((f"s{s}", "spell", f"sp{j}", 5, "A", False, 0, 1000, "", 8, f"k{s}", "2026-01-05", a, b))
sp = pd.DataFrame(sp, columns=list(df.columns) + ["cls", "cls2"])
sp.to_csv("sim5_spell.csv", index=False)
subprocess.run([sys.executable, "calibrate.py", "sim5.csv", "sim5_out"], check=True, stdout=open("sim5_report.txt", "w"))
print(open("sim5_report.txt").read().split("Level order")[0][:1800])
subprocess.run([sys.executable, "calibrate.py", "sim5_spell.csv", "sim5_out2"], check=True, stdout=open("sim5b.txt", "w"))
print([l for l in open("sim5b.txt") if "Second marker" in l])
