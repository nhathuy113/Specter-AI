import { execFileSync } from 'child_process'
import { resolve } from 'path'
import { expect, it } from 'vitest'

it('Python DeepSeek parser retains complete replies and excludes previous turns', () => {
  expect(() => execFileSync('python3', ['-B', '-m', 'unittest', 'discover', '-s', 'scripts', '-p', 'test_deepseek_reply.py'], {
    cwd: resolve(__dirname, '../../..'), stdio: 'pipe'
  })).not.toThrow()
})
