# Deploy Log: /event command

| Datum | Actie | Resultaat |
|---|---|---|
| 2026-09-21 | `npm run deploy` vanaf server-14 (debian) | Registered 4 command(s) to guild 777898731562336276: /clear-lid, /event, /ping, /restore-lid |

| 2026-09-21 | `npm run deploy` na increment 2 (language-optie) | Registered 4 command(s): /clear-lid, /event, /ping, /restore-lid |
| 2026-09-21 | `npm run deploy` na increment 3 (announce-optie), buiten de sandbox (DNS voor discord.com geblokkeerd erbinnen) | Registered 4 command(s): /clear-lid, /event, /ping, /restore-lid. Teruggelezen: /event heeft url, language, announce. |

## Rollback
Vorige werkende commit: ca2c2bf (increment 2 zonder announce), daarvoor 6f0b645 (increment 1 zonder vertaling), daarvoor b8964a2 (zonder /event). Terug: `git checkout b8964a2 -- scripts lib` en opnieuw `npm run deploy` (registreert dan 3 commands, /event verdwijnt uit de guild).

## Open
- Het bot-proces zelf draait niet op server-14. Waar het wel draait moet `git pull` plus herstart gebeuren, anders kent de draaiende bot /event nog niet (Discord toont het command wel al).
- Push naar origin kan niet vanaf server-14 (geen GitHub ssh-key).
