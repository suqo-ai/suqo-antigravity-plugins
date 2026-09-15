import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTempDir, writeJson, readJson, readText, runScript } from './test-utils.mjs';

const SCRIPT = join(fileURLToPath(new URL('.', import.meta.url)), 'rename-plugin-manifest.mjs');

test('renames the plugin regardless of what agy import called it', () => {
  const { dir, cleanup } = makeTempDir('rename-plugin-');
  try {
    const manifestPath = join(dir, 'plugin.json');
    writeJson(manifestPath, {
      name: 'suqo-claude-plugins',
      version: '0.4.0',
      description: 'Claude skills for building apps with the SUQO SDKs.',
      author: 'SUQO AI',
    });

    runScript(SCRIPT, [manifestPath, 'suqo-antigravity-plugins']);
    const result = readJson(manifestPath);

    assert.equal(result.name, 'suqo-antigravity-plugins');
  } finally {
    cleanup();
  }
});

test('leaves every other field untouched', () => {
  const { dir, cleanup } = makeTempDir('rename-plugin-');
  try {
    const manifestPath = join(dir, 'plugin.json');
    writeJson(manifestPath, {
      author: 'SUQO AI',
      description: 'Claude skills for building apps with the SUQO SDKs.',
      name: 'suqo-claude-plugins',
      version: '0.4.0',
    });

    runScript(SCRIPT, [manifestPath, 'suqo-antigravity-plugins']);
    const result = readJson(manifestPath);

    assert.equal(result.author, 'SUQO AI');
    assert.equal(result.description, 'Claude skills for building apps with the SUQO SDKs.');
    assert.equal(result.version, '0.4.0');
  } finally {
    cleanup();
  }
});

test('is a no-op (but still normalizes the trailing newline) when the name already matches', () => {
  const { dir, cleanup } = makeTempDir('rename-plugin-');
  try {
    const manifestPath = join(dir, 'plugin.json');
    writeJson(manifestPath, { name: 'suqo-antigravity-plugins', version: '0.4.0' });

    const { stdout } = runScript(SCRIPT, [manifestPath, 'suqo-antigravity-plugins']);

    assert.match(stdout, /no change needed/);
    const result = readJson(manifestPath);
    assert.equal(result.name, 'suqo-antigravity-plugins');
  } finally {
    cleanup();
  }
});

test('writes exactly one trailing newline', () => {
  const { dir, cleanup } = makeTempDir('rename-plugin-');
  try {
    const manifestPath = join(dir, 'plugin.json');
    writeJson(manifestPath, { name: 'suqo-claude-plugins' });

    runScript(SCRIPT, [manifestPath, 'suqo-antigravity-plugins']);
    const text = readText(manifestPath);

    assert.ok(text.endsWith('\n'));
    assert.ok(!text.endsWith('\n\n'));
  } finally {
    cleanup();
  }
});

test('exits non-zero with a usage message when arguments are missing', () => {
  assert.throws(() => runScript(SCRIPT, []), (err) => {
    assert.equal(err.status, 1);
    assert.match(err.stderr.toString(), /Usage: node tools\/rename-plugin-manifest\.mjs/);
    return true;
  });
});
