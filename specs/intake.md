# Intake: /event command

Datum: 2026-09-21. Opdrachtgever: Thijmen (SIT, voorzitter evenementencommissie en bestuur XII).

## Context
Discord-SITbot (discord.js v14, Node 18+) draait op de SIT Discord. De site svsit.nl heeft
per event een pagina `https://svsit.nl/events/<uuid>` en een publieke JSON API
`GET https://svsit.nl/api/events/<uuid>` met envelope `{ data, error, meta }`.

## Vraag
Een command dat met de event-URL van svsit.nl het event als embed in Discord toont,
zodat de commissie een event snel in een kanaal kan delen.

## Project type
Feature in bestaande SIT-repo. Geen web-UI, geen Figma (Discord rendert de embed).
