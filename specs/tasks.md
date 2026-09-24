# Tasks: /event command

| ID | Taak | Boundary | Depends | Tijd |
|---|---|---|---|---|
| T001 DONE | `parseEventUrl`, `eventPageUrl`, `fetchEvent` met tests | lib/svsit-events.js, test/ | - | 25 min |
| T002 DONE | `buildEventEmbed` met tests (M3, M4, M7, limieten) | lib/svsit-events.js, test/ | T001 | 30 min |
| T003 DONE | `scripts/event.js` slash plus prefix, `npm test` script, docs (README, .claude/claude.md) | scripts/event.js, package.json, README.md, .claude/claude.md | T002 | 25 min |
| T004 DONE | `lib/translate.js`: Google gtx client, parsing, timeout, cache, met tests | lib/translate.js, test/ | - | 30 min |
| T005 DONE | embed `description`/`footerNote` opties, `language` optie in slash en prefix, met tests | lib/svsit-events.js, scripts/event.js, test/ | T004 | 30 min |
| T006 DONE | docs (README, .claude/claude.md), check, deploy, live integratie, testReport | README.md, .claude/claude.md, specs/ | T005 | 20 min |
| T007 DONE | `announce` optie in slash en prefix: permissiechecks, `@everyone` content, allowedMentions, met tests | scripts/event.js, test/event-command.test.js | T005 | 30 min |
| T008 DONE | docs (README, .claude/claude.md), check, deploy, testReport, gates | README.md, .claude/claude.md, specs/ | T007 | 15 min |
| T009 DONE | `lib/week.js` (localDate, weekDates, weekLabel) plus `fetchPublicEvents` en `buildEventCardEmbed` in lib/svsit-events.js, met tests | lib/week.js, lib/svsit-events.js, test/week.test.js, test/svsit-events-public.test.js | - | 30 min |
| T010 DONE | `scripts/events.js` slash `/events [week]` plus prefix `%events [next]`, met tests | scripts/events.js, test/events-command.test.js | T009 | 30 min |
| T011 DONE | docs (README, .claude/claude.md), check, deploy, testReport, deployLog, gates | README.md, .claude/claude.md, specs/ | T010 | 15 min |

## Acceptance criteria
- T001: geldige svsit.nl en www URL met slash/query/hash geven de uuid; andere hosts, andere paden, niet-uuid geven null. 200 geeft event, 404 geeft not_found, netwerkfout/timeout/5xx/kapotte JSON geven unavailable. Timeout via AbortSignal.
- T002: alle rijen uit de embed-mapping in design.md, cancelled-prefix, ended-footer, afkappen op 1000/1024/256, kleur per categorie met fallback.
- T003: `npm run check` groen, `/event` in de commandlijst, prefix `%event`, fouten ephemeral, deferReply voor de fetch.
- T004: juiste URL-parameters, segmenten samengevoegd, detected taal terug, 4xx/5xx/netwerk/timeout/kapotte body geven `{ ok: false }`, cache hit doet geen tweede fetch, cache max 200.
- T005: zonder language ongewijzigd gedrag (bestaande tests blijven groen); met language vertaalde description en footer; faalt de vertaling dan originele tekst en fallback-footer; prefix `nl`/`en` als tweede argument; onbekende taal in prefix wordt genegeerd.
- T006: check groen, alle tests groen, deploy 4 commands, live integratie met een Nederlands event naar `en`.

- T007: zonder announce ongewijzigd gedrag (bestaande tests groen, geen content, geen allowedMentions op het slash-pad). Met announce en beide permissies: `content` is `@everyone`, `allowedMentions.parse` bevat `everyone`, embed ongewijzigd. Aanroeper zonder Mention Everyone: ephemeral weigering zonder defer, geen fetch. Buiten een guild: ephemeral weigering. Bot zonder Mention Everyone: ephemeral melding. Prefix `announce` argument (elke positie, hoofdletterongevoelig) doet hetzelfde met een gewone reply als weigering. Registratie: optie `announce` boolean, optional.
- T008: check groen, alle tests groen, deploy 4 commands met announce-optie, README en claude.md beschrijven de permissie-eis.

- T009: `weekDates` geeft 7 opeenvolgende `YYYY-MM-DD` strings van maandag tot zondag voor een `now` op maandag, woensdag en zondag (Amsterdam), ook rond middernacht UTC waar de Amsterdam-datum al een dag verder is, en rond de DST-wissel (eind oktober); `weeks: 1` geeft de week erna. `localDate` van `2026-09-30T22:30:00Z` is `2026-10-01`. `weekLabel` geeft `22 Sep to 28 Sep`. `fetchPublicEvents`: array geeft ok met events; 500, netwerkfout, timeout, niet-array en items zonder id of date geven unavailable. `buildEventCardEmbed`: alle rijen uit de card-mapping, poster als image, geen image zonder poster, `TBA` zonder locatie, ended-footer, afkappen op 300/256, kleur per categorie met fallback. Bestaande tests blijven groen.
- T010: `npm run check` groen met `/events` erbij; `execute`: deferReply, dan editReply met content `Events this week: ...` en 1 embed per event van deze week, gesorteerd op date, events buiten de week weg; leeg geeft `No events this week.`; 12 events geeft 10 embeds plus noot; fetch-fout geeft deleteReply plus ephemeral followUp; `week: next` gebruikt de volgende week en zegt `next week`. Prefix `%events` en `%events next` zelfde payload als gewone reply met `repliedUser: false`. Registratie: optie `week` optional met choices this en next, geen andere opties.
- T011: check groen, alle tests groen, deploy 5 commands met `/events` en de week-optie teruggelezen, README en claude.md beschrijven `/events`, testReport en deployLog bijgewerkt, gates increment 4.

