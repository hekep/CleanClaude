import { expect, mock, test } from 'claude-code/testing'

const MARK = '[/clean]'
const engineSummary = { messages: [{ role: 'user' as const, text: 'ENGINE SUMMARY', toolUses: [] }] }

test('the marked compaction is answered with one line; the engine summarizer is never reached', async ($, on) => {
  let engineSaw = ''
  // Beneath the plugin: the engine's summarizer. It must not run for a marked compaction.
  on('session.compact', (_, e) => {
    engineSaw = e.instructions ?? ''
    return engineSummary
  })

  const r = await $.session.compact({ instructions: `${MARK} Discard everything.` })
  expect(r.skip).toBeUndefined()
  expect(r.messages?.length).toBe(1)
  expect(r.messages?.[0]?.role).toBe('user')
  expect(r.messages?.[0]?.text).toMatch(/^Context was cleaned on purpose with \/clean/)
  expect(engineSaw).toBe('')

  const withNote = await $.session.compact({ instructions: `${MARK} Discard everything.\nread Docs/SessionNotes.md first` })
  expect(withNote.messages?.[0]?.text).toMatch(/The person's note for the fresh start: read Docs\/SessionNotes.md first$/)
  expect(engineSaw).toBe('')
})

test("another plugin's or the person's compaction is left to the engine", async ($, on) => {
  let engineSaw = ''
  on('session.compact', (_, e) => {
    engineSaw = e.instructions ?? ''
    return engineSummary
  })
  const r = await $.session.compact({ instructions: 'keep the plan' })
  expect(r.skip).toBeUndefined()
  expect(r.messages?.[0]?.text).toBe('ENGINE SUMMARY')
  expect(engineSaw).toBe('keep the plan')
})

test('/clean answers at once and then runs the built-in /compact with the marked instruction', async ($, on) => {
  const clock = mock.clock(on)
  const toasts: string[] = []
  const compactRuns: string[] = []
  on('command.register', () => ({ value: { command: 'clean' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  // Stands for the engine's /compact command (the kit refuses a real compaction from here).
  on('command.run', { command: 'compact' }, (_, e) => {
    compactRuns.push(e.args)
    return { text: 'Compacted' }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const out = await $.command.run({ command: 'clean', args: 'read Docs/SessionNotes.md first' })
  expect(out.text).toBe('Cleaning the context; the note for the fresh start: read Docs/SessionNotes.md first')
  expect(compactRuns).toEqual([])

  await clock.advance(100)
  expect(compactRuns.length).toBe(1)
  expect(compactRuns[0]).toMatch(/^\[\/clean\] Discard everything\./)
  expect(compactRuns[0]).toMatch(/\nread Docs\/SessionNotes.md first$/)
  // The stand-in /compact ran no compaction, so the toast reports the fallback wording.
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toMatch(/^Context compacted by the engine's summarizer/)
})
