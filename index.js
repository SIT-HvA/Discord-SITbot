require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, MessageFlags } = require('discord.js');

const client = new Client({
  // GuildMembers is a privileged intent — enable it in the Developer Portal.
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();

const scriptsPath = path.join(__dirname, 'scripts');
for (const file of fs.readdirSync(scriptsPath).filter((name) => name.endsWith('.js'))) {
  const command = require(path.join(scriptsPath, file));

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`Skipping scripts/${file}: missing a "data" or "execute" export.`);
  }
}

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Loaded ${client.commands.size} command(s): ${[...client.commands.keys()].join(', ')}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  if (interaction.isAutocomplete()) {
    try {
      if (command.autocomplete) await command.autocomplete(interaction);
    } catch (error) {
      console.error(`Error autocompleting /${interaction.commandName}:`, error);
    }
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error running /${interaction.commandName}:`, error);

    const payload = {
      content: 'Something went wrong running that command.',
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
