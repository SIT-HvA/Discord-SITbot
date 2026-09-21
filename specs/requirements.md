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

## Should
- S2 Vertalingen per event en taal in het geheugen cachen (max 200 entries).
- S1 Basis-URL van de site overschrijfbaar via env `SVSIT_BASE_URL` (default `https://svsit.nl`) voor lokaal testen.

## Won't
- Geen caching, geen zoeken op naam, geen lijst van komende events, geen aanmelden vanuit Discord.

## NFRs
- Fetch timeout 8 seconden (event) en 5 seconden (vertaling), reply eerst deferren (Discord eist antwoord binnen 3 s).
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
