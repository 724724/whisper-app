// ─── Project ─────────────────────────────────────────────────────────────────

export type ProjectStatus = 'pending' | 'processing' | 'done' | 'error'
export type MediaType = 'audio' | 'video'
export type WhisperModelName = 'tiny' | 'base' | 'small' | 'medium' | 'large-v2' | 'large-v3'

export interface ProjectFolder {
  id: string
  name: string
  createdAt: string
}

export interface Project {
  id: string
  name: string
  originalFileName: string
  mediaType: MediaType
  storedFilePath: string
  status: ProjectStatus
  modelUsed: WhisperModelName | null
  language: string | null
  createdAt: string
  updatedAt: string
  transcriptId: string | null
  durationSeconds: number | null
  folderId: string | null
}

// ─── Transcript ───────────────────────────────────────────────────────────────

export interface TranscriptSegment {
  id: string
  startMs: number
  endMs: number
  text: string
  translatedText: string | null
}

export interface Transcript {
  id: string
  projectId: string
  segments: TranscriptSegment[]
  rawText: string
  targetLanguage: string | null
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  deeplApiKey: string
  deeplApiType: 'free' | 'pro'
  whisperModel: WhisperModelName
  outputLanguage: string
  theme: 'dark' | 'light' | 'system'
  audioDeviceId: string       // '' = system default
  realtimeEnhance: boolean    // lecture EQ + gain boost for realtime transcription
  transcribeLanguage: string  // '' = auto-detect; ISO 639-1 code otherwise (e.g. 'en', 'ko')
}

// ─── Backend / IPC payloads ───────────────────────────────────────────────────

export interface BackendStatus {
  phase: 'checking' | 'installing' | 'starting' | 'ready' | 'error'
  message: string
  progress?: number
}

export interface ImportFileResult {
  success: boolean
  project?: Project
  error?: string
}

export interface TranslateResult {
  success: boolean
  translatedSegments?: { id: string; translatedText: string }[]
  error?: string
}

// ─── electron-store schema ────────────────────────────────────────────────────

export interface StoreSchema {
  projects: Project[]
  transcripts: Record<string, Transcript>
  settings: AppSettings
  folders: ProjectFolder[]
}
