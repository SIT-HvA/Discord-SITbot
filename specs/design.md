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

## Weekoverzicht (M10, S3, increment 4)

### Structuur
- `lib/week.js`: pure datumlogica, geen Discord.
  - `localDate(instant, timeZone = 'Europe/Amsterdam') -> 'YYYY-MM-DD'` (Intl en-CA).
  - `weekDates(now, { weeks = 0, timeZone }) -> string[7]` maandag tot zondag van de week van `now` in die zone, `weeks` verschuift (1 = volgende week). Rekent op datumstrings plus `Date.UTC`, dus geen DST-rekenwerk.
  - `weekLabel(dates) -> '22 Sep to 28 Sep'` (eigen maandnamen, geen ICU-verschillen).
- `lib/svsit-events.js` krijgt erbij:
  - `fetchPublicEvents({ fetch, baseUrl, timeoutMs }) -> { ok: true, events } | { ok: false, reason: 'unavailable' }`. GET `<base>/api/events/public`. Body moet een array zijn waarvan elk item een string `id` en `date` heeft, anders unavailable. Zelfde AbortController-timeout als `fetchEvent`.
  - `buildEventCardEmbed(item, { now }) -> EmbedBuilder` voor een item uit de lijst (velden `name`, `dateEnd`, `poster` in plaats van `title`, `end_date`, `poster_url`).
- `scripts/events.js`: slash `/events [week]` plus prefix `events`. Deferren, lijst fetchen, filteren op `weekDates`, sorteren op date, embeds bouwen.
- Tests: `test/week.test.js`, `test/svsit-events-public.test.js`, `test/events-command.test.js` (fetch geinjecteerd of gestubd, geen netwerk).

### Data (GET /api/events/public, live gecheckt 2026-09-24)
```
[ { id, name, date, dateEnd?, location, description?, poster?, capacity?, link?,
    priceMembers, priceNonMembers, isPaid, status: 'next'|'done'|'tba', type,
    category: 'Social'|'Code'|'Career'|'Game', color: '#F29E18' }, ... ]
```
Plain array, geen envelope. Bij een DB-fout antwoordt de route `[]` met status 500. Geannuleerde events staan er niet in. Optionele velden ontbreken als key (JSON laat undefined weg).

### Card-embed mapping
| Embed | Bron |
|---|---|
| title | name, afgekapt op 256 |
| url | `https://svsit.nl/events/<id>` |
| description | description afgekapt op 300, alleen als aanwezig |
| color | `CATEGORY_COLORS[category.toLowerCase()]`, default social |
| field When | zelfde als `/event`: `<t:start:F>` plus ` to <t:end:t>` als dateEnd, plus ` (<t:start:R>)` |
| field Where | location of `TBA`, inline |
| image | poster als aanwezig |
| footer | `svsit.nl`, plus `  This event has ended` als voorbij (dateEnd of date + 4h < now) |

### Command-flow
1. `week` lezen: slash `getString('week')` met choices `this` (default) en `next`; prefix: argument `next` (hoofdletterongevoelig) geeft volgende week.
2. `deferReply`, dan `fetchPublicEvents()`. Niet ok: `deleteReply` plus ephemeral followUp `svsit.nl did not respond. Try again in a minute.` (prefix: gewone reply).
3. `dates = weekDates(new Date(), { weeks })`, filter `dates.includes(localDate(item.date))`, sorteer op date oplopend.
4. Leeg: `editReply({ content: 'No events this week.' })` of `next week`.
5. Anders `content: 'Events this week: <weekLabel>'` plus `embeds` van max 10 cards. Meer dan 10: content krijgt ` Showing the first 10 of <n>.`
6. Geen allowedMentions nodig, de content bevat geen mentions.

### Constanten
`MAX_EMBEDS = 10` (Discord), `CARD_DESCRIPTION_MAX = 300`, tijdzone `Europe/Amsterdam`, `weeks` alleen 0 of 1.

## Compact view (M11, increment 5)

### Structuur
- `lib/svsit-events.js` krijgt `buildWeekListEmbed(items, { title, now }) -> EmbedBuilder`: 1 embed, `setTitle(title)`, kleur `CATEGORY_COLORS.social`, footer `svsit.nl`, description met per item een regel. Items zijn al gefilterd en gesorteerd door het command.
- `scripts/events.js`: optie `view` (choices `Full` = `full`, `Compact` = `compact`, optional, default full), constante `VIEWS = { full, compact }`, `COMPACT_ARG = 'compact'`. `eventsReply(weekKey, view, now)`.

### Regel per event
`<t:${start}:f}  [${name}](${eventPageUrl(id)})  ${location || 'TBA'}` plus ` (ended)` als `hasEnded`. Naam afgekapt op 80 tekens (`LIST_NAME_MAX`), locatie op 60 (`LIST_LOCATION_MAX`). Vierkante haken in de naam worden vervangen door ronde, anders breekt de markdown-link. Regels gescheiden door `\n`.

### Limiet
`DESCRIPTION_LIMIT = 4096` (Discord). Regels toevoegen zolang totaal plus slotregel past; daarna slotregel `and ${rest} more on svsit.nl`. Bij 7 events van ~150 tekens is dat nooit nodig, de check is voor de zekerheid.

### Command-flow (aanvulling)
1. `view = getString('view') ?? 'full'`; prefix: argument `compact` (hoofdletterongevoelig) geeft compact, `next` blijft werken, volgorde vrij.
2. Fetch, filter, sorteer en de lege melding zijn gelijk voor beide views.
3. full: ongewijzigd (content-regel plus fitEmbeds). compact: `{ embeds: [buildWeekListEmbed(events, { title: 'Events this week: ' + weekLabel(dates), now })] }`, geen content.
