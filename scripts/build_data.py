"""Merge wiki_raw.json (Unbound data) with PokeAPI CSVs into data/dex.json + data/moves.json.

Run parse_wiki.py first. Also writes scripts/.cache/sprite_ids.json (slug -> PokeAPI pokemon id).
"""
import csv
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CSV = os.path.join(HERE, ".cache", "csv")
EN, IT = "9", "8"


def rows(name):
    with open(os.path.join(CSV, name + ".csv"), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower().replace("é", "e"))


def names(table, key, lang):
    return {r[key]: r["name"] for r in rows(table) if r["local_language_id"] == lang}


def latest_flavor(table, key):
    """{id: {lang: text}} using the most recent version group per language."""
    best = {}
    for r in rows(table):
        if r["language_id"] not in (EN, IT):
            continue
        k = (r[key], r["language_id"])
        vg = int(r["version_group_id"])
        if k not in best or vg >= best[k][0]:
            best[k] = (vg, re.sub(r"\s+", " ", r["flavor_text"].replace("\xad ", "").replace("\xad", "")).strip())
    out = {}
    for (i, lang), (_, t) in best.items():
        out.setdefault(i, {})[lang] = t
    return out


# ---------------------------------------------------------------- PokeAPI lookups
POKEMON = {r["identifier"]: r for r in rows("pokemon")}
POKEMON_BY_ID = {r["id"]: r for r in POKEMON.values()}
SPECIES = {r["id"]: r for r in rows("pokemon_species")}
SPECIES_BY_IDENT = {r["identifier"]: r for r in SPECIES.values()}
SPECIES_IT = names("pokemon_species_names", "pokemon_species_id", IT)
STATS = {}
for r in rows("pokemon_stats"):
    STATS.setdefault(r["pokemon_id"], {})[int(r["stat_id"])] = int(r["base_stat"])

TYPES = {r["id"]: r["identifier"] for r in rows("types")}
TYPE_IT = {TYPES[k]: v for k, v in names("type_names", "type_id", IT).items() if k in TYPES}

MOVES_API = {r["id"]: r for r in rows("moves")}
MOVE_EN = names("move_names", "move_id", EN)
MOVE_IT = names("move_names", "move_id", IT)
MOVE_BY_NORM = {norm(n): i for i, n in MOVE_EN.items()}
for i, r in MOVES_API.items():
    MOVE_BY_NORM.setdefault(norm(r["identifier"]), i)
# Unbound truncates names to 12 chars
MOVE_ALIAS = {
    "HiHorsepower": "High Horsepower", "SurgeStrikes": "Surging Strikes", "PsyshieldRam": "Psyshield Bash",
    "BleakiceWind": "Bleakwind Storm", "WildboltWind": "Wildbolt Storm", "SandsearWind": "Sandsear Storm",
    "Spring Wind": "Springtide Storm", "Scorch Sands": "Scorching Sands", "Jungle Heal": "Jungle Healing",
    "Expand Force": "Expanding Force", "Corrode Gas": "Corrosive Gas", "Break Swipe": "Breaking Swipe",
    "Clang Soul": "Clangorous Soul", "DMax Cannon": "Dynamax Cannon", "Freeze Glare": "Freezing Glare",
    "Thunder Kick": "Thunderous Kick", "Mystic Power": "Mystical Power", "Astral Storm": "Astral Barrage",
    "Jealous Burn": "Burning Jealousy", "False Yield": "False Surrender", "Giant Bash": "Behemoth Bash",
    "Meteor Rush": "Meteor Assault", "InfernalRage": "Raging Fury",
}
for a, b in MOVE_ALIAS.items():
    if norm(b) in MOVE_BY_NORM:
        MOVE_BY_NORM[norm(a)] = MOVE_BY_NORM[norm(b)]
MOVE_FLAVOR = latest_flavor("move_flavor_text", "move_id")

ABIL_EN = names("ability_names", "ability_id", EN)
ABIL_IT = names("ability_names", "ability_id", IT)
ABIL_BY_NORM = {norm(n): i for i, n in ABIL_EN.items()}
ABIL_FLAVOR = latest_flavor("ability_flavor_text", "ability_id")

