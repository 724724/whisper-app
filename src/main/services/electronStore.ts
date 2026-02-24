import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import type { StoreSchema, AppSettings } from '../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  deeplApiKey: '',
  deeplApiType: 'free',
  whisperModel: 'base',
  outputLanguage: 'KO',
  theme: 'dark'
}

function getStorePath(): string {
  const userDataPath = app.getPath('userData')
  mkdirSync(userDataPath, { recursive: true })
  return join(userDataPath, 'store.json')
}

function readStore(): StoreSchema {
  try {
    const filePath = getStorePath()
    if (!existsSync(filePath)) {
      return { projects: [], transcripts: {}, settings: { ...DEFAULT_SETTINGS } }
    }
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as Partial<StoreSchema>
    return {
      projects: parsed.projects ?? [],
      transcripts: parsed.transcripts ?? {},
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) }
    }
  } catch {
    return { projects: [], transcripts: {}, settings: { ...DEFAULT_SETTINGS } }
  }
}

function writeStore(data: StoreSchema): void {
  writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf-8')
}

export const store = {
  get<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
    return readStore()[key]
  },
  set<K extends keyof StoreSchema>(key: K, value: StoreSchema[K]): void {
    const data = readStore()
    data[key] = value
    writeStore(data)
  }
}
