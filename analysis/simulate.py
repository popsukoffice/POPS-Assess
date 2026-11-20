#!/usr/bin/env python3
"""Simulate pooled data with known item difficulties, then check that calibrate.py recovers them.
Usage: python3 simulate.py [n_sessions] -> writes sim_pool.csv and prints the recovery summary."""
import sys, subprocess, numpy as np, pandas as pd
rng = np.random.default_rng(11)
N = int(sys.argv[1]) if len(sys.argv) > 1 else 400
levels, per = 12, 14
true = {}
rows = []
for l in range(1, levels + 1):
    for j in range(per):
        true[f"w{l}_{j}"] = (l - 6.5) * 0.9 + rng.normal(0, .25)
ids = list(true)
for s in range(N):
    th = rng.normal(0.3, 1.5)
    run = 0
    for it in ids:  # fixed order, stop after 4 consecutive errors
        p = 1 / (1 + np.exp(-(th - true[it]))); m = int(rng.random() < p)
        rows.append((f"b{s}", "word", it, int(it[1:].split("_")[0]), "A", False, m, 1200)); run = 0 if m else run + 1
        if run >= 4: break
df = pd.DataFrame(rows, columns=["batch", "test_key", "item_id", "level", "form", "probe", "mark", "ms"])
df.to_csv("sim_pool.csv", index=False)
subprocess.run([sys.executable, "calibrate.py", "sim_pool.csv", "sim_out"], stdout=subprocess.DEVNULL, check=True)
est = pd.read_csv("sim_out/items_word.csv").set_index("item_id")
t = pd.Series(true).loc[est.index]; t -= t.mean()
r = np.corrcoef(t, est.difficulty)[0, 1]; rmse = float(np.sqrt(((t - est.difficulty) ** 2).mean()))
print(f"sessions {N}, items recovered {len(est)}, correlation true vs estimated {r:.3f}, RMSE {rmse:.2f} logits")
lv = pd.read_csv("sim_out/levels_word.csv"); print(lv[["level", "mean_difficulty", "gap_to_next"]].round(2).to_string(index=False))