ITEM_EN = names("item_names", "item_id", EN)
ITEM_IT = names("item_names", "item_id", IT)
ITEM_EN_TO_IT = {}
for i, n in ITEM_EN.items():
    if i in ITEM_IT and len(n) > 3 and n != ITEM_IT[i]:
        ITEM_EN_TO_IT.setdefault(n, ITEM_IT[i])
# Unbound / old spellings
for a, b in {"Thunderstone": "Thunder Stone", "Up Grade": "Up-Grade", "Ancientpower": "Ancient Power"}.items():
    if b in ITEM_EN_TO_IT:
        ITEM_EN_TO_IT[a] = ITEM_EN_TO_IT[b]

EGG_IT = {
    "Monster": "Mostro", "Water 1": "Acqua 1", "Water 2": "Acqua 2", "Water 3": "Acqua 3", "Bug": "Coleottero",
    "Flying": "Volante", "Field": "Campo", "Fairy": "Magico", "Grass": "Erba", "Human-Like": "Umanoide",
    "Human-like": "Umanoide", "Mineral": "Minerale", "Amorphous": "Amorfo", "Ditto": "Ditto", "Dragon": "Drago",
    "Undiscovered": "Sconosciuto", "No Eggs Discovered": "Sconosciuto", "Gender unknown": "Sconosciuto",
}

# ---------------------------------------------------------------- slug -> PokeAPI pokemon
SPECIAL = {
    "calyrex-shadow-rider": "calyrex-shadow", "calyrex-ice-rider": "calyrex-ice",
    "urshifu-single": "urshifu-single-strike", "urshifu-rapid": "urshifu-rapid-strike",
    "original-color-magearna": "magearna-original", "spiky-eared-pichu": "pichu",
    "eternal-floette": "floette-eternal", "hoopa-unbound-form": "hoopa-unbound",
    "galarian-darmanitan": "darmanitan-galar-standard", "hisuian-basculin": "basculin-white-striped",
}
REGION = {"alolan": "alola", "galarian": "galar", "hisuian": "hisui"}
REGION_IT = {"alolan": "di Alola", "galarian": "di Galar", "hisuian": "di Hisui"}


def api_pokemon(slug):
    if slug in SPECIAL:
        return POKEMON[SPECIAL[slug]]
    if slug in POKEMON:
        return POKEMON[slug]
    pre, _, rest = slug.partition("-")
    if pre in REGION and f"{rest}-{REGION[pre]}" in POKEMON:
        return POKEMON[f"{rest}-{REGION[pre]}"]
    sp = SPECIES_BY_IDENT.get(slug)
    if sp:
        return next(p for p in POKEMON.values() if p["species_id"] == sp["id"] and p["is_default"] == "1")
    return None


