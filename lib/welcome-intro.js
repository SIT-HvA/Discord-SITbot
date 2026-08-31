// Walks a new member through #introductions and promotes them once they post.
//
//   join            -> pinged in #introductions with the channel's instructions
//   first message   -> lid role granted, welcomed in #general
//
// Both messages are public. Discord has no way to send an unprompted ephemeral —
// the flag needs an interaction token, and neither a join nor a plain message has
// one — so the earlier version pinged with a button and put the text behind the
// click. The text is three lines of channel instructions, not server rules
// (Discord's own onboarding covers those), so it costs nothing to say out loud,
// and one message beats a ping plus a click plus a reply.
const { PermissionFlagsBits } = require('discord.js');

const INTRO_CHANNEL_ID = process.env.INTRO_CHANNEL_ID || '1517152202546745445';
const GENERAL_CHANNEL_ID = process.env.GENERAL_CHANNEL_ID || '1517149504820744252';
const LID_ROLE_ID = process.env.LID_ROLE_ID || '1279109484739952811';

// How long an unanswered #introductions ping sits in its channel before it is
// swept. 0 keeps it forever. Lives only as long as the current process — a
// restart strands the message, see `sweep()`.
const rawTimeout = Number(process.env.INTRO_PROMPT_TIMEOUT_MS);
const PROMPT_TIMEOUT_MS =
  Number.isFinite(rawTimeout) && rawTimeout >= 0 ? rawTimeout : 10 * 60_000;

const INTRO_TEXT = [
  '**Introduce yourself! == You can only ever send one message here.**',
  '**Attach image(s) that describes your current mood, of course.**',
  "Once you've sent a message here, you get access to the rest of the server.",
  '',
  '**Introduceer jezelf! == Je kan hier maar eenmaals een bericht in sturen.**',
  '**Voeg afbeelding(en) toe die je huidige stemming beschrijft.**',
  'Zodra je hier een bericht hebt gestuurd, krijg je toegang tot de rest van de server.',
].join('\n');

const PROMOTED_TEXT = "You're now a fully-fledged member. Be welcome!";

// Lets a member's outstanding #introductions ping be cleared the moment they
// post, instead of lingering until the sweep. Keyed `<guild id>:<member id>`.
const pendingPrompts = new Map();

const promptKey = (member) => `${member.guild.id}:${member.id}`;

function clearPrompt(key) {
  const prompt = pendingPrompts.get(key);
  if (!prompt) return;

  pendingPrompts.delete(key);
  prompt.delete().catch(() => {});
}

// The map is only tidied when it still points at this prompt — a rejoin may have
// replaced it, and that newer prompt must stay tracked.
function sweep(key, prompt) {
  if (PROMPT_TIMEOUT_MS === 0) return;

  const timer = setTimeout(() => {
    if (pendingPrompts.get(key) === prompt) pendingPrompts.delete(key);
    prompt.delete().catch(() => {});
  }, PROMPT_TIMEOUT_MS);

  // Never hold the process open for a prompt nobody is waiting on.
  timer.unref?.();
}

// Resolves a channel *through the member's guild*, so a guild that does not own
// the channel rejects the fetch rather than the bot posting somewhere unrelated.
async function resolveChannel(guild, channelId) {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return null;

  const me = guild.members.me ?? (await guild.members.fetchMe());
  const permissions = channel.permissionsFor(me);

  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    console.warn(`welcome-intro: missing View Channel / Send Messages in #${channel.name}.`);
    return null;
  }

  return channel;
}

// `allowedMentions` keeps the ping to the one member even if the text ever grows
// a role or @everyone.
async function ping(channel, member, content) {
  return channel
    .send({
      content: `${member} ${content}`,
      allowedMentions: { users: [member.id] },
    })
    .catch((error) => {
      console.error(`welcome-intro: could not post for ${member.user.tag}:`, error);
      return null;
    });
}

// Step 1 — they joined. Tell them what the channel is for.
async function greet(member) {
  if (member.user.bot) return;

  const channel = await resolveChannel(member.guild, INTRO_CHANNEL_ID);
  if (!channel) return;

  const prompt = await ping(channel, member, `welcome! · Welkom!\n\n${INTRO_TEXT}`);
  if (!prompt) return;

  const key = promptKey(member);
  clearPrompt(key); // A rejoin should not leave the previous ping behind.
  pendingPrompts.set(key, prompt);
  sweep(key, prompt);
}

// Step 2 — they introduced themselves. Give them the run of the server.
async function promote(member) {
  const { guild } = member;
  const role = await guild.roles.fetch(LID_ROLE_ID).catch(() => null);

  if (!role) {
    console.warn(`welcome-intro: no role ${LID_ROLE_ID} in ${guild.name} — ${member.user.tag} not promoted.`);
    return;
  }

  // Already a member: this is not their first message, so there is nothing to
  // grant and nothing to celebrate.
  if (member.roles.cache.has(role.id)) return;

  const me = guild.members.me ?? (await guild.members.fetchMe());

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    console.warn(`welcome-intro: I need Manage Roles to grant ${role.name}.`);
    return;
  }

  if (me.roles.highest.comparePositionTo(role) <= 0) {
    console.warn(
      `welcome-intro: my highest role sits below ${role.name}, so I cannot grant it. Move my role above it.`
    );
    return;
  }

  try {
    await member.roles.add(role, `Introduced themselves in #introductions`);
  } catch (error) {
    // Do not congratulate someone who did not actually get access.
    console.error(`welcome-intro: could not grant ${role.name} to ${member.user.tag}:`, error);
    return;
  }

  // Their #introductions ping has served its purpose.
  clearPrompt(promptKey(member));

  const channel = await resolveChannel(guild, GENERAL_CHANNEL_ID);
  if (!channel) return;

  // Left standing, unlike the #introductions ping: this one announces the new
  // member to the server, so people can greet and react to it.
  await ping(channel, member, PROMOTED_TEXT);
}

function register(client) {
  client.on('guildMemberAdd', (member) => {
    // A server with membership screening fires this while the member is still
    // `pending` — they cannot see a single channel yet, so greeting them now
    // would ping into a void. `guildMemberUpdate` below picks them up instead.
    if (member.pending) return;

    greet(member).catch((error) => console.error('welcome-intro:', error));
  });

  client.on('guildMemberUpdate', (before, after) => {
    if (!before.pending || after.pending) return;

    greet(after).catch((error) => console.error('welcome-intro:', error));
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channelId !== INTRO_CHANNEL_ID || !message.guild) return;

    // Webhooks and the odd uncached author have no member to promote.
    const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
    if (!member) return;

    promote(member).catch((error) => console.error('welcome-intro:', error));
  });
}

module.exports = {
  register,
  INTRO_CHANNEL_ID,
  GENERAL_CHANNEL_ID,
  LID_ROLE_ID,
  INTRO_TEXT,
  PROMOTED_TEXT,
};
