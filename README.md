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

## Development

`npm run check` validates the source: every `.js` file parses, and every command
in `scripts/` loads, exports `data`/`execute`, and builds a valid Discord payload.
A command that fails this would otherwise be skipped silently at startup.

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