# ---------------------------------------------------------------- Italian phrase translation
ORDINALS = [
    (r"\bRoute (\d+)", r"Percorso \1"),
    (r"\bRaid Den\b", "Tana Raid"),
    (r"\b(\d(?:-\d)?)[ -][Ss]tars?\b", r"\1 stelle"),
    (r"\b1 stelle\b", "1 stella"),
    (r"\bTall Grass\b|\btall grass\b", "erba alta"),
    (r"\bSuper Rod\b", "Superamo"),
    (r"\bGood Rod\b", "Amo Buono"),
    (r"\bOld Rod\b", "Amo Vecchio"),
    (r"\bRock Smash\b", "Spaccaroccia"),
    (r"\bHeadbutt\b", "Bottintesta"),
    (r"\bSurfing\b|\bSurf\b|\bsurf\b", "Surf"),
    (r"\bUnderwater\b|\bunderwater\b", "Sott'acqua"),
    (r"\bSwarm\b|\bswarm\b", "Sciame"),
    (r"\b[Cc]ave area\b", "zona grotta"),
    (r"\([Cc]ave\)", "(grotta)"),
    (r"\b[Cc]ave\b(?=\s*[/)])", "grotta"),
    (r"\bRequires Gen 8 Activation\b|\bGen 8 Activation Required\b|\brequires gen 8 activation\b", "Richiede attivazione Gen 8"),
    (r"\bpost-game only\b", "solo post-game"),
    (r"\bDay and Night\b", "giorno e notte"),
    (r"\b[Nn]ighttime only\b", "solo di notte"),
    (r"\b[Nn]ighttime\b", "notte"),
    (r"\b[Dd]aytime\b", "giorno"),
    (r"\bNight\b|\bnight\b", "notte"),
    (r"\bDay\b|\bday\b", "giorno"),
    (r"\b[Mm]orning\b", "mattina"),
    (r"\b[Ee]vening\b", "sera"),
    (r"\b[Ww]ild encounters?\b", "incontro selvatico"),
    (r"\bSpecial DexNav Encounter\b", "Incontro speciale DexNav"),
    (r"\b[Ee]ncounter during Mission\b", "Incontro durante la Missione"),
    (r"\b[Ee]ncounter\b", "incontro"),
    (r"\b[Rr]andom chance\b", "probabilità casuale"),
    (r"\b[Rr]andom\b", "casuale"),
    (r"\bDumpsters\b", "Cassonetti"),
    (r"\bInterior\b|\binterior\b", "interno"),
    (r"\bSands\b|\bsands\b", "sabbia"),
    (r"\bAll Flowers\b", "tutti i fiori"),
    (r"\bInsane\b|\binsane\b", "Folle"),
    (r"\bHard\b|\bhard\b", "Difficile"),
    (r"\bMedium\b", "Media"),
    (r"\bEasy\b|\beasy\b", "Facile"),
    (r"\bReward (?:for completing|from|for) Mission\b", "Ricompensa della Missione"),
    (r"\bMission\b", "Missione"),
    (r"\bStarter chosen when beginning the game\b", "Starter scelto all'inizio del gioco"),
    (r"\bPost-Game Mystery Gift code\b", "Codice Dono Segreto post-game"),
    (r"\bMystery Gift\b", "Dono Segreto"),
    (r"\bGame Corner\b", "Casinò"),
    (r"\bPrize for (\d+) Coins\b", r"premio per \1 gettoni"),
    (r"\bpossible egg hatch\b", "possibile schiusa uovo"),
    (r"\bEgg Lady\b", "Signora delle Uova"),
    (r"\bRevive an? (.+?) Fossil\b", r"Fai rianimare un Fossile \1"),
    # evolution phrasing
    (r"\bEvolves? (?:an? )?(.+?) at (?:Level|Lv\.?) (\d+)", r"Fai evolvere \1 al livello \2"),
    (r"\bEvolves from (.+?) at (?:Level|Lv\.?) (\d+)", r"Si evolve da \1 al livello \2"),
    (r"\bEvolve (?:an? )?(.+?) with (?:an? |either a )?", r"Fai evolvere \1 con "),
    (r"\bEvolve (?:an? )?(.+?) while it knows\b", r"Fai evolvere \1 mentre conosce"),
    (r"\bEvolve (?:an? )?(.+?) by level-up\b", r"Fai evolvere \1 salendo di livello"),
    (r"\bEvolve (?:an? )?", "Fai evolvere "),
    (r"\bBreed (?:an? )?(.+?) (?:while it holds|holding) (?:an? )?", r"Alleva \1 tenendo "),
    (r"\bBreed (?:an? )?(.+?) with (?:an? )?", r"Alleva \1 con "),
    (r"\b[Bb]reed (?:an? )?", "Alleva "),
    (r"\band hatch the egg\b", "e schiudi l'uovo"),
    (r"\bBaby form\b|\bBaby\b", "Forma baby"),
    (r"\bBase form\b", "Forma base"),
    (r"\(breeding\)", "(allevamento)"),
    (r"\bbreeding\b", "allevamento"),
    (r"\bLevel up\b|\bLevel Up\b|\bLevel-up\b|\bleveling up\b|\blevel-up\b", "Sali di livello"),
    (r"\bLevel (\d+)", r"Livello \1"),
    (r"\bLevel Day (\d+)", r"Livello \1 di giorno"),
    (r"\bLevel\b(?=\s*\()", "Livello"),
    (r"\bLevel with\b", "Sali di livello con"),
    (r"\bat (?:Level|Lv\.?) (\d+)", r"al livello \1"),
    (r"\bwith (?:its )?Atk higher than Def\b", "con Attacco > Difesa"),
    (r"\bwith (?:its )?Atk lower than Def\b", "con Attacco < Difesa"),
    (r"\bwith (?:its )?Atk = Def\b|\bwith its Atk stat equal to its Def stat\b", "con Attacco = Difesa"),
    (r"\b[Hh]igh [Ff]riendship\b|\bhigh Happiness\b|\b[Hh]igh [Hh]appiness\b", "Amicizia alta"),
    (r"\bwithi? (?=Amicizia)", "con "),
    (r"\bat (?=Amicizia)", "con "),
    (r"\bvia (?=Sali)", "tramite "),
    (r"\bknowing (?:a |the move )?", "conoscendo "),
    (r"\bwhile (?:it )?knows (?:an? |the move )?", "mentre conosce "),
    (r"\bwhile knowing (?:the move )?", "conoscendo "),
    (r"\bknows\b", "conosce"),
    (r"(\w+)-type move\b", lambda m: "una mossa di tipo " + TYPE_IT.get(m.group(1).lower(), m.group(1))),
    (r"\bwhile (?:holding|it holds|Dartrix holds|Dewott holds|Petilil holds) (?:an? )?", "tenendo "),
    (r"\bHold (.+?) & Sali di livello\b", r"Tieni \1 e sali di livello"),
    (r"\bholding (?:an? )?", "tenendo "),
    (r"\bduring (?:the )?giorno\b", "di giorno"),
    (r"\bduring (?:the )?day\b", "di giorno"),
    (r"\bduring (?:the )?notte\b|\bat notte\b|\bat Night\b|\bat night\b", "di notte"),
    (r"\bin Rain or Fog Weather\b", "con pioggia o nebbia"),
    (r"\bon a beach\b", "su una spiaggia"),
    (r"\binside\b|\bin\b(?= Thundercap)", "dentro"),
    (r"\bor\b", "o"),
    (r"\bUse (?:an? )?", "Usa "),
    (r"\(on (.+?)\)", r"(su \1)"),
    (r"\bonly on\b", "solo su"),
    (r"\bfrom the\b", "dalla"),
    (r"\bfemale only\b|\bfemale (\w+) only\b", r"solo femmina \1"),
    (r"\(Female\)", "(Femmina)"),
    (r"\(Male\)", "(Maschio)"),
    (r"\bFemale\b", "Femmina"),
    (r"\bMale\b", "Maschio"),
    (r"\bwith an? (.+?) in your party\b", r"con \1 in squadra"),
    (r"\bin your party\b", "in squadra"),
    (r"\bwith one of the Sweets items\b", "con uno dei Dolcetti"),
    (r"\bMake (.+?) land (\d+) critical hits in a single battle\b", r"Fai mettere a segno a \1 \2 brutti colpi in una lotta"),
    (r"\bbetween\b", "tra"),
    (r"\bFrom\b(?= \d)", "dalle"),
    (r"\bwhen there is at least (\d+) empty space in the party and (\d+) available Pokeball\b",
     r"con almeno \1 posto libero in squadra e \2 Poké Ball"),
    (r"\bForm to Form\b", "forma per forma"),
    (r"\bEast & West Sea forms\b", "forme Mare Est e Ovest"),
    (r"\b[Rr]eward\b", "Ricompensa"),
    (r"\b[Gg]ift\b", "Regalo"),
    (r"\b[Tt]rade\b", "Scambio"),
    (r"\bAt the summit of\b", "In cima al"),
    (r"\bInside the\b", "Dentro la"),
    (r"\bat (?=[A-Z])", "a "),
    (r"\bNot available\b|\bNot obtainable\b|\bUnobtainable\b", "Non disponibile"),
]
ORDINALS = [(re.compile(a), b) for a, b in ORDINALS]
ITEM_RE = None


