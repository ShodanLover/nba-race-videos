# Handoff — where things stand (2026-11-05)

Work moved from a laptop (software rendering, ~12 min per video) to a desktop with a graphics card.

## Approved
The **rebounds** video is approved as the template for mass production:
25s format (`18` second race, default `--hold 3`), start year 1960, both sound versions (`_sfx` and `_beat`).
```bash
python3 export_data.py trb 1960 data_trb_1960.json
node render.js data_trb_1960.json "ALL-TIME|REBOUND LEADERS" "Career regular-season rebounds" videos/rebounds.mp4 18 --hook "ALL-TIME|REBOUND LEADER"
node render.js data_trb_1960.json "ALL-TIME|REBOUND LEADERS" "Career regular-season rebounds" x 18 --hook "ALL-TIME|REBOUND LEADER" --events audio/ev_rebounds.json
python3 sound.py audio/ev_rebounds.json videos/rebounds.mp4
python3 sound.py audio/ev_rebounds.json videos/rebounds.mp4 --beat
```
The rendered rebounds videos are not in git; re-render them here if needed (`videos/` and `audio/` are ignored).

## Changes made on the laptop
- `scene.js`: basketballs now spin with each player's own growth (one full turn per season at the
  data's fastest single-season pace). Before, spin was tied to bar length relative to the leader, so
  with later start years the balls barely turned.
- `package.json`: added `playwright` (render.js needs it; it wasn't listed). Pinned via the lockfile to
  1.64.1 because 1.65.0 pointed at an unpublished `playwright-core` at the time.
- README: start-year table (how much each stat's top 10 actually moves).

## Next: the batch
Same command pattern as above, start years from the README table. Suggested order (most movement first):
3-pointers (1980), blocks (1974), steals (1974), assists (1960), points (1960), triple-doubles (1960).
Spot-check each with `--preview` before the full render.

## Setup on a new machine
```bash
npm install
pip install pandas numpy scipy matplotlib
npx playwright install chromium
mkdir -p videos audio
```
Plus ffmpeg on the PATH. `data/totals.csv` is in the repo; refresh it with the curl command in the README.
