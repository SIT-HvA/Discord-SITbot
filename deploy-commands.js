require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('DISCORD_TOKEN, CLIENT_ID and GUILD_ID must all be set in .env');
  process.exit(1);
}

const commands = [];
const scriptsPath = path.join(__dirname, 'scripts');

for (const file of fs.readdirSync(scriptsPath).filter((name) => name.endsWith('.js'))) {
  const command = require(path.join(scriptsPath, file));

  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`Skipping scripts/${file}: missing a "data" or "execute" export.`);
  }
}

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Registering ${commands.length} command(s) to guild ${GUILD_ID}...`);

    const data = await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });

    console.log(`Registered ${data.length} command(s): ${data.map((c) => `/${c.name}`).join(', ')}`);
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exit(1);
  }
})();
