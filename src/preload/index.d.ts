import type { ElectronAPI } from '@electron-toolkit/preload'
import type {
  Project,
  Transcript,
  TranscriptSegment,
  AppSettings,
  BackendStatus,
  ImportFileResult,
  TranslateResult,
} from '../shared/types'

interface WhisperAPI {
  // File
  openFileDialog(): Promise<{ canceled: boolean; filePaths: string[] }>
  importFile(params: { filePath: string; name?: string }): Promise<ImportFileResult>
  getMediaUrl(params: { storedFilePath: string }): Promise<{ url: string }>
  exportTranscript(params: {
    segments: TranscriptSegment[]
    projectName: string
    format: 'txt' | 'srt' | 'csv'
    hasTranslation: boolean
  }): Promise<{ success: boolean; path?: string }>

  // Projects
  listProjects(): Promise<Project[]>
  getProject(params: { projectId: string }): Promise<Project | null>
  updateProject(updates: Partial<Project> & { id: string }): Promise<Project>
  deleteProject(params: { projectId: string }): Promise<{ success: boolean; error?: string }>

  // Transcripts
  getTranscript(params: { transcriptId: string }): Promise<Transcript | null>
  saveTranscript(transcript: Transcript): Promise<{ success: boolean }>

  // Translation
  translateFull(params: { transcriptId: string; targetLang: string; segments?: TranscriptSegment[] }): Promise<TranslateResult>
  translateSegment(params: { transcriptId: string; segmentId: string; targetLang: string; segments?: TranscriptSegment[] }): Promise<TranslateResult>

  // Settings
  getSettings(): Promise<AppSettings>
  setSettings(updates: Partial<AppSettings>): Promise<AppSettings>

  // Backend status
  onBackendStatus(callback: (status: BackendStatus) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: WhisperAPI
  }
}
