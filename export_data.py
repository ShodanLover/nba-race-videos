"""Export cumulative career totals per season (players who ever reach the top 11) as JSON for the 3D renderer."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_race import load

def export(stat, start, out):
    cum, names = load(os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "totals.csv"), stat, start)
    keep = set()
    for s in cum.index:
        keep |= set(cum.loc[s].nlargest(11).index)
    cum = cum[sorted(keep)]
    json.dump({"seasons": [int(s) for s in cum.index],
               "players": [{"id": p, "name": names[p], "v": [int(x) for x in cum[p]]} for p in cum.columns]},
              open(out, "w"))
    print(out, len(cum), "seasons", len(keep), "players")

if __name__ == "__main__":
    export(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 0, sys.argv[3] if len(sys.argv) > 3 else f"data_{sys.argv[1]}.json")
