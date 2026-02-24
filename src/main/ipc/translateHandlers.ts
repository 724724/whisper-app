import { ipcMain } from 'electron'
import { store } from '../services/electronStore'
import type { Transcript, TranslateResult, TranscriptSegment } from '../../shared/types'

interface DeepLTranslateParams {
  transcriptId: string
  targetLang: string
  segmentId?: string
  // Fallback: segments passed directly from renderer when transcript isn't saved to store yet
  segments?: TranscriptSegment[]
}

async function callDeepL(text: string, targetLang: string, apiKey: string, apiType: 'free' | 'pro'): Promise<string> {
  const baseUrl = apiType === 'free' ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
  const res = await fetch(`${baseUrl}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: [text], target_lang: targetLang }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DeepL API error ${res.status}: ${body}`)
  }
  const data = (await res.json()) as { translations: { text: string }[] }
  return data.translations[0].text
}

function resolveTranscript(params: DeepLTranslateParams): Transcript | null {
  // Try persistent store first
  const transcripts = store.get('transcripts')
  if (transcripts[params.transcriptId]) return transcripts[params.transcriptId]

  // Fallback: reconstruct from segments sent by the renderer (e.g. not yet saved)
  if (params.segments && params.segments.length > 0) {
    return {
      id: params.transcriptId,
      projectId: '',
      segments: params.segments,
      rawText: params.segments.map((s) => s.text).join(' '),
      targetLanguage: null,
    }
  }

  return null
}

export function registerTranslateHandlers(): void {
  ipcMain.handle('translate:full', async (_event, params: DeepLTranslateParams): Promise<TranslateResult> => {
    try {
      const settings = store.get('settings')
      if (!settings.deeplApiKey) {
        return { success: false, error: 'DeepL API 키가 설정되지 않았습니다.' }
      }

      const transcript = resolveTranscript(params)
      if (!transcript) return { success: false, error: 'Transcript not found' }

      const texts = transcript.segments.map((s) => s.text)
      const combined = texts.join('\n')
      const translated = await callDeepL(combined, params.targetLang, settings.deeplApiKey, settings.deeplApiType)
      const translatedLines = translated.split('\n')

      const translatedSegments = transcript.segments.map((seg, i) => ({
        id: seg.id,
        translatedText: translatedLines[i] ?? '',
      }))

      // Persist only if the transcript exists in the store
      const transcripts = store.get('transcripts')
      if (transcripts[params.transcriptId]) {
        transcripts[params.transcriptId].segments = transcript.segments.map((seg, i) => ({
          ...seg,
          translatedText: translatedLines[i] ?? '',
        }))
        transcripts[params.transcriptId].targetLanguage = params.targetLang
        store.set('transcripts', transcripts)
      }

      return { success: true, translatedSegments }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('translate:segment', async (_event, params: DeepLTranslateParams): Promise<TranslateResult> => {
    try {
      const settings = store.get('settings')
      if (!settings.deeplApiKey) {
        return { success: false, error: 'DeepL API 키가 설정되지 않았습니다.' }
      }

      const transcript = resolveTranscript(params)
      if (!transcript) return { success: false, error: 'Transcript not found' }

      const segment = transcript.segments.find((s) => s.id === params.segmentId)
      if (!segment) return { success: false, error: 'Segment not found' }

      const translated = await callDeepL(segment.text, params.targetLang, settings.deeplApiKey, settings.deeplApiType)

      // Persist only if in store
      const transcripts = store.get('transcripts')
      if (transcripts[params.transcriptId]) {
        const seg = transcripts[params.transcriptId].segments.find((s) => s.id === params.segmentId)
        if (seg) {
          seg.translatedText = translated
          transcripts[params.transcriptId].targetLanguage = params.targetLang
          store.set('transcripts', transcripts)
        }
      }

      return { success: true, translatedSegments: [{ id: segment.id, translatedText: translated }] }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