def to_it(s):
    global ITEM_RE
    if not s:
        return s
    if ITEM_RE is None:
        keys = sorted(ITEM_EN_TO_IT, key=len, reverse=True)
        ITEM_RE = re.compile(r"\b(" + "|".join(re.escape(k) for k in keys) + r")\b")
    s = s.replace("’", "'")
    s = ITEM_RE.sub(lambda m: ITEM_EN_TO_IT[m.group(1)], s)
    for rx, rep in ORDINALS:
        s = rx.sub(rep, s)
    return s


# ---------------------------------------------------------------- type chart
T = ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying",
     "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"]
_C = {
    "normal": {"rock": .5, "ghost": 0, "steel": .5},
    "fire": {"fire": .5, "water": .5, "grass": 2, "ice": 2, "bug": 2, "rock": .5, "dragon": .5, "steel": 2},
    "water": {"fire": 2, "water": .5, "grass": .5, "ground": 2, "rock": 2, "dragon": .5},
    "electric": {"water": 2, "electric": .5, "grass": .5, "ground": 0, "flying": 2, "dragon": .5},
    "grass": {"fire": .5, "water": 2, "grass": .5, "poison": .5, "ground": 2, "flying": .5, "bug": .5, "rock": 2, "dragon": .5, "steel": .5},
    "ice": {"fire": .5, "water": .5, "grass": 2, "ice": .5, "ground": 2, "flying": 2, "dragon": 2, "steel": .5},
    "fighting": {"normal": 2, "ice": 2, "poison": .5, "flying": .5, "psychic": .5, "bug": .5, "rock": 2, "ghost": 0, "dark": 2, "steel": 2, "fairy": .5},
    "poison": {"grass": 2, "poison": .5, "ground": .5, "rock": .5, "ghost": .5, "steel": 0, "fairy": 2},
    "ground": {"fire": 2, "electric": 2, "grass": .5, "poison": 2, "flying": 0, "bug": .5, "rock": 2, "steel": 2},
    "flying": {"electric": .5, "grass": 2, "fighting": 2, "bug": 2, "rock": .5, "steel": .5},
    "psychic": {"fighting": 2, "poison": 2, "psychic": .5, "dark": 0, "steel": .5},
    "bug": {"fire": .5, "grass": 2, "fighting": .5, "poison": .5, "flying": .5, "psychic": 2, "ghost": .5, "dark": 2, "steel": .5, "fairy": .5},
    "rock": {"fire": 2, "ice": 2, "fighting": .5, "ground": .5, "flying": 2, "bug": 2, "steel": .5},
    "ghost": {"normal": 0, "psychic": 2, "ghost": 2, "dark": .5},
    "dragon": {"dragon": 2, "steel": .5, "fairy": 0},
    "dark": {"fighting": .5, "psychic": 2, "ghost": 2, "dark": .5, "fairy": .5},
    "steel": {"fire": .5, "water": .5, "electric": .5, "ice": 2, "rock": 2, "steel": .5, "fairy": 2},
    "fairy": {"fire": .5, "fighting": 2, "poison": .5, "dragon": 2, "dark": 2, "steel": .5},
}


