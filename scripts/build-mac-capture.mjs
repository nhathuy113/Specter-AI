import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
for (const [arch, goarch] of [['x64', 'amd64'], ['arm64', 'arm64']]) {
  const result = spawnSync('go', ['build', '-o', resolve(root, `capture/bin/specter-capture-${arch}`), '.'], {
    cwd: resolve(root, 'capture'), env: { ...process.env, GOOS: 'darwin', GOARCH: goarch, CGO_ENABLED: '0' }, stdio: 'inherit'
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status || 1)
}
