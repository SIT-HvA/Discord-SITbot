// On-disk snapshots of who held the "lid" role before a /clear-lid run, so the
// removal can be reversed by /restore-lid.
const fsp = require('node:fs/promises');
const path = require('node:path');

const BACKUP_DIR = process.env.LID_BACKUP_DIR
  ? path.resolve(process.env.LID_BACKUP_DIR)
  : path.join(__dirname, '..', 'data', 'lid-backups');

// Sortable, filename-safe, and derived from the clock so listings read newest-first.
const ID_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

function newId() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// Backup ids reach us from a slash-command option, so never let one build a path
// outside BACKUP_DIR.
function fileFor(guildId, id) {
  if (!/^\d{1,20}$/.test(guildId)) throw new Error(`Invalid guild id: ${guildId}`);
  if (!ID_PATTERN.test(id)) throw new Error(`Invalid backup id: ${id}`);

  return path.join(BACKUP_DIR, `${guildId}-${id}.json`);
}

async function write(backup) {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  await fsp.writeFile(fileFor(backup.guildId, backup.id), JSON.stringify(backup, null, 2), 'utf8');
  return backup;
}

// Written BEFORE the first role is removed, so a crash mid-run still leaves a
// complete record of who to put the role back on.
async function createBackup({ guildId, roleId, roleName, executedBy, members }) {
  return write({
    id: newId(),
    guildId,
    roleId,
    roleName,
    executedAt: new Date().toISOString(),
    executedBy,
    members,
    removed: null,
    failed: null,
  });
}

async function finalizeBackup(backup, { removed, failed }) {
  return write({ ...backup, removed, failed, completedAt: new Date().toISOString() });
}

async function listBackups(guildId, limit = 25) {
  let entries;
  try {
    entries = await fsp.readdir(BACKUP_DIR);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const names = entries
    .filter((name) => name.startsWith(`${guildId}-`) && name.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit);

  const backups = [];
  for (const name of names) {
    try {
      backups.push(JSON.parse(await fsp.readFile(path.join(BACKUP_DIR, name), 'utf8')));
    } catch (error) {
      console.error(`Skipping unreadable backup ${name}:`, error.message);
    }
  }

  return backups;
}

async function readBackup(guildId, id) {
  try {
    return JSON.parse(await fsp.readFile(fileFor(guildId, id), 'utf8'));
  } catch {
    return null;
  }
}

module.exports = {
  BACKUP_DIR,
  ID_PATTERN,
  createBackup,
  finalizeBackup,
  listBackups,
  readBackup,
};