def eff(atk, defend):
    return _C.get(atk, {}).get(defend, 1)


# ---------------------------------------------------------------- move recommendation
# multiplier on effective power for drawbacks (recharge, charge turn, self-KO, stat drops, recoil, lock-in...)
PENALTY = {
    "hyperbeam": .45, "gigaimpact": .45, "blastburn": .45, "frenzyplant": .45, "hydrocannon": .45, "rockwrecker": .45,
    "roaroftime": .45, "prismaticlaser": .45, "eternabeam": .45, "explosion": .1, "selfdestruct": .1, "mistyexplosion": .1,
    "memento": 0, "finalgambit": 0, "focuspunch": .4, "dreameater": .2, "solarbeam": .55, "solarblade": .55,
    "skyattack": .5, "razorwind": .4, "skullbash": .5, "meteorbeam": .6, "freezeshock": .5, "iceburn": .5,
    "futuresight": .5, "doomdesire": .5, "lastresort": .3, "belch": .3, "synchronoise": .3, "steelbeam": .7,
    "mindblown": .6, "headsmash": .85, "doubleedge": .88, "bravebird": .88, "flareblitz": .88, "woodhammer": .88,
    "volttackle": .88, "wildcharge": .9, "headcharge": .9, "submission": .8, "takedown": .8, "overheat": .8,
    "dracometeor": .8, "leafstorm": .8, "psychoboost": .8, "fleurcannon": .8, "superpower": .88, "hammerarm": .92,
    "closecombat": .95, "outrage": .85, "thrash": .8, "petaldance": .8, "ragingfury": .85, "fly": .8, "dig": .8,
    "dive": .8, "bounce": .75, "phantomforce": .85, "shadowforce": .85, "fakeout": .3, "feint": .3, "firstimpression": .45,
    "rollout": .4, "iceball": .4, "furycutter": .35, "uproar": .6, "hyperspacefury": .9, "selfdestruc": .1,
    "struggle": 0, "snore": .1, "spitup": .1, "naturalgift": 0, "fling": 0, "trumpcard": .4, "echoedvoice": .5,
    "round": .7, "beatup": .3, "present": .2, "magnitude": .7, "spitup ": 0, "lunge": 1.05, "skydrop": .5,
    "burnup": .6, "steelroller": .5, "shelltrap": .4, "beakblast": .7, "chloroblast": .75, "dynamaxcannon": .9,
}
# moves whose listed power is per hit, or variable / missing
FIXED_POWER = {
    "doublekick": 60, "bonemerang": 100, "dualchop": 80, "doublehit": 70, "geargrind": 100, "dragondarts": 100,
    "twineedle": 50, "icicle spear": 75, "iciclespear": 75, "bulletseed": 75, "rockblast": 75, "pinmissile": 75,
    "tailslap": 75, "scaleshot": 75, "armthrust": 45, "furyattack": 45, "furyswipes": 54, "cometpunch": 54,
    "doubleslap": 45, "barrage": 45, "spikecannon": 60, "bonerush": 75, "watershuriken": 45, "surgingstrikes": 75,
    "doubleironbash": 120, "dualwingbeat": 80, "triplekick": 50, "tripleaxel": 94, "tripledive": 90,
    "return": 102, "frustration": 0, "lowkick": 60, "grassknot": 60, "heavyslam": 60, "heatcrash": 60,
    "gyroball": 60, "electroball": 60, "seismictoss": 75, "nightshade": 75, "eruption": 150, "waterspout": 150,
    "reversal": 40, "flail": 40, "hiddenpower": 0, "crushgrip": 80, "wringout": 80, "punishment": 60,
    "storedpower": 40, "powertrip": 40, "acrobatics": 80, "weatherball": 60, "terrainpulse": 60,
}
BOOST = {  # status moves worth a slot: kind
    "swordsdance": "atk", "dragondance": "atk", "bulkup": "atk", "coil": "atk", "shiftgear": "atk",
    "honeclaws": "atk", "victorydance": "atk", "howl": "atk", "bellydrum": "atk", "nastyplot": "spa",
    "calmmind": "spa", "quiverdance": "spa", "tailglow": "spa", "geomancy": "spa", "workup": "both",
    "shellsmash": "both", "growth": "both", "tidyup": "atk", "takeheart": "spa",
}
RECOVER = ["recover", "roost", "slackoff", "softboiled", "milkdrink", "shoreup", "healorder", "strengthsap",
           "moonlight", "morningsun", "synthesis", "wish", "junglehealing", "lifedew"]
