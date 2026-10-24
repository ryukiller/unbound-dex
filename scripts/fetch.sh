#!/bin/sh
# Download the raw sources into scripts/.cache (needs a list of wiki URLs in scripts/.cache/wiki_urls.txt,
# built from https://unboundwiki.com/wiki-sitemap{1..8}.xml).
set -e
cd "$(dirname "$0")/.cache"
mkdir -p wiki csv
for i in 1 2 3 4 5 6 7 8; do curl -sL "https://unboundwiki.com/wiki-sitemap$i.xml" | grep -oE '<loc>[^<]*' | sed 's/<loc>//'; done \
  | grep '/pokemon/.\+/' | sort -u > wiki_urls.txt
xargs -P 8 -I{} sh -c 'f=wiki/$(echo {} | sed -E "s#.*/pokemon/([^/]+)/#\1#").html; [ -s "$f" ] || curl -sL --retry 3 "{}" -o "$f"' < wiki_urls.txt
for f in pokemon pokemon_species pokemon_species_names pokemon_stats moves move_names move_flavor_text abilities \
  ability_names ability_flavor_text types type_names items item_names; do
  curl -sL "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/$f.csv" -o "csv/$f.csv"
done
mkdir -p gyms
for u in gyms/dresco-town-gym gyms/crater-town-gym gyms/blizzard-city-gym gyms/fallshore-city-gym gyms/dehara-city-gym \
  gyms/antisis-city-gym gyms/polder-town-gym gyms/redwood-village-gym elite-four; do
  curl -sL "https://unboundwiki.com/$u/" -o "gyms/$(echo $u | tr / _).html"
done
