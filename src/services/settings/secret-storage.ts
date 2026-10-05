import { safeStorage } from 'electron'

function encryptSensitive(value: string): string {
  if (!value) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(value)
      return encrypted.toString('base64')
    }
  } catch (err) {
    console.warn('[Specter] safeStorage encryption unavailable, storing as-is:', err)
  }
  // Fallback: store raw (better than crashing; logs a warning)
  return value
}

function decryptSensitive(stored: string): string {
  if (!stored) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const buffer = Buffer.from(stored, 'base64')
      return safeStorage.decryptString(buffer)
    }
  } catch {
    // If decryption fails, the value was likely stored unencrypted (pre-migration)
    // Return as-is so the user doesn't lose their key
  }
  return stored
}

export const nativeSecretCodec = { encrypt: encryptSensitive, decrypt: decryptSensitive }
