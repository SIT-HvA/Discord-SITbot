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

## Increment 4: /events weekoverzicht (M10, S3, T009-T011)

Datum: 2026-09-24. Machine: server-14 (debian), Node v20.19.2. Uitvoerder: Claude, vers gedraaid na de laatste code-commit (ffb8abb).

| # | Check | Resultaat |
|---|---|---|
| 1 | Lint + anti-slop | N/A: geen linter. Handmatig: geen emoji in bot-teksten, geen nieuwe deps (package.json ongewijzigd). |
| 2 | Types | N/A: plain JS. `npm run check`: 21 files geparsed, groen. |
| 3 | Unit tests | `npm test`: 93 tests, 93 pass, 0 fail (9 testfiles). RED-bewijs: T009 17 fails (modules ontbraken), T010 1 fail (scripts/events ontbrak). Nieuw: test/week.test.js, test/svsit-events-public.test.js, test/events-command.test.js. |
| 4 | E2E | Live run 24 sep tegen svsit.nl via scripts/events.js met fake interaction (fetch via sandbox-proxy): `this week` gaf deferReply, editReply, content `Events this week: 21 Sep to 27 Sep`, 1 embed (De Digitale Schijf van Vijf, kleur career, poster, link, footer `This event has ended`); `next week` gaf `Events next week: 28 Sep to 4 Oct` met 2 embeds (Lets SIT #1 zaalvoetbal social, NEMO AI Hackathon career) elk met poster en link; prefix `%events NEXT` zelfde payload met repliedUser false. Totaal 2,9 s voor 3 runs. Echte Discord-klik nog door Thijmen na deploy. |
| 5 | Build | `npm run check`: 5 commands valid (/clear-lid, /event, /events, /ping, /restore-lid), prefixes %event, %events, %ping. |
| 6 | Lighthouse / SEO | N/A. |
| 7 | Security | Geen user-input bereikt de fetch: vaste URL `/api/events/public`, `week` alleen via Discord choices of het vaste woord `next`. Lijst-items gevalideerd (string id, parseerbare date), fouttekst vast, echte fout alleen in console. Reviewer T010 probeerde routing-collision %event/%events, dubbele reply en choice-bypass: fail-closed of onbereikbaar. |
| 8 | Accessibility | N/A. |
| 9 | Bundle size | N/A. |
| 10 | Mobile | N/A. |
| 11 | Error scenarios | Getest: 500 (route geeft `[]` met 500), netwerkfout, timeout, niet-array, item zonder id, zonder date, niet-parseerbare date, kapotte JSON: allemaal unavailable en ephemeral. Lege week (this en next), 12 events (10 embeds plus noot), 8 worst-case cards (stopt onder 6000 tekens plus noot), event zonder poster, zonder locatie (TBA), zonder dateEnd (When zonder eindtijd, ended na 4 uur). |
| 12 | i18n | N/A: bot eentalig Engels. |

### Review increment 4
- T009 ronde 1 CHANGES_REQUESTED (alleen testdekking: geen test zonder dateEnd), 2 tests toegevoegd, ronde 2 APPROVED. Reviewer herrekende de weekgrenzen rond DST 25 okt 2026 en de UTC-middernacht-rollover met Intl: correct.
- T010 ronde 1 APPROVED met 2 non-blocking bevindingen in de lib (RangeError bij ongeldige date, 6000-tekenlimiet), direct gefixt in ffb8abb en a91f984 met tests, hercheck gevraagd.

## Increment 5: compact view (M11, T012-T017)

Datum: 2026-09-24. Machine: server-14 (debian), Node v20.19.2. Uitvoerder: Claude, vers gedraaid na 9877c5d.

| # | Check | Resultaat |
|---|---|---|
| 1 | Lint + anti-slop | N/A: geen linter. Handmatig: geen emoji, geen nieuwe deps. |
| 2 | Types | N/A. `npm run check`: 21 files, groen. |
| 3 | Unit tests | `npm test`: 112 tests, 112 pass, 0 fail. RED-bewijs builders: T012 13 fails, T014 15 fails, T016 7 fails voor implementatie. |
| 4 | E2E | Live run 24 sep tegen svsit.nl na T014: `view:compact` gaf content `Events this week: 21 Sep to 27 Sep` plus 1 kleine embed (De Digitale Schijf van Vijf, kleur career, thumbnail ja, image nee, 0 fields, geen footer, description `<t:..:f>  REC Impact (Roeterseiland) (ended)`, 108 tekens); `week:next` gaf 2 embeds (Lets SIT zaalvoetbal social, NEMO AI Hackathon career) elk met thumbnail; prefix `%events compact NEXT` zelfde payload. Discord-klik door Thijmen na deploy. |
| 5 | Build | `npm run check`: 22 files, 5 commands valid, prefixes %event, %events, %ping. |
| 6 | Lighthouse / SEO | N/A. |
| 7 | Security | Reviewers vonden 2x link-injectie via het locatieveld (T012 in de lijst-regel, T014 opnieuw na het verwijderen van de helper). `plainText` staat nu op de locatie in alle drie de embeds, test bewijst 1 regel en geen `](`. Mentions in embeds pingen niet. URL altijd vast `https://svsit.nl/events/<uuid>`. |
| 8 | Accessibility | N/A. |
| 9 | Bundle size | N/A. |
| 10 | Mobile | N/A. |
| 11 | Error scenarios | Lege week compact (this en next) zelfde melding als full, fetch-fout zelfde ephemeral pad (gedeelde eventsReply), 12 compact events geeft 10 plus noot, geen poster geeft geen thumbnail, locatie ontbreekt (TBA), afkappen locatie 100 en titel 256, voorbij ((ended)) met en zonder dateEnd, locatie met haken en newlines. |
| 12 | i18n | N/A. |

### Review increment 5
- T012 ronde 1 CHANGES_REQUESTED (link-injectie via location), gefixt, ronde 2 APPROVED (4bf203d).
- T014 (compact herzien naar kleine embeds met thumbnail) ronde 1 CHANGES_REQUESTED (zelfde klasse: sanitization met de lijst-embed verwijderd), gefixt in 32bc977 met plainText op alle embeds plus test; ronde 2 APPROVED.
- T016 (gelijke grootte: spacer-attachment plus 2-regel layout) APPROVED in 1 ronde; PNG gevalideerd door de reviewer; live payload: compact 1 file spacer.png 78 B, image attachment://spacer.png per kaart, full zonder files.
