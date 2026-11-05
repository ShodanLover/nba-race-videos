"""Generate a vertical (1080x1920) NBA career-leaders bar chart race video.

Usage:
  python3 make_race.py pts "ALL-TIME SCORING LEADERS" "Career points" out.mp4
  python3 make_race.py x3p "ALL-TIME 3-POINT LEADERS" "Career 3s made" out.mp4 --start 1980
"""
import argparse, subprocess, colorsys, hashlib
import numpy as np, pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe

W, H, FPS = 1080, 1920, 30
BG, FG, MUTED, ACCENT = "#0d1117", "#f5f5f5", "#8b949e", "#ff6b1a"
TOP_N = 10


def load(path, stat, start):
    d = pd.read_csv(path)
    d = d[d.lg.isin(["NBA", "BAA"])]  # official NBA records include the BAA years
    multi = d.team.str.match(r"\dTM|TOT")
    # keep combined row for players traded mid-season, drop their per-team rows
    has_multi = set(zip(d[multi].season, d[multi].player_id))
    d = d[multi | ~pd.Series(list(zip(d.season, d.player_id)), index=d.index).isin(has_multi)]
    d[stat] = d[stat].fillna(0)
    names = d.groupby("player_id").player.last()
    piv = d.pivot_table(index="season", columns="player_id", values=stat, aggfunc="sum").fillna(0)
    piv = piv.reindex(range(piv.index.min(), piv.index.max() + 1), fill_value=0)
    cum = piv.cumsum()
    cum = cum[cum.index >= start]
    return cum, names


def color_for(pid):
    h = int(hashlib.md5(pid.encode()).hexdigest()[:6], 16) / 0xFFFFFF
    r, g, b = colorsys.hls_to_rgb(h, 0.55, 0.65)
    return (r, g, b)


def season_label(s):
    return f"{s-1}-{str(s)[-2:]}"


def render(cum, names, title, subtitle, out, frames_per_season, hold_s, source):
    seasons = list(cum.index)
    # only players who ever crack the top N matter -> faster
    keep = set()
    for s in seasons:
        keep |= set(cum.loc[s].nlargest(TOP_N + 2).index)
    cum = cum[list(keep)]

    fig = plt.figure(figsize=(W / 100, H / 100), dpi=100, facecolor=BG)
    proc = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264",
         "-pix_fmt", "yuv420p", "-crf", "20", "-movflags", "+faststart", out],
        stdin=subprocess.PIPE)

    prev_rank = None
    steps = []
    for i in range(len(seasons) - 1):
        for f in range(frames_per_season):
            steps.append((i, f / frames_per_season))
    steps += [(len(seasons) - 1, 0.0)] * int(hold_s * FPS)

    for i, t in steps:
        a = cum.iloc[i]
        b = cum.iloc[min(i + 1, len(seasons) - 1)]
        t_e = t  # linear keeps motion steady across seasons
        vals = a + (b - a) * t_e
        top = vals[vals > 0].nlargest(TOP_N)
        pos = pd.Series(range(1, len(top) + 1), index=top.index)
        show = list(top.index)

        fig.clf()
        fig.patch.set_facecolor(BG)
        fig.text(0.5, 0.925, title, ha="center", color=FG, fontsize=44, weight="bold")
        fig.text(0.5, 0.895, subtitle, ha="center", color=MUTED, fontsize=26)
        ax = fig.add_axes([0.04, 0.2, 0.92, 0.66])
        ax.set_facecolor(BG)
        vmax = max(vals.max(), 1)
        xmax = vmax * 1.18
        px = 0.92 * W / xmax  # pixels per data unit
        for p in show:
            y = pos[p]
            ax.barh(y, vals[p], height=0.82, color=color_for(p))
            name = names.get(p, p)
            ax.text(vmax * 0.012, y, name, va="center", ha="left", color="white",
                    fontsize=27, weight="bold",
                    path_effects=[pe.withStroke(linewidth=4, foreground="#000000aa")])
            name_end = vmax * 0.012 + len(name) * 16.5 / px
            ax.text(max(vals[p], name_end) + vmax * 0.012, y, f"{int(vals[p]):,}",
                    va="center", ha="left", color=FG, fontsize=25)
        ax.set_ylim(TOP_N + 0.6, 0.4)
        ax.set_xlim(0, xmax)
        ax.axis("off")
        s = seasons[i] if t < 0.5 else seasons[min(i + 1, len(seasons) - 1)]
        fig.text(0.5, 0.125, season_label(s), ha="center", color=ACCENT, fontsize=88, weight="bold")
        leader = names.get(vals.idxmax())
        fig.text(0.5, 0.075, f"#1: {leader}", ha="center", color=FG, fontsize=32, weight="bold")
        fig.text(0.5, 0.03, source, ha="center", color=MUTED, fontsize=18)
        fig.canvas.draw()
        proc.stdin.write(fig.canvas.buffer_rgba().tobytes())

    proc.stdin.close()
    proc.wait()
    print(f"wrote {out} ({len(steps)/FPS:.1f}s)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stat"); ap.add_argument("title"); ap.add_argument("subtitle"); ap.add_argument("out")
    ap.add_argument("--data", default="/home/user/data/totals.csv")
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--seconds", type=float, default=45, help="target length of the race part")
    ap.add_argument("--hold", type=float, default=4)
    a = ap.parse_args()
    cum, names = load(a.data, a.stat, a.start)
    fps_season = max(4, round(a.seconds * FPS / max(len(cum) - 1, 1)))
    render(cum, names, a.title, a.subtitle, a.out, fps_season, a.hold,
           "Regular season, NBA/BAA only · Data: Basketball-Reference · 2026-27 through Nov")