## Implementation Notes
- T001: `AbortSignal.timeout()` gebruikt een unref'd timer, in de test eindigde de event loop voor de abort. Eigen AbortController plus setTimeout met clearTimeout in finally.
- T001/T002: embed-builder is samen met parse/fetch geschreven, de T002-tests kwamen daarna (geen aparte RED voor T002). Alle 18 tests groen.
- T002: het live veld `poster_url` staat nog niet in de lokale svsit-site checkout (~/work/svsit-site loopt achter op productie), wel in de live API. Embed gebruikt het als image.
- T003: ongeldige URL wordt voor `deferReply` afgewezen (ephemeral). Na een publieke defer kan de reply niet meer ephemeral worden, dus bij fetch-fout: deleteReply plus ephemeral followUp.
- T004: gtx-antwoord is `[[[vertaald, origineel, ...], ...], null, brontaal]`; eigen AbortController zoals in fetchEvent. Alleen geslaagde vertalingen in de cache, anders blijft een tijdelijke storing 200 entries lang hangen.
- T005: de cache is module-globaal, dus command-tests die vertalen hebben elk een eigen event-id nodig (2x tegen aangelopen). Gedetecteerde taal gelijk aan gekozen taal: originele tekst zonder noot (fix bf73c66), anders claimt de footer een vertaling die er niet is.
- T007: permissiecheck voor `deferReply`, zelfde reden als de URL-check (weigering moet de eerste reply zijn om ephemeral te blijven). `interaction.memberPermissions` is null buiten een guild, dat is de DM-check. Prefix: `permissionsIn(channel)` op de member en `permissionsFor(members.me)` op het kanaal, null vallen allebei fail-closed. Reviewer: docs niet aanraken voor de review van de huidige taak rond is (boundary).
- T008: deploy vanuit de sandbox faalt op DNS (EAI_AGAIN discord.com), buiten de sandbox in 1 keer goed.
- T006 live 2026-09-21: "SIT x MODUS x Athena D&D" nl naar en in ~1 s, zonder taal origineel, nl op nl origineel zonder noot, cache-hit zonder tweede Google-call.
- Integratie-run 2026-09-21 tegen live svsit.nl: upcoming event (poster, tickets, signups), afgelopen event (footer), 404 en 1 ms timeout allemaal correct.
- T009 (a30ad98): weekDates rekent op datumstrings in een UTC-frame (Date.UTC plus 7 x 86400000 ms), dus geen DST-rekenwerk; reviewer herrekende de weekdagen rond 25 okt 2026 en de UTC-middernacht-rollover, allemaal correct. fetchPublicEvents checkt de status voor de body: de route geeft `[]` met 500 bij een DB-fout. Reviewer ronde 1 CHANGES_REQUESTED: geen test zonder dateEnd (When zonder eindtijd en de 4-uur-default), 2 tests toegevoegd, 82/82. Bekend en bewust gelaten: buildEventCardEmbed crasht op een item zonder `name` (lijst-API geeft name altijd, de generieke error-handler in index.js vangt het).
- T010 (a91f984): reviewer APPROVED in 1 ronde, met 2 non-blocking bevindingen in de lib die direct gefixt zijn: (1) een lijst-item met een niet-parseerbare date liet localDate een RangeError gooien, fetchPublicEvents eist nu Date.parse (fix ffb8abb); (2) Discord telt naast 10 embeds ook 6000 tekens over alle embeds samen, worst case 10 cards is ~16.000, dus `fitEmbeds` in scripts/events.js houdt alleen de embeds die binnen beide limieten passen en de noot meldt het aantal. Info gelaten: test-anker `weekDates(new Date())` op module-load kan rond zondagnacht 1x per week flaky zijn (subseconde-venster). Live run 24 sep: this week 1 embed (ended), next week 2 embeds met poster en link, 2.9 s.
- T011: deploy vanuit de sandbox faalt op DNS (EAI_AGAIN discord.com) en de retry buiten de sandbox is deze sessie door de auto-mode classifier geweigerd. Registreren doet Thijmen zelf met `npm run deploy` (met `!` prefix in de sessie of in een terminal). Gate 6 blijft PENDING tot dat gedaan is.
