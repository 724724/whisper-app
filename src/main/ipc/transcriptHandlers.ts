import { ipcMain } from 'electron'
import { store } from '../services/electronStore'
import type { Transcript } from '../../shared/types'

export function registerTranscriptHandlers(): void {
  ipcMain.handle('transcript:get', (_event, { transcriptId }: { transcriptId: string }) => {
    const transcripts = store.get('transcripts')
    return transcripts[transcriptId] ?? null
  })

  ipcMain.handle('transcript:save', (_event, transcript: Transcript) => {
    try {
      const transcripts = store.get('transcripts')
      transcripts[transcript.id] = transcript
      store.set('transcripts', transcripts)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
