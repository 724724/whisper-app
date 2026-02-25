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

async function callDeepL(
  text: string | string[],
  targetLang: string,
  apiKey: string,
  apiType: 'free' | 'pro'
): Promise<string[]> {
  const baseUrl = apiType === 'free' ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
  const textArray = Array.isArray(text) ? text : [text]
  const res = await fetch(`${baseUrl}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: textArray, target_lang: targetLang })
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`DeepL API error ${res.status}: ${body}`)
  }
  const data = (await res.json()) as { translations: { text: string }[] }
  return data.translations.map((t) => t.text)
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
      targetLanguage: null
    }
  }

  return null
}

export function registerTranslateHandlers(): void {
  ipcMain.handle(
    'translate:full',
    async (event, params: DeepLTranslateParams): Promise<TranslateResult> => {
      try {
        const settings = store.get('settings')
        if (!settings.deeplApiKey) {
          return { success: false, error: 'DeepL API 키가 설정되지 않았습니다.' }
        }

        const transcript = resolveTranscript(params)
        if (!transcript) return { success: false, error: 'Transcript not found' }

        const batchSize = 50
        let totalTranslatedSegments: { id: string; translatedText: string }[] = []

        const transcripts = store.get('transcripts')
        const persist = !!transcripts[params.transcriptId]

        for (let i = 0; i < transcript.segments.length; i += batchSize) {
          const batch = transcript.segments.slice(i, i + batchSize)
          // Filter out explicitly empty text (DeepL omits them from the response array)
          const validIndices: number[] = []
          const textsToTranslate: string[] = []

          batch.forEach((s, idx) => {
            if (s.text.trim()) {
              validIndices.push(idx)
              textsToTranslate.push(s.text)
            }
          })

          let translatedTextArray: string[] = []
          if (textsToTranslate.length > 0) {
            translatedTextArray = await callDeepL(
              textsToTranslate,
              params.targetLang,
              settings.deeplApiKey,
              settings.deeplApiType
            )
          }

          const translatedSegments = batch.map((seg, j) => {
            const mappedIdx = validIndices.indexOf(j)
            const translatedText = mappedIdx !== -1 ? (translatedTextArray[mappedIdx] ?? '') : ''
            return {
              id: seg.id,
              translatedText
            }
          })

          totalTranslatedSegments = totalTranslatedSegments.concat(translatedSegments)

          // Persist incrementally
          if (persist) {
            transcripts[params.transcriptId].segments = transcript.segments.map((seg) => {
              const translatedMatch = totalTranslatedSegments.find((t) => t.id === seg.id)
              return {
                ...seg,
                translatedText: translatedMatch
                  ? translatedMatch.translatedText
                  : seg.translatedText
              }
            })
            transcripts[params.transcriptId].targetLanguage = params.targetLang
            store.set('transcripts', transcripts)
          }

          // Emit progress
          event.sender.send('translate:progress', {
            success: true,
            translatedSegments,
            progress: {
              current: Math.min(i + batchSize, transcript.segments.length),
              total: transcript.segments.length
            }
          })
        }

        return { success: true, translatedSegments: totalTranslatedSegments }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  ipcMain.handle(
    'translate:segment',
    async (_event, params: DeepLTranslateParams): Promise<TranslateResult> => {
      try {
        const settings = store.get('settings')
        if (!settings.deeplApiKey) {
          return { success: false, error: 'DeepL API 키가 설정되지 않았습니다.' }
        }

        const transcript = resolveTranscript(params)
        if (!transcript) return { success: false, error: 'Transcript not found' }

        const segment = transcript.segments.find((s) => s.id === params.segmentId)
        if (!segment) return { success: false, error: 'Segment not found' }

        const translatedArray = await callDeepL(
          segment.text,
          params.targetLang,
          settings.deeplApiKey,
          settings.deeplApiType
        )
        const translated = translatedArray[0]

        // Persist only if in store
        const transcripts = store.get('transcripts')
        if (transcripts[params.transcriptId]) {
          const seg = transcripts[params.transcriptId].segments.find(
            (s) => s.id === params.segmentId
          )
          if (seg) {
            seg.translatedText = translated
            transcripts[params.transcriptId].targetLanguage = params.targetLang
            store.set('transcripts', transcripts)
          }
        }

        return {
          success: true,
          translatedSegments: [{ id: segment.id, translatedText: translated }]
        }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )
}
