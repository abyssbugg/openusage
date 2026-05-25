# Usage
Menu bar app for tracking AI subscription usage across providers.

Usage shows provider limits, usage, remaining quota, reset times, and a local HTTP API from one lightweight macOS app.

![Usage screenshot](screenshot.png)

## Download
[Download the latest release](https://github.com/datamatics/usage-meter/releases/latest) for macOS.

The app can auto-update from GitHub releases after it is installed. Local source changes still require a new build and reinstall.

## Features
- Menu bar usage overview
- Provider detail pages
- Used and remaining quota shown together
- Auto refresh with configurable interval
- Global shortcut
- Start on login
- Light and dark themes
- Local HTTP API on `127.0.0.1:6736`
- Bundled provider plugins
- Optional provider HTTP proxy support

## Supported Providers
- [Amp](docs/providers/amp.md) / free tier, bonus, credits
- [Antigravity](docs/providers/antigravity.md) / all models
- [Claude](docs/providers/claude.md) / session, weekly, peak/off-peak, extra usage, local token usage
- [Codex](docs/providers/codex.md) / session, weekly, reviews, credits
- [Copilot](docs/providers/copilot.md) / premium, chat, completions
- [Cursor](docs/providers/cursor.md) / credits, total usage, auto usage, API usage, on-demand, CLI auth
- [Factory / Droid](docs/providers/factory.md) / extra usage, 5h/weekly/monthly limits, Droid Core, managed computers, legacy tokens
- [Gemini](docs/providers/gemini.md) / pro, flash, workspace/free/paid tier
- [JetBrains AI Assistant](docs/providers/jetbrains-ai-assistant.md) / quota, remaining
- [Kiro](docs/providers/kiro.md) / credits, bonus credits, overages
- [Kimi Code](docs/providers/kimi.md) / session, weekly
- [MiniMax](docs/providers/minimax.md) / coding plan session
- [OpenCode Go](docs/providers/opencode-go.md) / 5h, weekly, monthly spend limits
- [Perplexity](docs/providers/perplexity.md) / account limits from the desktop app
- [Rovo Dev](docs/providers/rovo-dev.md) / monthly credits
- [Warp](docs/providers/warp.md) / requests
- [Windsurf](docs/providers/windsurf.md) / prompt credits, flex credits
- [Z.ai](docs/providers/zai.md) / session, weekly, web searches

Request a provider or report an issue at https://github.com/datamatics/usage-meter/issues.

## Local HTTP API
Usage exposes read-only usage data at `http://127.0.0.1:6736`.

See [docs/local-http-api.md](docs/local-http-api.md).

## Proxy Support
Provider HTTP requests can be routed through a SOCKS5 or HTTP proxy.

See [docs/proxy.md](docs/proxy.md).

## Development
Requirements:
- macOS
- Bun
- Rust
- Tauri prerequisites

Install dependencies:

    bun install

Run tests:

    bun run test --run

Build the web app:

    bun run build

Build the macOS app:

    bun run tauri build

Bundle plugins after plugin changes:

    bun run bundle:plugins

## Project Structure
- `src/` frontend app
- `src-tauri/` Tauri/Rust host
- `plugins/` bundled provider plugins
- `docs/providers/` provider documentation
- `docs/plugins/` plugin API documentation
- `.github/` GitHub templates and workflows

## Contributing
- Keep changes small.
- Add tests for bugs and plugin changes.
- Update provider docs when behavior changes.
- Do not commit generated build outputs.
- Use provider brand colors and `currentColor` SVG icons for plugins.

## Credits
Inspired by [CodexBar](https://github.com/steipete/CodexBar).

## License
[MIT](LICENSE)
