import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * Prod capture must stay on the Specter AI Electron app.
 * The node Electron shim and screencapture helper fail under launchd.
 */
const root = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf-8')

describe('prod capture anti-degrade gate', () => {
  it('launches the branded Electron app instead of the node shim', () => {
    const launch = read('scripts/prod-launch.sh')
    expect(launch).toContain('/usr/sbin:/sbin')
    expect(launch).toContain('CFBundleName Specter AI')
    expect(launch).toContain('CFBundleIdentifier com.specter.ai')
    expect(launch).toContain('exec "$branded_app/Contents/MacOS/Electron"')
    expect(launch).not.toContain('electron-vite preview')
  })

  it('names the launchd background item Specter AI', () => {
    const install = read('scripts/install-prod-launchd.sh')
    expect(install).toContain('AssociatedBundleIdentifiers')
    expect(install).toContain('com.specter.ai')
    expect(install).toContain('Specter AI')
    expect(install).not.toContain('<string>/bin/bash</string>')
  })

  it('captures through Electron instead of screencapture or system_profiler', () => {
    const capture = read('src/main/go-capture.ts')
    const screen = read('src/main/screen-capture.ts')
    const main = read('src/main/index.ts')
    expect(capture).toContain('desktopCapturer.getSources')
    expect(capture).not.toContain('screencapture')
    expect(screen).toContain('screenshotIndexForDisplay')
    expect(screen).not.toContain('screenshot.listDisplays')
    expect(main).toContain('app.setName(APP_NAME)')
  })
})
