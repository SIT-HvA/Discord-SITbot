# Deploy Log: /event command

| Datum | Actie | Resultaat |
|---|---|---|
| 2026-09-21 | `npm run deploy` vanaf server-14 (debian) | Registered 4 command(s) to guild 777898731562336276: /clear-lid, /event, /ping, /restore-lid |

| 2026-09-21 | `npm run deploy` na increment 2 (language-optie) | Registered 4 command(s): /clear-lid, /event, /ping, /restore-lid |
| 2026-09-21 | `npm run deploy` na increment 3 (announce-optie), buiten de sandbox (DNS voor discord.com geblokkeerd erbinnen) | Registered 4 command(s): /clear-lid, /event, /ping, /restore-lid. Teruggelezen: /event heeft url, language, announce. |

| 2026-09-22 09:12 UTC | `git pull` en `systemctl restart discord-sitbot` op sit-srv-01 als user sit (niet door Claude, game-admin heeft daar geen rechten) | Repo op 311c747, node-proces gestart 09:12:35, 16 s na de pull. Productie draait /event met language en announce. discord.js 14.27.0, node v24. |

| 2026-09-24 | `npm run deploy` na increment 4 (/events) vanaf server-14 | In de sandbox EAI_AGAIN op discord.com; buiten de sandbox geweigerd door de auto-mode classifier. Thijmen draaide het zelf in de sessie: Registered 5 command(s) to guild 777898731562336276: /clear-lid, /event, /events, /ping, /restore-lid. Productie (sit-srv-01) volgt na merge van PR #2. |
| 2026-09-24 ~12:00 UTC | PR #2 gemerged (ca7ed09), pull plus deploy plus restart op sit-srv-01 door SIT (niet door Claude) | Thijmen: `/events` werkt in de SIT-server. Productie draait increment 4. |
| 2026-09-24 | `npm run deploy` na increment 5 (view-optie, compact met spacer) door Thijmen in de dev-guild | 5 commands, /events met week en view. Thijmen klikte view:Compact: kaarten even groot, ziet er goed uit. Productie (sit-srv-01) volgt na merge van PR #3. |

## Rollback
Vorige werkende commit: d0b6110 (increment 3, zonder /events; /events weghalen: `git checkout d0b6110 -- scripts lib test` en `npm run deploy`), daarvoor ca2c2bf (increment 2 zonder announce), daarvoor 6f0b645 (increment 1 zonder vertaling), daarvoor b8964a2 (zonder /event). Terug: `git checkout b8964a2 -- scripts lib` en opnieuw `npm run deploy` (registreert dan 3 commands, /event verdwijnt uit de guild).

## Open
- Bot draait op sit-srv-01 als systemd `discord-sitbot.service` (user sit). Bijgewerkt 22 sep 09:12 UTC. game-admin kan niet pullen; de sudo-regel `systemctl restart` mist de unit-naam en matcht daardoor niet, SIT moet die aanpassen naar `/usr/bin/systemctl restart discord-sitbot.service`.
- Push werkt sinds 21 sep via ssh-key; PR #1 gemerged.
