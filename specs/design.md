# Design: /event command

## Structuur
- `lib/svsit-events.js`: pure logica, geen Discord-client.
  - `parseEventUrl(input) -> uuid | null`
  - `fetchEvent(uuid, { fetch, baseUrl, timeoutMs }) -> { ok: true, event } | { ok: false, reason: 'not_found' | 'unavailable' }`
  - `buildEventEmbed(event, { now }) -> EmbedBuilder`
  - `eventPageUrl(uuid) -> string`
- `scripts/event.js`: slash command `/event url` plus prefix `event`. Deferren, fetchen, embed of ephemeral fout.
- `test/svsit-events.test.js`: `node:test`, fetch geinjecteerd (geen netwerk in unit tests).

## Data (uit GET /api/events/<uuid>, live gecheckt 2026-09-21)
```
data: { id, title, description, date, end_date, location, category, tags, status,
        is_paid, price_members, price_nonmembers, capacity, external_ticket_url,
        recap_description, recap_photos, recap_published, signup_required,
        form_fields, poster_url, ticketCount }
```
Prijzen in centen. 404 geeft `{ data: null, error: 'Event niet gevonden' }`, ook bij een niet-uuid.

## Embed mapping
| Embed | Bron |
|---|---|
| title | `[Cancelled] ` + title als status cancelled, anders title |
| url | `https://svsit.nl/events/<id>` |
| description | description, afgekapt op 1000 tekens |
| color | categoriekleur, default social |
| field When | `<t:start:F>` plus ` to <t:end:t>` als end_date, plus ` (<t:start:R>)` |
| field Where | location of `TBA` |
| field Category | category met hoofdletter |
| field Price | `Free` als niet is_paid, anders `Members EUR x / non-members EUR y` |
| field Signups | `n` of `n / capacity`, alleen als signup_required |
| field Tickets | external_ticket_url, alleen als aanwezig |
| image | poster_url als aanwezig |
| footer | `svsit.nl` of `svsit.nl  This event has ended` als voorbij (end_date of date + 4h < now, zelfde regel als de site) |

## Error handling
- Ongeldige URL: ephemeral `That is not a svsit.nl event link. Expected https://svsit.nl/events/<id>.`
- not_found: ephemeral `No event found at that link.`
- unavailable (netwerk, timeout, 5xx, ongeldige JSON): ephemeral `svsit.nl did not respond. Try again in a minute.` en `console.error` met de echte fout.
- Prefix-pad: zelfde teksten als gewone reply (ephemeral kan niet zonder interaction).

## Geen designSystem.md, geen Figma
Discord rendert de embed. Enige designkeuze is de kleur, die volgt de site.
