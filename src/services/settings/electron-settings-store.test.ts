import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ userData: '', construct: vi.fn(), migrate: vi.fn() }))
vi.mock('electron', () => ({ app: { getPath: () => native.userData } }))
vi.mock('electron-store', () => ({ default: class { constructor() { return native.construct() } } }))
vi.mock('./settings-migrations', () => ({ migrateSettings: native.migrate }))

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  native.userData = mkdtempSync(join(tmpdir(), 'specter-settings-test-'))
})
afterEach(() => rmSync(native.userData, { recursive: true, force: true }))

describe('Electron settings recovery', () => {
  it('preserves the failed configuration byte for byte before loading defaults', async () => {
    const original = Buffer.from([0, 1, 255, 3])
    const recovered = { get: vi.fn(), set: vi.fn(), clear: vi.fn() }
    writeFileSync(join(native.userData, 'specter-settings.json'), original)
    native.construct.mockImplementationOnce(() => { throw new Error('corrupt') }).mockReturnValue(recovered)
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { getStore } = await import('./electron-settings-store')
      expect(getStore()).toBe(recovered)
      const backups = readdirSync(native.userData).filter(name => name.endsWith('.bak'))
      expect(backups).toHaveLength(1)
      expect(readFileSync(join(native.userData, backups[0]))).toEqual(original)
      expect(native.migrate).toHaveBeenCalledWith(recovered)
    } finally { warning.mockRestore() }
  })

  it('leaves valid configuration untouched if migration fails', async () => {
    const path = join(native.userData, 'specter-settings.json')
    writeFileSync(path, 'original settings')
    native.construct.mockReturnValue({})
    native.migrate.mockImplementation(() => { throw new Error('migration error') })
    const { getStore } = await import('./electron-settings-store')
    expect(() => getStore()).toThrow('migration error')
    expect(readFileSync(path, 'utf8')).toBe('original settings')
    expect(readdirSync(native.userData)).toEqual(['specter-settings.json'])
    expect(native.construct).toHaveBeenCalledOnce()
  })

  it('propagates load errors when no configuration exists instead of retrying blindly', async () => {
    native.construct.mockImplementation(() => { throw new Error('permission denied') })
    const { getStore } = await import('./electron-settings-store')
    expect(() => getStore()).toThrow('permission denied')
    expect(native.construct).toHaveBeenCalledOnce()
    expect(native.migrate).not.toHaveBeenCalled()
  })
})
