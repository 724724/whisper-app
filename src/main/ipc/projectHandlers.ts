import { ipcMain } from 'electron'
import { unlink } from 'fs/promises'
import { store } from '../services/electronStore'
import type { Project } from '../../shared/types'

export function registerProjectHandlers(): void {
  ipcMain.handle('project:list', () => {
    return store.get('projects')
  })

  ipcMain.handle('project:get', (_event, { projectId }: { projectId: string }) => {
    const projects = store.get('projects')
    return projects.find((p) => p.id === projectId) ?? null
  })

  ipcMain.handle('project:update', (_event, updates: Partial<Project> & { id: string }) => {
    const projects = store.get('projects')
    const idx = projects.findIndex((p) => p.id === updates.id)
    if (idx === -1) throw new Error('Project not found')
    const updated = { ...projects[idx], ...updates, updatedAt: new Date().toISOString() }
    projects[idx] = updated
    store.set('projects', projects)
    return updated
  })

  ipcMain.handle('project:delete', async (_event, { projectId }: { projectId: string }) => {
    try {
      const projects = store.get('projects')
      const project = projects.find((p) => p.id === projectId)
      if (!project) return { success: false, error: 'Project not found' }

      // Delete stored media file
      try {
        await unlink(project.storedFilePath)
      } catch {
        // File may not exist, ignore
      }

      // Delete transcript if exists
      if (project.transcriptId) {
        const transcripts = store.get('transcripts')
        delete transcripts[project.transcriptId]
        store.set('transcripts', transcripts)
      }

      store.set('projects', projects.filter((p) => p.id !== projectId))
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
