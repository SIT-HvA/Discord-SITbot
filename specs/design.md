# Design: /event command

## Structuur
- `lib/svsit-events.js`: pure logica, geen Discord-client.
  - `parseEventUrl(input) -> uuid | null`
  - `fetchEvent(uuid, { fetch, baseUrl, timeoutMs }) -> { ok: true, event } | { ok: false, reason: 'not_found' | 'unavailable' }`
  - `buildEventEmbed(event, { now, description, footerNote }) -> EmbedBuilder` (description overschrijft event.description, footerNote komt achter de footer)
  - `eventPageUrl(uuid) -> string`
- `lib/translate.js`: `translate(text, targetLang, { fetch, timeoutMs }) -> { ok: true, text, detected } | { ok: false }`.
  GET `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=<lang>&dt=t&q=<text>`.
  Antwoord is een array: `[0]` segmenten `[vertaald, origineel, ...]`, `[2]` gedetecteerde brontaal. Nooit throwen.
  `cachedTranslate(key, text, lang)` cachet in een Map (max 200, oudste eruit).
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
| footer | `svsit.nl`, plus `  This event has ended` als voorbij, plus `  <footerNote>` als meegegeven (end_date of date + 4h < now, zelfde regel als de site) |

## Vertaalflow (M8)
1. `language` gekozen en event heeft description: description eerst afkappen op 1000, dan `cachedTranslate(`${id}:${lang}`, ...)`.
2. ok: embed met vertaalde description en footerNote `Translated with Google Translate`.
3. niet ok: originele description en footerNote `Translation unavailable, showing the original text`.
4. Geen description: niets vertalen, geen footerNote.

## Announce (M9)
1. `announce` gelezen (slash: `getBoolean('announce')`, prefix: een argument gelijk aan `announce`, hoofdletterongevoelig).
2. Voor `deferReply`: `announceRefusal(interaction)` geeft een tekst of null.
   - Niet in een guild (`memberPermissions` ontbreekt): `Announcing only works in a server channel.`
   - Aanroeper mist `PermissionFlagsBits.MentionEveryone` in `interaction.memberPermissions`: `You need the Mention Everyone permission to announce an event.`
   - Bot mist `MentionEveryone` in `interaction.appPermissions`: `I need the Mention Everyone permission in this channel to announce.`
   Tekst aanwezig: ephemeral reply, klaar. Zo blijft de fout ephemeral (voor de defer).
3. Reply-payload krijgt `content: '@everyone'` en `allowedMentions: { parse: ['everyone'] }`. Zonder announce blijft de payload ongewijzigd.
4. Prefix: `message.member?.permissionsIn(message.channel)` en `message.channel.permissionsFor(message.guild.members.me)`; weigering als gewone reply. allowedMentions wordt `{ parse: ['everyone'], repliedUser: false }`.
5. `eventReply(link, language, announce)` bouwt de payload, `scripts/event.js` doet de checks. `lib/svsit-events.js` verandert niet.

## Error handling
- Ongeldige URL: ephemeral `That is not a svsit.nl event link. Expected https://svsit.nl/events/<id>.`
- not_found: ephemeral `No event found at that link.`
- unavailable (netwerk, timeout, 5xx, ongeldige JSON): ephemeral `svsit.nl did not respond. Try again in a minute.` en `console.error` met de echte fout.
- Prefix-pad: zelfde teksten als gewone reply (ephemeral kan niet zonder interaction).

## Geen designSystem.md, geen Figma
Discord rendert de embed. Enige designkeuze is de kleur, die volgt de site.
