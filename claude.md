# Discord-SITbot

A Discord bot built with discord.js v14 and Node.js.

## Stack
- Runtime: Node.js v18+
- Library: discord.js v14
- Config: dotenv

## Project Structure
- `index.js` — entry point, initializes the client and logs in
- `.env` — credentials (gitignored, never commit)

## Environment Variables
- `DISCORD_TOKEN` — bot token from Discord Developer Portal
- `CLIENT_ID` — application ID, used for slash command registration
- `GUILD_ID` — server ID, used for dev-scoped command registration
