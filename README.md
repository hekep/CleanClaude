# CleanClaude

A Claude Code mod that adds `/clean`: wipe the conversation's context but keep the conversation id and the transcript file.

Made by [Ahco](https://www.ahco.fi), where it keeps a fleet of tmux-driven Claude Code sessions resumable by id.

## Install

```
/plugin install cleanclaude --marketplace hekep/CleanClaude
```

Typed at the prompt of a Claude Code terminal session; answer `y` to add the marketplace, then pick a scope. To run it from a checkout instead: `claude --plugin-dir <this folder>`, or list the folder in `CLAUDE_CODE_PLUGIN_DIRS`.

## Why

`/clear` empties the context but opens a **new** conversation id (measured 2026-11-11, Claude Code 2.1.322). Anything that resumes a session by id (`claude --resume <id>`, a launcher script, a tmux-driven session) then brings back the pre-clear conversation. `/compact` keeps the id but leaves a model-written summary and costs one summarizer request over the whole context.

## How

`/clean` runs the built-in `/compact` with a marked instruction, and this plugin's `session.compact` hook answers that compaction with one message of its own. No summarizer runs, and nothing of the old context survives except that line:

> Context was cleaned on purpose with /clean: nothing from before this line is in context, and nothing from before is wanted. The conversation id and the transcript file are unchanged; the transcript still holds the earlier rows, but do not read them unless the person asks.

`/clean <text>` adds `<text>` after that line as the person's note for the fresh start, for example `/clean read docs/NOTES.md first`.

The command answers at once and the compaction follows a moment later (the engine refuses a compaction from inside a command's own hook). A toast reports whether the plugin's own hook answered (no model call) or the engine's summarizer ran (a build that skips the hook: then the instruction still asks for the one sentence).

Any other compaction (`/compact`, the automatic one, another plugin's) is left to the engine untouched.

## What it touches

Nothing outside the session. The plugin registers one slash command, hooks the session's compaction event and shows one toast. It opens no network connection, reads and writes no files, reads no environment variables or credentials, and keeps no data between sessions. Its whole source is the one module `hooks/register.ts`; `hooks/clean.test.ts` is its test.

## Check

```
claude plugin validate <this folder>
claude plugin test <this folder>
```

## License

MIT, see `LICENSE`. Copyright Ahco, https://www.ahco.fi
