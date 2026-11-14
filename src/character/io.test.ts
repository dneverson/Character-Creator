import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadCharacter, parseImportedCharacter } from './io'
import { CHARACTER_SCHEMA_VERSION, createCharacter, defaultPlayState } from './model'

describe('parseImportedCharacter', () => {
  it('round-trips an exported character but assigns a fresh id', () => {
    const original = createCharacter('Gimli')
    original.selectedBooks = ['XPHB', 'PHB']
    const parsed = parseImportedCharacter(JSON.stringify(original))
    expect(parsed.name).toBe('Gimli')
    expect(parsed.selectedBooks).toEqual(['XPHB', 'PHB'])
    expect(parsed.id).not.toBe(original.id)
  })

  it('restores a portrait from the file and drops one that is not a picture', () => {
    const portrait = 'data:image/webp;base64,UklGRg=='
    const kept = parseImportedCharacter(
      JSON.stringify({ ...createCharacter('Gimli'), portrait }),
    )
    expect(kept.portrait).toBe(portrait)
    const dropped = parseImportedCharacter(
      JSON.stringify({
        ...createCharacter('Gimli'),
        portrait: 'https://example.com/a.png',
      }),
    )
    expect('portrait' in dropped).toBe(false)
  })

  it('rejects invalid JSON', () => {
    expect(() => parseImportedCharacter('{not json')).toThrow('valid JSON')
  })

  it('fills defaults for a minimal object', () => {
    const parsed = parseImportedCharacter('{}')
    expect(parsed.name).toBe('Imported Character')
    expect(parsed.selectedBooks).toEqual(['PHB', 'MM', 'DMG'])
    // A file with no equipment gets an empty inventory, so the sheet can open it.
    expect(parsed.equipment).toMatchObject({ items: [], starting: {} })
    expect(parsed.equipment.currency).toEqual({ pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 })
  })

  it('rejects a non-object payload', () => {
    expect(() => parseImportedCharacter('42')).toThrow('character object')
  })

  it('completes a file written by an earlier version of the app', () => {
    const parsed = parseImportedCharacter(
      '{"name":"Old Hero","hp":{"tough":true},"rollHistory":{"records":[' +
        '{"id":"r1","stream":"hitDie","at":5,"kind":"hit-die","rolls":[6]}]}}',
    )
    expect(parsed.schemaVersion).toBe(CHARACTER_SCHEMA_VERSION)
    expect(parsed.story.alignment).toBe('')
    expect(parsed.play).toEqual(defaultPlayState())
    expect(parsed.feats.bonusSlots).toHaveLength(1) // the Tough checkbox, as a feat
    expect(parsed.history.map((e) => e.action?.type)).toEqual([
      'roll',
      'tracking-started',
      'imported',
    ])
  })

  it('brings the history along, and adds the import to it', () => {
    const original = createCharacter('Gimli')
    const before = Date.now()
    const parsed = parseImportedCharacter(JSON.stringify(original))

    expect(parsed.history.slice(0, -1)).toEqual(original.history)
    const imported = parsed.history.at(-1)
    expect(imported?.action).toEqual({ type: 'imported', from: original.id })
    expect(imported?.at).toBeGreaterThanOrEqual(before)
    expect(parsed.createdAt).toBe(imported?.at)
  })

  it("takes every entry of a file as the user's own account", () => {
    const original = createCharacter('Gimli')
    original.history.push({ id: 's1', at: 9, by: 'server', changes: [] })
    const parsed = parseImportedCharacter(JSON.stringify(original))
    expect(parsed.history.map((e) => e.by)).toEqual(['device', 'device', 'device'])
  })

  it('does not name a source when the file has no id', () => {
    const parsed = parseImportedCharacter('{"name":"Nameless"}')
    expect(parsed.history.at(-1)?.action).toEqual({ type: 'imported' })
  })
})

describe('downloadCharacter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('creates a blob URL, clicks a sanitized-name link, and revokes the URL', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})

    const character = createCharacter('Théoden, King!')
    downloadCharacter(character)

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
    // The anchor is removed after the click, so nothing leaks into the DOM.
    expect(document.querySelector('a')).toBeNull()

    vi.unstubAllGlobals()
  })

  it('falls back to "character" when the name has no safe characters', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() })
    let captured = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      captured = this.download
    })

    downloadCharacter(createCharacter(''))
    expect(captured).toBe('character.json')

    vi.unstubAllGlobals()
  })
})
