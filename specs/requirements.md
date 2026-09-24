# Requirements: /event command

## Must
- M1 `/event url:<link>` toont het event uit de link als embed in het kanaal.
- M2 Accepteert `https://svsit.nl/events/<uuid>` en `https://www.svsit.nl/events/<uuid>`, met of zonder trailing slash, query of hash.
- M3 Embed bevat: titel (klikbaar naar de eventpagina), omschrijving, datum en tijd (Discord timestamp, dus in de tijdzone van de lezer), locatie, categorie, prijs, aanmeldingen (ticketCount, met capaciteit als die er is), poster als afbeelding, link naar externe tickets als die er is.
- M4 Kleur van de embed volgt de categoriekleur van de site (social #F29E18, code #22C55E, career #3B82F6, game #EF4444).
- M5 Foutpaden geven een ephemeral melding: geen geldige svsit.nl event-link, event niet gevonden (404), svsit.nl niet bereikbaar of timeout.
- M6 Ook via prefix `%event <link>` (zelfde embed, publiek).
- M7 Geannuleerd event: titel krijgt prefix `[Cancelled]`. Voorbij event: footer meldt dat het voorbij is.

- M8 Optionele `language` keuze (Nederlands, English). Gekozen: omschrijving vertaald via het onofficiele Google Translate gtx-endpoint (geen key, geen account). Titel en locatie blijven origineel. Footer meldt `Translated with Google Translate`. Vertaling faalt of duurt te lang: embed in de originele taal met footer `Translation unavailable, showing the original text`, geen foutmelding. Prefix: `%event <link> nl|en`.

- M9 Optionele `announce` vlag (boolean). Aan: het bericht begint met `@everyone` boven de embed en pingt echt (allowedMentions parse everyone). Alleen leden met de Discord-permissie **Mention Everyone** in dat kanaal mogen dit; anderen krijgen een ephemeral weigering en er wordt niets gepost. Buiten een server (DM) is announce niet mogelijk: zelfde weigering. Heeft de bot zelf geen Mention Everyone in het kanaal: ephemeral melding, niets gepost. Prefix: `%event <link> [nl|en] announce`, zelfde permissiecheck, weigering als gewone reply.

- M10 `/events` toont alle events van deze week (maandag tot en met zondag, Europe/Amsterdam) uit svsit.nl als 1 bericht met per event een embed: titel klikbaar naar `https://svsit.nl/events/<id>`, korte omschrijving, datum en tijd (Discord timestamp), locatie, poster als afbeelding, categoriekleur. Boven de embeds een regel `Events this week: <ma> to <zo>`. Geen events: `No events this week.` als gewone reply. Meer dan 10 events: de eerste 10 plus een noot (Discord-limiet 10 embeds per bericht). Al voorbije events van deze week blijven staan met de footer `This event has ended`. svsit.nl onbereikbaar: ephemeral `svsit.nl did not respond. Try again in a minute.` Ook via prefix `%events`.

## Should
- S3 Optionele `week` keuze (This week, Next week) op `/events`, prefix `%events next`. Default deze week. Header en lege melding volgen de keuze (`next week`).
- S2 Vertalingen per event en taal in het geheugen cachen (max 200 entries).
- S1 Basis-URL van de site overschrijfbaar via env `SVSIT_BASE_URL` (default `https://svsit.nl`) voor lokaal testen.

## Won't
- Geen caching, geen zoeken op naam, geen aanmelden vanuit Discord. Geen vertaling of announce op `/events` (increment 4 houdt het bij de lijst). Geen vrij datumbereik, alleen deze of volgende week.

## NFRs
- Fetch timeout 8 seconden (event en lijst) en 5 seconden (vertaling), reply eerst deferren (Discord eist antwoord binnen 3 s).
- Geen nieuwe dependencies: Node `fetch` en `node:test`.
- Alle teksten Engels, zoals de rest van de bot. Geen emoji in bot-teksten.
- Omschrijving afgekapt op 1000 tekens, veldwaarden op 1024, titel op 256 (Discord limieten).
- Foutmeldingen lekken geen interne details (geen stack, geen URL van de API).

## Success criteria
- `npm run check` groen, `npm test` groen met tests per M-requirement.
- Embed gebouwd uit live data van een echt event op svsit.nl (integratie-run met output als bewijs).

## Clarifications
- Vertaaldienst? Thijmen koos 2026-09-21 optie 1 (Google gtx, onofficieel) boven MyMemory en DeepL: geen account. Risico dat Google het endpoint sluit is geaccepteerd, de fallback toont dan de originele tekst.
- Bare uuid zonder URL? Nee, alleen URL (vraag van Thijmen was expliciet "met de event url").
- Taal? Engels, consistent met ping en clear-lid.
- Wie mag announcen (2026-09-21, increment 3)? Thijmen: "alleen een aantal mensen". Gekozen: de Discord-permissie Mention Everyone van de aanroeper, geen eigen rollenlijst in .env. Bestuur krijgt de permissie via een rol in Discord, de bot volgt dat.
- Weekgrens (2026-09-24, increment 4)? Maandag 00:00 tot zondag 23:59 in Europe/Amsterdam, op de startdatum van het event. Vaste tijdzone omdat alle SIT-events in Amsterdam zijn, Discord-timestamps in de embed blijven wel per lezer.
- Welke velden in het weekoverzicht? Titel met link, omschrijving (afgekapt op 300), When, Where, poster, kleur. Geen prijs of aanmeldingen: de lijst-API heeft geen ticketCount en het overzicht moet compact blijven, details via de link of `/event`.
