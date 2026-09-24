# Discord-SITbot

A Discord bot built with [discord.js](https://discord.js.org/) v14 and Node.js.

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env` and fill in your credentials:
   ```
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_id_here
   GUILD_ID=your_server_id_here
   ```
4. Enable **Server Members Intent** and **Message Content Intent** for your app
   under *Developer Portal → Bot → Privileged Gateway Intents*. The first lets the
   bot enumerate role holders, the second lets it read `%` prefix commands.
   Both are privileged — the bot fails to log in if either is missing.
5. Register the slash commands with your server:
   ```
   npm run deploy
   ```
6. Start the bot:
   ```
   npm start
   ```

## Commands

| Command | What it does |
| --- | --- |
| `/ping` | Replies `pong!`. Add `private:True` for a reply only you can see. |
| `/clear-lid` | Removes the **lid** role from every member who has it. Asks for confirmation first, and snapshots who had it. |
| `/restore-lid` | Puts the role back on everyone a `/clear-lid` run removed it from. Asks for confirmation first. |
| `/event` | Shows an event from svsit.nl as an embed. Paste the event link as `url`, pick `language` to translate the description, set `announce` to ping @everyone (needs Mention Everyone). Also `%event <link> [nl\|en] [announce]`. |
| `/events` | Lists the svsit.nl events of this week, one embed per event with the poster and a link to the event page. Pick `week` for next week and `view:Compact` for a one-embed list. Also `%events [next] [compact]`. |

Commands live in [`scripts/`](scripts/), one file per command, each exporting
`data` (a `SlashCommandBuilder`) and `execute(interaction)`. Add a file, run
`npm run deploy`, restart the bot.

### `/ping`

`/ping` replies `pong!` visibly in the channel. `/ping private:True` replies `pong`
ephemerally — Discord shows it as *"Only you can see this · Dismiss message"*.

`private` is an **option**, not a subcommand, because Discord won't let a bare
`/ping` be invoked once a command defines subcommands. Works in servers and DMs,
with no permission requirement.

The same command also answers to the `%` message prefix:

| Typed | Reply |
| --- | --- |
| `/ping` | `pong!` in channel |
| `/ping private:True` | `pong`, ephemeral |
| `%ping` | `pong!` in channel |
| `%ping private` | `pong`, ephemeral — behind one button click |

`%ping private` posts a short-lived public message with a **Show me pong** button.
Clicking it returns a genuine ephemeral `pong`, identical to `/ping private:True`,
and the public prompt is deleted — so the channel is left with nothing but the
user's own message. Unclicked, the prompt is removed after 60 seconds. Anyone
other than the invoker who clicks gets their own ephemeral "not for you".

The button exists because an ephemeral reply requires an interaction token and a
plain message has none — but a *button click* is an interaction, so its response
can be ephemeral. discord.js enforces this directly: `MessagePayload` only applies
the Ephemeral flag when the target is an interaction.

Prefix matching is case-insensitive and tolerates extra whitespace. Change the
prefix with `COMMAND_PREFIX` in `.env`.

Any command can opt into the prefix by exporting `prefix` (a name or array of
names) alongside `runPrefix(message, args)`; `npm run check` rejects a command
that declares one without the other.

### `/event`

Takes a link like `https://svsit.nl/events/<id>` (the `www.` host, a trailing
slash, query string or `<...>` brackets are fine) and posts the event as an
embed: title linking back to the page, description, date and time as Discord
timestamps (so everyone sees their own timezone), location, category, price,
signup count with capacity when set, external ticket link when there is one,
and the poster as image. The colour follows the category colour on svsit.nl.
Cancelled events get a `[Cancelled]` prefix; events that already happened say so
in the footer.

Errors are ephemeral: a link that is not a svsit.nl event, an event that does
not exist (404), or svsit.nl not answering within 8 seconds. The prefix form
`%event <link>` posts the same embed publicly and its errors as a normal reply.

Pick `language` (Nederlands or English) to have the description translated;
the title and location stay as written and the footer says so. Translation goes
through the same keyless endpoint the Google Translate web page uses, so it
needs no account. That endpoint is unofficial: if it stops answering, the embed
still appears with the original text and a footer note instead of an error.
Translations are cached in memory per event and language. The prefix form is
`%event <link> nl` or `%event <link> en`.

Set `announce:True` to post `@everyone` above the embed as a real ping. Only
members who hold Discord's **Mention Everyone** permission in that channel can
do this; anyone else gets an ephemeral refusal and nothing is posted. The bot
needs the same permission in the channel, and announcing does not work in DMs.
Who may announce is therefore managed in Discord's role settings, not in the
bot. The prefix form is `%event <link> announce`, optionally combined with
`nl` or `en` in any order.

The data comes from the public `GET /api/events/<id>` endpoint. Point the bot at
another checkout of the site with `SVSIT_BASE_URL` in `.env`.

### `/events`

Posts every svsit.nl event of the current week (Monday to Sunday, Amsterdam
time) as one message: a line like `Events this week: 22 Sep to 28 Sep` followed
by one embed per event, sorted by date. Each embed has the title linking to the
event page, a short description, date and time as Discord timestamps, the
location and the poster as image. The colour follows the category colour on
svsit.nl. Events earlier in the week that already happened stay in the list
with a footer saying so. Pick `week:Next week` to look one week ahead.

