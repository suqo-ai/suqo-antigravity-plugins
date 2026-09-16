#!/usr/bin/env node
/**
 * Rename the plugin this repo ships, and reconcile fields `agy plugin
 * import` drops, in the pipeline rather than by hand-editing the
 * committed output.
 *
 * Unlike suqo-codex-plugins/suqo-cursor-plugins, this repo doesn't run
 * `acplugin` - the official `agy plugin import` (Antigravity's first-party
 * Claude importer) does the conversion. But it has its own two gaps,
 * confirmed by reading its actual output against the real source, not
 * assumed:
 *
 * 1. Naming: `agy plugin import` always names the imported plugin after
 *    the source (`suqo-claude-plugins`) - confirmed by reading its usage
 *    (`agy plugin import [source]` takes only a positional source path;
 *    `agy plugin --help` lists no rename/name-override flag anywhere in
 *    the CLI). --rename-to (the second positional, `<new-name>`) fixes
 *    this, as before.
 *
 * 2. Metadata loss: `agy plugin import` reads `description` from the
 *    source's own `.claude-plugin/plugin.json` - which says "Claude
 *    skills for building apps..." - rather than from the cleaner
 *    marketplace-entry description acplugin uses for the Codex/Cursor
 *    ports ("Skills and SDK usage guides..."). It also silently drops
 *    `homepage`/`license`/`keywords` entirely, even though `agy plugin
 *    validate` accepts all three just fine (confirmed empirically - this
 *    is lost metadata, not an Antigravity schema limitation). --source
 *    fixes the dropped fields; --description is a deliberate override
 *    (not a "copy from source" fill) since the source's own wording is
 *    exactly the string this fixes.
 *
 * Usage:
 *   node tools/rename-plugin-manifest.mjs <plugin.json> <new-name> \
 *     [--source <source-plugin.json>] [--description <text>]
 *
 * --source <source-plugin.json>: merges `homepage`, `license`, and
 * `keywords` in from the real source manifest when the target is missing
 * them or they differ. `homepage` (and `repository`/`repository.url`, if
 * ever present) additionally gets the source's own old name rewritten to
 * <new-name> wherever it appears embedded in the URL - the same fix
 * already applied to suqo-codex-plugins/suqo-cursor-plugins.
 *
 * The anchor for that rewrite is `source.name` - deliberately, not this
 * script's own `manifest.name`. An earlier version read it from
 * `manifest.name`, which had already become <new-name> after the first
 * run; on a second run, the rewrite silently no-op'd (it was looking for
 * the wrong string) while the plain source-copy above it kept
 * unconditionally overwriting with the raw, unrenamed value - so the
 * script converged on the wrong homepage and then reported itself clean.
 * Found by review (the exact same class of bug reported and fixed on
 * suqo-codex-plugins/suqo-cursor-plugins), reproduced, fixed:
 * `source.name` never changes between runs, so this script is now a true
 * no-op on a second run against its own output - see the idempotency test.
 *
 * --description <text>: replaces `description` unconditionally with the
 * given text, regardless of what's currently there. Not a "fill a gap"
 * fix like --source's fields above - an explicit override, same shape as
 * --rename-to itself.
 *
 * Writes the renamed manifest back to <plugin.json> in place, with a
 * trailing newline.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const FIELDS_TO_RECONCILE = ['homepage', 'license', 'keywords'];
const KNOWN_FLAGS = new Set(['--source', '--description']);

// Strict on purpose - see the Codex/Cursor reconcile scripts' identical
// rationale: a silently-ignored malformed flag defeats the whole point of
// this living in the pipeline instead of being a hand-edit. Found by
// review: `--source=x` / `--description=x`, a missing value, or a typo'd
// flag name all used to fall through to being silently-ignored positional
// arguments, exit code 0.
function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      if (arg.includes('=')) {
        console.error(`Unsupported "--flag=value" syntax: "${arg}". Use "--flag value" (space-separated).`);
        process.exit(1);
      }
      if (!KNOWN_FLAGS.has(arg)) {
        console.error(`Unrecognized flag: "${arg}".`);
        process.exit(1);
      }
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) {
        console.error(`Flag "${arg}" requires a value.`);
        process.exit(1);
      }
      flags[arg] = value;
    } else {
      positional.push(arg);
    }
  }
  return { positional, sourcePath: flags['--source'], description: flags['--description'] };
}

function main() {
  const { positional, sourcePath, description } = parseArgs(process.argv.slice(2));
  const [manifestPath, newName] = positional;
  if (!manifestPath || !newName) {
    console.error('Usage: node tools/rename-plugin-manifest.mjs <plugin.json> <new-name> [--source <source-plugin.json>] [--description <text>]');
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const changed = [];

  if (manifest.name !== newName) {
    changed.push(`name: ${JSON.stringify(manifest.name)} -> ${JSON.stringify(newName)}`);
    manifest.name = newName;
  }

  if (sourcePath !== undefined) {
    const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
    // source.name, not manifest.name - see the doc comment above.
    const oldName = source.name;
    const rename = (str) => (oldName && str.includes(oldName) ? str.split(oldName).join(newName) : str);

    for (const field of FIELDS_TO_RECONCILE) {
      if (source[field] === undefined) continue;
      let value = source[field];
      if (field === 'homepage' && typeof value === 'string') value = rename(value);
      const before = JSON.stringify(manifest[field]);
      const after = JSON.stringify(value);
      if (before !== after) {
        changed.push(`${field}: ${before ?? '(absent)'} -> ${after}`);
        manifest[field] = value;
      }
    }
    if (manifest.repository !== undefined) {
      if (typeof manifest.repository === 'string') {
        const before = manifest.repository;
        const after = rename(before);
        if (after !== before) {
          manifest.repository = after;
          changed.push(`repository: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
        }
      } else if (typeof manifest.repository === 'object' && typeof manifest.repository.url === 'string') {
        const before = manifest.repository.url;
        const after = rename(before);
        if (after !== before) {
          manifest.repository.url = after;
          changed.push(`repository.url: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
        }
      }
    }
  }

  if (description !== undefined && manifest.description !== description) {
    changed.push(`description: ${JSON.stringify(manifest.description)} -> ${JSON.stringify(description)}`);
    manifest.description = description;
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  if (changed.length === 0) {
    console.log('No fields needed reconciling.');
  } else {
    console.log(`Reconciled ${changed.length} field(s) in ${manifestPath}:`);
    for (const line of changed) console.log(`  - ${line}`);
  }
}

main();
