"""Build data/places.json (place -> Pokémon) and data/gyms.json (gym leaders / Elite Four teams).

Needs data/dex.json (build_data.py) and the gym pages in scripts/.cache/gyms (fetch.sh).
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from build_data import norm, to_it  # noqa: E402

DEX = json.load(open(os.path.join(ROOT, "data", "dex.json"), encoding="utf-8"))
MOVES = json.load(open(os.path.join(ROOT, "data", "moves.json"), encoding="utf-8"))

# ---------------------------------------------------------------- places
PLACES = [
    "Route 1", "Route 2", "Route 3", "Route 4", "Route 5", "Route 6", "Route 7", "Route 8", "Route 9", "Route 10",
    "Route 11", "Route 12", "Route 13", "Route 14", "Route 15", "Route 16", "Route 17", "Route 18",
    "Frozen Forest", "Great Desert", "Cliff Cave", "Frost Mountain", "Epidimy Town", "Cinder Volcano",
    "Frozen Heights", "Crater Town", "Tarmigan Town", "Dehara City", "Gurun Town", "Flower Paradise", "Grim Woods",
    "Auburn Waterway", "Vivill Woods", "Antisis Port", "Cootes Bog", "Magnolia Fields", "Redwood Forest",
    "Icicle Cave", "Valley Cave", "Tehl Town", "Thundercap Mountain", "Tarmigan Mansion", "Ruins of Void",
    "Lost Tunnel", "Vivill Warehouse", "Antisis Sewers", "Ferrothorn Turf", "Icy Hole", "Seaport Warehouse",
    "Victory Road", "Seaport City", "Antisis City", "Blizzard City", "Dresco Town", "Bellin Town",
    "KBT Expressway", "Shadow Base", "Fallshore City", "Magnolia Town", "Battle Frontier", "Cube Corp",
    "Redwood Village", "Crystal Peak", "SS Marine", "Vivill Town", "Polder Town", "Safari Zone", "Rift Cave",
    "Kyurem's Cave", "Distortion World", "Tomb of Borrius", "Dehara Beach", "Desert Ruins", "Frozen Tomb",
]
NOT_WILD = re.compile(r"^(evolve|eveolve|evolves|level|use |breed|reward|starter|post-game mystery|revive)|"
                      r"mission|egg lady|game corner|prize|gift|trade", re.I)


def place_rx(p):
    return re.compile(r"\b" + re.escape(p).replace("'", "['’]") + (r"(?!\d)" if p[-1].isdigit() else r"\b"), re.I)


PLACE_RX = [(p, place_rx(p)) for p in sorted(PLACES, key=len, reverse=True)]


def places_of(line):
    found, taken = [], line
    for p, rx in PLACE_RX:
        if rx.search(taken):
            found.append(p)
            taken = rx.sub("#", taken)  # "Cinder Volcano Shadow Base" counts once for each, not for "Volcano" twice
    return found


def build_places():
    out = {}
    for p in DEX:
        for en, it in zip(p["loc"], p["locIt"]):
            if NOT_WILD.search(en):
                continue
            for pl in places_of(en):
                out.setdefault(pl, []).append({"id": p["id"], "how": en, "howIt": it})

    def key(n):
        m = re.match(r"Route (\d+)$", n)
        return (0, int(m.group(1)), "") if m else (1, 0, n)

    res = [{"n": n, "it": to_it(n), "mons": out[n]} for n in sorted(out, key=key)]
    json.dump(res, open(os.path.join(ROOT, "data", "places.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(len(res), "places,", sum(len(r["mons"]) for r in res), "entries")


# ---------------------------------------------------------------- gyms
GYMS = [  # in story order
    ("gyms_dresco-town-gym", "Dresco Town", 1), ("gyms_crater-town-gym", "Crater Town", 2),
    ("gyms_blizzard-city-gym", "Blizzard City", 3), ("gyms_fallshore-city-gym", "Fallshore City", 4),
    ("gyms_dehara-city-gym", "Dehara City", 5), ("gyms_antisis-city-gym", "Antisis City", 6),
    ("gyms_polder-town-gym", "Polder Town", 7), ("gyms_redwood-village-gym", "Redwood Village", 8),
    ("elite-four", "Lega Pokémon", 9),
]
BY_NAME = {norm(p["en"]): p for p in DEX}
REGIONAL = {"alolan": "alolan-", "galarian": "galarian-", "hisuian": "hisuian-"}
MOVE_BY_NORM = {norm(m["en"]): k for k, m in MOVES.items()}


def clean(s):
    s = re.sub(r"<br\s*/?>|</li>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    return html.unescape(s).replace("\xa0", " ").strip()


def find_mon(raw):
    """'(Mega) Manectric Lv. 44' / 'Mega Banette (Level 76 at cap)' / 'Alolan Golem Lv. 46' -> (dex entry, level, mega)."""
    lv = re.search(r"(?:Lv\.?|Level)\s*(\d+)", raw)
    name = re.sub(r"\(?(?:Lv\.?|Level)\s*\d+[^)]*\)?", "", raw)
    mega = bool(re.search(r"\bMega\b", name))
    name = re.sub(r"\(?\bMega\b\)?|\(.*?\)|[XY]$", "", name).strip()
    p = BY_NAME.get(norm(name))
    if not p:
        first, _, rest = name.partition(" ")
        if first.lower() in REGIONAL:
            p = next((q for q in DEX if q["id"] == REGIONAL[first.lower()] + rest.lower().replace(" ", "-")), None)
    if not p:
        p = next((q for q in DEX if norm(name).startswith(norm(q["en"])) and len(q["en"]) > 3), None)
    return p, int(lv.group(1)) if lv else None, mega, name


def parse_tables(s):
    teams = []
    for t in re.findall(r"<table.*?</table>", s, re.S):
        head = re.search(r"<th[^>]*>(.*?)</th>", t, re.S)
        title = clean(head.group(1)).split("\n")[0].replace("[hide]", "").replace("[show]", "").strip() if head else ""
        if not re.match(r"(Gym Leader|Elite Four|Champion|Rival)", title):
            continue
        rows = {}
        for r in re.findall(r"<tr[^>]*>(.*?)</tr>", t, re.S):
            th = re.search(r"<th[^>]*>(.*?)</th>", r, re.S)
            label = clean(th.group(1)) if th else ""
            rows[label.replace("é", "e").lower()] = [clean(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)]
        names = rows.get("pokemon", [])
        mons = []
        for i, raw in enumerate(names):
            if not raw:
                continue
            p, lv, mega, nm = find_mon(raw)
            types = [x.strip().lower() for x in re.split(r"[/,]", (rows.get("type") or [""] * 9)[i] if i < len(rows.get("type", [])) else "") if x.strip()]
            moves = []
            for mv in (rows.get("moves", [])[i] if i < len(rows.get("moves", [])) else "").split("\n"):
                mv = mv.strip()
                if mv:
                    moves.append(MOVE_BY_NORM.get(norm(re.sub(r"\s*\(.*\)", "", mv)), mv))
            # the wiki's type column has typos (e.g. Gyarados Water/Ground): trust the dex when we know the mon
            m = {"n": nm, "lv": lv, "types": (p["types"] if p and not mega else types) or types, "moves": moves}
            if p:
                m["id"] = p["id"]
            if mega:
                m["mega"] = 1
            for k, key in (("item", "held item"), ("ab", "ability")):
                v = rows.get(key, [])
                if i < len(v) and v[i] not in ("", "–", "None"):
                    m[k] = v[i]
            mons.append(m)
        if not mons:
            continue
        diff = re.search(r"\((Vanilla|Difficult|Expert|Insane|[^)]*)\)\s*$", title)
        teams.append({"t": title, "diff": diff.group(1) if diff else "", "mons": mons})
    return teams


def build_gyms():
    out = []
    for f, town, n in GYMS:
        s = open(os.path.join(HERE, ".cache", "gyms", f + ".html"), encoding="utf-8").read()
        body = s[s.find("section-content"):]
        intro = re.search(r"<p>(.*?)</p>", body, re.S)
        teams = parse_tables(body)
        ty = re.search(r"speciali[sz]\w* in ([A-Za-z]+)", clean(intro.group(1))) if intro else None
        leader = re.match(r"Gym Leader (.+?) \(", teams[0]["t"]) if teams else None
        out.append({
            "n": n, "town": town, "slug": f.replace("gyms_", "gyms/"),
            "leader": leader.group(1) if leader else "", "type": ty.group(1).lower() if ty else {1: "grass", 2: "dark", 6: "fighting"}.get(n, ""),
            "intro": clean(intro.group(1)) if intro else "", "teams": teams,
        })
        print(town, len(teams), [t["t"] for t in teams][:6])
    json.dump(out, open(os.path.join(ROOT, "data", "gyms.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    build_places()
    build_gyms()
