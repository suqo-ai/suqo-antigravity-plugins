# suqo-antigravity-plugins

An Antigravity plugin providing [SUQO](https://github.com/suqo-ai)'s SDK-usage skills — automatically kept in sync with [`suqo-ai/suqo-claude-plugins`](https://github.com/suqo-ai/suqo-claude-plugins), the source of truth.

This repo isn't hand-written. Its content is generated from the Claude plugin using Antigravity's own first-party importer; see [How this stays in sync](#how-this-stays-in-sync) below.

## Install

Requires the [Antigravity CLI](https://antigravity.google) (`agy`) installed first:

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Then install straight from GitHub — no clone needed:

```bash
agy plugin install https://github.com/suqo-ai/suqo-antigravity-plugins
```

That's it. Confirm it registered:

```bash
agy plugin list
```

```json
{
  "imports": [
    {
      "name": "suqo-antigravity-plugins",
      "source": "antigravity",
      "components": ["skills"]
    }
  ]
}
```

Once installed, Antigravity has the SUQO PHP and TypeScript SDK usage skills built in — correct method signatures, common pitfalls, and webhook-handling patterns, without needing to explain any of it per session.

### Installing from a local clone

Useful if you're changing the plugin and want to test before pushing:

```bash
git clone https://github.com/suqo-ai/suqo-antigravity-plugins.git
agy plugin install ./suqo-antigravity-plugins
```

### Other commands

```bash
agy plugin validate ./suqo-antigravity-plugins   # check a local copy before installing
agy plugin uninstall suqo-antigravity-plugins    # remove
```

> **Note:** if the path to your clone contains spaces, quote it:
> `agy plugin install "/path/with spaces/suqo-antigravity-plugins"`

## What's included

| Skill | Covers |
|---|---|
| `php-sdk-usage` | The SUQO PHP SDK (`suqo/suqo-php`, namespace `Suqo\`) — products, subscriptions, billing cycles, paging, webhook verification, and wiring the client into Laravel, Symfony, Slim or plain PHP. |
| `ts-sdk-usage` | The SUQO TypeScript SDK (`@suqo/sdk`) — products, customers, subscriptions, paging, webhook verification, and wiring the client into Express, Fastify, Next.js or plain Node. |

Both ship reference docs and runnable templates, including the raw-body rule that most broken webhook handlers get wrong.

## Structure

```
suqo-antigravity-plugins/
  plugin.json                    # plugin manifest
  skills/
    php-sdk-usage/               # SUQO PHP SDK skill
    ts-sdk-usage/                # SUQO TypeScript SDK skill
  tools/                         # rename step used when regenerating - see below
  .github/workflows/             # CI that verifies the above stays in sync - see below
  .source-sync                   # the suqo-claude-plugins commit this repo was last synced from
```

## How this stays in sync

Unlike the [Codex](https://github.com/suqo-ai/suqo-codex-plugins) and [Cursor](https://github.com/suqo-ai/suqo-cursor-plugins) ports, this repo runs no third-party converter and no manifest-reconciling scripts of its own. Antigravity's official importer does the whole job:

1. **`agy plugin import`** (first-party) reads the source `.claude-plugin/plugin.json` and copies `skills/` verbatim. Claude's `SKILL.md` / `references/` / `templates/` layout already matches Antigravity's own `skills/` format, so no restructuring is needed.
2. **`tools/rename-plugin-manifest.mjs`** is the one step of our own. `agy plugin import` always names the imported plugin after its source (`suqo-claude-plugins`) and offers no rename flag, so this renames it to match this repo's identity — in the pipeline, rather than by hand-editing the committed manifest.
3. Every regeneration is verified with a real `agy plugin install` before being committed.

### CI

- **`.github/workflows/verify-sync.yml`** — on every PR: runs `tools/*.test.mjs`, then re-runs the import above against `suqo-claude-plugins` pinned to the commit recorded in `.source-sync`, and fails if the result doesn't match what's committed.
- **`.github/workflows/check-source-drift.yml`** — weekly: checks whether `suqo-claude-plugins` has moved past `.source-sync`, and opens a GitHub issue if so. Doesn't block anything — a human decides when to re-sync.

### Manually re-syncing

```bash
agy plugin import <path-to-suqo-claude-plugins>
node tools/rename-plugin-manifest.mjs \
  ~/.gemini/config/plugins/suqo-claude-plugins/plugin.json \
  suqo-antigravity-plugins
```

The importer copies the source tree wholesale into `~/.gemini/config/plugins/suqo-claude-plugins/`. Copy only `plugin.json` and `skills/` from there into this repo — `.git/`, `.claude/`, `.claude-plugin/`, `LICENSE` and `README.md` are either Claude-specific or redundant with this repo's own. Then verify with a real `agy plugin install` and update `.source-sync` to the commit you imported from.

> **Note:** `agy` has no supported way to pin a version — the installer's manifest URL is hardcoded, with no version argument or env override. CI therefore always runs whatever the installer currently calls latest, unlike the Codex/Cursor ports which pin their converter exactly. If a future `agy` release changes what `plugin import` produces, the sync check can go red for reasons unrelated to any PR's content.

## License

Apache-2.0 (see [LICENSE](LICENSE)). This repo, and the plugin it ships, have zero dependencies — `tools/` uses only Node's built-ins.
