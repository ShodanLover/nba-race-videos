# NBA 3D Leaderboard Races

Generates vertical (1080×1920) NBA "career leaders" race videos for TikTok / YouTube Shorts / Reels.
Bright toy-style 3D scene: candy bars, rolling basketballs, a crown for #1, confetti and a "NEW #1!"
banner on every lead change, a 3.6s "Think you can guess…? COMMENT BELOW NOW!" hook at the start,
and an original synthesized sound track (no copyright issues).

Standard format: **~25 seconds** = 3.6s hook + 18s race + 3s "ALL-TIME #1" ending.

## Setup
Needs Node 18+, Python 3, ffmpeg, and Playwright's Chromium.
```bash
npm install
pip install pandas numpy scipy matplotlib
npx playwright install chromium
```
On Windows, install ffmpeg (e.g. `winget install ffmpeg`) and make sure `ffmpeg` works in a new terminal.

## Make a video (3 steps)

**1. Export the stat.** Columns in `data/totals.csv`: `pts`, `ast`, `trb`, `x3p`, `stl`, `blk`, `g`, `trp_dbl` …
The second argument is the first season shown (career totals still include every earlier season).
```bash
python3 export_data.py trb 1960 data_trb_1960.json
```
Recommended start years — pick one where the top 10 is still active, or the counters sit frozen
(e.g. rebounds from 1990: 9 of the top 10 were already retired). "Moving" = average top-10 players
still adding to their total each season:

| Stat | Start | Moving |
|---|---|---|
| `x3p` | 1980 | 5.9/10 |
| `blk` | 1974 | 3.9/10 |
| `stl` | 1974 | 3.6/10 |
| `ast` | 1960 | 2.4/10 |
| `pts` | 1960 | 2.3/10 |
| `trp_dbl` | 1960 | 2.0/10 |
| `trb` | 1960 | 1.7/10 |

**2. Render the video.** `18` is the race length in seconds. `|` splits a title onto two lines.
`--hook` is the text in "Think you can guess who the current ___ is?".
```bash
mkdir -p videos
node render.js data_trb_1960.json "ALL-TIME|REBOUND LEADERS" "Career regular-season rebounds" videos/rebounds.mp4 18 --hook "ALL-TIME|REBOUND LEADER"
```
Options: `--hold 3` (seconds of the ending, default 3), `--preview 10,300,600` (write a few JPG frames
instead of the whole video, handy for checking a layout), `WORKERS=8` env var for more parallel renderers.

**3. Add sound.** First write the event timings (use the *same* data file, race length and hook as step 2),
then build the audio:
```bash
node render.js data_trb_1960.json "ALL-TIME|REBOUND LEADERS" "Career regular-season rebounds" x 18 --hook "ALL-TIME|REBOUND LEADER" --events audio/ev_rebounds.json
python3 sound.py audio/ev_rebounds.json videos/rebounds.mp4
python3 sound.py audio/ev_rebounds.json videos/rebounds.mp4 --beat
```
(Create the `audio` folder first: `mkdir -p audio`.)

This produces two versions:
- `rebounds_sfx.mp4` — sound effects only. Use on **TikTok** and add a trending sound in the app.
- `rebounds_beat.mp4` — sound effects + built-in beat. Ready to post anywhere.

Sound effects: drumroll + text pops + ball bounces + whoosh + cymbal crash in the hook; a tick every season;
a swoosh when the top 3 changes; chime + party horn + confetti crackle on each new #1; fanfare at the end.
Audio is loudness-normalized for phones.

## Data
`data/totals.csv` is per-season player totals from Basketball-Reference (via the
sumitrodatta/bball-reference-datasets project), regular season, NBA + BAA only, players traded mid-season
counted once. Refresh it during the season with:
```bash
curl -L -o data/totals.csv "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/Player%20Totals.csv"
```

## Files
- `scene.js` – the 3D scene (three.js): bars, crown, confetti, text, hook intro, timed events
- `ball.js` – procedural basketball (real 8-panel seam layout, pebbled leather)
- `render.js` – drives headless Chrome, encodes MP4 with ffmpeg; also `--preview` and `--events` modes
- `sound.py` – synthesizes the sound effects and beat and adds them to a rendered video
- `export_data.py` / `make_race.py` – data cleanup and export (and the old 2D version)
- `balltest.html` – close-up test page for the basketball
- `UPLOAD_KIT.md` – titles, descriptions and posting plan

## Speed
Rendering uses WebGL. On a computer with a graphics card it takes a few minutes per video; on a machine
without one (software rendering) expect ~20–25 minutes for a 25-second video.
