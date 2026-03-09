import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { store } from '../services/electronStore'
import type { ProjectFolder } from '@shared/types'

export function registerFolderHandlers(): void {
  ipcMain.handle('folder:list', () => {
    return store.get('folders')
  })

  ipcMain.handle('folder:create', (_event, { name }: { name: string }) => {
    const folder: ProjectFolder = {
      id: randomUUID(),
      name: name.trim(),
      createdAt: new Date().toISOString()
    }
    const folders = store.get('folders')
    folders.push(folder)
    store.set('folders', folders)
    return folder
  })

  ipcMain.handle('folder:rename', (_event, { folderId, name }: { folderId: string; name: string }) => {
    const folders = store.get('folders')
    const idx = folders.findIndex((f) => f.id === folderId)
    if (idx === -1) throw new Error('Folder not found')
    folders[idx] = { ...folders[idx], name: name.trim() }
    store.set('folders', folders)
    return folders[idx]
  })

  ipcMain.handle('folder:delete', (_event, { folderId }: { folderId: string }) => {
    // Remove folder and unassign any projects that were in it
    const folders = store.get('folders').filter((f) => f.id !== folderId)
    store.set('folders', folders)

    const projects = store.get('projects').map((p) =>
      p.folderId === folderId ? { ...p, folderId: null } : p
    )
    store.set('projects', projects)
    return { success: true }
  })

  ipcMain.handle(
    'project:move-to-folder',
    (_event, { projectIds, folderId }: { projectIds: string[]; folderId: string | null }) => {
      const projects = store.get('projects').map((p) =>
        projectIds.includes(p.id) ? { ...p, folderId } : p
      )
      store.set('projects', projects)
      return { success: true }
    }
  )
}