A week without events answers `No events this week.` (or `next week`). Discord
allows 10 embeds and 6000 characters per message, so a busy week shows the
first events that fit and says how many there are in total. If svsit.nl does
not answer within 8 seconds the error is ephemeral. The prefix form is
`%events` or `%events next`, posted publicly.

Pick `view:Compact` for a single embed instead: one line per event with the
start time as a Discord timestamp, the title linking to the event page and the
location, plus `(ended)` for events that already happened. No posters or
descriptions, handy for a quick overview in a busy channel. `view:Full` is the
default described above. The prefix form is `%events compact`, combinable with
`next` in any order.

The data comes from the public `GET /api/events/public` list, the same
`SVSIT_BASE_URL` override applies.

### `/clear-lid`

Requires **Manage Roles** on both the invoker and the bot, and the bot's highest
role must sit above the lid role. It shows an ephemeral **"Are you sure?"** prompt
with the exact number of affected members and does nothing until you press
confirm; the prompt expires after 30 seconds. The role ID defaults to
`1279109484739952811` and can be overridden with `LID_ROLE_ID` in `.env`.

### Backups and reversing a run

Before removing a single role, `/clear-lid` writes a snapshot of everyone who held
it to `data/lid-backups/<guild id>-<timestamp>.json`:

```json
{
  "id": "2026-08-31T12-04-04-217Z",
  "guildId": "...", "roleId": "...", "roleName": "lid",
  "executedAt": "2026-08-31T12:04:04.217Z",
  "executedBy": { "id": "...", "tag": "..." },
  "members": [{ "id": "...", "tag": "..." }],
  "removed": ["..."],
  "failed": [{ "id": "...", "tag": "...", "error": "..." }]
}
```

The snapshot is written *before* the first removal and the outcome is filled in
afterwards, so a run that crashes halfway still leaves a complete record. If the
backup cannot be written, the run aborts without touching any roles.

`/restore-lid` reverses a run. With no argument it takes the most recent backup;
the `backup` option autocompletes from the last 25, labelled by date and size. It
skips members who left the server or who already have the role again, and reports
both counts. The restore is itself confirmation-gated.

`data/` is gitignored — the snapshots contain member IDs. Set `LID_BACKUP_DIR` to
store them elsewhere.

## Welcoming new members

[`lib/welcome-intro.js`](lib/welcome-intro.js) runs the onboarding flow. It is not
a command — it listens for gateway events and is wired up from `index.js`:

| When | What happens |
| --- | --- |
| A member joins | They are pinged in **#introductions** with the channel's instructions. |
| They post their intro | They are granted the **lid** role and welcomed in **#general**. |

Each step is a single public message that pings the member and says what it has
to say. An earlier version put the text behind a button so the reply could be
ephemeral — Discord has no way to send an *unprompted* ephemeral, since the flag
requires an interaction token and neither a join nor a plain message has one, so
the click was the only way in. That is the same constraint that shapes
`%ping private` above, but it is not worth paying here: the text is three lines
of channel instructions, not server rules — Discord's built-in onboarding covers
those — so one message beats a ping plus a click plus a reply.

Both messages delete themselves. The #introductions ping goes the moment the
member posts, and is swept after 10 minutes otherwise
(`INTRO_PROMPT_TIMEOUT_MS`); the #general welcome is swept after 2 minutes
(`GENERAL_WELCOME_TIMEOUT_MS`) — long enough for the channel to see someone
arrived, short enough not to accumulate. `0` keeps either one forever. Both
sweeps are in-memory timers, so a restart before one fires strands that message
in the channel.

Only a member's first message promotes them; once they hold the role, later
messages in the channel are ignored. The bot needs **Manage Roles** and a role
above **lid**; if it cannot grant the role it logs why and stays quiet rather
than congratulating someone who did not actually get access.

If your server uses membership screening, `guildMemberAdd` fires while the member
is still `pending` and cannot see any channel — the greeting waits for them to
accept the rules first.

Channel and role IDs default to this server's and can be overridden with
`INTRO_CHANNEL_ID`, `GENERAL_CHANNEL_ID`, and `LID_ROLE_ID` in `.env`.

## Development

`npm run check` validates the source: every `.js` file parses, and every command
in `scripts/` loads, exports `data`/`execute`, and builds a valid Discord payload.
A command that fails this would otherwise be skipped silently at startup.

`npm test` runs the unit tests in [`test/`](test/) with the built-in `node:test`
runner (Node 18+, no extra dependency). Network calls are injected, so the tests
never hit svsit.nl.

These checks run automatically on **every** `git commit` via a hook in
[`.githooks/`](.githooks/) — terminal, IDE, or otherwise. The hook also refuses a
commit that tracks `.env` or stages anything shaped like a bot token.

`npm install` points git at the hooks directory (the `prepare` script). To wire it
up by hand:

```
git config core.hooksPath .githooks
```

Bypass for a single commit with `git commit --no-verify`.

## Requirements

- Node.js v18+
- A Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications)
