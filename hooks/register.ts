// clean: the /clean command. /clear empties the context but opens a NEW conversation id
// (measured 2026-11-11, Claude Code 2.1.322), which breaks a launcher that resumes the
// session by id. /clean keeps the id and the transcript: it runs the built-in /compact with
// a marked instruction, and this plugin's session.compact hook answers that compaction
// with one message, so no summarizer runs and nothing of the old context survives but
// that one line. `/clean <text>` puts <text> after the line as the person's note for the
// fresh start.
//
// Why /compact and not $.session.compact: the engine runs a plugin's own call through every
// hook but the calling plugin's (measured with `claude plugin test`), so a direct call would
// always end in the engine's summarizer. The person's /compact is nobody's call, so the hook
// below sees it. Where a build still skips the hook, the instruction asks the summarizer for
// the one sentence, and the toast says which of the two happened. The compaction cannot run
// inside the command's own hook (it would compact under the turn the hook holds), so the
// command schedules it on $.clock.after and answers at once.
import type { Register, SessionMessage } from 'claude-code'

const MARK = '[/clean]'
const NOTE =
  'Context was cleaned on purpose with /clean: nothing from before this line is in context, ' +
  'and nothing from before is wanted. The conversation id and the transcript file are unchanged; ' +
  'the transcript still holds the earlier rows, but do not read them unless the person asks.'
const INSTRUCTIONS =
  MARK +
  ' Discard everything. The summary must be exactly one sentence: ' +
  '"Context was cleaned on purpose with /clean." Nothing else.'

let lastCleanAnsweredByPlugin = false

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'clean',
      description: 'Wipe the context but keep the conversation id (a one-line compaction, no model call)',
    })
    return next(e)
  })

  on('command.run', { command: 'clean' }, ($, e) => {
    const note = (e.args ?? '').trim()
    $.clock.after(50, () => {
      void (async () => {
        try {
          lastCleanAnsweredByPlugin = false
          const { text } = await $.command.run({
            command: 'compact',
            args: note ? `${INSTRUCTIONS}\n${note}` : INSTRUCTIONS,
          })
          $.ui.toast(
            lastCleanAnsweredByPlugin
              ? 'Context cleaned: one line left, conversation id unchanged, no model call.'
              : `Context compacted by the engine's summarizer (the plugin's own compaction hook did not run); conversation id unchanged. ${text ?? ''}`.trim(),
            { timeoutMs: 8000 },
          )
        } catch (error) {
          $.ui.toast(`/clean failed: ${error instanceof Error ? error.message : String(error)}`, { timeoutMs: 8000 })
        }
      })()
    })
    return {
      text: note
        ? `Cleaning the context; the note for the fresh start: ${note}`
        : 'Cleaning the context (conversation id unchanged).',
    }
  })

  on('session.compact', ($, e, next) => {
    if (!e.instructions?.startsWith(MARK)) return next(e)
    const note = e.instructions.split('\n').slice(1).join('\n').trim()
    const message: SessionMessage = {
      role: 'user',
      text: note ? `${NOTE}\n\nThe person's note for the fresh start: ${note}` : NOTE,
      toolUses: [],
    }
    lastCleanAnsweredByPlugin = true
    return { messages: [message] }
  })
}
