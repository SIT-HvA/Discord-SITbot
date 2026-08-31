#!/usr/bin/env node
// Validates the bot's source. Run directly with `npm run check`; also invoked
// by .githooks/pre-commit on every commit.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const errors = [];

if (!fs.existsSync(path.join(root, 'node_modules', 'discord.js'))) {
  console.error('Dependencies are missing. Run `npm install` first.');
  process.exit(1);
}

// 1. Every project .js file must parse.
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) files.push(full);
  }
})(root);

for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    errors.push(`${path.relative(root, file)} — ${error.stderr.toString().trim()}`);
  }
}

// 2. Every command in scripts/ must load and build a valid payload, or the bot
//    silently skips it at startup and `npm run deploy` registers the wrong set.
const { SlashCommandBuilder } = require('discord.js');
const scriptsPath = path.join(root, 'scripts');
const names = new Map();
const prefixes = new Map();

for (const file of fs.readdirSync(scriptsPath).filter((name) => name.endsWith('.js'))) {
  const rel = `scripts/${file}`;
  let command;

  try {
    command = require(path.join(scriptsPath, file));
  } catch (error) {
    errors.push(`${rel} — failed to load: ${error.message}`);
    continue;
  }

  if (typeof command.execute !== 'function') {
    errors.push(`${rel} — missing an "execute" function export`);
  }

  if (!(command.data instanceof SlashCommandBuilder)) {
    errors.push(`${rel} — "data" export is not a SlashCommandBuilder`);
    continue;
  }

  let json;
  try {
    json = command.data.toJSON();
  } catch (error) {
    errors.push(`${rel} — data.toJSON() failed: ${error.message}`);
    continue;
  }

  if (names.has(json.name)) {
    errors.push(`${rel} — duplicate command name "${json.name}", also in ${names.get(json.name)}`);
  }
  names.set(json.name, rel);

  // Optional prefix half: half-declared, and index.js silently never routes it.
  if (command.prefix || command.runPrefix) {
    if (!command.prefix) {
      errors.push(`${rel} — has "runPrefix" but no "prefix" name to route it from`);
    } else if (typeof command.runPrefix !== 'function') {
      errors.push(`${rel} — declares prefix "${command.prefix}" but "runPrefix" is not a function`);
    }

    for (const name of [command.prefix || []].flat()) {
      if (typeof name !== 'string' || !/^\S+$/.test(name)) {
        errors.push(`${rel} — prefix name ${JSON.stringify(name)} must be a whitespace-free string`);
        continue;
      }

      const key = name.toLowerCase();
      if (prefixes.has(key)) {
        errors.push(`${rel} — duplicate prefix name "${key}", also in ${prefixes.get(key)}`);
      }
      prefixes.set(key, rel);
    }
  }
}

if (errors.length > 0) {
  console.error(`\ncheck failed — ${errors.length} problem(s):\n`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error('');
  process.exit(1);
}

const list = [...names.keys()].map((name) => `/${name}`).join(', ');
const prefixList = [...prefixes.keys()].map((name) => `%${name}`).join(', ');

console.log(`check passed — ${files.length} file(s) parsed, ${names.size} command(s) valid: ${list}`);
if (prefixes.size > 0) console.log(`  prefix command(s): ${prefixList}`);
