import { beforeEach, describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({ isEncryptionAvailable: vi.fn(), encryptString: vi.fn(), decryptString: vi.fn() }))
vi.mock('electron', () => ({ safeStorage: storage }))
import { nativeSecretCodec } from './secret-storage'

beforeEach(() => {
  vi.resetAllMocks()
  storage.isEncryptionAvailable.mockReturnValue(true)
})

describe('native secret storage', () => {
  it('round trips safeStorage buffers through base64', () => {
    const bytes = Buffer.from([1, 2, 3])
    storage.encryptString.mockReturnValue(bytes)
    storage.decryptString.mockReturnValue('key')
    expect(nativeSecretCodec.encrypt('key')).toBe(bytes.toString('base64'))
    expect(nativeSecretCodec.decrypt(bytes.toString('base64'))).toBe('key')
    expect(storage.decryptString).toHaveBeenCalledWith(bytes)
  })

  it('retains legacy plaintext when decryption fails or encryption is unavailable', () => {
    storage.decryptString.mockImplementation(() => { throw new Error('legacy plaintext') })
    expect(nativeSecretCodec.decrypt('legacy-key')).toBe('legacy-key')
    storage.isEncryptionAvailable.mockReturnValue(false)
    expect(nativeSecretCodec.encrypt('key')).toBe('key')
    expect(nativeSecretCodec.decrypt('key')).toBe('key')
    expect(nativeSecretCodec.encrypt('')).toBe('')
    expect(nativeSecretCodec.decrypt('')).toBe('')
  })
})
