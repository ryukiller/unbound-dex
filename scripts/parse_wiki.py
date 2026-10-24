"""Parse cached unboundwiki.com Pokémon pages into raw JSON (scripts/.cache/wiki_raw.json)."""
import html
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
WIKI = os.path.join(HERE, ".cache", "wiki")


def clean(s):
    s = re.sub(r"<img[^>]*>", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def split_lines(cell):
    parts = re.split(r"<br\s*/?>|</p>|</li>|\n", cell)
    out = []
    for p in parts:
        t = clean(p)
        t = re.sub(r"^\d+\.\s*", "", t)
        if t:
            out.append(t)
    return out


def section(s, title):
    m = re.search(r"<h2>\s*" + re.escape(title) + r".*?</h2>(.*?)(?=<h2>|class=\"parent-page-card\")", s, re.S)
    return m.group(1) if m else ""


def rows(tbl):
    body = re.search(r"<tbody>(.*?)</tbody>", tbl, re.S)
    body = body.group(1) if body else tbl
    return [re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S)]


def move_rows(sec, with_level):
    out = []
    for c in rows(sec):
        if with_level:
            if len(c) < 7:
                continue
            lv, c = clean(c[0]), c[1:]
        if len(c) < 6:
            continue
        cat = re.search(r'alt="([^"]+)"', c[2])
        m = {
            "name": clean(c[0]),
            "type": clean(c[1]),
            "cat": cat.group(1) if cat else clean(c[2]),
            "pow": clean(c[3]),
            "acc": clean(c[4]),
            "pp": clean(c[5]),
        }
        if with_level:
            m["lv"] = lv
        out.append(m)
    return out


def parse(slug):
    s = open(os.path.join(WIKI, slug + ".html"), encoding="utf-8").read()
    name = clean(re.search(r'<h1 class="post-title">(.*?)</h1>', s, re.S).group(1))
    info = re.search(r"section-content.*?</table>", s, re.S)
    info = info.group(0) if info else ""
    d = {"slug": slug, "name": name}
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", info, re.S):
        th = re.search(r"<th[^>]*>(.*?)</th>", r, re.S)
        tds = re.findall(r"<td[^>]*>(.*?)</td>", r, re.S)
        key = clean(th.group(1)) if th else None
        if key == "Type":
            d["types"] = re.findall(r'class="type ([a-z]+)"', tds[0])
        elif key == "National Dex":
            d["dex"] = int(re.sub(r"\D", "", clean(tds[0])) or 0)
        elif key == "Location":
            d["loc"] = split_lines(tds[0])
        elif key in ("Abilities", None) and len(tds) == 2 and "thh3" in r:
            d.setdefault("abil", []).append([clean(tds[0]), clean(tds[1])])
        elif key == "Egg Groups":
            d["egg"] = clean(tds[0])
        elif key == "Wild Held Items":
            d["held"] = clean(tds[0])
    evo = []
    prev = None
    for c in rows(section(s, "Evolution Line")):
        if not c:
            continue
        frm = None
        if len(c) == 3 and not clean(c[0]):
            c = c[1:]
        elif len(c) == 3:
            fm = re.search(r"From (.+?)\s*(?:→|&rarr;)", c[0])
            frm = clean(fm.group(1)) if fm else None
            c = c[1:]
        link = re.search(r'/pokemon/([^/"]+)/', c[0])
        how = clean(c[1]) if len(c) > 1 else ""
        e = {"slug": link.group(1) if link else None, "name": clean(c[0]), "how": how}
        low = how.lower()
        if low.startswith("base form") and len(how) > 9 and prev and not low.startswith("base form/"):
            how = e["how"] = how[9:].strip()
            low = ""
        if not (low.startswith("base form") or low.startswith("baby")):
            e["from"] = frm or prev
        evo.append(e)
        prev = e["name"]
    d["evo"] = evo
    d["lv"] = move_rows(section(s, "Moveset (Level Up)"), True)
    d["tm"] = move_rows(section(s, "Learnset (TM/HM)"), False)
    d["tutor"] = move_rows(section(s, "Move Tutor Moves"), False)
    d["eggm"] = move_rows(section(s, "Egg Moves"), False)
    img = re.search(r'section-content.*?<img[^>]*src="([^"]+)"', s, re.S)
    d["wikisprite"] = img.group(1) if img else None
    return d


if __name__ == "__main__":
    out = [parse(f[:-5]) for f in sorted(os.listdir(WIKI)) if f.endswith(".html")]
    json.dump(out, open(os.path.join(HERE, ".cache", "wiki_raw.json"), "w"), ensure_ascii=False, indent=1)
    print(len(out), "pages")
