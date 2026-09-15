#!/usr/bin/env node
/**
 * Rename the plugin this repo ships, in the pipeline rather than by
 * hand-editing the committed output.
 *
 * Unlike suqo-codex-plugins/suqo-cursor-plugins, this repo doesn't run
 * `acplugin` or any reconcile script of ours - the official
 * `agy plugin import` (Antigravity's first-party Claude importer) does the
 * whole conversion correctly by itself, so there's no "fill gaps from
 * source" logic needed here. But like the other two conversion tools,
 * `agy plugin import` always names the imported plugin after the source
 * (`suqo-claude-plugins`) - confirmed by reading its usage (`agy plugin
 * import [source]` takes only a positional source path; `agy plugin --help`
 * lists no rename/name-override flag anywhere in the CLI) - so this script
 * is the one small step this repo needs of its own, run right after import.
 *
 * Usage:
 *   node tools/rename-plugin-manifest.mjs <plugin.json> <new-name>
 *
 * Writes the renamed manifest back to <plugin.json> in place, with a
 * trailing newline. Every other field is left untouched.
 */

import { readFileSync, writeFileSync } from 'node:fs';

function main() {
  const [, , manifestPath, newName] = process.argv;
  if (!manifestPath || !newName) {
    console.error('Usage: node tools/rename-plugin-manifest.mjs <plugin.json> <new-name>');
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const before = manifest.name;
  manifest.name = newName;

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  if (before === newName) {
    console.log(`name was already "${newName}" - no change needed.`);
  } else {
    console.log(`Renamed ${manifestPath}: name: ${JSON.stringify(before)} -> ${JSON.stringify(newName)}`);
  }
}

main();
