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

## Acceptance criteria
- T001: geldige svsit.nl en www URL met slash/query/hash geven de uuid; andere hosts, andere paden, niet-uuid geven null. 200 geeft event, 404 geeft not_found, netwerkfout/timeout/5xx/kapotte JSON geven unavailable. Timeout via AbortSignal.
- T002: alle rijen uit de embed-mapping in design.md, cancelled-prefix, ended-footer, afkappen op 1000/1024/256, kleur per categorie met fallback.
- T003: `npm run check` groen, `/event` in de commandlijst, prefix `%event`, fouten ephemeral, deferReply voor de fetch.
- T004: juiste URL-parameters, segmenten samengevoegd, detected taal terug, 4xx/5xx/netwerk/timeout/kapotte body geven `{ ok: false }`, cache hit doet geen tweede fetch, cache max 200.
- T005: zonder language ongewijzigd gedrag (bestaande tests blijven groen); met language vertaalde description en footer; faalt de vertaling dan originele tekst en fallback-footer; prefix `nl`/`en` als tweede argument; onbekende taal in prefix wordt genegeerd.
- T006: check groen, alle tests groen, deploy 4 commands, live integratie met een Nederlands event naar `en`.

- T007: zonder announce ongewijzigd gedrag (bestaande tests groen, geen content, geen allowedMentions op het slash-pad). Met announce en beide permissies: `content` is `@everyone`, `allowedMentions.parse` bevat `everyone`, embed ongewijzigd. Aanroeper zonder Mention Everyone: ephemeral weigering zonder defer, geen fetch. Buiten een guild: ephemeral weigering. Bot zonder Mention Everyone: ephemeral melding. Prefix `announce` argument (elke positie, hoofdletterongevoelig) doet hetzelfde met een gewone reply als weigering. Registratie: optie `announce` boolean, optional.
- T008: check groen, alle tests groen, deploy 4 commands met announce-optie, README en claude.md beschrijven de permissie-eis.

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
