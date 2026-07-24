import { describe, expect, it } from 'vitest'
import { detectGame, isGameStillForeground, slugifyGameId } from './game-mode'

describe('game-mode', () => {
  it('detects HOI4', () => {
    const g = detectGame('hoi4', 'Hearts of Iron IV')
    expect(g?.profile.id).toBe('hoi4')
  })

  it('rejects Chrome browser', () => {
    expect(detectGame('Google Chrome', 'YouTube')).toBeNull()
  })

  it('rejects Cursor IDE', () => {
    expect(detectGame('Cursor', 'App.tsx')).toBeNull()
  })

  it('rejects Steam client and helper', () => {
    expect(detectGame('steam', 'Steam')).toBeNull()
    expect(detectGame('Steam Helper', 'Steam')).toBeNull()
  })

  it('generic game for unknown non-denylisted app', () => {
    const g = detectGame('Stellaris', 'Stellaris')
    expect(g?.profile.id).toBe('stellaris')
  })

  it('slugifies custom game id', () => {
    expect(slugifyGameId('My Cool Game')).toBe('my-cool-game')
  })

  it('foreground check pauses on alt-tab unless watchWhileBackground', () => {
    const session = detectGame('hoi4', 'Hearts of Iron IV')!
    expect(isGameStillForeground(session, 'Google Chrome', 'Tab')).toBe(false)
    expect(isGameStillForeground(session, 'hoi4', 'Hearts of Iron IV')).toBe(true)
  })
})
