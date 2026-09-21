# Requirements: /event command

## Must
- M1 `/event url:<link>` toont het event uit de link als embed in het kanaal.
- M2 Accepteert `https://svsit.nl/events/<uuid>` en `https://www.svsit.nl/events/<uuid>`, met of zonder trailing slash, query of hash.
- M3 Embed bevat: titel (klikbaar naar de eventpagina), omschrijving, datum en tijd (Discord timestamp, dus in de tijdzone van de lezer), locatie, categorie, prijs, aanmeldingen (ticketCount, met capaciteit als die er is), poster als afbeelding, link naar externe tickets als die er is.
- M4 Kleur van de embed volgt de categoriekleur van de site (social #F29E18, code #22C55E, career #3B82F6, game #EF4444).
- M5 Foutpaden geven een ephemeral melding: geen geldige svsit.nl event-link, event niet gevonden (404), svsit.nl niet bereikbaar of timeout.
- M6 Ook via prefix `%event <link>` (zelfde embed, publiek).
- M7 Geannuleerd event: titel krijgt prefix `[Cancelled]`. Voorbij event: footer meldt dat het voorbij is.

## Should
- S1 Basis-URL van de site overschrijfbaar via env `SVSIT_BASE_URL` (default `https://svsit.nl`) voor lokaal testen.

## Won't
- Geen caching, geen zoeken op naam, geen lijst van komende events, geen aanmelden vanuit Discord.

## NFRs
- Fetch timeout 8 seconden, reply eerst deferren (Discord eist antwoord binnen 3 s).
- Geen nieuwe dependencies: Node `fetch` en `node:test`.
- Alle teksten Engels, zoals de rest van de bot. Geen emoji in bot-teksten.
- Omschrijving afgekapt op 1000 tekens, veldwaarden op 1024, titel op 256 (Discord limieten).
- Foutmeldingen lekken geen interne details (geen stack, geen URL van de API).

## Success criteria
- `npm run check` groen, `npm test` groen met tests per M-requirement.
- Embed gebouwd uit live data van een echt event op svsit.nl (integratie-run met output als bewijs).

## Clarifications
- Bare uuid zonder URL? Nee, alleen URL (vraag van Thijmen was expliciet "met de event url").
- Taal? Engels, consistent met ping en clear-lid.
