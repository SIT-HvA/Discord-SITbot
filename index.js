require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  MessageFlags,
  Partials,
} = require('discord.js');

// Overridable so a second instance can run alongside without both answering.
const PREFIX = process.env.COMMAND_PREFIX || '%';

const client = new Client({
  // GuildMembers and MessageContent are privileged — both must be enabled in the
  // Developer Portal or login fails outright.
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  // DM channels aren't cached, so without this the bot never sees DM messages.
  partials: [Partials.Channel],
});

client.commands = new Collection();
client.prefixCommands = new Collection();

const scriptsPath = path.join(__dirname, 'scripts');
for (const file of fs.readdirSync(scriptsPath).filter((name) => name.endsWith('.js'))) {
  const command = require(path.join(scriptsPath, file));

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`Skipping scripts/${file}: missing a "data" or "execute" export.`);
  }

  // Optional: a command may also answer to the message prefix.
  if (command.prefix && typeof command.runPrefix === 'function') {
    for (const name of [command.prefix].flat()) {
      client.prefixCommands.set(name.toLowerCase(), command);
    }
  }
}

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`Loaded ${client.commands.size} command(s): ${[...client.commands.keys()].join(', ')}`);

  const prefixed = [...client.prefixCommands.keys()].map((name) => `${PREFIX}${name}`);
  console.log(`Prefix command(s): ${prefixed.join(', ') || 'none'}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const [name, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = client.prefixCommands.get(name?.toLowerCase());
  if (!command) return;

  try {
    await command.runPrefix(message, args);
  } catch (error) {
    console.error(`Error running ${PREFIX}${name}:`, error);
    await message.reply('Something went wrong running that command.').catch(() => {});
  }
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