UTILITY = {"toxic": 1.0, "willowisp": .9, "thunderwave": .85, "spore": 1.1, "sleeppowder": .8, "stealthrock": .7,
           "leechseed": .8, "protect": .5, "substitute": .6, "glare": .85, "yawn": .6, "hypnosis": .5}


def ival(s, default=0):
    m = re.search(r"\d+", s or "")
    return int(m.group(0)) if m else default


def recommend(p, moves):
    st = p["stats"]  # hp atk def spa spd spe
    atk, spa = st[1], st[3]
    top = max(atk, spa, 1)
    types = p["types"]
    cands = []
    for mid in set(p["learn"]["all"]):
        m = moves[mid]
        k = norm(m["en"])
        if m["cat"] == "Status":
            continue
        pw = FIXED_POWER.get(k, m["pow"])
        if not pw:
            continue
        acc = (m["acc"] or 100) / 100
        stat = atk if m["cat"] == "Physical" else spa
        if k in ("foulplay", "bodypress"):
            stat = top
        stab = 1.5 if m["type"] in types and k not in ("seismictoss", "nightshade") else 1
        score = pw * acc * stab * (stat / top) ** 1.4 * PENALTY.get(k, 1)
        if score > 0:
            cands.append((score, mid, m["type"], stab > 1))
    cands.sort(reverse=True)
    chosen = []

    def coverage(sel):
        tot = 0
        for d in T:
            tot += max([s * eff(t, d) for s, _, t, _ in sel] or [0])
        return tot

    # 1) best STAB per own type
    for t in types:
        best = next((c for c in cands if c[2] == t and c[3]), None)
        if best and best not in chosen:
            chosen.append(best)
    # 2) greedy coverage
    while len(chosen) < 4 and len(chosen) < len(cands):
        base = coverage(chosen)
        gain, pick = max(((coverage(chosen + [c]) - base, c) for c in cands if c not in chosen and c[2] not in [x[2] for x in chosen]), default=(0, None))
        if pick is None or gain <= 0:
            pick = next((c for c in cands if c not in chosen), None)
            if pick is None:
                break
        chosen.append(pick)
    result = [{"m": c[1], "why": "stab" if c[3] else "cov"} for c in chosen]

    # 3) status move swap for the weakest attack
    pool = {norm(moves[mid]["en"]): mid for mid in p["learn"]["all"] if moves[mid]["cat"] == "Status"}
    phys = atk >= spa
    status = None
    for k, kind in BOOST.items():
        if k in pool and (kind == "both" or (kind == "atk") == phys):
            if k in ("bellydrum", "howl", "honeclaws", "workup", "growth") and any(
                    x in pool for x in ("swordsdance", "dragondance", "nastyplot", "calmmind", "quiverdance", "shellsmash")):
                continue
            status = (pool[k], "boost")
            break
    bulky = st[0] + st[2] + st[4] > (atk + spa + st[5]) * 1.15
    if bulky:
        rec = next((pool[k] for k in RECOVER if k in pool), None)
        if rec:
            status = (rec, "heal")
        elif not status or top < 80:
            u = max(((v, pool[k]) for k, v in UTILITY.items() if k in pool), default=None)
            if u:
                status = (u[1], "util")
    if top < 70 and not status:
        u = max(((v, pool[k]) for k, v in UTILITY.items() if k in pool), default=None)
        if u:
            status = (u[1], "util")
    if status:
        if len(result) >= 4:
            result[-1] = {"m": status[0], "why": status[1]}
        else:
            result.append({"m": status[0], "why": status[1]})
    return result


