import { ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { unlink } from 'fs/promises'
import { store } from '../services/electronStore'
import type { Project, Transcript, TranscriptSegment, WhisperModelName } from '@shared/types'

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

  ipcMain.handle(
    'project:save-realtime',
    async (
      _event,
      params: {
        name: string
        segments: TranscriptSegment[]
        language: string | null
        modelUsed: string | null
        targetLanguage: string | null
      }
    ) => {
      try {
        const id = randomUUID()
        const transcriptId = randomUUID()
        const now = new Date().toISOString()

        const project: Project = {
          id,
          name: params.name,
          originalFileName: '실시간 전사',
          mediaType: 'audio',
          storedFilePath: '',
          status: 'done',
          modelUsed: (params.modelUsed as WhisperModelName) ?? null,
          language: params.language,
          createdAt: now,
          updatedAt: now,
          transcriptId,
          durationSeconds: null,
          folderId: null
        }

        const transcript: Transcript = {
          id: transcriptId,
          projectId: id,
          segments: params.segments,
          rawText: params.segments.map((s) => s.text).join('\n'),
          targetLanguage: params.targetLanguage
        }

        const transcripts = store.get('transcripts')
        transcripts[transcriptId] = transcript
        store.set('transcripts', transcripts)

        store.set('projects', [project, ...store.get('projects')])
        return { success: true, project }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

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

      store.set(
        'projects',
        projects.filter((p) => p.id !== projectId)
      )
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
