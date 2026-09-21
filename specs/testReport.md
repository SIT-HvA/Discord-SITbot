# Test Report: /event command

Datum: 2026-09-21. Machine: server-14 (debian), Node v20.19.2. Uitvoerder: Claude, vers gedraaid.

| # | Check | Resultaat |
|---|---|---|
| 1 | Lint + anti-slop | N/A: repo heeft geen linter. Handmatig: geen emoji in bot-teksten, geen nieuwe deps. |
| 2 | Types | N/A: plain JS. `npm run check` parseert alle 14 files met `node --check`: groen. |
| 3 | Unit tests | `npm test`: 50 tests, 50 pass, 0 fail (6 testfiles, node:test). Increment 1 was 26/26, increment 2 41/41, increment 3 (announce) 50/50 met RED 9 fails vooraf. |
| 4 | E2E | Integratie-run tegen live svsit.nl via lib/svsit-events.js: upcoming event met poster en tickets, afgelopen event met footer, 404, 1 ms timeout. Alle 4 correct. Increment 2: Nederlands event naar `en` in ~1 s, zonder taal origineel, `nl` op Nederlands origineel zonder noot, cache-hit zonder tweede Google-call. Slash-interactie zelf alleen met fake interaction getest, echte Discord-klik doet Thijmen na deploy. Increment 3: geregistreerde /event uit Discord teruggelezen, optie `announce` type 5 (boolean) optional aanwezig. |
| 5 | Build | `npm run check`: 16 files, 4 commands valid (/clear-lid, /event, /ping, /restore-lid), prefixes %event en %ping. |
| 6 | Lighthouse / SEO | N/A: geen webpagina. |
| 7 | Security | Alleen de gevalideerde uuid uit de URL bereikt de fetch; host exact op svsit.nl of www.svsit.nl; foutteksten vast, echte fout alleen in console. Reviewer probeerde host-confusion en userinfo-bypasses: geen doorbraak. Increment 2: alleen de description van svsit.nl gaat naar Google, nooit de geplakte link; URLSearchParams encodeert; elke vertaalfout is soft. Increment 3: @everyone alleen met Discord-permissie Mention Everyone op aanroeper en bot, gecheckt voor deferReply; reviewer probeerde DM, thread zonder gecached parent, bot-member null en volgorde-aanval: fail-closed, geen bypass. allowedMentions parse everyone alleen bij announce. |
| 8 | Accessibility | N/A: Discord rendert de embed. |
| 9 | Bundle size | N/A. |
| 10 | Mobile | N/A. |
| 11 | Error scenarios | Getest: ongeldige link, 404, niet-uuid (404), 5xx, netwerkfout, kapotte JSON, lege data, timeout. Vertaling: 429, 500, netwerkfout, kapotte body, leeg antwoord, timeout, lege tekst, onbekende taal, allemaal originele tekst met footer-noot. Announce: aanroeper zonder permissie, buiten guild, bot zonder permissie, prefix zonder permissie en in DM, allemaal weigering zonder fetch. |
| 12 | i18n | N/A: bot is eentalig Engels, consistent met bestaande commands. |

## Review
Ronde 1: CHANGES_REQUESTED (geen bugs, ontbrekende tests voor M1, M5, M6, S1). Ronde 2: APPROVED, geen issues, productiecode ongewijzigd.
Increment 2 (vertaling): APPROVED in 1 ronde. Info: cache zonder TTL kan een bewerkte omschrijving tot 200 events lang oud tonen, bewust zo ontworpen.
Increment 3 (announce): ronde 1 CHANGES_REQUESTED, alleen boundary (docs voor T008 stonden al in de working tree), geen functionele issues. Fix: T007 gecommit met alleen scripts/event.js en de test, docs in T008. Reviewer had geen shell; tests en check zelf vers gedraaid: 50/50 en groen.
