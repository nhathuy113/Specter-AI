export function createTranscriptBuffer() {
  let text = ''
  return {
    append(value: string, maxLength = 5000): void {
      const sanitized = value.replace(/[^\x20-\x7E\u00A0-\uFFFF\n\r\t]/g, '')
      const limit = Number.isFinite(maxLength) ? Math.max(0, Math.floor(maxLength)) : 5000
      text = limit > 0 ? (text + ' ' + sanitized).slice(-limit) : ''
    },
    get(): string { return text.trim() },
    clear(): void { text = '' }
  }
}
