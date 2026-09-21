# Tasks: /event command

| ID | Taak | Boundary | Depends | Tijd |
|---|---|---|---|---|
| T001 DONE | `parseEventUrl`, `eventPageUrl`, `fetchEvent` met tests | lib/svsit-events.js, test/ | - | 25 min |
| T002 DONE | `buildEventEmbed` met tests (M3, M4, M7, limieten) | lib/svsit-events.js, test/ | T001 | 30 min |
| T003 DONE | `scripts/event.js` slash plus prefix, `npm test` script, docs (README, .claude/claude.md) | scripts/event.js, package.json, README.md, .claude/claude.md | T002 | 25 min |

## Acceptance criteria
- T001: geldige svsit.nl en www URL met slash/query/hash geven de uuid; andere hosts, andere paden, niet-uuid geven null. 200 geeft event, 404 geeft not_found, netwerkfout/timeout/5xx/kapotte JSON geven unavailable. Timeout via AbortSignal.
- T002: alle rijen uit de embed-mapping in design.md, cancelled-prefix, ended-footer, afkappen op 1000/1024/256, kleur per categorie met fallback.
- T003: `npm run check` groen, `/event` in de commandlijst, prefix `%event`, fouten ephemeral, deferReply voor de fetch.

## Implementation Notes
- T001: `AbortSignal.timeout()` gebruikt een unref'd timer, in de test eindigde de event loop voor de abort. Eigen AbortController plus setTimeout met clearTimeout in finally.
- T001/T002: embed-builder is samen met parse/fetch geschreven, de T002-tests kwamen daarna (geen aparte RED voor T002). Alle 18 tests groen.
- T002: het live veld `poster_url` staat nog niet in de lokale svsit-site checkout (~/work/svsit-site loopt achter op productie), wel in de live API. Embed gebruikt het als image.
- T003: ongeldige URL wordt voor `deferReply` afgewezen (ephemeral). Na een publieke defer kan de reply niet meer ephemeral worden, dus bij fetch-fout: deleteReply plus ephemeral followUp.
- Integratie-run 2026-09-21 tegen live svsit.nl: upcoming event (poster, tickets, signups), afgelopen event (footer), 404 en 1 ms timeout allemaal correct.
