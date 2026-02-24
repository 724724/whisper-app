import { ipcMain } from 'electron'
import { store } from '../services/electronStore'
import type { AppSettings } from '../../shared/types'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', () => {
    return store.get('settings')
  })

  ipcMain.handle('settings:set', (_event, updates: Partial<AppSettings>) => {
    const current = store.get('settings')
    const updated = { ...current, ...updates }
    store.set('settings', updated)
    return updated
  })
}
