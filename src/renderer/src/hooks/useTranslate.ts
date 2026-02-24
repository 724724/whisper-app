import { useCallback, useState } from 'react'
import { useTranscriptStore } from '../store/transcriptStore'
import { useSettingsStore } from '../store/settingsStore'

export function useTranslate() {
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { transcript, updateSegmentTranslation, setTranscript } = useTranscriptStore()
  const settings = useSettingsStore((s) => s.settings)

  const translateFull = useCallback(async () => {
    if (!transcript) return
    setIsTranslating(true)
    setError(null)
    try {
      const result = await window.api.translateFull({
        transcriptId: transcript.id,
        targetLang: settings.outputLanguage,
        segments: transcript.segments, // fallback if transcript not yet in store
      })
      if (!result.success) {
        setError(result.error ?? '번역 실패')
        return
      }
      // Apply translations to store
      result.translatedSegments?.forEach(({ id, translatedText }) => {
        updateSegmentTranslation(id, translatedText)
      })
      setTranscript({ ...transcript, targetLanguage: settings.outputLanguage })
    } finally {
      setIsTranslating(false)
    }
  }, [transcript, settings.outputLanguage, updateSegmentTranslation, setTranscript])

  const translateSegment = useCallback(
    async (segmentId: string) => {
      if (!transcript) return
      setError(null)
      try {
        const result = await window.api.translateSegment({
          transcriptId: transcript.id,
          segmentId,
          targetLang: settings.outputLanguage,
          segments: transcript.segments, // fallback if transcript not yet in store
        })
        if (!result.success) {
          setError(result.error ?? '번역 실패')
          return
        }
        result.translatedSegments?.forEach(({ id, translatedText }) => {
          updateSegmentTranslation(id, translatedText)
        })
      } catch (err) {
        setError((err as Error).message)
      }
    },
    [transcript, settings.outputLanguage, updateSegmentTranslation]
  )

  return { isTranslating, error, translateFull, translateSegment }
}
