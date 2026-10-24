# Unbound Dex

Pokédex PWA per **Pokémon Unbound**, pensata per il telefono.

- Tutti i 968 Pokémon/forme di Unbound con sprite
- Ricerca sempre visibile (nome EN/IT, numero, tipo, luogo, abilità) + filtri per tipo, generazione, modo di ottenerlo, mossa
- Per ogni Pokémon: dove trovarlo in Unbound, come/quando si evolve, 4 mosse consigliate, statistiche, debolezze, abilità, learnset completo
- Nomi di Pokémon, mosse, tipi, abilità e luoghi in inglese con traduzione italiana in un tocco (EN/IT)
- Squadra di 6 con accesso rapido dalla barra in alto e analisi di debolezze e copertura
- Segna i Pokémon catturati e filtra catturati / non catturati
- Installabile come app (Aggiungi a schermata Home) e funziona offline

## Aggiornare i dati

```bash
scripts/fetch.sh
python3 scripts/parse_wiki.py
python3 scripts/build_data.py
```

Dopo aver cambiato file dell'app o dati, incrementa `VERSION` in `sw.js`.

## Fonti

Dati Unbound da [unboundwiki.com](https://unboundwiki.com), dati base/traduzioni e sprite da [PokeAPI](https://pokeapi.co).
Pokémon © Nintendo / Creatures / Game Freak. Progetto fan non ufficiale.
