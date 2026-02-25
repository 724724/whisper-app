import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  Project,
  Transcript,
  TranscriptSegment,
  AppSettings,
  BackendStatus,
  ImportFileResult,
  TranslateResult
} from '../shared/types'

const api = {
  // ─── File ────────────────────────────────────────────────────────────────
  openFileDialog: (): Promise<{ canceled: boolean; filePaths: string[] }> =>
    ipcRenderer.invoke('file:open-dialog'),

  importFile: (params: { filePath: string; name?: string }): Promise<ImportFileResult> =>
    ipcRenderer.invoke('file:import', params),

  getMediaUrl: (params: { storedFilePath: string }): Promise<{ url: string }> =>
    ipcRenderer.invoke('file:get-media-url', params),

  exportTranscript: (params: {
    segments: TranscriptSegment[]
    projectName: string
    format: 'txt' | 'srt' | 'csv'
    hasTranslation: boolean
  }): Promise<{ success: boolean; path?: string }> =>
    ipcRenderer.invoke('file:export-transcript', params),

  // ─── Projects ────────────────────────────────────────────────────────────
  listProjects: (): Promise<Project[]> => ipcRenderer.invoke('project:list'),

  getProject: (params: { projectId: string }): Promise<Project | null> =>
    ipcRenderer.invoke('project:get', params),

  updateProject: (updates: Partial<Project> & { id: string }): Promise<Project> =>
    ipcRenderer.invoke('project:update', updates),

  deleteProject: (params: { projectId: string }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('project:delete', params),

  // ─── Transcripts ─────────────────────────────────────────────────────────
  getTranscript: (params: { transcriptId: string }): Promise<Transcript | null> =>
    ipcRenderer.invoke('transcript:get', params),

  saveTranscript: (transcript: Transcript): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('transcript:save', transcript),

  // ─── Translation ─────────────────────────────────────────────────────────
  translateFull: (params: {
    transcriptId: string
    targetLang: string
    segments?: TranscriptSegment[]
  }): Promise<TranslateResult> => ipcRenderer.invoke('translate:full', params),

  translateSegment: (params: {
    transcriptId: string
    segmentId: string
    targetLang: string
    segments?: TranscriptSegment[]
  }): Promise<TranslateResult> => ipcRenderer.invoke('translate:segment', params),

  onTranslateProgress: (
    callback: (data: {
      success: boolean
      translatedSegments: { id: string; translatedText: string }[]
      progress: { current: number; total: number }
    }) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: any): void => callback(data)
    ipcRenderer.on('translate:progress', handler)
    return () => ipcRenderer.removeListener('translate:progress', handler)
  },

  // ─── Settings ────────────────────────────────────────────────────────────
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),

  setSettings: (updates: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', updates),

  // ─── Backend status ───────────────────────────────────────────────────────
  onBackendStatus: (callback: (status: BackendStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: BackendStatus): void =>
      callback(status)
    ipcRenderer.on('backend:status', handler)
    return () => ipcRenderer.removeListener('backend:status', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
