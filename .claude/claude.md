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
- `check.js` — source validation (`npm run check`)
- `.githooks/pre-commit` — runs `check.js` + a credential scan on every commit
- `.env` — credentials (gitignored, never commit)

## Adding a Command
Drop a file in `scripts/` exporting `{ data, execute }`, then run `npm run deploy`.
Files missing either export are skipped with a warning.

## Environment Variables
- `DISCORD_TOKEN` — bot token from Discord Developer Portal
- `CLIENT_ID` — application ID, used for slash command registration
- `GUILD_ID` — server ID, used for dev-scoped command registration
- `LID_ROLE_ID` — optional override for the "lid" role targeted by `/clear-lid`
- `LID_BACKUP_DIR` — optional override for where role backups are written

## Notes
- The bot uses the privileged `GuildMembers` intent (needed to enumerate role holders);
  it must be enabled in the Developer Portal or login fails.
- Destructive commands prompt for confirmation with buttons before acting, and
  snapshot the state they are about to destroy so it can be reversed.
- Backup ids reach `lib/lid-backups.js` from user input; keep the id/guild-id
  validation in `fileFor()` — it is what stops path traversal.
- `npm run check` runs automatically on every commit via `core.hooksPath=.githooks`.
  A commit that fails it is rejected; `--no-verify` bypasses.
