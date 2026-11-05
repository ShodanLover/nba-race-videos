# NBA 3D Leaderboard Races

Generates vertical (1080×1920) NBA "career leaders" race videos for TikTok / YouTube Shorts / Reels.
Bright toy-style 3D scene: candy bars, rolling basketballs, crown for #1, confetti on lead changes,
and a 3.6s "Think you can guess…? Comment below now!" hook at the start.

## Setup
Needs Node 18+, Python 3 (pandas), ffmpeg, and Playwright's Chromium.
```bash
npm install
pip install pandas matplotlib
npx playwright install chromium
```

## Make a video
1. Export the stat (column names from `data/totals.csv`: pts, ast, trb, x3p, stl, blk, g, trp_dbl …):
```bash
python3 export_data.py trb 0 data_trb.json
```
   The second argument is the first season to include (e.g. `1980` for 3-pointers, `1974` for blocks/steals).

2. Render (the number is the length of the race in seconds; the hook and a 5s ending are added on top):
```bash
mkdir -p videos
node render.js data_trb.json "ALL-TIME|REBOUND LEADERS" "Career regular-season rebounds" videos/rebounds.mp4 45 --hook "ALL-TIME|REBOUND LEADER"
```
   `|` splits a title onto two lines.

Preview single frames without rendering the whole video: add `--preview 10,500,1200` (writes JPGs).

## Data
`data/totals.csv` is per-season player totals from Basketball-Reference (via the
sumitrodatta/bball-reference-datasets project). Refresh it with:
```bash
curl -L -o data/totals.csv "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/Player%20Totals.csv"
```

## Files
- `scene.js` – the 3D scene (three.js), animation, text and the hook intro
- `ball.js` – procedural basketball (seams, pebbled leather)
- `render.js` – drives headless Chrome and encodes MP4s with ffmpeg (4 workers in parallel)
- `export_data.py` / `make_race.py` – data cleanup (traded players, NBA+BAA only) and the old 2D version
- `UPLOAD_KIT.md` – titles, descriptions and posting plan
