# Handoff — where things stand (2026-11-08)

## Editorial style + brand (2026-11-08) — the current look
Channel name: **Certified Bucketry** (logo in `assets/`). The toy 3D scene was too young for the audience, so
all 20 videos are now rendered in a black-and-white editorial style (`editorial.html` / `editorial.js`,
`render.js --style editorial`):
- 30s total: 2.4s question hook → 24s race on a shot clock (clock turns red under 5s) → 3.6s end screen.
- Leader as a huge Anton number + Playfair italic name, ranks 2–10 as a list; pure black and white, no grey.
- Thin border around the video, with a thick line tracing it as the clock runs (closes at the buzzer).
- End: "FOLLOW FOR MORE" + logo + CERTIFIEDBUCKETRY in Syncopate Bold (`--brand-font`), then everything but
  the logo fades out.
- Sound (`_sfx.mp4`): real recorded game-clock tick each second and an arena buzzer at 0.0, from `sfx/`
  (Pixabay Content License; originals in `sfx/raw/`). No music — that gets added in the app. No `_beat` version.
- `./batch.sh` renders this style; the old toy scene still works without `--style`.


Work moved from a laptop (software rendering, ~12 min per video) to a desktop with a GTX 1660 Ti.

## Done on the desktop
- **Batch rendered**: rebounds, 3-pointers (1980), blocks (1974), steals (1974), assists (1960),
  points (1960), triple-doubles (1960) — each as `videos/<name>.mp4`, `_sfx.mp4` and `_beat.mp4`.
- **13 more** to make 20: games, minutes, field goals, shots taken, free throws, free throw attempts,
  offensive and defensive rebounds (1974), turnovers (1978), personal fouls, 3s attempted (1980),
  games started (1982), 2-pointers (1980). Start years are 1960 or the first season the stat was tracked.
  Long names are split across both title/hook lines (`ALL-TIME DEFENSIVE|REBOUND LEADER`) so the text stays big.
  `videos/` is not in git; re-run `./batch.sh` (about 30s per stat) to regenerate them.
- `render.js`: uses the GPU now. It used to force `--use-angle=swiftshader` (software) even on a graphics card.
  Backend is picked with the `GL` env var (`d3d11` default on Windows, `swiftshader` for no-GPU machines).
  Full video render: ~15s, down from ~12 min.
- `batch.sh`: the whole pipeline (export → render → events → sfx + beat) for every stat, or the ones named.
- `scene.js`: the title shrinks to fit (TRIPLE-DOUBLE LEADERS ran off both edges).
- `scene.js`: accented names (Jokić, Dončić, Šarūnas, Türkoğlu…). Lilita One only has Latin-1 glyphs, so
  these fell back to a thin system font. `text()` now draws base letter + Lilita's own accent (caron = flipped ˆ).
  Known gap: ģ draws its cedilla below instead of as a comma above (no current video uses it).

## Next
- Watch the 20 videos before posting. Spot-checked only via preview frames.
- UPLOAD_KIT.md has copy for points/threes/assists only; write titles/descriptions for the other 17.
- Other ideas from UPLOAD_KIT: games played, per-team leaders, single-season races.

## Setup on a new machine
```bash
npm install
pip install pandas numpy scipy matplotlib
npx playwright install chromium
mkdir -p videos audio
```
Plus ffmpeg on the PATH. `data/totals.csv` is in the repo; refresh it with the curl command in the README.
On Windows, clone with `git -c core.longpaths=true clone …` if the path is deep (the pack file name is long).
