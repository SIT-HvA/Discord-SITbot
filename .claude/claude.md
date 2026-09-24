# Discord-SITbot

A Discord bot built with discord.js v14 and Node.js.

## Stack
- Runtime: Node.js v18+
- Library: discord.js v14
- Config: dotenv

## Project Structure
- `index.js` — entry point, loads `scripts/`, routes interactions, logs in
- `deploy-commands.js` — registers slash commands to `GUILD_ID` (`npm run deploy`)
- `scripts/` — one file per slash command, each exporting `data` (SlashCommandBuilder) and `execute(interaction)`
- `lib/` — shared modules; NOT scanned by the command loader, put non-command code here
- `data/` — runtime state (role backups), gitignored
- `test/` — unit tests, `node:test` runner (`npm test`); inject `fetch`, never hit the network
- `check.js` — source validation (`npm run check`)
- `.githooks/pre-commit` — runs `check.js` + a credential scan on every commit
- `.env` — credentials (gitignored, never commit)

## Adding a Command
Drop a file in `scripts/` exporting `{ data, execute }`, then run `npm run deploy`.
Files missing either export are skipped with a warning.

To also answer the `%` message prefix, export `prefix` (a name or array of names)
and `runPrefix(message, args)`.

A prefix reply cannot be ephemeral: the flag needs an interaction token and a
plain message has none (discord.js only sets it when the target is an
interaction). To get a real ephemeral from a prefix command, reply with a button
and answer the *click* — a click is an interaction. See `runPrefix` in
`scripts/ping.js`; delete the public prompt on collector `end`.

## Adding an Event Feature
Anything driven by a gateway event rather than a command goes in `lib/` — the
`scripts/` loader and `check.js` both require a `data`/`execute` pair, so an
event handler placed there fails the check. Export a `register(client)` that
attaches its own listeners and call it from `index.js`. See
`lib/welcome-intro.js`.

## Environment Variables
- `DISCORD_TOKEN` — bot token from Discord Developer Portal
- `CLIENT_ID` — application ID, used for slash command registration
- `GUILD_ID` — server ID, used for dev-scoped command registration
- `LID_ROLE_ID` — optional override for the "lid" role targeted by `/clear-lid`
  and granted by the welcome flow
- `LID_BACKUP_DIR` — optional override for where role backups are written
- `COMMAND_PREFIX` — message-command prefix, defaults to `%`
- `INTRO_CHANNEL_ID` — optional override for #introductions
- `GENERAL_CHANNEL_ID` — optional override for #general
- `INTRO_PROMPT_TIMEOUT_MS` — how long an unanswered #introductions ping lingers,
  defaults to 10 minutes; `0` keeps it forever
- `GENERAL_WELCOME_TIMEOUT_MS` — how long the #general welcome lingers, defaults
  to 2 minutes; `0` keeps it forever
- `SVSIT_BASE_URL` — optional override for the svsit.nl origin `/event` and `/events`
  read from, defaults to `https://svsit.nl`

## After Changing Functionality
Run all three, in this order, without asking:

```
npm run prepare   # re-point core.hooksPath at .githooks
npm run check     # validate every source file and command payload
npm test          # unit tests
npm run deploy    # re-register slash commands to GUILD_ID
```

Run them for any behaviour change, not just ones that touch `scripts/` — the
whole point is that the registered commands never drift from the source. Report
the output; if `check` fails, fix it and rerun the sequence rather than
continuing on to `deploy`.

## Notes
- `/event` reads `GET https://svsit.nl/api/events/<uuid>` (envelope `{ data, error, meta }`,
  404 for unknown or non-uuid ids). Parsing, fetching and the embed live in
  `lib/svsit-events.js`; `scripts/event.js` only wires the interaction.
- `/event language:` translates the description via `lib/translate.js` (Google Translate
  gtx endpoint, unofficial, keyless, 5 s timeout, in-memory cache). Failures are soft:
  original text plus a footer note, never an error reply.
- `/event announce:True` puts `@everyone` above the embed with `allowedMentions.parse`
  set to everyone. Gate is Discord's own `MentionEveryone` permission, checked on the
  invoker (`interaction.memberPermissions`) and on the bot (`interaction.appPermissions`)
  before `deferReply`, so the refusal stays ephemeral. No role list in `.env`.
- `/events [week:this|next]` reads `GET https://svsit.nl/api/events/public` (plain array,
  no envelope; list items use `name`, `dateEnd`, `poster` instead of `title`, `end_date`,
  `poster_url`). Week logic (Monday to Sunday in Europe/Amsterdam, date-string based so no
  DST arithmetic) lives in `lib/week.js`; `fetchPublicEvents` and `buildEventCardEmbed` in
  `lib/svsit-events.js`; `scripts/events.js` filters, sorts and fits the embeds within
  Discord's 10 embeds and 6000 characters per message.
- Two privileged intents are required, both enabled in the Developer Portal or login
  fails: `GuildMembers` (enumerating role holders) and `MessageContent` (reading `%`
  prefix commands).
- Destructive commands prompt for confirmation with buttons before acting, and
  snapshot the state they are about to destroy so it can be reversed.
- Backup ids reach `lib/lid-backups.js` from user input; keep the id/guild-id
  validation in `fileFor()` — it is what stops path traversal.
- `npm run check` runs automatically on every commit via `core.hooksPath=.githooks`.
  A commit that fails it is rejected; `--no-verify` bypasses.