# ---------------------------------------------------------------- build
def main():
    raw = json.load(open(os.path.join(HERE, ".cache", "wiki_raw.json"), encoding="utf-8"))
    by_name = {r["name"]: r["slug"] for r in raw}

    moves, move_key = {}, {}
    unmatched = set()

    def move_id(m):
        nm = m["name"]
        k = norm(nm)
        if k in move_key:
            return move_key[k]
        api = MOVE_BY_NORM.get(k)
        alt = re.search(r"\((.+?)\)", nm)
        if not api and alt:
            api = MOVE_BY_NORM.get(norm(alt.group(1))) or MOVE_BY_NORM.get(norm(nm.split("(")[0]))
        if not api:
            unmatched.add(nm)
        mid = MOVES_API[api]["identifier"] if api else k
        cat = m["cat"].capitalize()
        entry = {
            "en": MOVE_EN.get(api, nm) if api else nm,
            "it": MOVE_IT.get(api) or (MOVE_EN.get(api) if api else nm),
            "type": m["type"].lower(),
            "cat": cat if cat in ("Physical", "Special", "Status") else "Status",
            "pow": ival(m["pow"]),
            "acc": ival(m["acc"]),
            "pp": ival(m["pp"]),
        }
        if api and api in MOVE_FLAVOR:
            f = MOVE_FLAVOR[api]
            entry["den"], entry["dit"] = f.get(EN, ""), f.get(IT, f.get(EN, ""))
        if api and MOVES_API[api]["priority"] not in ("0", ""):
            entry["pri"] = int(MOVES_API[api]["priority"])
        moves.setdefault(mid, entry)
        move_key[k] = mid
        return mid

    sprite_ids, out, missing = {}, [], []
    for r in raw:
        api = api_pokemon(r["slug"])
        if not api:
            missing.append(r["slug"])
        sp = SPECIES.get(api["species_id"]) if api else None
        st = STATS.get(api["id"], {}) if api else {}
        stats = [st.get(i, 0) for i in range(1, 7)]
        name_it = SPECIES_IT.get(sp["id"], r["name"]) if sp else r["name"]
        pre = r["slug"].split("-")[0]
        if pre in REGION_IT:
            name_it = f"{name_it} {REGION_IT[pre]}"
        elif sp and norm(r["name"]) != norm(sp["identifier"]):
            # forms like "Hoopa Unbound", "Eternal Floette": species names are identical in Italian anyway
            name_it = r["name"]
        lv = [[ival(m["lv"]), move_id(m)] for m in r["lv"]]
        tm = [move_id(m) for m in r["tm"]]
        tu = [move_id(m) for m in r["tutor"]]
        eg = [move_id(m) for m in r["eggm"]]
        abil = []
        for a, desc in r.get("abil", []):
            hidden = "Hidden Ability" in desc
            desc = desc.replace(" (Hidden Ability)", "")
            aid = ABIL_BY_NORM.get(norm(a))
            it_name = ABIL_IT.get(aid, a) if aid else a
            it_desc = ABIL_FLAVOR.get(aid, {}).get(IT, desc) if aid else desc
            abil.append({"en": a, "it": it_name, "den": desc, "dit": it_desc, "h": 1 if hidden else 0})
        evo = []
        for e in r["evo"]:
            slug = e["slug"] or by_name.get(e["name"]) or norm(e["name"])
            item = {"s": slug, "n": e["name"], "how": e["how"], "howIt": to_it(e["how"])}
            if e.get("from"):
                item["f"] = by_name.get(e["from"], norm(e["from"]))
            evo.append(item)
        loc = r.get("loc") or []
        p = {
            "id": r["slug"],
            # the wiki has a few wrong numbers (e.g. Garchomp #498): trust PokeAPI's national dex
            "dex": int(api["species_id"]) if api else r.get("dex", 0),
            "en": r["name"],
            "it": name_it,
            "types": r.get("types", []),
            "stats": stats,
            "abil": abil,
            "egg": r.get("egg", ""),
            "eggIt": ", ".join(EGG_IT.get(x.strip(), x.strip()) for x in r.get("egg", "").split(",") if x.strip()),
            "held": r.get("held", ""),
            "heldIt": to_it(r.get("held", "")).replace("None", "Nessuno"),
            "loc": loc,
            "locIt": [to_it(l) for l in loc],
            "evo": evo,
            "learn": {"lv": lv, "tm": tm, "tu": tu, "egg": eg},
        }
        if api:
            sprite_ids[r["slug"]] = int(api["id"])
            p["spr"] = int(api["id"])
        p["learn"]["all"] = sorted({m for _, m in lv} | set(tm) | set(tu) | set(eg))
        p["best"] = recommend(p, moves)
        del p["learn"]["all"]
        out.append(p)

    out.sort(key=lambda p: (p["dex"], p["id"] != SPECIES.get(str(p["dex"]), {}).get("identifier"), p["id"]))
    os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
    json.dump(out, open(os.path.join(ROOT, "data", "dex.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(moves, open(os.path.join(ROOT, "data", "moves.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    json.dump({"type_it": TYPE_IT}, open(os.path.join(ROOT, "data", "meta.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(sprite_ids, open(os.path.join(HERE, ".cache", "sprite_ids.json"), "w"))
    print(len(out), "pokemon,", len(moves), "moves")
    print("no PokeAPI match:", missing)
    print("moves not in PokeAPI:", sorted(unmatched))


if __name__ == "__main__":
    main()
