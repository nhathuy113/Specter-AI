import Store from 'electron-store'
import { app } from 'electron'
import { existsSync, renameSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { settingsSchema } from './settings-schema'
import { migrateSettings } from './settings-migrations'
import { createLazySettingsStore } from './lazy-settings-store'

function loadStore() {
  return new Store({ name: 'specter-settings', schema: settingsSchema })
}

export const getStore = createLazySettingsStore<ReturnType<typeof loadStore>>({
  load: loadStore,
  recover(error) {
    const configPath = join(app.getPath('userData'), 'specter-settings.json')
    if (!existsSync(configPath)) throw error
    const backupPath = `${configPath}.corrupt-${randomUUID()}.bak`
    renameSync(configPath, backupPath)
    console.warn(`[Specter] Could not load settings; preserved original at ${backupPath}:`, error)
    return loadStore()
  },
  migrate: migrateSettings
})
