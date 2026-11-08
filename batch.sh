#!/usr/bin/env bash
# Render the full batch in the editorial style: 2.4s hook + 24s shot-clock race + 3.6s end screen = 30s.
# Writes videos/<name>.mp4 (silent) and videos/<name>_sfx.mp4 (clock ticks + buzzer; music gets added in the app).
# Usage: ./batch.sh            (all)
#        ./batch.sh blocks     (just the named ones)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p videos audio
PY=${PY:-python3}; command -v "$PY" >/dev/null || PY=python

#       name          stat     start  title                          subtitle                                  hook
JOBS=(
  "rebounds|trb|1960|ALL-TIME|REBOUND LEADERS|Career regular-season rebounds|ALL-TIME|REBOUND LEADER"
  "threes|x3p|1980|ALL-TIME|3-POINT LEADERS|Career regular-season 3-pointers made|ALL-TIME|3-POINT LEADER"
  "blocks|blk|1974|ALL-TIME|BLOCKS LEADERS|Career regular-season blocks|ALL-TIME|BLOCKS LEADER"
  "steals|stl|1974|ALL-TIME|STEALS LEADERS|Career regular-season steals|ALL-TIME|STEALS LEADER"
  "assists|ast|1960|ALL-TIME|ASSIST LEADERS|Career regular-season assists|ALL-TIME|ASSIST LEADER"
  "points|pts|1960|ALL-TIME|SCORING LEADERS|Career regular-season points|ALL-TIME|SCORING LEADER"
  "triple_doubles|trp_dbl|1960|ALL-TIME|TRIPLE-DOUBLE LEADERS|Career regular-season triple-doubles|ALL-TIME|TRIPLE-DOUBLE LEADER"
  "games|g|1960|ALL-TIME|GAMES PLAYED LEADERS|Career regular-season games played|ALL-TIME|GAMES PLAYED LEADER"
  "minutes|mp|1960|ALL-TIME|MINUTES LEADERS|Career regular-season minutes played|ALL-TIME|MINUTES LEADER"
  "field_goals|fg|1960|ALL-TIME|FIELD GOAL LEADERS|Career regular-season field goals made|ALL-TIME|FIELD GOAL LEADER"
  "shots|fga|1960|ALL-TIME|MOST SHOTS TAKEN|Career regular-season field goal attempts|ALL-TIME SHOT|ATTEMPTS LEADER"
  "free_throws|ft|1960|ALL-TIME|FREE THROW LEADERS|Career regular-season free throws made|ALL-TIME|FREE THROW LEADER"
  "free_throw_attempts|fta|1960|ALL-TIME|MOST FREE THROWS TAKEN|Career regular-season free throw attempts|ALL-TIME FREE THROW|ATTEMPTS LEADER"
  "offensive_rebounds|orb|1974|ALL-TIME OFFENSIVE|REBOUND LEADERS|Career regular-season offensive rebounds|ALL-TIME OFFENSIVE|REBOUND LEADER"
  "defensive_rebounds|drb|1974|ALL-TIME DEFENSIVE|REBOUND LEADERS|Career regular-season defensive rebounds|ALL-TIME DEFENSIVE|REBOUND LEADER"
  "turnovers|tov|1978|ALL-TIME|TURNOVER LEADERS|Career regular-season turnovers|ALL-TIME|TURNOVER LEADER"
  "fouls|pf|1960|ALL-TIME|PERSONAL FOUL LEADERS|Career regular-season personal fouls|ALL-TIME PERSONAL|FOUL LEADER"
  "three_attempts|x3pa|1980|ALL-TIME|MOST 3s ATTEMPTED|Career regular-season 3-point attempts|ALL-TIME 3-POINT|ATTEMPTS LEADER"
  "games_started|gs|1982|ALL-TIME|GAMES STARTED LEADERS|Career regular-season games started|ALL-TIME|GAMES STARTED LEADER"
  "two_pointers|x2p|1980|ALL-TIME|2-POINTER LEADERS|Career regular-season 2-pointers made|ALL-TIME|2-POINTER LEADER"
)

for job in "${JOBS[@]}"; do
  IFS='|' read -r name stat start t1 t2 sub h1 h2 <<<"$job"
  if [ $# -gt 0 ] && [[ " $* " != *" $name "* ]]; then continue; fi
  data="data_${stat}_${start}.json"
  echo "=== $name ($stat from $start)"
  [ -f "$data" ] || "$PY" export_data.py "$stat" "$start" "$data"
  node render.js "$data" "$t1|$t2" "$sub" "videos/$name.mp4" 24 --style editorial --hook "$h1|$h2"
  node render.js "$data" "$t1|$t2" "$sub" x 24 --style editorial --hook "$h1|$h2" --events "audio/ev_$name.json"
  "$PY" sound.py "audio/ev_$name.json" "videos/$name.mp4"
done
