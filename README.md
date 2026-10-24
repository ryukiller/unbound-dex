# Unbound Dex

Pokédex PWA per **Pokémon Unbound**, pensata per il telefono.

- Tutti i 968 Pokémon/forme di Unbound con sprite
- Ricerca sempre visibile (nome EN/IT, numero, tipo, luogo, abilità) + filtri per tipo, generazione, modo di ottenerlo, mossa
- Per ogni Pokémon: dove trovarlo in Unbound, come/quando si evolve, 4 mosse consigliate, statistiche, debolezze, abilità, learnset completo
- Nomi di Pokémon, mosse, tipi, abilità e luoghi in inglese con traduzione italiana in un tocco (EN/IT)
- Squadra di 6 con accesso rapido dalla barra in alto e analisi di debolezze e copertura
- Segna i Pokémon catturati e filtra catturati / non catturati
- **Sfida**: scegli un avversario (Pokémon o tipi) e vedi chi usare dalla tua squadra, dai catturati e in generale
- **Luoghi**: ogni zona di Unbound con i Pokémon che ci trovi, evidenziando quelli che ti mancano
- **Palestre e Lega**: squadre dei capipalestra per difficoltà, livello massimo, tipi consigliati e chi portare
- **Backup** di squadra e catturati via link o file, per passarli su un altro telefono
- Installabile come app (Aggiungi a schermata Home) e funziona offline

## Aggiornare i dati

```bash
scripts/fetch.sh
python3 scripts/parse_wiki.py
python3 scripts/build_data.py
python3 scripts/build_extra.py   # luoghi + palestre
```

Dopo aver cambiato file dell'app o dati, incrementa `VERSION` in `sw.js`.

## Fonti

Dati Unbound da [unboundwiki.com](https://unboundwiki.com), dati base/traduzioni e sprite da [PokeAPI](https://pokeapi.co).
Pokémon © Nintendo / Creatures / Game Freak. Progetto fan non ufficiale.
